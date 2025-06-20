const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { ConfirmSubscriptionCommand } = require("@aws-sdk/client-sns");
const { snsClient } = require("../config/aws.config");
const { sesClient } = require("../config/aws.config");
const { v4: uuidv4 } = require("uuid");
const EmailCampaign = require("../models/emailStatus.model");
const Campaign = require("../models/campaign.model");
const EmailReply = require("../models/emailReply.model");

// Send Emails
exports.sendEmail = async (req, res) => {
  const { campaignId, content, recipients, sender, subject, type } = req.body;

  if (!campaignId || !content?.html || !recipients || !subject) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found" });

    const baseUrl =
      process.env.BASE_URL || "https://email-sender-server-rho.vercel.app";
    const throttleLimit = 10;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const results = [];
    const recipientsData = [];

    const sendEmailToRecipient = async (recipient) => {
      try {
        const messageId = uuidv4();
        const trackingPixel = `<img src="${baseUrl}/email/track?messageId=${messageId}&email=${encodeURIComponent(
          recipient
        )}" width="1" height="1" style="display:none;" />`;
        const emailContent = `${content.html}${trackingPixel}`;

        const params = {
          Source: sender,
          Destination: { ToAddresses: [recipient] },
          Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: emailContent } },
          },
          Tags: [
            { Name: "campaignId", Value: campaignId },
            { Name: "recipient", Value: recipient },
          ],
          ReplyToAddresses: ["replies@blackleoventure.com"],
        };

        const command = new SendEmailCommand(params);
        await sesClient.send(command);

        recipientsData.push({
          email: recipient,
          messageId,
          status: "sent",
          delivered: false,
          opened: false,
        });

        results.push({ recipient, status: "sent", messageId });
      } catch (error) {
        recipientsData.push({
          email: recipient,
          messageId: uuidv4(),
          status: "failed",
          delivered: false,
          opened: false,
        });

        results.push({ recipient, status: "failed", error: error.message });
      }
    };

    for (let i = 0; i < recipients.length; i += throttleLimit) {
      const batch = recipients.slice(i, i + throttleLimit);
      await Promise.all(batch.map(sendEmailToRecipient));
      await delay(1000);
    }

    const emailCampaign = await EmailCampaign.create({
      campaignRef: campaignId,
      subject,
      sender,
      contentHtml: content.html,
      sentAt: new Date(),
      sentCount: recipientsData.length,
      recipientEmails: recipientsData,
      type: type || "regular",
    });

    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { totalEmailsSent: recipientsData.length },
    });

    res.status(201).json({
      message: "Emails sent and campaign stored",
      campaignId,
      emailCampaign,
      results,
    });
  } catch (error) {
    console.error("Fatal error during sendEmail:", error.message);
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};

