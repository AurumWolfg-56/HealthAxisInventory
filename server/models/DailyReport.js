
const mongoose = require('mongoose');

const DailyReportSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  user: {
    type: String,
    required: true
  },
  financials: {
    methods: {
      cash: { type: Number, default: 0 },
      credit: { type: Number, default: 0 },
      check: { type: Number, default: 0 }
    },
    types: {
      billPay: { type: Number, default: 0 },
      copay: { type: Number, default: 0 },
      selfPay: { type: Number, default: 0 }
    }
  },
  insurances: {
    medicaid: { type: Number, default: 0 },
    bcbs_il: { type: Number, default: 0 },
    meridian: { type: Number, default: 0 },
    commercial: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    workersComp: { type: Number, default: 0 },
    selfPay: { type: Number, default: 0 }
  },
  operational: {
    nurseVisits: { type: Number, default: 0 },
    providerVisits: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  stats: {
    newPts: { type: Number, default: 0 },
    estPts: { type: Number, default: 0 },
    xrays: { type: Number, default: 0 }
  },
  notes: { type: String },
  isBalanced: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('DailyReport', DailyReportSchema);
