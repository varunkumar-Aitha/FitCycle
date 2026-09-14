require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const WorkoutSession = require('../models/WorkoutSession');
const connectDB = require('../config/db');

const verify = async () => {
  await connectDB();

  // Sessions
  const sessions = await WorkoutSession.find({}).sort({ date: -1 }).limit(5).lean();
  console.log('\n=== RECENT SESSIONS ===');
  if (sessions.length === 0) {
    console.log('  No sessions found in DB');
  }
  sessions.forEach(s => {
    console.log(`\n  [${s.status}] ${s.workoutType} | ${new Date(s.date).toLocaleDateString()} | ${s.exercises.length} exercises`);
    s.exercises.forEach(e => console.log(`     - ${e.exerciseName} | ${e.muscleGroup} | videoUrl: ${e.videoUrl || 'null'}`));
  });

  // Chest exercises
  const chest = await Exercise.find({ muscleGroup: 'Chest' }, 'name targetArea equipment videoUrl').lean();
  console.log('\n=== CHEST EXERCISES (DB insertion order) ===');
  chest.forEach((e, i) => console.log(`  ${i+1}. ${e.name} | ${e.targetArea} | ${e.equipment}${e.videoUrl ? ' | VIDEO: ' + e.videoUrl : ''}`));

  // Triceps exercises
  const tri = await Exercise.find({ muscleGroup: 'Triceps' }, 'name targetArea equipment videoUrl').lean();
  console.log('\n=== TRICEPS EXERCISES (DB insertion order) ===');
  tri.forEach((e, i) => console.log(`  ${i+1}. ${e.name} | ${e.targetArea} | ${e.equipment}`));

  console.log('\n=== WORKOUT TYPE ENUM CHECK ===');
  console.log('  Day 1 type in WORKOUT_ROTATION: Chest + Triceps');
  console.log('  Sessions with old type "Chest + Triceps + Lower Back":', sessions.filter(s => s.workoutType === 'Chest + Triceps + Lower Back').length);

  process.exit(0);
};

verify().catch(e => { console.error(e); process.exit(1); });
