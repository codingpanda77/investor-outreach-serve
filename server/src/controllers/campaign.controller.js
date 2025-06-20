const Campaign = require("../models/campaign.model");

exports.createCampaign = async (req, res) => {
  try {
    const { name, company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({ message: "company_id are required." });
    }

    const newCampaign = await Campaign.create({
      name,
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

exports.getCampaignReport = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found" });

    res.json({
      campaign,
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};
