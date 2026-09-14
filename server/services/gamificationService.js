/**
 * Gamification Service
 * Handles XP awards, level calculation, streak tracking, and achievements.
 */

const User = require('../models/User');
const { differenceInDays } = require('../utils/dateUtils');

// XP per fitness level (cumulative thresholds)
const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250,
  3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450, 11500
];

// XP rewards
const XP_REWARDS = {
  COMPLETE_WORKOUT: 100,
  ALL_EXERCISES: 50,
  ALL_SETS: 50,
  STREAK_BONUS: 25,
  PERSONAL_RECORD: 100,
  PERFECT_WORKOUT: 50,
  // Nutrition XP
  LOG_MEAL: 10,            // per food entry logged
  BULK_MEAL_BONUS: 15,     // extra when logging 3+ items at once
  HIT_CALORIE_GOAL: 30,    // daily calorie goal within 10%
  HIT_PROTEIN_GOAL: 20,    // daily protein goal within 10%
  // Water XP
  LOG_WATER: 5,            // per water entry logged
  WATER_GOAL_25: 10,       // reach 25% of daily water goal (first time today)
  WATER_GOAL_50: 15,       // reach 50% of daily water goal
  WATER_GOAL_75: 20,       // reach 75%
  WATER_GOAL_100: 30       // hit 100% of daily water goal
};

// All available achievements
const ACHIEVEMENT_DEFINITIONS = [
  { key: 'first_workout', name: 'First Step', description: 'Complete your first workout', icon: '🔥', threshold: 1 },
  { key: 'workouts_5', name: 'Getting Started', description: 'Complete 5 workouts', icon: '💪', threshold: 5 },
  { key: 'workouts_10', name: 'Ten Down', description: 'Complete 10 workouts', icon: '🏅', threshold: 10 },
  { key: 'workouts_25', name: 'Quarter Century', description: 'Complete 25 workouts', icon: '🏆', threshold: 25 },
  { key: 'workouts_50', name: 'Fifty Strong', description: 'Complete 50 workouts', icon: '🚀', threshold: 50 },
  { key: 'streak_3', name: '3-Day Streak', description: 'Work out 3 days in a row', icon: '🔥', streakThreshold: 3 },
  { key: 'streak_7', name: 'Week Warrior', description: '7-day workout streak', icon: '🔥', streakThreshold: 7 },
  { key: 'streak_14', name: 'Two-Week Titan', description: '14-day workout streak', icon: '💫', streakThreshold: 14 },
  { key: 'streak_30', name: 'Monthly Master', description: '30-day workout streak', icon: '👑', streakThreshold: 30 },
  { key: 'level_5', name: 'Rising Star', description: 'Reach Fitness Level 5', icon: '⭐', levelThreshold: 5 },
  { key: 'level_10', name: 'Elite Athlete', description: 'Reach Fitness Level 10', icon: '🌟', levelThreshold: 10 },
  { key: 'perfect_workout', name: 'Perfect Workout', description: 'Complete all sets in a workout', icon: '💯' },
  { key: 'personal_record', name: 'Personal Best', description: 'Set a new personal record', icon: '🥇' }
];

/**
 * Calculate fitness level from XP
 */
const calcLevel = (xp) => {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
};

/**
 * Get XP info for the current level
 */
const getXpInfo = (xp) => {
  const level = calcLevel(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const xpIntoLevel = xp - currentThreshold;
  const xpForLevel = nextThreshold - currentThreshold;
  const percent = Math.min(Math.round((xpIntoLevel / xpForLevel) * 100), 100);

  return {
    level,
    xp,
    currentThreshold,
    nextThreshold,
    xpIntoLevel,
    xpForLevel,
    percent,
    xpToNext: Math.max(0, nextThreshold - xp)
  };
};

/**
 * Update user streak based on last workout date
 */
const updateStreak = (user, now) => {
  const lastDate = user.lastWorkoutDate ? new Date(user.lastWorkoutDate) : null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (!lastDate) {
    user.currentStreak = 1;
  } else {
    const lastDay = new Date(lastDate);
    lastDay.setHours(0, 0, 0, 0);
    const diff = differenceInDays(today, lastDay);

    if (diff === 0) {
      // Same day — keep streak unchanged
    } else if (diff === 1) {
      // Consecutive day
      user.currentStreak = (user.currentStreak || 0) + 1;
    } else if (diff <= 2) {
      // Allow 1 rest day gap (still maintain streak)
      user.currentStreak = (user.currentStreak || 0) + 1;
    } else {
      // Streak broken
      user.currentStreak = 1;
    }
  }

  if (user.currentStreak > (user.longestStreak || 0)) {
    user.longestStreak = user.currentStreak;
  }

  user.lastWorkoutDate = now;
  return user;
};

/**
 * Check and unlock achievements, return newly unlocked ones
 */
const checkAchievements = (user, newWorkoutCount, hasPR, isPerfect) => {
  const unlocked = [];
  const existingKeys = new Set((user.achievements || []).map(a => a.key));

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (existingKeys.has(def.key)) continue;

    let earned = false;

    if (def.threshold && newWorkoutCount >= def.threshold) earned = true;
    if (def.streakThreshold && user.currentStreak >= def.streakThreshold) earned = true;
    if (def.levelThreshold && user.fitnessLevel >= def.levelThreshold) earned = true;
    if (def.key === 'perfect_workout' && isPerfect) earned = true;
    if (def.key === 'personal_record' && hasPR) earned = true;

    if (earned) {
      user.achievements.push({
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        unlockedAt: new Date()
      });
      unlocked.push({ key: def.key, name: def.name, icon: def.icon, description: def.description });
    }
  }

  return unlocked;
};

