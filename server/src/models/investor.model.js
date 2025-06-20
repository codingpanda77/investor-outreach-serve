const mongoose = require("mongoose");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const investorSchema = new mongoose.Schema(
  {
    investor_name: {
      type: String,
      required: true,
      trim: true,
    },
    fund_type: {
      type: String,
      required: true,
      trim: true,
    },
    fund_stage: {
      type: [String],
      required: true,
      default: [],
    },
    website: {
      type: String,
      required: true,
      trim: true,
    },
    sector_focus: {
      type: [String],
      required: true,
      default: [],
    },
    partner_name: {
      type: String,
      required: true,
      trim: true,
    },
    partner_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      trim: true,
    },
    founded_year: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear(),
    },
    portfolio_companies: {
      type: [String],
      required: true,
      default: [],
    },
    location: {
      type: String,
      trim: true,
    },
    twitter_link: {
      type: String,
      trim: true,
    },
    linkedIn_link: {
      type: String,
      trim: true,
    },
    facebook_link: {
      type: String,
      trim: true,
    },
    number_of_investments: {
      type: Number,
      default: 0,
    },
    number_of_exits: {
      type: Number,
      default: 0,
    },
    fund_description: {
      type: String,
      trim: true,
    },
    list_id: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

investorSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("Investor", investorSchema);
