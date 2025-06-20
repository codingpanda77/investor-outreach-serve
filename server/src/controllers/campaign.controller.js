const Campaign = require("../models/campaign.model");

exports.createCampaign = async (req, res) => {
  try {
    const { name, type, company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({ message: "company_id are required." });
    }

    const newCampaign = await Campaign.create({
      name,
      type: type || "regular",
      company_id,
    });

    res
      .status(201)
      .json({ message: "Campaign created", campaign: newCampaign });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({ message: "Failed to create campaign" });
  }
};
