const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      trim: true,
    },
    last_name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    company_desc: {
      type: String,
      trim: true,
    },
    founder_name: {
      type: String,
      trim: true,
    },
    founded_year: {
      type: Number,
    },
    industry: {
      type: String,
      trim: true,
    },
    employees: {
      type: Number,
    },
    position: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalcode: {
      type: Number,
    },
    revenue: {
      type: Number,
    },
    investment_ask: {
      type: Number,
    },
    fund_stage: {
      type: String,
      trim: true,
    },
    archive: {
      type: Boolean,
      default: false,
    },
    campaign_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Campaign",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
