
const mongoose = require('mongoose');

const BillingRuleSchema = new mongoose.Schema({
  insurers: {
    type: [String], // Array of strings to handle multiple insurers per rule
    required: true,
    index: true // Indexed for fast lookups by insurer name
  },
  testName: {
    type: String,
    required: true,
    index: 'text' // Text index for reverse search functionality
  },
  cpt: {
    type: String,
    required: true
  },
  billToClient: {
    type: Boolean,
    default: true,
    description: "If true, this combination is permitted for Client Billing"
  },
  notes: {
    type: String,
    description: "Internal notes, e.g. 'Requires QW modifier'"
  }
}, { timestamps: true });

// Compound index just in case we need to verify a specific combo quickly
BillingRuleSchema.index({ insurers: 1, cpt: 1 });

module.exports = mongoose.model('BillingRule', BillingRuleSchema);
