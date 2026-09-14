const WorkoutSession = require('../models/WorkoutSession');
const Exercise = require('../models/Exercise');
const { startOfDay, endOfDay, differenceInDays } = require('../utils/dateUtils');
const { awardWorkoutXP } = require('../services/gamificationService');

const WORKOUT_ROTATION = [
  { dayNumber: 1, workoutType: 'Chest + Triceps', muscleGroups: ['Chest', 'Triceps'] },
  { dayNumber: 2, workoutType: 'Back + Biceps', muscleGroups: ['Back', 'Biceps'] },
  { dayNumber: 3, workoutType: 'Legs + Shoulders', muscleGroups: ['Legs', 'Shoulders'] },
  { dayNumber: 4, workoutType: 'Arms + Abs', muscleGroups: ['Arms', 'Abs'] }
];

// Calculate current week based on plan start date
const getCurrentWeek = (planStartDate) => {
  const start = new Date(planStartDate);
  const now = new Date();
  const days = Math.max(0, differenceInDays(now, start));
  return Math.min(Math.ceil((days + 1) / 7), 12);
};

// Get today's workout type based on rotation and history
const getTodayWorkoutType = async (userId, planStartDate) => {
  const lastWorkout = await WorkoutSession.findOne({
    userId,
    status: { $in: ['completed', 'in_progress'] }
  }).sort({ date: -1 });

  if (!lastWorkout) {
    return WORKOUT_ROTATION[0];
  }

  const nextDayNumber = (lastWorkout.dayNumber % 4) + 1;
  return WORKOUT_ROTATION.find(r => r.dayNumber === nextDayNumber);
};

