
const mongoose = require('mongoose');

const PettyCashTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  action: {
    type: String,
    enum: ['DEPOSIT', 'WITHDRAWAL'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  runningBalance: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for quick history lookup
PettyCashTransactionSchema.index({ timestamp: -1 });

module.exports = mongoose.model('PettyCashTransaction', PettyCashTransactionSchema);
