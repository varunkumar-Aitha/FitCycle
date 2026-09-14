const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  setNumber: { type: Number, required: true },
  weight: { type: Number, default: 0 },
  reps: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  notes: { type: String, default: '' }
}, { _id: false });

const sessionExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: false   // allow null if exercise was deleted/re-seeded
  },
  exerciseName: { type: String, required: true },
  muscleGroup: { type: String },
  targetArea: { type: String },
  videoUrl: { type: String, default: null },
  sets: [setSchema],
  notes: { type: String, default: '' },
  completed: { type: Boolean, default: false }
});

const workoutSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workoutType: {
    type: String,
    required: true,
    enum: ['Chest + Triceps', 'Back + Biceps', 'Legs + Shoulders', 'Arms + Abs', 'Chest + Triceps + Lower Back']
  },
  dayNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number, default: 0 }, // minutes
  exercises: [sessionExerciseSchema],
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'missed', 'skipped'],
    default: 'scheduled'
  },
  muscleGroupsFocus: [{ type: String }]
}, { timestamps: true });

// Index for efficient queries
workoutSessionSchema.index({ userId: 1, date: -1 });
workoutSessionSchema.index({ userId: 1, weekNumber: 1, dayNumber: 1 });
// Index for status-filtered queries (completeWorkout guard, gamemap, dashboard)
workoutSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
