/**
 * Game Map Controller
 * Returns the Candy Crush-style level map for the 12-week fitness journey.
 * Each workout session = one level in the game map.
 */

const WorkoutSession = require('../models/WorkoutSession');
const User = require('../models/User');
const { differenceInDays } = require('../utils/dateUtils');
const { getXpInfo, ACHIEVEMENT_DEFINITIONS } = require('../services/gamificationService');

const WORKOUT_ROTATION = [
  { dayNumber: 1, workoutType: 'Chest + Triceps', muscleGroups: ['Chest', 'Triceps'], icon: '💪', color: '#16a34a' },
  { dayNumber: 2, workoutType: 'Back + Biceps', muscleGroups: ['Back', 'Biceps'], icon: '🔵', color: '#0077b6' },
  { dayNumber: 3, workoutType: 'Legs + Shoulders', muscleGroups: ['Legs', 'Shoulders'], icon: '🦵', color: '#2d6a4f' },
  { dayNumber: 4, workoutType: 'Arms + Abs', muscleGroups: ['Biceps', 'Triceps', 'Abs'], icon: '🔴', color: '#9d4edd' }
];

// Total workout days in 3-month plan = 12 weeks × 4 days = 48
const TOTAL_LEVELS = 48;

// @desc    Get game map data
// @route   GET /api/gamemap
// @access  Private
const getGameMap = async (req, res, next) => {
  try {
    const userId = req.user._id;
    // Use req.user set by auth middleware — avoids a redundant DB round-trip
    const user = req.user;

    // Get all sessions for this user, oldest first
    const allSessions = await WorkoutSession.find({ userId })
      .sort({ date: 1, createdAt: 1 })
      .select('dayNumber weekNumber workoutType status date duration exercises createdAt');

    const completedSessions = allSessions.filter(s => s.status === 'completed');
    const inProgressSession = allSessions.find(s => s.status === 'in_progress');

    const completedCount = completedSessions.length;

    // Map completed sessions to level numbers by sequential order:
    // 1st completed workout → level 1, 2nd → level 2, …
    // This is resilient to wrong weekNumber/dayNumber values saved on old sessions.
    const completedByLevel = {}; // levelNumber (1-48) → session
    completedSessions.forEach((s, i) => {
      completedByLevel[i + 1] = s;
    });

    // In-progress session maps to the next level after all completed ones
    const inProgressLevelNumber = inProgressSession ? completedCount + 1 : null;

    // Build the game map levels
    const levels = [];
    let currentLevelIndex = -1;

    for (let week = 1; week <= 12; week++) {
      for (let dayIdx = 0; dayIdx < 4; dayIdx++) {
        const rotation = WORKOUT_ROTATION[dayIdx];
        const levelNumber = (week - 1) * 4 + dayIdx + 1;

        let state;
        let sessionRef = null;

        const completedSession = completedByLevel[levelNumber];

        if (completedSession) {
          state = 'completed';
          sessionRef = {
            id: completedSession._id,
            date: completedSession.date,
            duration: completedSession.duration,
            exerciseCount: completedSession.exercises?.length || 0,
            setsCompleted: completedSession.exercises?.reduce(
              (s, e) => s + e.sets.filter(st => st.completed).length, 0
            ) || 0
          };
        } else if (inProgressSession && levelNumber === inProgressLevelNumber) {
          state = 'in_progress';
          currentLevelIndex = levels.length;
          sessionRef = { id: inProgressSession._id };
        } else if (levelNumber === completedCount + 1 && !inProgressSession) {
          // Next available level (no in-progress session exists)
          state = 'available';
          currentLevelIndex = levels.length;
        } else if (levelNumber <= completedCount) {
          // Safety: should have been caught above
          state = 'available';
        } else {
          state = 'locked';
        }

        const visibilityThreshold = Math.max(completedCount + 12, 12);

        levels.push({
          levelNumber,
          weekNumber: week,
          dayNumber: rotation.dayNumber,
          workoutType: rotation.workoutType,
          muscleGroups: rotation.muscleGroups,
          icon: rotation.icon,
          color: rotation.color,
          state,
          session: sessionRef,
          visible: levelNumber <= visibilityThreshold
        });
      }
    }

    // Mark active level
    if (currentLevelIndex === -1) {
      currentLevelIndex = levels.findIndex(l => l.state === 'in_progress' || l.state === 'available');
    }
    if (currentLevelIndex >= 0) {
      levels[currentLevelIndex].isActive = true;
    }

    // XP info
    const xpInfo = getXpInfo(user.xp || 0);

    // Journey progress
    const weekProgress = {};
    for (let w = 1; w <= 12; w++) {
      const weekLevels = levels.filter(l => l.weekNumber === w);
      const completedInWeek = weekLevels.filter(l => l.state === 'completed').length;
      weekProgress[w] = {
        week: w,
        total: 4,
        completed: completedInWeek,
        state: completedInWeek === 4 ? 'completed' :
          completedInWeek > 0 ? 'in_progress' :
            w <= Math.ceil(completedCount / 4) ? 'available' : 'locked'
      };
    }

    res.json({
      success: true,
      gameMap: {
        levels,
        currentLevelIndex,
        totalLevels: TOTAL_LEVELS,
        completedLevels: completedCount,
        activeLevelNumber: currentLevelIndex >= 0 ? levels[currentLevelIndex]?.levelNumber : null
      },
      player: {
        name: user.name,
        xp: user.xp || 0,
        workoutXP: user.workoutXP || 0,
        nutritionXP: user.nutritionXP || 0,
        waterXP: user.waterXP || 0,
        fitnessLevel: user.fitnessLevel || 1,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        totalWorkouts: user.totalWorkouts || completedCount,
        achievements: (user.achievements || []).length,
        xpInfo
      },
      weekProgress: Object.values(weekProgress)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get player profile with achievements
// @route   GET /api/gamemap/profile
// @access  Private
const getPlayerProfile = async (req, res, next) => {
  try {
    // Select only the gamification fields needed — no password, no waterReminderHours, etc.
    const user = await User.findById(req.user._id).select(
      'name xp workoutXP nutritionXP waterXP fitnessLevel currentStreak longestStreak ' +
      'totalWorkouts totalSetsCompleted totalExercisesCompleted achievements createdAt'
    );
    const completedSessions = await WorkoutSession.countDocuments({
      userId: req.user._id,
      status: 'completed'
    });

    const xpInfo = getXpInfo(user.xp || 0);

    // All achievement definitions with unlock status
    const achievementStatus = ACHIEVEMENT_DEFINITIONS.map(def => {
      const unlocked = (user.achievements || []).find(a => a.key === def.key);
      return {
        ...def,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt || null
      };
    });

    res.json({
      success: true,
      profile: {
        name: user.name,
        xp: user.xp || 0,
        workoutXP: user.workoutXP || 0,
        nutritionXP: user.nutritionXP || 0,
        waterXP: user.waterXP || 0,
        fitnessLevel: user.fitnessLevel || 1,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        totalWorkouts: user.totalWorkouts || completedSessions,
        totalSetsCompleted: user.totalSetsCompleted || 0,
        totalExercisesCompleted: user.totalExercisesCompleted || 0,
        memberSince: user.createdAt,
        xpInfo,
        achievements: achievementStatus,
        unlockedAchievements: (user.achievements || [])
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGameMap, getPlayerProfile };
