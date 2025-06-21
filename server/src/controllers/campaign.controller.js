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

    res.status(201).json({
      message: "Campaign created",
      success: true,
      campaign: newCampaign,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({ message: "Failed to create campaign" });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 10, company_id } = req.query;

    const filter = {};
    if (company_id) {
      filter.company_id = company_id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("company_id", "company_name email"),
      Campaign.countDocuments(filter),
    ]);

    const formattedCampaigns = campaigns.map((campaign) => {
      const company = campaign.company_id || {};
      return {
        _id: campaign._id,
        name: campaign.name,
        totalEmailsSent: campaign.totalEmailsSent || 0,
        totalReplies: campaign.totalReplies || 0,
        createdAt: campaign.createdAt || 0,
        companyName: company.company_name || "",
        companyEmail: company.email || "",
      };
    });

    res.status(200).json({
      success: true,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      campaigns: formattedCampaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};

exports.getCampaignReport = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId)
      .populate("company_id", "company_name email") // Only select needed fields
      .lean();

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const company = campaign.company_id || {};
    const { company_name: companyName, email: companyEmail } = company;

    delete campaign.company_id;

    res.json({
      ...campaign,
      companyName,
      companyEmail,
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};

exports.getPublicCampaignReport = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId)
      .populate("company_id", "company_name email") // Only select needed fields
      .lean();

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const company = campaign.company_id || {};
    const report = {
      _id: campaign._id,
      name: campaign.name,
      totalEmailsSent: campaign.totalEmailsSent || 0,
      totalReplies: campaign.totalReplies || 0,
      companyName: company.company_name || "",
      companyEmail: company.email || "",
    };

    res.json(report);
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Failed to get campaign report" });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ message: "Campaign ID is required." });
    }

    const deleted = await Campaign.findByIdAndDelete(campaignId);

    if (!deleted) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    res.status(200).json({
      message: "Campaign deleted",
      success: true,
      campaign: deleted,
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    res.status(500).json({ message: "Failed to delete campaign" });
  }
};
