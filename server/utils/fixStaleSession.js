require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const WorkoutSession = require('../models/WorkoutSession');
const connectDB = require('../config/db');

const fix = async () => {
  await connectDB();

  // Delete all in_progress sessions that have wrong/old exercises (no triceps)
  const stale = await WorkoutSession.find({ status: 'in_progress' }).lean();
  console.log(`Found ${stale.length} in_progress session(s)`);

  for (const s of stale) {
    const hasTriceps = s.exercises.some(e => e.muscleGroup === 'Triceps');
    const isDay1 = s.workoutType === 'Chest + Triceps' || s.workoutType === 'Chest + Triceps + Lower Back';
    console.log(`  Session: ${s.workoutType} | ${new Date(s.date).toLocaleDateString()} | hasTriceps: ${hasTriceps} | exercises: ${s.exercises.length}`);

    if (isDay1 && !hasTriceps) {
      await WorkoutSession.deleteOne({ _id: s._id });
      console.log(`  -> DELETED stale session (no triceps, old exercises)`);
    }
  }

  console.log('\nDone. Start a new session from the app to get correct exercises.');
  process.exit(0);
};

fix().catch(e => { console.error(e); process.exit(1); });