// @desc    Get today's workout
// @route   GET /api/workouts/today
// @access  Private
const getTodayWorkout = async (req, res, next) => {
  try {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Check if there's already a session for today
    let session = await WorkoutSession.findOne({
      userId: req.user._id,
      date: { $gte: todayStart, $lte: todayEnd }
    }).populate('exercises.exercise');

    if (!session) {
      // Determine today's workout based on rotation
      const rotation = await getTodayWorkoutType(req.user._id, req.user.planStartDate);
      const weekNumber = getCurrentWeek(req.user.planStartDate);

      // Get suggested exercises for this workout type
      const exercises = await Exercise.find({
        muscleGroup: { $in: rotation.muscleGroups }
      }).limit(10);

      return res.json({
        success: true,
        session: null,
        recommendation: {
          workoutType: rotation.workoutType,
          dayNumber: rotation.dayNumber,
          weekNumber,
          muscleGroups: rotation.muscleGroups,
          suggestedExercises: exercises
        }
      });
    }

    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all workouts (with optional filters)
// @route   GET /api/workouts
// @access  Private
const getWorkouts = async (req, res, next) => {
  try {
    const { week, status, limit = 20, page = 1 } = req.query;

    const query = { userId: req.user._id };
    if (week) query.weekNumber = parseInt(week);
    if (status) query.status = status;

    const total = await WorkoutSession.countDocuments(query);
    const sessions = await WorkoutSession.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('exercises.exercise', 'name muscleGroup targetArea');

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      sessions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single workout session
// @route   GET /api/workouts/:id
// @access  Private
const getWorkout = async (req, res, next) => {
  try {
    const session = await WorkoutSession.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('exercises.exercise');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Workout session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// @desc    Create / Start a workout session
// @route   POST /api/workouts
// @access  Private
const createWorkout = async (req, res, next) => {
  try {
    const { workoutType, dayNumber, weekNumber, exercises, notes, date } = req.body;

    const rotation = WORKOUT_ROTATION.find(r => r.workoutType === workoutType);
    if (!rotation) {
      return res.status(400).json({ success: false, message: 'Invalid workout type' });
    }

    // Derive weekNumber from the sequential number of completed workouts,
    // not from the calendar date. This ensures workouts 5-8 always land in week 2,
    // workouts 9-12 in week 3, etc. — regardless of when in real time they happen.
    let resolvedWeekNumber = weekNumber;
    if (!resolvedWeekNumber) {
      const completedCount = await WorkoutSession.countDocuments({
        userId: req.user._id,
        status: 'completed'
      });
      // next workout is completedCount + 1 (1-indexed), week = ceil(n / 4)
      resolvedWeekNumber = Math.min(Math.ceil((completedCount + 1) / 4), 12);
    }

    // Derive dayNumber from sequential position within the week
    let resolvedDayNumber = dayNumber || rotation.dayNumber;

    const session = await WorkoutSession.create({
      userId: req.user._id,
      workoutType,
      dayNumber: resolvedDayNumber,
      weekNumber: resolvedWeekNumber,
      date: date ? new Date(date) : new Date(),
      startTime: new Date(),
      exercises: exercises || [],
      notes,
      status: 'in_progress',
      muscleGroupsFocus: rotation.muscleGroups
    });

    res.status(201).json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// @desc    Update workout session
// @route   PUT /api/workouts/:id
// @access  Private
const updateWorkout = async (req, res, next) => {
  try {
    const session = await WorkoutSession.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Workout session not found' });
    }

    const allowedFields = ['exercises', 'notes', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        session[field] = req.body[field];
      }
    });

    // Heal any exercises whose exercise ref became null/invalid (e.g. after re-seed).
    // Re-link by matching exerciseName against the current Exercise collection.
    if (req.body.exercises) {
      const nullRefs = session.exercises.filter(e => !e.exercise);
      if (nullRefs.length > 0) {
        const names = [...new Set(nullRefs.map(e => e.exerciseName).filter(Boolean))];
        const found = await Exercise.find({ name: { $in: names } }).select('_id name');
        const nameToId = {};
        found.forEach(ex => { nameToId[ex.name] = ex._id; });
        session.exercises = session.exercises.map(e => {
          if (!e.exercise && e.exerciseName && nameToId[e.exerciseName]) {
            e.exercise = nameToId[e.exerciseName];
          }
          return e;
        });
      }
    }

    await session.save();

    const populated = await WorkoutSession.findById(session._id).populate('exercises.exercise');
    res.json({ success: true, session: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete a workout session
// @route   POST /api/workouts/:id/complete
// @access  Private
const completeWorkout = async (req, res, next) => {
  try {
    const session = await WorkoutSession.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Workout session not found' });
    }

    // Guard: already completed — refuse to award XP again
    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Workout already completed' });
    }

    session.status = 'completed';
    session.endTime = new Date();
    if (session.startTime) {
      session.duration = Math.round((session.endTime - session.startTime) / 60000);
    }

    // Heal any null exercise refs before saving (can occur after re-seed)
    const nullRefs = session.exercises.filter(e => !e.exercise);
    if (nullRefs.length > 0) {
      const names = [...new Set(nullRefs.map(e => e.exerciseName).filter(Boolean))];
      const found = await Exercise.find({ name: { $in: names } }).select('_id name');
      const nameToId = {};
      found.forEach(ex => { nameToId[ex.name] = ex._id; });
      session.exercises = session.exercises.map(e => {
        if (!e.exercise && e.exerciseName && nameToId[e.exerciseName]) {
          e.exercise = nameToId[e.exerciseName];
        }
        return e;
      });
    }

    await session.save();

    // Award XP and update gamification state
    let gamification = null;
    try {
      gamification = await awardWorkoutXP(req.user._id, session, req.body.hasPR || false);
    } catch (xpErr) {
      console.error('XP award error (non-fatal):', xpErr.message);
    }

    res.json({ success: true, session, gamification });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete workout session
// @route   DELETE /api/workouts/:id
// @access  Private
const deleteWorkout = async (req, res, next) => {
  try {
    const session = await WorkoutSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Workout session not found' });
    }

    res.json({ success: true, message: 'Workout deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent muscle groups trained
// @route   GET /api/workouts/recent-muscles
// @access  Private
const getRecentMuscles = async (req, res, next) => {
  try {
    const sessions = await WorkoutSession.find({
      userId: req.user._id,
      status: 'completed'
    })
      .sort({ date: -1 })
      .limit(8)
      .select('workoutType muscleGroupsFocus date exercises');

    const muscleMap = {};
    sessions.forEach(session => {
      session.muscleGroupsFocus.forEach(mg => {
        if (!muscleMap[mg]) {
          muscleMap[mg] = { lastTrained: session.date, workoutType: session.workoutType };
        }
      });
    });

    const recentMuscles = Object.entries(muscleMap).map(([muscle, data]) => ({
      muscle,
      lastTrained: data.lastTrained,
      daysAgo: differenceInDays(new Date(), new Date(data.lastTrained)),
      workoutType: data.workoutType
    }));

    res.json({ success: true, recentMuscles });
  } catch (error) {
    next(error);
  }
};

// @desc    Get personal records for exercises
// @route   GET /api/workouts/prs
// @access  Private
const getPersonalRecords = async (req, res, next) => {
  try {
    const { exerciseId } = req.query;

    const matchQuery = { userId: req.user._id, status: 'completed' };
    if (exerciseId) {
      matchQuery['exercises.exercise'] = exerciseId;
    }

    const sessions = await WorkoutSession.find(matchQuery)
      .sort({ date: 1 })
      .populate('exercises.exercise', 'name');

    const prs = {};

    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        const exId = ex.exercise?._id?.toString() || ex.exerciseName;
        if (!prs[exId]) {
          prs[exId] = {
            exerciseName: ex.exerciseName,
            maxWeight: 0,
            maxReps: 0,
            maxVolume: 0,
            history: []
          };
        }

        let sessionMaxWeight = 0;
        let sessionMaxReps = 0;
        let sessionVolume = 0;

        ex.sets.filter(s => s.completed).forEach(set => {
          if (set.weight > sessionMaxWeight) sessionMaxWeight = set.weight;
          if (set.reps > sessionMaxReps) sessionMaxReps = set.reps;
          sessionVolume += set.weight * set.reps;
        });

        if (sessionMaxWeight > prs[exId].maxWeight) prs[exId].maxWeight = sessionMaxWeight;
        if (sessionMaxReps > prs[exId].maxReps) prs[exId].maxReps = sessionMaxReps;
        if (sessionVolume > prs[exId].maxVolume) prs[exId].maxVolume = sessionVolume;

        prs[exId].history.push({
          date: session.date,
          weekNumber: session.weekNumber,
          maxWeight: sessionMaxWeight,
          volume: sessionVolume
        });
      });
    });

    res.json({ success: true, prs });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested exercise variations for today's workout
//          Avoids repeating exercises used in the last session of same workout type.
//          Same muscle + same target area → different exercise.
// @route   GET /api/workouts/suggestions?workoutType=Chest+Triceps
// @access  Private
const getSuggestedExercises = async (req, res, next) => {
  try {
    const { workoutType } = req.query;
    const rotation = WORKOUT_ROTATION.find(r => r.workoutType === workoutType);
    if (!rotation) {
      return res.status(400).json({ success: false, message: 'Invalid workout type' });
    }

    const muscleGroups = rotation.muscleGroups;

    // Find last completed session of this exact workout type
    const lastSession = await WorkoutSession.findOne({
      userId: req.user._id,
      workoutType: { $in: [workoutType, 'Chest + Triceps + Lower Back'] },
      status: 'completed'
    }).sort({ date: -1 });

    // Collect exercise IDs used last time, keyed by targetArea per muscle
    // e.g. { Chest: { 'Mid Chest': ['exerciseId1'], 'Upper Chest': ['exerciseId2'] } }
    const prevUsed = {}; // muscleGroup → Set of exercise ObjectId strings
    if (lastSession) {
      lastSession.exercises.forEach(ex => {
        const mg = ex.muscleGroup;
        const exId = ex.exercise?.toString();
        if (mg && exId) {
          if (!prevUsed[mg]) prevUsed[mg] = new Set();
          prevUsed[mg].add(exId);
        }
      });
    }

    // Fetch all exercises for the relevant muscle groups (in insertion/seed order)
    const allExercises = await Exercise.find({
      $or: [{ isCustom: false }, { isCustom: true, createdBy: req.user._id }],
      muscleGroup: { $in: muscleGroups }
    });

    // For each muscle group pick exactly 4 exercises.
    // Strategy:
    //   1. Sort all exercises for this muscle: non-used ones first (preserving DB insertion order within each tier)
    //   2. Try to cover as many distinct target areas as possible
    //   3. Fill remaining slots with best non-used exercises regardless of target area
    const PICKS_PER_MUSCLE = 4;
    const suggested = [];

    for (const mg of muscleGroups) {
      const allForMuscle = allExercises.filter(e => e.muscleGroup === mg);
      const usedSet = prevUsed[mg] || new Set();

      // Split into preferred (not used last session) and fallback (used last session)
      const notUsed = allForMuscle.filter(e => !usedSet.has(e._id.toString()));
      const usedOnes = allForMuscle.filter(e => usedSet.has(e._id.toString()));

      // Pool: preferred first, then fallback — preserves seeding order within each tier
      const pool = [...notUsed, ...usedOnes];

      // Greedy pick: cover distinct target areas first, then fill remaining slots
      const selected = [];
      const coveredTargets = new Set();

      // Pass 1: one representative per target area (from pool in order)
      for (const ex of pool) {
        if (selected.length >= PICKS_PER_MUSCLE) break;
        const ta = ex.targetArea || 'General';
        if (!coveredTargets.has(ta)) {
          selected.push(ex);
          coveredTargets.add(ta);
        }
      }

      // Pass 2: fill remaining slots with next best from pool (can repeat target area)
      for (const ex of pool) {
        if (selected.length >= PICKS_PER_MUSCLE) break;
        if (!selected.find(s => s._id.toString() === ex._id.toString())) {
          selected.push(ex);
        }
      }

      suggested.push(...selected.slice(0, PICKS_PER_MUSCLE).map(ex => ({
        _id: ex._id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        targetArea: ex.targetArea,
        equipment: ex.equipment,
        difficulty: ex.difficulty,
        defaultSets: ex.defaultSets,
        defaultReps: ex.defaultReps,
        videoUrl: ex.videoUrl || null,
        usedLastSession: usedSet.has(ex._id.toString())
      })));
    }

    // Also return previous session summary for dashboard display
    const prevSummary = lastSession ? {
      date: lastSession.date,
      exercises: lastSession.exercises.map(e => ({
        name: e.exerciseName,
        muscleGroup: e.muscleGroup,
        targetArea: e.targetArea,
        sets: e.sets.filter(s => s.completed).map(s => ({ weight: s.weight, reps: s.reps }))
      }))
    } : null;

    res.json({ success: true, suggested, previousSession: prevSummary });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTodayWorkout,
  getWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  completeWorkout,
  deleteWorkout,
  getRecentMuscles,
  getPersonalRecords,
  getSuggestedExercises,
  getCurrentWeek,
  WORKOUT_ROTATION
};
