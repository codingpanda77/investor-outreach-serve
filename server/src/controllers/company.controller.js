const Company = require("../models/company.model");
const {
  VerifyEmailIdentityCommand,
  GetIdentityVerificationAttributesCommand,
} = require("@aws-sdk/client-ses");
const { sesClient } = require("../config/aws.config");

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

    const deletedClient = await Company.findOneAndDelete({ _id: id });

    if (!deletedClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyClientEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const client = await Company.findOne({ email });
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (client.email_verified) {
      return res.status(200).json({
        email,
        alreadyVerified: true,
        message: `${email} is already verified in the system.`,
      });
    }

    const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
    await sesClient.send(command);

    res.status(200).json({
      email,
      success: true,
      message: `Verification email sent successfully to ${email}`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send verification email",
      error: error.message,
    });
  }
};

exports.updateClientEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const command = new GetIdentityVerificationAttributesCommand({
      Identities: [email],
    });

    const response = await sesClient.send(command);
    const status = response.VerificationAttributes?.[email]?.VerificationStatus;

    if (!status) {
      return res
        .status(404)
        .json({ message: "Email not found in SES identities" });
    }

    const isVerified = status === "Success";

    const updatedClient = await Company.findOneAndUpdate(
      { email },
      { email_verified: isVerified },
      { new: true }
    );

    if (!updatedClient) {
      return res.status(404).json({ message: "Client not found in database" });
    }

    res.status(200).json({
      email,
      verified: isVerified,
      success: true,
      message: `Email verification status updated to "${status}"`,
    });
  } catch (error) {
    console.error("Error updating verification status:", error);
    res.status(500).json({
      message: "Failed to update verification status",
      error: error.message,
    });
  }
};
