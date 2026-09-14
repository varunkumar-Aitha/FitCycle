const mongoose = require('mongoose');

const foodEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  foodName: {
    type: String,
    required: [true, 'Food name is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity must be positive']
  },
  unit: {
    type: String,
    default: 'g'
  },
  calories: {
    type: Number,
    required: true,
    min: [0, 'Calories must be positive']
  },
  protein: {
    type: Number,
    default: 0,
    min: 0
  },
  carbs: {
    type: Number,
    default: 0,
    min: 0
  },
  fat: {
    type: Number,
    default: 0,
    min: 0
  },
  mealType: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    required: true
  }
}, { timestamps: true });

foodEntrySchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('FoodEntry', foodEntrySchema);
