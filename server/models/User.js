const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const achievementSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: '🏆' },
  unlockedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  calorieGoal: {
    type: Number,
    default: 2200
  },
  proteinGoal: {
    type: Number,
    default: 120
  },
  waterGoal: {
    type: Number,
    default: 3000 // ml
  },
  planStartDate: {
    type: Date,
    default: Date.now
  },
  // Gamification fields
  xp: { type: Number, default: 0 },
  workoutXP: { type: Number, default: 0 },   // XP earned from workouts
  nutritionXP: { type: Number, default: 0 }, // XP earned from food logging
  waterXP: { type: Number, default: 0 },     // XP earned from water logging
  fitnessLevel: { type: Number, default: 1 },
  totalWorkouts: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastWorkoutDate: { type: Date, default: null },
  totalSetsCompleted: { type: Number, default: 0 },
  totalExercisesCompleted: { type: Number, default: 0 },
  achievements: [achievementSchema],
  // Water reminder
  waterReminderEnabled: { type: Boolean, default: false },
  waterReminderHours: {
    type: [Number],
    default: [8, 10, 12, 14, 16, 18, 20, 22]   // every 2 hrs 8am–10pm
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Index for hourly water reminder scheduler query
userSchema.index({ waterReminderEnabled: 1, waterReminderHours: 1 });

module.exports = mongoose.model('User', userSchema);
