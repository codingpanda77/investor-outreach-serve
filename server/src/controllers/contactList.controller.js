const { default: mongoose } = require("mongoose");
const ContactList = require("../models/contactList.modal");

exports.createContactList = async (req, res) => {
  try {
    const { listName, emails, companyId } = req.body;

    if (!listName || typeof listName !== "string") {
      return res.status(400).json({
        success: false,
        message: "listName is required and must be a string",
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "emails must be a non-empty array",
      });
    }

    if (companyId && !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
    }

    // console.log(listName, emails);

    const contactList = await ContactList.create({
      listName,
      emails,
      company: companyId || undefined, // Only assign if present
    });

    res.status(201).json({
      success: true,
      message: "Contact list created successfully",
      // id: contactList._id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create contact list",
      error: error.message,
    });
  }
};

exports.getAllContactLists = async (req, res) => {
  try {
    const lists = await ContactList.find().populate("company", "company_name");
    res.status(200).json({
      success: true,
      data: lists,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact lists",
      error: error.message,
    });
  }
};

exports.getContactListsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required in the URL",
      });
    }

    const contactLists = await ContactList.find({ company: companyId });

    res.status(200).json({
      success: true,
      data: contactLists,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact lists for company",
      error: error.message,
    });
  }
};

exports.deleteContactList = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact list ID",
      });
    }

    const deleted = await ContactList.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact list not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact list deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete contact list",
      error: error.message,
    });
  }
};
