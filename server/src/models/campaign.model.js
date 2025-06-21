const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String },
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

CampaignSchema.pre("findOneAndDelete", async function (next) {
  try {
    const campaignId = this.getQuery()._id;

    await mongoose.model("EmailStatus").deleteMany({ campaignRef: campaignId });
    await mongoose.model("EmailReply").deleteMany({ campaignRef: campaignId });

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Campaign", CampaignSchema);