/**
 * Main function: award XP and update gamification state after workout completion.
 * Returns { xpAwarded, xpBreakdown, newLevel, leveledUp, newAchievements, xpInfo }
 */
const awardWorkoutXP = async (userId, session, hasPR = false) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const oldLevel = calcLevel(user.xp || 0);

  // Calculate XP
  const xpBreakdown = [];
  let totalXP = XP_REWARDS.COMPLETE_WORKOUT;
  xpBreakdown.push({ label: 'Completed Workout', xp: XP_REWARDS.COMPLETE_WORKOUT });

  const exercisesCompleted = session.exercises?.filter(e => e.completed).length || 0;
  const totalExercises = session.exercises?.length || 0;
  const missedBreakdown = [];

  if (exercisesCompleted === totalExercises && totalExercises > 0) {
    totalXP += XP_REWARDS.ALL_EXERCISES;
    xpBreakdown.push({ label: 'All Exercises Done', xp: XP_REWARDS.ALL_EXERCISES });
  } else if (totalExercises > 0) {
    const missedExercises = totalExercises - exercisesCompleted;
    missedBreakdown.push({
      label: `${missedExercises} exercise${missedExercises > 1 ? 's' : ''} not completed`,
      xp: XP_REWARDS.ALL_EXERCISES
    });
  }

  const totalSets = session.exercises?.reduce((s, e) => s + e.sets.length, 0) || 0;
  const completedSets = session.exercises?.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0) || 0;
  const isPerfect = totalSets > 0 && completedSets === totalSets;

  if (isPerfect) {
    totalXP += XP_REWARDS.ALL_SETS;
    xpBreakdown.push({ label: 'Perfect Sets', xp: XP_REWARDS.ALL_SETS });
  } else if (totalSets > 0) {
    const missedSets = totalSets - completedSets;
    missedBreakdown.push({
      label: `${missedSets} set${missedSets > 1 ? 's' : ''} not marked done`,
      xp: XP_REWARDS.ALL_SETS
    });
  }

  if (hasPR) {
    totalXP += XP_REWARDS.PERSONAL_RECORD;
    xpBreakdown.push({ label: 'Personal Record!', xp: XP_REWARDS.PERSONAL_RECORD });
  }

  // Update streak first so we can use streak for XP bonus
  updateStreak(user, session.endTime || new Date());

  if (user.currentStreak >= 2) {
    const streakBonus = XP_REWARDS.STREAK_BONUS * Math.min(user.currentStreak, 7);
    totalXP += streakBonus;
    xpBreakdown.push({ label: `${user.currentStreak}-Day Streak Bonus`, xp: streakBonus });
  }

  // Update user stats
  user.xp = (user.xp || 0) + totalXP;
  user.workoutXP = (user.workoutXP || 0) + totalXP;
  user.totalWorkouts = (user.totalWorkouts || 0) + 1;
  user.totalExercisesCompleted = (user.totalExercisesCompleted || 0) + exercisesCompleted;
  user.totalSetsCompleted = (user.totalSetsCompleted || 0) + completedSets;
  user.fitnessLevel = calcLevel(user.xp);

  const newLevel = user.fitnessLevel;
  const leveledUp = newLevel > oldLevel;

  // Check achievements
  const newAchievements = checkAchievements(user, user.totalWorkouts, hasPR, isPerfect);

  await user.save();

  const xpInfo = getXpInfo(user.xp);

  return {
    xpAwarded: totalXP,
    xpBreakdown,
    missedXP: missedBreakdown.reduce((s, m) => s + m.xp, 0),
    missedBreakdown,
    newLevel,
    oldLevel,
    leveledUp,
    newAchievements,
    xpInfo,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak
  };
};

