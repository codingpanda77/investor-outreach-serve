const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { v4: uuidv4 } = require("uuid");
const sesClient = require("../config/sesClient.config");
const EmailCampaign = require("../models/emailCampaign.model");
const EmailStatus = require("../models/emailStatus.model");

// 1. Create a new campaign
exports.createCampaign = async (req, res) => {
  try {
    const {
      campaignId,
      subject,
      from,
      content,
      recipients,
      templateId,
      utmParams,
    } = req.body;

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ message: "Recipients list is empty." });
    }

    const campaign = await EmailCampaign.create({
      campaignId,
      subject,
      from,
      content,
      templateId,
      utmParams,
      sentAt: new Date(),
      totalRecipients: recipients.length,
    });

    const emailStatusDocs = recipients.map(({ email, messageId }) => ({
      email,
      messageId,
      campaignId: campaign._id,
    }));

    await EmailStatus.insertMany(emailStatusDocs);
    return res.status(201).json({ message: "Campaign created", campaign });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({ message: "Failed to create campaign" });
  }
};

// 2. Update delivery/bounce/complaint status
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;

    const emailStatus = await EmailStatus.findOneAndUpdate(
      { messageId },
      {
        status,
        deliveryAt: new Date(),
      },
      { new: true }
    );

    if (emailStatus) {
      const fieldMap = {
        DELIVERED: "stats.delivered",
        BOUNCED: "stats.bounced",
        COMPLAINED: "stats.complained",
      };

      const field = fieldMap[status];
      if (field) {
        await EmailCampaign.findByIdAndUpdate(emailStatus.campaignId, {
          $inc: { [field]: 1 },
        });
      }
    }

    res.status(200).json({ message: "Status updated" });
  } catch (err) {
    console.error("Error updating delivery status:", err);
    res.status(500).json({ message: "Failed to update delivery status" });
  }
};

// 3. Track email open via pixel
exports.trackOpen = async (req, res) => {
  try {
    const { messageId } = req.query;

    const emailStatus = await EmailStatus.findOneAndUpdate(
      { messageId, opened: false },
      { opened: true, openedAt: new Date() },
      { new: true }
    );

    if (emailStatus) {
      await EmailCampaign.findByIdAndUpdate(emailStatus.campaignId, {
        $inc: { "stats.opened": 1 },
      });
    }

    const transparent1x1PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
      "base64"
    );

    res.setHeader("Content-Type", "image/png");
    res.send(transparent1x1PNG);
  } catch (err) {
    console.error("Error tracking open:", err);
    res.status(500).end();
  }
};

// 4. Store reply from user
exports.storeReply = async (req, res) => {
  try {
    const { messageId, subject, body } = req.body;

    const emailStatus = await EmailStatus.findOneAndUpdate(
      { messageId },
      {
        replied: true,
        replyAt: new Date(),
        replySubject: subject,
        replyBody: body,
      },
      { new: true }
    );

    if (emailStatus) {
      await EmailCampaign.findByIdAndUpdate(emailStatus.campaignId, {
        $inc: { "stats.replied": 1 },
      });
    }

    res.status(200).json({ message: "Reply stored" });
  } catch (err) {
    console.error("Error storing reply:", err);
    res.status(500).json({ message: "Error storing reply" });
  }
};

