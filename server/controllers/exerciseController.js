const Exercise = require('../models/Exercise');

// @desc    Get all exercises
// @route   GET /api/exercises
// @access  Private
const getExercises = async (req, res, next) => {
  try {
    const { muscleGroup, targetArea, equipment, difficulty } = req.query;

    const query = {
      $or: [
        { isCustom: false },
        { isCustom: true, createdBy: req.user._id }
      ]
    };

    if (muscleGroup) query.muscleGroup = muscleGroup;
    if (targetArea) query.targetArea = targetArea;
    if (equipment) query.equipment = equipment;
    if (difficulty) query.difficulty = difficulty;

    const exercises = await Exercise.find(query).sort({ muscleGroup: 1, name: 1 });

    res.json({ success: true, exercises });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single exercise
// @route   GET /api/exercises/:id
// @access  Private
const getExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found' });
    }
    res.json({ success: true, exercise });
  } catch (error) {
    next(error);
  }
};

// @desc    Create custom exercise
// @route   POST /api/exercises
// @access  Private
const createExercise = async (req, res, next) => {
  try {
    const { name, muscleGroup, targetArea, equipment, difficulty, instructions, defaultSets, defaultReps } = req.body;

    const exercise = await Exercise.create({
      name,
      muscleGroup,
      targetArea,
      equipment,
      difficulty,
      instructions,
      defaultSets,
      defaultReps,
      isCustom: true,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, exercise });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete custom exercise
// @route   DELETE /api/exercises/:id
// @access  Private
const deleteExercise = async (req, res, next) => {
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      isCustom: true
    });

    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found or not authorized' });
    }

    await exercise.deleteOne();
    res.json({ success: true, message: 'Exercise deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getExercises, getExercise, createExercise, deleteExercise };
