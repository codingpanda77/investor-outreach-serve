const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  investor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    required: [true, 'Investor reference is required']
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company reference is required']
  }
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
