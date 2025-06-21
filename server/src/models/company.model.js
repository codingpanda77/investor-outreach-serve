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
  },
  { timestamps: true }
);

companySchema.pre("findOneAndDelete", async function (next) {
  try {
    const companyId = this.getQuery()._id;

    const campaigns = await mongoose
      .model("Campaign")
      .find({ company_id: companyId });

    for (const campaign of campaigns) {
      await mongoose.model("Campaign").findOneAndDelete({ _id: campaign._id });
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Company", companySchema);
