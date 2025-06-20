const mongoose = require("mongoose");

const EmailReplySchema = new mongoose.Schema(
  {
    emailCampaignRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailStatus",
      required: true,
    },
    campaignRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    from: String,
    to: [String],
    subject: String,
    body: String,
    messageId: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailReply", EmailReplySchema);