/**
 * Award XP for logging food entries.
 * @param {string} userId
 * @param {number} entryCount   – number of food entries being added (1 for single, N for bulk)
 * @param {Object} [goals]      – optional { calorieGoal, proteinGoal, currentCalories, currentProtein }
 *                                Pass these to also check if daily goals were hit today.
 * Returns { xpAwarded, xpBreakdown, xpInfo }
 */
const awardFoodXP = async (userId, entryCount = 1, goals = null) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const xpBreakdown = [];
  let totalXP = 0;

  // Base: XP per entry logged
  const perEntry = XP_REWARDS.LOG_MEAL * entryCount;
  totalXP += perEntry;
  xpBreakdown.push({ label: entryCount === 1 ? 'Meal Logged' : `${entryCount} Meals Logged`, xp: perEntry });

  // Bulk bonus (logging 3+ items at once)
  if (entryCount >= 3) {
    totalXP += XP_REWARDS.BULK_MEAL_BONUS;
    xpBreakdown.push({ label: 'Bulk Logging Bonus', xp: XP_REWARDS.BULK_MEAL_BONUS });
  }

  // Goal milestones (only award once per day — caller passes current totals after adding)
  if (goals) {
    const { calorieGoal, proteinGoal, prevCalories = 0, newCalories = 0, prevProtein = 0, newProtein = 0 } = goals;

    // Calorie goal: crossed the 90–110% window
    if (calorieGoal) {
      const low = calorieGoal * 0.9, high = calorieGoal * 1.1;
      const wasIn = prevCalories >= low && prevCalories <= high;
      const nowIn = newCalories >= low && newCalories <= high;
      if (!wasIn && nowIn) {
        totalXP += XP_REWARDS.HIT_CALORIE_GOAL;
        xpBreakdown.push({ label: 'Calorie Goal Hit!', xp: XP_REWARDS.HIT_CALORIE_GOAL });
      }
    }

    // Protein goal: crossed the ≥ 90% threshold
    if (proteinGoal) {
      const crossed = prevProtein < proteinGoal * 0.9 && newProtein >= proteinGoal * 0.9;
      if (crossed) {
        totalXP += XP_REWARDS.HIT_PROTEIN_GOAL;
        xpBreakdown.push({ label: 'Protein Goal Hit!', xp: XP_REWARDS.HIT_PROTEIN_GOAL });
      }
    }
  }

  user.xp = (user.xp || 0) + totalXP;
  user.nutritionXP = (user.nutritionXP || 0) + totalXP;
  user.fitnessLevel = calcLevel(user.xp);
  await user.save();

  return { xpAwarded: totalXP, xpBreakdown, xpInfo: getXpInfo(user.xp) };
};

/**
 * Award XP for logging a water entry.
 * @param {string} userId
 * @param {number} prevTotalMl   – water total BEFORE this entry
 * @param {number} newTotalMl    – water total AFTER this entry
 * @param {number} goalMl        – user's daily water goal
 * Returns { xpAwarded, xpBreakdown, xpInfo }
 */
const awardWaterXP = async (userId, prevTotalMl = 0, newTotalMl = 0, goalMl = 3000) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const xpBreakdown = [];
  let totalXP = 0;

  // Base: XP per entry logged
  totalXP += XP_REWARDS.LOG_WATER;
  xpBreakdown.push({ label: 'Water Logged', xp: XP_REWARDS.LOG_WATER });

  // Milestone bonuses — only when crossing the threshold for the first time today
  const milestones = [
    { pct: 25, reward: XP_REWARDS.WATER_GOAL_25, label: '25% Water Goal' },
    { pct: 50, reward: XP_REWARDS.WATER_GOAL_50, label: '50% Water Goal' },
    { pct: 75, reward: XP_REWARDS.WATER_GOAL_75, label: '75% Water Goal' },
    { pct: 100, reward: XP_REWARDS.WATER_GOAL_100, label: 'Water Goal Complete!' }
  ];

  for (const m of milestones) {
    const threshold = goalMl * (m.pct / 100);
    if (prevTotalMl < threshold && newTotalMl >= threshold) {
      totalXP += m.reward;
      xpBreakdown.push({ label: m.label, xp: m.reward });
    }
  }

  user.xp = (user.xp || 0) + totalXP;
  user.waterXP = (user.waterXP || 0) + totalXP;
  user.fitnessLevel = calcLevel(user.xp);
  await user.save();

  return { xpAwarded: totalXP, xpBreakdown, xpInfo: getXpInfo(user.xp) };
};

module.exports = {
  awardWorkoutXP,
  awardFoodXP,
  awardWaterXP,
  calcLevel,
  getXpInfo,
  ACHIEVEMENT_DEFINITIONS,
  LEVEL_THRESHOLDS,
  XP_REWARDS
};
