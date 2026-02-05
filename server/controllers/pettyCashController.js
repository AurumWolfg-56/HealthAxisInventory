
const PettyCashTransaction = require('../models/PettyCashTransaction');

// Get current balance and full history
exports.getHistory = async (req, res) => {
  try {
    const transactions = await PettyCashTransaction.find()
      .sort({ timestamp: -1 })
      .populate('user', 'username email'); // POPULATE: Get name/initials source

    // Calculate current balance from the latest transaction (or 0 if none)
    const currentBalance = transactions.length > 0 ? transactions[0].runningBalance : 0;

    res.status(200).json({
      success: true,
      balance: currentBalance,
      history: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add a new transaction
exports.addTransaction = async (req, res) => {
  try {
    const { userId, amount, action, reason } = req.body;

    // 1. Get the last transaction to find previous balance
    const lastTransaction = await PettyCashTransaction.findOne().sort({ timestamp: -1 });
    const previousBalance = lastTransaction ? lastTransaction.runningBalance : 0;

    // 2. Calculate new balance
    let newBalance = previousBalance;
    const numericAmount = parseFloat(amount);

    if (action === 'DEPOSIT') {
      newBalance += numericAmount;
    } else if (action === 'WITHDRAWAL') {
      if (previousBalance < numericAmount) {
        return res.status(400).json({ success: false, error: "Insufficient funds in Petty Cash" });
      }
      newBalance -= numericAmount;
    } else {
      return res.status(400).json({ success: false, error: "Invalid action type" });
    }

    // 3. Create the Transaction Record
    const transaction = new PettyCashTransaction({
      user: userId,
      amount: numericAmount,
      action,
      reason,
      runningBalance: newBalance
    });

    await transaction.save();

    // 4. Return populated result
    await transaction.populate('user', 'username');

    res.status(201).json({
      success: true,
      data: transaction,
      newBalance
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
