const mongoose = require('mongoose');

const waterEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  amountMl: {
    type: Number,
    required: true,
    min: [1, 'Amount must be positive']
  }
}, { timestamps: true });

waterEntrySchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('WaterEntry', waterEntrySchema);
