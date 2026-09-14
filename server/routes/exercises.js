const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getExercises, getExercise, createExercise, deleteExercise } = require('../controllers/exerciseController');

router.use(protect);

router.get('/', getExercises);
router.get('/:id', getExercise);
router.post('/', createExercise);
router.delete('/:id', deleteExercise);

module.exports = router;
