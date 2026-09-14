const FoodEntry = require('../models/FoodEntry');
const { startOfDay, endOfDay } = require('../utils/dateUtils');
const { awardFoodXP } = require('../services/gamificationService');

// @desc    Get food entries for a date
// @route   GET /api/food?date=
// @access  Private
const getFoodEntries = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const entries = await FoodEntry.find({
      userId: req.user._id,
      date: { $gte: startOfDay(date), $lte: endOfDay(date) }
    }).sort({ mealType: 1, createdAt: 1 });

    const totals = entries.reduce((acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein:  acc.protein  + entry.protein,
      carbs:    acc.carbs    + entry.carbs,
      fat:      acc.fat      + entry.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    res.json({ success: true, entries, totals });
  } catch (error) {
    next(error);
  }
};

// @desc    Create food entry
// @route   POST /api/food
// @access  Private
const createFoodEntry = async (req, res, next) => {
  try {
    const { foodName, quantity, unit, calories, protein, carbs, fat, mealType, date } = req.body;

    const entry = await FoodEntry.create({
      userId: req.user._id,
      date: date ? new Date(date) : new Date(),
      foodName,
      quantity,
      unit,
      calories,
      protein: protein || 0,
      carbs:   carbs   || 0,
      fat:     fat     || 0,
      mealType
    });

    // Award XP — fetch today's totals before and after this entry for milestone detection
    let gamification = null;
    try {
      const entryDate = date ? new Date(date) : new Date();
      const todayEntries = await FoodEntry.find({
        userId: req.user._id,
        date: { $gte: startOfDay(entryDate), $lte: endOfDay(entryDate) }
      });
      const prevCalories = todayEntries.reduce((s, e) => s + (e._id.equals(entry._id) ? 0 : e.calories), 0);
      const prevProtein  = todayEntries.reduce((s, e) => s + (e._id.equals(entry._id) ? 0 : e.protein),  0);
      const newCalories  = prevCalories + (calories || 0);
      const newProtein   = prevProtein  + (protein  || 0);

      gamification = await awardFoodXP(req.user._id, 1, {
        calorieGoal:  req.user.calorieGoal  || 2200,
        proteinGoal:  req.user.proteinGoal  || 120,
        prevCalories, newCalories,
        prevProtein,  newProtein
      });
    } catch (xpErr) {
      // Non-fatal — entry is saved regardless
      console.error('[FoodXP] Failed to award XP:', xpErr.message);
    }

    res.status(201).json({ success: true, entry, gamification });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create food entries (from catalog picker)
// @route   POST /api/food/bulk
// @access  Private
const createBulkFoodEntries = async (req, res, next) => {
  try {
    const { entries, date } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'entries array is required' });
    }

    const entryDate = date ? new Date(date) : new Date();

    const docs = entries.map(e => ({
      userId:   req.user._id,
      date:     entryDate,
      foodName: e.foodName,
      quantity: e.quantity,
      unit:     e.unit,
      calories: e.calories,
      protein:  e.protein || 0,
      carbs:    e.carbs   || 0,
      fat:      e.fat     || 0,
      mealType: e.mealType
    }));

    const created = await FoodEntry.insertMany(docs);

    // Award XP for bulk logging — include calorie/protein milestone check
    let gamification = null;
    try {
      const allEntries = await FoodEntry.find({
        userId: req.user._id,
        date: { $gte: startOfDay(entryDate), $lte: endOfDay(entryDate) }
      });
      const createdIds = new Set(created.map(e => e._id.toString()));
      const prevCalories = allEntries.filter(e => !createdIds.has(e._id.toString())).reduce((s, e) => s + e.calories, 0);
      const prevProtein  = allEntries.filter(e => !createdIds.has(e._id.toString())).reduce((s, e) => s + e.protein,  0);
      const newCalories  = allEntries.reduce((s, e) => s + e.calories, 0);
      const newProtein   = allEntries.reduce((s, e) => s + e.protein,  0);

      gamification = await awardFoodXP(req.user._id, created.length, {
        calorieGoal: req.user.calorieGoal || 2200,
        proteinGoal: req.user.proteinGoal || 120,
        prevCalories, newCalories,
        prevProtein,  newProtein
      });
    } catch (xpErr) {
      console.error('[FoodXP] Failed to award bulk XP:', xpErr.message);
    }

    res.status(201).json({ success: true, count: created.length, entries: created, gamification });
  } catch (error) {
    next(error);
  }
};

// @desc    Update food entry
// @route   PUT /api/food/:id
// @access  Private
const updateFoodEntry = async (req, res, next) => {
  try {
    const entry = await FoodEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Food entry not found' });
    }

    res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete food entry
// @route   DELETE /api/food/:id
// @access  Private
const deleteFoodEntry = async (req, res, next) => {
  try {
    const entry = await FoodEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Food entry not found' });
    }

    res.json({ success: true, message: 'Food entry deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly food summary
// @route   GET /api/food/weekly
// @access  Private
const getWeeklyFood = async (req, res, next) => {
  try {
    const now     = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const entries = await FoodEntry.find({
      userId: req.user._id,
      date: { $gte: startOfDay(weekAgo), $lte: endOfDay(now) }
    });

    const byDay = {};
    entries.forEach(entry => {
      const day = entry.date.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      byDay[day].calories += entry.calories;
      byDay[day].protein  += entry.protein;
      byDay[day].carbs    += entry.carbs;
      byDay[day].fat      += entry.fat;
    });

    const days        = Object.values(byDay);
    const avgCalories = days.length ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0;
    const avgProtein  = days.length ? Math.round(days.reduce((s, d) => s + d.protein,  0) / days.length) : 0;
    const avgCarbs    = days.length ? Math.round(days.reduce((s, d) => s + d.carbs,    0) / days.length) : 0;
    const avgFat      = days.length ? Math.round(days.reduce((s, d) => s + d.fat,      0) / days.length) : 0;

    res.json({
      success: true,
      byDay,
      averages: { calories: avgCalories, protein: avgProtein, carbs: avgCarbs, fat: avgFat }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFoodEntries, createFoodEntry, createBulkFoodEntries, updateFoodEntry, deleteFoodEntry, getWeeklyFood };
