const WorkoutSession = require('../models/WorkoutSession');
const FoodEntry = require('../models/FoodEntry');
const WaterEntry = require('../models/WaterEntry');
const User = require('../models/User');
const { startOfDay, endOfDay, differenceInDays } = require('../utils/dateUtils');
const { getCurrentWeek, WORKOUT_ROTATION } = require('./workoutController');

// @desc    Get dashboard data
// @route   GET /api/dashboard
// @access  Private
const getDashboard = async (req, res, next) => {
  try {
    const user = req.user;
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Current week
    const currentWeek = getCurrentWeek(user.planStartDate);

    // Today's workout
    const todaySession = await WorkoutSession.findOne({
      userId: user._id,
      date: { $gte: todayStart, $lte: todayEnd }
    }).populate('exercises.exercise', 'name muscleGroup');

    // Last completed workout
    const lastWorkout = await WorkoutSession.findOne({
      userId: user._id,
      status: 'completed'
    }).sort({ date: -1 });

    // Determine next workout type
    let nextWorkoutType = WORKOUT_ROTATION[0];
    if (lastWorkout) {
      const nextDayNumber = (lastWorkout.dayNumber % 4) + 1;
      nextWorkoutType = WORKOUT_ROTATION.find(r => r.dayNumber === nextDayNumber);
    }

    // Today's food
    const foodEntries = await FoodEntry.find({
      userId: user._id,
      date: { $gte: todayStart, $lte: todayEnd }
    });
    const todayFood = foodEntries.reduce((acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Today's water
    const waterEntries = await WaterEntry.find({
      userId: user._id,
      date: { $gte: todayStart, $lte: todayEnd }
    });
    const todayWaterMl = waterEntries.reduce((sum, e) => sum + e.amountMl, 0);

    // Workout stats — parallel count queries instead of loading all sessions into memory
    const [completedCount, totalCount] = await Promise.all([
      WorkoutSession.countDocuments({ userId: user._id, status: 'completed' }),
      WorkoutSession.countDocuments({ userId: user._id })
    ]);

    // Streak calculation — only fetch completed sessions (sorted, minimal fields)
    const sortedCompleted = await WorkoutSession.find({
      userId: user._id,
      status: 'completed'
    }).sort({ date: -1 }).select('date muscleGroupsFocus').lean();

    let streak = 0;
    if (sortedCompleted.length > 0) {
      let checkDate = new Date();
      const lastDate = new Date(sortedCompleted[0].date);
      const daysSinceLast = differenceInDays(checkDate, lastDate);

      if (daysSinceLast <= 1) {
        streak = 1;
        for (let i = 1; i < sortedCompleted.length; i++) {
          const curr = new Date(sortedCompleted[i - 1].date);
          const prev = new Date(sortedCompleted[i].date);
          const diff = differenceInDays(curr, prev);
          if (diff <= 3) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    // 3-month completion
    const totalPlannedWorkouts = 12 * 4;
    const completionPercent = Math.min(Math.round((completedCount / totalPlannedWorkouts) * 100), 100);

    // Recently trained muscle groups (from already-fetched sortedCompleted)
    const recentSessions = sortedCompleted.slice(0, 6);
    const recentMuscles = {};
    recentSessions.forEach(session => {
      (session.muscleGroupsFocus || []).forEach(mg => {
        if (!recentMuscles[mg]) {
          recentMuscles[mg] = {
            lastTrained: session.date,
            daysAgo: differenceInDays(new Date(), new Date(session.date))
          };
        }
      });
    });

    // Reminders
    const reminders = [];
    if (!todaySession || todaySession.status === 'scheduled') {
      reminders.push({ type: 'workout', message: "Today's workout is waiting for you." });
    }
    const proteinRemaining = user.proteinGoal - todayFood.protein;
    if (proteinRemaining > 0) {
      reminders.push({ type: 'protein', message: `You're ${Math.round(proteinRemaining)}g short of your protein goal.` });
    }
    const waterRemaining = user.waterGoal - todayWaterMl;
    if (waterRemaining > 0) {
      reminders.push({
        type: 'water',
        message: `You're ${(waterRemaining / 1000).toFixed(2)}L short of your water goal.`
      });
    }

    res.json({
      success: true,
      dashboard: {
        currentWeek,
        totalWeeks: 12,
        completionPercent,
        streak,
        totalWorkouts: totalCount,
        completedWorkouts: completedCount,
        missedWorkouts: 0,
        todaySession,
        lastWorkout,
        nextWorkout: nextWorkoutType,
        todayFood,
        goals: {
          calories: user.calorieGoal,
          protein: user.proteinGoal,
          waterMl: user.waterGoal
        },
        todayWaterMl,
        recentMuscles,
        reminders
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