// 5. Get campaign report
exports.getCampaignReport = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await EmailCampaign.findOne({ campaignId });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json({
      campaignId: campaign.campaignId,
      subject: campaign.subject,
      sentAt: campaign.sentAt,
      stats: campaign.stats,
      totalRecipients: campaign.totalRecipients,
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};

exports.sendEmail = async (req, res) => {
  const { campaignId, content, recipients, sender, subject } = req.body;

  if (!campaignId || !content?.html || !recipients || !subject) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // const recipientEmails = await fetchInvestorEmails(recipients);
    const recipientEmails = recipients;
    if (recipientEmails.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid recipient emails found" });
    }

    const baseUrl =
      process.env.BASE_URL || "https://email-sender-server-rho.vercel.app";

    const throttleLimit = 10; // SES sandbox = 14/sec. For prod, increase.
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const results = [];

    const sendEmailToRecipient = async (recipient) => {
      try {
        const trackingId = uuidv4();

        const trackingPixel = `<img src="${baseUrl}/track-open?id=${trackingId}" width="1" height="1" style="display:none;" />`;
        const emailContent = `${content.html}${trackingPixel}`;

        const params = {
          Source: sender,
          Destination: {
            ToAddresses: [recipient],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: emailContent },
            },
          },
          Tags: [
            { Name: "campaignId", Value: campaignId },
            { Name: "recipient", Value: recipient },
          ],
          ReplyToAddresses: ["replies@blackleoventure.com"],
        };

        const command = new SendEmailCommand(params);
        const response = await sesClient.send(command);

        await storeSentEmailMetadata({
          campaignId,
          sender,
          recipientEmails: [recipient],
          subject,
          sentAt: new Date().toISOString(),
          messageId: response.MessageId,
          trackingId,
        });

        results.push({
          recipient,
          status: "sent",
          messageId: response.MessageId,
        });
      } catch (error) {
        console.error(`Error sending email to ${recipient}:`, error.message);
        results.push({ recipient, status: "failed", error: error.message });
      }
    };

    for (let i = 0; i < recipientEmails.length; i += throttleLimit) {
      const batch = recipientEmails.slice(i, i + throttleLimit);
      await Promise.all(batch.map(sendEmailToRecipient));
      await delay(1000); // throttle delay: 1 sec
    }

    res.status(200).json({
      message: "Campaign processed",
      campaignId,
      results,
    });
  } catch (error) {
    console.error("Fatal error during campaign send:", error.message);
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};

const fetchInvestorEmails = require("../utils/fetchInvestorEmails");
const storeSentEmailMetadata = require("../utils/storeSentEmailMetadata");

app.post("/send-email", async (req, res) => {
  const { campaignId, content, recipients, sender, subject } = req.body;

  if (!campaignId || !content?.html || !recipients || !subject) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // const recipientEmails = await fetchInvestorEmails(recipients);
    const recipientEmails = recipients;
    if (recipientEmails.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid recipient emails found" });
    }

    const baseUrl =
      process.env.BASE_URL || "https://email-sender-server-rho.vercel.app";

    const throttleLimit = 10; // SES sandbox = 14/sec. For prod, increase.
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const results = [];

    const sendEmailToRecipient = async (recipient) => {
      try {
        const trackingId = uuidv4();

        const trackingPixel = `<img src="${baseUrl}/track-open?id=${trackingId}" width="1" height="1" style="display:none;" />`;
        const emailContent = `${content.html}${trackingPixel}`;

        const params = {
          Source: sender,
          Destination: {
            ToAddresses: [recipient],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: emailContent },
            },
          },
          Tags: [
            { Name: "campaignId", Value: campaignId },
            { Name: "recipient", Value: recipient },
          ],
          ReplyToAddresses: ["replies@blackleoventure.com"],
        };

        const command = new SendEmailCommand(params);
        const response = await sesClient.send(command);

        await storeSentEmailMetadata({
          campaignId,
          sender,
          recipientEmails: [recipient],
          subject,
          sentAt: new Date().toISOString(),
          messageId: response.MessageId,
          trackingId,
        });

        results.push({
          recipient,
          status: "sent",
          messageId: response.MessageId,
        });
      } catch (error) {
        console.error(`Error sending email to ${recipient}:`, error.message);
        results.push({ recipient, status: "failed", error: error.message });
      }
    };

    for (let i = 0; i < recipientEmails.length; i += throttleLimit) {
      const batch = recipientEmails.slice(i, i + throttleLimit);
      await Promise.all(batch.map(sendEmailToRecipient));
      await delay(1000); // throttle delay: 1 sec
    }

    res.status(200).json({
      message: "Campaign processed",
      campaignId,
      results,
    });
  } catch (error) {
    console.error("Fatal error during campaign send:", error.message);
    res.status(500).json({ message: "Internal error", error: error.message });
  }
});
