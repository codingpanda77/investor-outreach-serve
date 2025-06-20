const Company = require("../models/company.model");

exports.addClientData = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      companyName,
      industry,
      position,
      website,
      state,
      city,
      postalCode,
      companyDescription,
      investment,
      revenue,
      fundingStage,
      employees,
    } = req.body;

    const clientData = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      company_name: companyName,
      industry,
      position,
      website,
      state,
      city,
      postalcode: postalCode ? parseInt(postalCode) : undefined,
      company_desc: companyDescription,
      investment_ask: investment ? parseFloat(investment) : undefined,
      revenue: revenue ? parseFloat(revenue) : undefined,
      fund_stage: fundingStage,
      employees: employees ? parseInt(employees) : undefined,
    };

    const newClient = new Company(clientData);
    const savedClient = await newClient.save();

    res.status(201).json({
      id: savedClient._id,
      message: "Client added successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getClientData = async (req, res) => {
  try {
    const { email, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (email) {
      filter.email = email;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const clients = await Company.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Company.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      clients,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActiveClientData = async (req, res) => {
  try {
    const { email, page = 1, limit = 10 } = req.query;

    const filter = { archive: { $ne: true } }; // only active clients
    if (email) {
      filter.email = email;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const clients = await Company.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Company.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      clients,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateClientData = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      position,
      industry,
      employees,
      website,
      address,
      city,
      state,
      postalCode,
      revenue,
      investment,
      fundingStage,
      archive,
    } = req.body;

    const updatedClientData = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      company_name: companyName,
      position,
      industry,
      employees: employees ? parseInt(employees) : undefined,
      website,
      address,
      city,
      state,
      postalcode: postalCode ? parseInt(postalCode) : undefined,
      revenue: revenue ? parseFloat(revenue) : undefined,
      investment_ask: investment ? parseFloat(investment) : undefined,
      fund_stage: fundingStage,
    };

    if (typeof archive !== "undefined") {
      updatedClientData.archive = archive;
    }

    const updatedClient = await Company.findByIdAndUpdate(
      id,
      updatedClientData,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteClientData = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedClient = await Company.findByIdAndDelete(id);

    if (!deletedClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
