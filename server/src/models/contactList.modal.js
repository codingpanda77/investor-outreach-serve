const mongoose = require("mongoose");

const ContactListSchema = new mongoose.Schema({
  listName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  emails: {
    type: [String],
    required: true,
    validate: [(arr) => arr.length > 0, "Email list cannot be empty"],
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ContactList", ContactListSchema);
