const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true
  },
  muscleGroup: {
    type: String,
    required: true,
    enum: ['Chest', 'Triceps', 'Back', 'Biceps', 'Legs', 'Shoulders', 'Abs', 'Arms', 'Lower Back', 'Forearms', 'Cardio']
  },
  targetArea: {
    type: String,
    required: true
  },
  equipment: {
    type: String,
    enum: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'EZ Bar', 'Plate', 'None'],
    default: 'Barbell'
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  instructions: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: null
  },
  defaultSets: {
    type: Number,
    default: 3
  },
  defaultReps: {
    type: String,
    default: '8-12'
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Index for muscle group filtering (used by suggestions + exercise search)
exerciseSchema.index({ muscleGroup: 1, isCustom: 1 });
exerciseSchema.index({ name: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);
