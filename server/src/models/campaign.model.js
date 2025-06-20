const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
  {
    // campaignId: { type: String, required: true, unique: true },
    name: { type: String },
    // subject: { type: String },
    // from: { type: String, required: true },
    // content: {
    //   html: { type: String },
    //   text: { type: String },
    // },
    // type: {
    //   type: String,
    //   enum: ["regular", "ai", "followUp"],
    //   default: "regular",
    // },
    // templateId: { type: String }, // if using SES template
    // utmParams: { type: mongoose.Schema.Types.Mixed }, // optional UTM tracking

    // sentAt: { type: Date },
    // totalRecipients: { type: Number, default: 0 },

    // stats: {
    //   delivered: { type: Number, default: 0 },
    //   bounced: { type: Number, default: 0 },
    //   opened: { type: Number, default: 0 },
    //   replied: { type: Number, default: 0 },
    //   complained: { type: Number, default: 0 },
    // },
    totalEmailsSent: { type: Number, default: 0 },
    totalEmailsOpened: { type: Number, default: 0 },
    totalDelivered: { type: Number, default: 0 },
    totalBounced: { type: Number, default: 0 },
    totalComplained: { type: Number, default: 0 },

    totalReplies: { type: Number, default: 0 },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", CampaignSchema);
