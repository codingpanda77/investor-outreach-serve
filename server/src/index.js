const express = require("express");
const multer = require("multer");
const admin = require("firebase-admin");
const cors = require("cors");
const dotenv = require("dotenv");
const Papa = require("papaparse");
const {
  SESClient,
  SendEmailCommand,
  VerifyEmailIdentityCommand,
} = require("@aws-sdk/client-ses");
const {
  SNSClient,
  ConfirmSubscriptionCommand,
} = require("@aws-sdk/client-sns");
const {
  bulkAddInvestors,
  uploadCSV,
  getAllInvestors,
  getPaginatedInvestors,
  getUniqueFilters,
  getUniqueFundSectors,
  getUniqueFundTypes,
  getFilterOptions,
  updateInvestor,
  deleteInvestor,
} = require("./controllers/investor.controller");
const connectDB = require("./config/database.config");
const {
  addClientData,
  getClientData,
  updateClientData,
  deleteClientData,
  getActiveClientData,
  verifyClientEmail,
  updateClientEmailVerification,
} = require("./controllers/company.controller");

// IMAP Configuration for Monitoring Replies

dotenv.config();

const app = express();
connectDB();

// Firebase credentials from environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin SDK only if it hasn’t been initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Middleware
// app.use(cors({ origin: "https://email-sender-platform.web.app" }));
app.use(
  cors({
    origin: ["http://localhost:5173", "https://email-sender-platform.web.app"],
  })
);
app.use(express.json());

// Configure multer to use /tmp directory (Vercel-compatible)
const upload = multer({ dest: "/tmp" });

// AWS SES Client
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const snsClient = new SNSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Helper function to find campaign by Message-ID
async function findCampaignByMessageId(messageId, replyFrom, campaignSender) {
  console.log(
    `Searching for campaign with Message-ID: ${messageId}, Reply-From: ${replyFrom}, Sender: ${campaignSender}`
  );
  if (messageId) {
    const snapshot = await db
      .collection("emailTracking")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      console.log(`Found campaign by Message-ID: ${snapshot.docs[0].id}`);
      return snapshot.docs[0].id;
    }
  }
  // Fallback: Match by sender and recipient
  const snapshot = await db
    .collection("emailTracking")
    .where("sender", "==", campaignSender)
    .where("recipientEmails", "array-contains", replyFrom)
    .limit(1)
    .get();
  if (!snapshot.empty) {
    console.log(`Found campaign by fallback: ${snapshot.docs[0].id}`);
    return snapshot.docs[0].id;
  }
  console.log("No campaign found");
  return null;
}

// async function fetchInvestorEmails(listId) {
//   if (!listId || listId === "No Recipients") return [];
//   const listIds = listId.split(",").map((id) => id.trim());
//   const emails = [];
//   const chunks = [];
//   for (let i = 0; i < listIds.length; i += 10) {
//     chunks.push(listIds.slice(i, i + 10));
//   }
//   try {
//     const investorsRef = db.collection("investors");
//     for (const chunk of chunks) {
//       const querySnapshot = await investorsRef
//         .where("listId", "in", chunk)
//         .get();
//       querySnapshot.forEach((doc) => {
//         const data = doc.data();
//         if (data["Partner Email"]) emails.push(data["Partner Email"]);
//       });
//     }
//     return emails;
//   } catch (error) {
//     console.error("Error fetching investor emails:", error);
//     return [];
//   }
// }

// Store email metadata in Firestore
async function storeSentEmailMetadata({
  campaignId,
  sender,
  recipientEmails,
  subject,
  sentAt,
  messageId,
}) {
  await db.collection("emailTracking").doc(campaignId).set(
    {
      sender,
      recipientEmails,
      subject,
      sentAt,
      messageId,
      sentCount: recipientEmails.length,
      openedCount: 0,
      bouncedCount: 0,
      spamCount: 0,
      unreadCount: recipientEmails.length,
      repliedCount: 0,
      repliedBy: [],
      replies: [],
      openedBy: [],
    },
    { merge: true }
  );
}

app.post("/clients", addClientData);

