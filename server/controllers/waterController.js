const WaterEntry = require('../models/WaterEntry');
const User = require('../models/User');
const { startOfDay, endOfDay } = require('../utils/dateUtils');
const { awardWaterXP } = require('../services/gamificationService');

// @desc    Get water entries for a date
// @route   GET /api/water?date=
// @access  Private
const getWaterEntries = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const entries = await WaterEntry.find({
      userId: req.user._id,
      date: { $gte: startOfDay(date), $lte: endOfDay(date) }
    }).sort({ createdAt: 1 });

    const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);

    res.json({ success: true, entries, totalMl });
  } catch (error) {
    next(error);
  }
};

// @desc    Add water entry
// @route   POST /api/water
// @access  Private
const addWaterEntry = async (req, res, next) => {
  try {
    const { amountMl, date } = req.body;
    const entryDate = date ? new Date(date) : new Date();

    // Get today's total BEFORE adding this entry (for milestone detection)
    const existingEntries = await WaterEntry.find({
      userId: req.user._id,
      date: { $gte: startOfDay(entryDate), $lte: endOfDay(entryDate) }
    });
    const prevTotalMl = existingEntries.reduce((s, e) => s + e.amountMl, 0);

    const entry = await WaterEntry.create({
      userId: req.user._id,
      date: entryDate,
      amountMl
    });

    const newTotalMl = prevTotalMl + amountMl;
    const goalMl = req.user.waterGoal || 3000;

    // Award XP (non-fatal)
    let gamification = null;
    try {
      gamification = await awardWaterXP(req.user._id, prevTotalMl, newTotalMl, goalMl);
    } catch (xpErr) {
      console.error('[WaterXP] Failed to award XP:', xpErr.message);
    }

    res.status(201).json({ success: true, entry, gamification });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete water entry
// @route   DELETE /api/water/:id
// @access  Private
const deleteWaterEntry = async (req, res, next) => {
  try {
    const entry = await WaterEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Water entry not found' });
    }

    res.json({ success: true, message: 'Water entry deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWaterEntries, addWaterEntry, deleteWaterEntry, updateReminderSettings, getReminderSettings };

// @desc    Get / toggle water reminder settings
// @route   PUT /api/water/reminder
// @access  Private
async function updateReminderSettings(req, res, next) {
  try {
    const { enabled } = req.body

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { waterReminderEnabled: !!enabled },
      { new: true }
    ).select('waterReminderEnabled waterReminderHours')

    res.json({
      success: true,
      waterReminderEnabled: user.waterReminderEnabled,
      waterReminderHours:   user.waterReminderHours,
      message: user.waterReminderEnabled
        ? 'Water reminders enabled! You\'ll receive emails every 2 hours (8am–10pm).'
        : 'Water reminders disabled.'
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get current reminder status
// @route   GET /api/water/reminder
// @access  Private
async function getReminderSettings(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
      .select('waterReminderEnabled waterReminderHours')
    res.json({
      success: true,
      waterReminderEnabled: user.waterReminderEnabled,
      waterReminderHours:   user.waterReminderHours
    })
  } catch (error) {
    next(error)
  }
}