// Track Email Open
exports.trackOpen = async (req, res) => {
  try {
    const { messageId, email } = req.query;
    if (!messageId || !email) {
      return res.status(400).json({ message: "Missing messageId or email" });
    }

    // Find the email campaign and check if already opened
    const campaign = await EmailCampaign.findOne({
      "recipientEmails.messageId": messageId,
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const recipient = campaign.recipientEmails.find(
      (r) => r.messageId === messageId
    );

    // If already opened, skip increment
    if (recipient?.opened) {
      const transparent1x1PNG = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
        "base64"
      );
      res.setHeader("Content-Type", "image/png");
      return res.send(transparent1x1PNG);
    }

    // Update the recipient opened status and campaign stats
    await EmailCampaign.updateOne(
      { "recipientEmails.messageId": messageId },
      {
        $set: {
          "recipientEmails.$.opened": true,
          "recipientEmails.$.openedAt": new Date(),
        },
        $inc: { openedCount: 1 },
      }
    );

    await Campaign.findByIdAndUpdate(campaign.campaignRef, {
      $inc: { totalEmailsOpened: 1 },
    });

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

// Update Delivery/Bounce/Complaint Status
exports.updateDeliveryStatus = async (req, res) => {
  try {
    // Accepts SES SNS-style payload for flexibility
    let message = req.body;

    // If SNS-style message structure, parse it
    if (req.body?.Message) {
      try {
        message = JSON.parse(req.body.Message || "{}");
      } catch (error) {
        console.error("Invalid SNS payload:", error);
        return res.status(400).json({ message: "Malformed SNS Message" });
      }
    }

    const eventType = message.eventType || req.body.status;
    const messageId = message.mail?.messageId || req.body.messageId;

    const fieldMap = {
      Bounce: "bouncedCount",
      Complaint: "complainedCount",
      Delivered: "deliveredCount",
    };

    const statField = fieldMap[eventType];

    if (!messageId || !statField) {
      return res.status(400).json({ message: "Missing or unsupported status" });
    }

    const campaignDoc = await EmailCampaign.findOne({
      "recipientEmails.messageId": messageId,
    });

    if (!campaignDoc) {
      return res.status(404).json({ message: "Email campaign not found" });
    }

    const index = campaignDoc.recipientEmails.findIndex(
      (r) => r.messageId === messageId
    );

    if (index === -1) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const update = {
      $inc: { [statField]: 1 },
      $set: {},
    };

    // Set individual recipient status flags
    if (eventType === "Delivered") {
      update.$set[`recipientEmails.${index}.delivered`] = true;
    } else if (eventType === "Bounce") {
      update.$set[`recipientEmails.${index}.status`] = "bounced";
    } else if (eventType === "Complaint") {
      update.$set[`recipientEmails.${index}.status`] = "complained";
    }

    await EmailCampaign.findByIdAndUpdate(campaignDoc._id, update);

    await Campaign.findByIdAndUpdate(campaignDoc.campaignRef, {
      $inc: {
        [`total${statField.charAt(0).toUpperCase() + statField.slice(1)}`]: 1,
      },
    });

    res.status(200).json({ message: `${eventType} status updated` });
  } catch (err) {
    console.error("Error in updateDeliveryStatus:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Store Email Reply
exports.storeReply = async (req, res) => {
  try {
    const body = req.body;

    // 1. Handle SNS SubscriptionConfirmation
    if (
      body.Type === "SubscriptionConfirmation" &&
      body.Token &&
      body.TopicArn
    ) {
      try {
        const command = new ConfirmSubscriptionCommand({
          TopicArn: body.TopicArn,
          Token: body.Token,
        });
        await snsClient.send(command);
        // console.log(
        //   `SNS subscription confirmed for TopicArn: ${body.TopicArn}`
        // );
        return res.status(200).send("SNS subscription confirmed successfully");
      } catch (error) {
        // console.error("❌ Error confirming SNS subscription:", error);
        return res.status(500).send("Failed to confirm SNS subscription");
      }
    }

    // 2. Parse SNS Message
    let message;
    try {
      message = JSON.parse(body.Message || "{}");
    } catch (error) {
      // console.error("❌ Error parsing SNS Message:", error);
      return res.sendStatus(400);
    }

    // 3. Only handle email "Received" events
    if (message.notificationType !== "Received") {
      // console.log(
      //   "ℹ️ Ignored SNS notification type:",
      //   message.notificationType
      // );
      return res.sendStatus(200);
    }

    const replyFrom = message.mail?.source;
    const subject = message.mail?.commonHeaders?.subject || "No Subject";
    const toAddress = message.mail?.destination?.[0];
    const timestamp = message.mail?.timestamp || new Date().toISOString();

    // 4. Try to find original messageId from headers
    const originalMessageId =
      message.mail?.commonHeaders?.["in-reply-to"] ||
      message.mail?.commonHeaders?.references?.split(" ")[0];

    if (!replyFrom || !toAddress || !originalMessageId) {
      console.log("❗ Missing replyFrom, toAddress, or messageId");
      return res.sendStatus(200);
    }

    // console.log(
    //   `📩 Reply from ${replyFrom} to ${toAddress}, ref: ${originalMessageId}`
    // );

    // 5. Find the matching EmailCampaign by original messageId
    const emailCampaign = await EmailCampaign.findOne({
      "recipientEmails.messageId": originalMessageId,
    });

    if (!emailCampaign) {
      // console.log(`⚠️ No campaign found for reply from ${replyFrom}`);
      return res.sendStatus(200);
    }

    // 6. Save reply in MongoDB
    const reply = await EmailReply.create({
      emailCampaignRef: emailCampaign._id,
      campaignRef: emailCampaign.campaignRef,
      from: replyFrom,
      to: toAddress,
      subject,
      body: message.content || "No body content",
      messageId: originalMessageId,
      timestamp,
    });

    // 7. Update stats
    await EmailCampaign.findByIdAndUpdate(emailCampaign._id, {
      $inc: { repliedCount: 1 },
    });

    await Campaign.findByIdAndUpdate(emailCampaign.campaignRef, {
      $inc: { totalReplies: 1 },
    });

    // console.log(
    //   `✅ Stored reply from ${replyFrom} for campaign ${emailCampaign._id}`
    // );
    res.sendStatus(200);
  } catch (error) {
    // console.error("❌ Error processing SES reply SNS:", error);
    res.sendStatus(500);
  }
};

// Get Campaign Report
exports.getCampaignReport = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found" });

    const emailCampaigns = await EmailCampaign.find({
      campaignRef: campaignId,
    }).lean();

    const replies = await EmailReply.find({ campaignRef: campaignId }).lean();

    res.json({
      campaign,
      emailCampaigns,
      totalReplies: replies.length,
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};

exports.getEmailCampaignReport = async (req, res) => {
  try {
    const { id } = req.params;

    const emailCampaign = await EmailCampaign.findById(id).lean();
    console.log(emailCampaign);
    if (!emailCampaign)
      return res.status(404).json({ message: "Campaign not found" });

    res.json({
      emailCampaign,
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};
