const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const nutritionChatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now }
});

nutritionChatHistorySchema.index({ userId: 1 });

module.exports = mongoose.model('NutritionChatHistory', nutritionChatHistorySchema);