app.post("/campaign", async (req, res) => {
  try {
    const campaignData = { ...req.body, createdAt: new Date() };
    console.log(campaignData);
    // const campaignRef = db.collection("campaignLists").doc();
    // await campaignRef.set(campaignData);
    res
      .status(201)
      .json({ id: campaignRef.id, message: "Campaign added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/contact-lists", async (req, res) => {
  try {
    const { listName } = req.body;
    if (!listName || typeof listName !== "string") {
      return res.status(400).json({
        success: false,
        message: "listName is required and must be a string",
      });
    }
    const querySnapshot = await db
      .collection("contactLists")
      .where("listName", "==", listName)
      .get();
    if (!querySnapshot.empty) {
      return res.status(409).json({
        success: false,
        message: `A contact list with the name "${listName}" already exists`,
      });
    }
    const docRef = await db.collection("contactLists").add({
      listName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({
      success: true,
      message: "Contact list created successfully",
      id: docRef.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save contact list",
      error: error.message,
    });
  }
});

app.post("/campaign-contact-lists", async (req, res) => {
  try {
    const { listName, emails } = req.body;
    if (!listName || typeof listName !== "string") {
      return res.status(400).json({
        success: false,
        message: "listName is required and must be a string",
      });
    }
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "emails must be a non-empty array",
      });
    }
    const querySnapshot = await db
      .collection("contactLists")
      .where("listName", "==", listName)
      .get();
    if (!querySnapshot.empty) {
      return res.status(409).json({
        success: false,
        message: `A contact list with the name "${listName}" already exists`,
      });
    }
    const docRef = await db.collection("contactLists").add({
      listName,
      emails,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({
      success: true,
      message: "Contact list created successfully",
      id: docRef.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save contact list",
      error: error.message,
    });
  }
});

app.post("/investors", bulkAddInvestors);

app.post("/investors/upload-csv", upload.single("file"), uploadCSV);

app.get("/clients", getClientData);
app.get("/clients/active", getActiveClientData);

app.get("/campaign", async (req, res) => {
  try {
    let query = db.collection("campaignLists");

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const result = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/campaign/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("campaignLists").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/reports/campaign/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("campaignLists").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const campaignName = docSnap.data();

    const reportdocRef = db.collection("emailTracking").doc(id);
    const reportdocSnap = await reportdocRef.get();

    const reportData = reportdocSnap.data();

    res.json({
      campaignName: campaignName.campaignName,
      firmsContacted: reportData.sentCount || 0,
      creditsUsed: reportData.sendCount || 0,
      remindersSent: reportData.remindersSent || 0,
      peopleResponded: reportData.repliedCount || 0,
      responseRate:
        reportData.firmsContacted / reportData.peopleResponded || 0.0,
      totalCredits: 10000,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/contact-lists", async (req, res) => {
  try {
    const snapshot = await db.collection("contactLists").get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "No contact lists found",
      });
    }

    // Map documents to include ID and data
    const contactLists = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      data: contactLists,
    });
  } catch (error) {
    console.error("Error fetching contact lists:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact lists",
      error: error.message,
    });
  }
});

app.get("/investors", getAllInvestors);

app.get("/filters", getFilterOptions);
app.get("/list-sector", getUniqueFundSectors);
app.get("/list-type", getUniqueFundTypes);

app.get("/investors/matchmaking", getPaginatedInvestors);

app.get("/stats", async (req, res) => {
  try {
    // Fetch the total number of clients
    const clientsSnapshot = await db.collection("clients").get();
    const clientCount = clientsSnapshot.size;

    // Fetch the total number of investor lists
    const investorListsSnapshot = await db.collection("investors").get();
    const investorListCount = investorListsSnapshot.size;

    const contactListsSnapshot = await db.collection("contactLists").get();
    const contactListCount = contactListsSnapshot.size;

    res.json({
      clients: clientCount,
      investorLists: investorListCount,
      totalContacts: contactListCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoint to update an investor
app.put("/investors/:id", updateInvestor);

app.put("/clients/:id", updateClientData);

// DELETE API to remove a contact list and its related investor lists
app.delete("/contact-lists/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Contact list ID is required",
      });
    }

    // Reference to the contact list document
    const contactListRef = db.collection("contactLists").doc(id);

    // Check if the contact list exists
    const contactListDoc = await contactListRef.get();
    if (!contactListDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Contact list with ID ${id} not found`,
      });
    }

    // Start a batch for atomic deletion
    const batch = db.batch();

    // Delete the contact list
    batch.delete(contactListRef);

    // Delete all investor lists referencing this contact list
    const investorListsSnapshot = await db
      .collection("investors")
      .where("listRef", "==", contactListRef)
      .get();

    investorListsSnapshot.forEach((doc) => batch.delete(doc.ref));

    // Delete all investors associated with this contact list
    const investorsSnapshot = await db
      .collection("investors")
      .where("listId", "==", id)
      .get();

    investorsSnapshot.forEach((doc) => batch.delete(doc.ref));

    // Commit the batch operation
    await batch.commit();

    res.status(200).json({
      success: true,
      message: `Contact list ${id} deleted along with ${investorListsSnapshot.size} investor lists and ${investorsSnapshot.size} investors.`,
    });
  } catch (error) {
    console.error("Error deleting contact list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact list and related data",
      error: error.message,
    });
  }
});

app.delete("/clients/:id", deleteClientData);

// DELETE endpoint to remove an investor
app.delete("/investors/:id", deleteInvestor);

app.delete("/campaign/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("campaignLists").doc(id);

    // Check if document exists before deleting
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Delete the document
    await docRef.delete();

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete campaign",
      error: error.message,
    });
  }
});

// Send Email Endpoint
// app.post("/clients/verify-email", async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ message: "Email is required" });
//   }

//   try {
//     const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
//     await sesClient.send(command);

//     res.status(200).json({ message: `Verification email sent to ${email}` });
//   } catch (error) {
//     console.error("Error sending verification email:", error);
//     res.status(500).json({
//       message: "Failed to send verification email",
//       error: error.message,
//     });
//   }
// });

app.post("/clients/verify-email", verifyClientEmail);
app.post("/clients/get-verify-status", updateClientEmailVerification);

// Send Email Endpoint
app.post("/email/send", async (req, res) => {
  const { campaignId, content, recipients, sender, subject } = req.body;

  if (!campaignId || !content?.html || !recipients || !subject) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  console.log(campaignId, content, recipients, sender, subject);

  // const recipientEmails = await fetchInvestorEmails(recipients);
  const recipientEmails = recipients;

  if (recipientEmails.length === 0) {
    return res.status(400).json({ message: "No valid recipient emails found" });
  }

  // const baseUrl =
  //   process.env.BASE_URL || "https://email-sender-server-rho.vercel.app";
  // const results = [];

  try {
    // for (const recipient of recipientEmails) {
    //   const trackingPixel = `<img src="${baseUrl}/track-open?campaignId=${campaignId}&recipient=${encodeURIComponent(
    //     recipient
    //   )}" width="1" height="1" style="display:none;" />`;
    //   const emailContent = `${content.html}${trackingPixel}`;

    //   const params = {
    //     Source: sender,
    //     Destination: {
    //       ToAddresses: [recipient],
    //     },
    //     Message: {
    //       Subject: {
    //         Data: subject,
    //       },
    //       Body: {
    //         Html: {
    //           Data: emailContent,
    //         },
    //       },
    //     },
    //     Tags: [{ Name: "campaignId", Value: campaignId }],
    //     ReplyToAddresses: ["replies@blackleoventure.com"],
    //   };

    //   const command = new SendEmailCommand(params);
    //   const result = await sesClient.send(command);
    //   results.push(result);

    //   await storeSentEmailMetadata({
    //     campaignId,
    //     sender: sender,
    //     recipientEmails: [recipient],
    //     subject,
    //     sentAt: new Date().toISOString(),
    //     messageId: result.MessageId,
    //   });
    // }

    res.status(200).json({
      message: "Campaign emails sent successfully",
      campaignId,
      recipients: recipientEmails,
      results,
    });
  } catch (error) {
    console.error("Error sending campaign emails:", error);
    res.status(500).json({
      message: "Failed to send campaign emails",
      error: error.message,
    });
  }
});

app.post("/receive-email", async (req, res) => {
  try {
    const body = req.body;
    console.log(body);

    if (body.Type === "SubscriptionConfirmation") {
      const { SubscribeURL, Token, TopicArn } = body;
      console.log("SNS SubscriptionConfirmation received:", {
        SubscribeURL,
        TopicArn,
      });

      // Programmatically confirm subscription
      try {
        const command = new ConfirmSubscriptionCommand({
          TopicArn,
          Token,
        });
        await snsClient.send(command);
        console.log(`SNS subscription confirmed for TopicArn: ${TopicArn}`);
        res.status(200).send("SNS subscription confirmed successfully");
      } catch (error) {
        console.error("Error confirming SNS subscription:", error);
        res.status(500).send("Failed to confirm SNS subscription");
      }
      return;
    }

    let message;
    try {
      message = JSON.parse(body.Message || "{}");
    } catch (error) {
      console.error("Error parsing SNS message:", error);
      return res.sendStatus(400);
    }

    if (message.notificationType !== "Received") {
      console.log(
        "Ignoring non-email SNS notification:",
        message.notificationType
      );
      return res.sendStatus(200);
    }

    const replyFrom = message.mail?.source;
    const subject = message.mail?.commonHeaders?.subject || "No Subject";
    const toAddress = message.mail?.destination?.[0];
    const originalMessageId =
      message.mail?.commonHeaders?.["in-reply-to"] ||
      message.mail?.commonHeaders?.references?.split(" ")[0];

    if (!replyFrom || !toAddress) {
      console.log("Missing replyFrom or toAddress:", { replyFrom, toAddress });
      return res.sendStatus(200);
    }

    console.log(
      `Processing reply from ${replyFrom} to ${toAddress}, In-Reply-To: ${originalMessageId}`
    );

    const campaignId = await findCampaignByMessageId(
      originalMessageId,
      replyFrom,
      toAddress
    );
    if (!campaignId) {
      console.log(`No campaign found for reply from ${replyFrom}`);
      return res.sendStatus(200);
    }

    const campaignRef = db.collection("emailTracking").doc(campaignId);
    const replyRef = campaignRef.collection("replies").doc();

    try {
      const batch = db.batch();
      batch.set(replyRef, {
        from: replyFrom,
        subject,
        date: message.mail?.timestamp || new Date().toISOString(),
        body: message.content || "No body content",
      });
      batch.update(campaignRef, {
        repliedCount: admin.firestore.FieldValue.increment(1),
        repliedBy: admin.firestore.FieldValue.arrayUnion(replyFrom),
      });
      await batch.commit();
      console.log(`Stored reply from ${replyFrom} for campaign ${campaignId}`);
      res.sendStatus(200);
    } catch (error) {
      console.error(`Failed to store reply for campaign ${campaignId}:`, error);
      res.sendStatus(500);
    }
  } catch (error) {
    console.error("Error processing SNS notification:", error);
    res.sendStatus(500);
  }
});

app.put("/clients/add-credentials", async (req, res) => {
  const { clientId, imapPassword } = req.body;

  if (!clientId || !imapPassword) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await db.collection("clients").doc(clientId).set(
      {
        imapPassword,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    res.status(201).json({ message: "Client credentials added successfully" });
  } catch (error) {
    console.error("Error adding client credentials:", error);
    res.status(500).json({ error: error.message });
  }
});

// Track Email Opens
app.get("/track-open", async (req, res) => {
  const { campaignId, recipient } = req.query;

  if (!campaignId) {
    return res.status(400).json({ message: "campaignId is required" });
  }

  try {
    const emailDocRef = db.collection("emailTracking").doc(campaignId);
    const emailDoc = await emailDocRef.get();

    if (!emailDoc.exists) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const data = emailDoc.data();
    const openedBy = data.openedBy || [];

    if (recipient && !openedBy.includes(recipient)) {
      await emailDocRef.update({
        openedCount: admin.firestore.FieldValue.increment(1),
        unreadCount: admin.firestore.FieldValue.increment(-1),
        openedBy: admin.firestore.FieldValue.arrayUnion(recipient),
      });
    }

    res.set("Content-Type", "image/png");
    res.send(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
        "base64"
      )
    );
  } catch (error) {
    console.error("Error tracking email open:", error);
    res.sendStatus(500);
  }
});

// SNS Endpoint for Bounce/Spam Events
app.post("/sns-email-events", async (req, res) => {
  let message;
  try {
    message = JSON.parse(req.body.Message || "{}");
  } catch (error) {
    console.error("Error parsing SNS message:", error);
    return res.sendStatus(400);
  }

  const campaignId = message.mail?.tags?.campaignId?.[0];
  if (!campaignId) {
    console.warn("No campaignId found in SNS event");
    return res.sendStatus(200);
  }

  try {
    const campaignRef = db.collection("emailTracking").doc(campaignId);

    if (message.eventType === "Bounce") {
      await campaignRef.update({
        bouncedCount: admin.firestore.FieldValue.increment(1),
      });
      console.log(`Recorded bounce for campaign ${campaignId}`);
    } else if (message.eventType === "Complaint") {
      await campaignRef.update({
        spamCount: admin.firestore.FieldValue.increment(1),
      });
      console.log(`Recorded spam complaint for campaign ${campaignId}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing SNS event:", error);
    res.sendStatus(500);
  }
});

// GET Stats for a Single Campaign
app.get("/campaign/:campaignId/replied-emails", async (req, res) => {
  const { campaignId } = req.params;

  try {
    const doc = await db.collection("emailTracking").doc(campaignId).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const data = doc.data();
    const repliedEmails = data.repliedBy || [];

    res.status(200).json({
      campaignId,
      repliedEmails,
      totalReplied: repliedEmails.length,
    });
  } catch (error) {
    console.error("Error fetching replied emails:", error);
    res.status(500).json({
      message: "Failed to fetch replied emails",
      error: error.message,
    });
  }
});

// Existing Email Stats Endpoint (Updated for Completeness)
app.get("/email-stats/:campaignId", async (req, res) => {
  const { campaignId } = req.params;

  try {
    const doc = await db.collection("emailTracking").doc(campaignId).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Campaign stats not found" });
    }

    const data = doc.data();
    res.status(200).json({
      campaignId,
      sender: data.sender,
      subject: data.subject,
      sentAt: data.sentAt,
      messageId: data.messageId,
      stats: {
        sent: data.sentCount || 0,
        opened: data.openedCount || 0,
        bounced: data.bouncedCount || 0,
        spammed: data.spamCount || 0,
        unread: data.unreadCount || 0,
        replied: data.repliedCount || 0,
      },
      repliedBy: data.repliedBy || [],
      replies: data.replies || [],
    });
  } catch (error) {
    console.error("Error fetching email stats:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch stats", error: error.message });
  }
});

// New GET API to Retrieve All Email Stats
app.get("/email-stats", async (req, res) => {
  try {
    const snapshot = await db.collection("emailTracking").get();

    if (snapshot.empty) {
      return res.status(200).json({
        message: "No email campaigns found",
        totalCampaigns: 0,
        data: [],
      });
    }

    const campaigns = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        campaignId: doc.id,
        sender: data.sender,
        subject: data.subject,
        sentAt: data.sentAt,
        messageId: data.messageId, // Include original MessageId
        stats: {
          sent: data.sentCount || 0,
          opened: data.openedCount || 0,
          bounced: data.bouncedCount || 0,
          spammed: data.spamCount || 0,
          unread: data.unreadCount || 0,
          replied: data.repliedCount || 0,
        },
        repliedBy: data.repliedBy || [],
        replies: data.replies || [],
      };
    });

    res.status(200).json({
      message: "Successfully retrieved all email stats",
      totalCampaigns: campaigns.length,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching all email stats:", error);
    res.status(500).json({
      message: "Failed to fetch all email stats",
      error: error.message,
    });
  }
});

app.get("/campaign/:listId/investors", async (req, res) => {
  try {
    const { listId } = req.params;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "listId is required",
      });
    }

    // Query the investors collection for documents with matching listId
    const snapshot = await db
      .collection("investors")
      .where("listId", "==", listId)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        message: `No investors found for listId: ${listId}`,
        totalCount: 0,
        data: [],
      });
    }

    // Map documents to include ID and data
    const investors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      message: `Successfully retrieved investors for listId: ${listId}`,
      totalCount: investors.length,
      data: investors,
    });
  } catch (error) {
    console.error("Error fetching investors by listId:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investors",
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Welcome to the Email Campaign API!");
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running on port 5000");
});
