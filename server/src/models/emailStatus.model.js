const mongoose = require("mongoose");

const EmailStatusSchema = new mongoose.Schema(
  {
    campaignRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    sender: String,
    subject: String,
    recipientEmails: [
      {
        email: String,
        messageId: String,
        status: {
          type: String,
          enum: ["sent", "failed"],
          default: "sent",
        },
        delivered: { type: Boolean, default: false },
        opened: { type: Boolean, default: false },
        openedAt: Date,
      },
    ],
    contentHtml: String,
    sentAt: { type: Date, default: Date.now },
    sentCount: Number,
    openedCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    bouncedCount: { type: Number, default: 0 },
    complainedCount: { type: Number, default: 0 },
    repliedCount: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["regular", "ai", "followUp"],
      default: "regular",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailStatus", EmailStatusSchema);
