const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTodayWorkout,
  getWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  completeWorkout,
  deleteWorkout,
  getRecentMuscles,
  getPersonalRecords,
  getSuggestedExercises
} = require('../controllers/workoutController');

router.use(protect);

router.get('/today', getTodayWorkout);
router.get('/recent-muscles', getRecentMuscles);
router.get('/prs', getPersonalRecords);
router.get('/suggestions', getSuggestedExercises);
router.get('/', getWorkouts);
router.get('/:id', getWorkout);
router.post('/', createWorkout);
router.put('/:id', updateWorkout);
router.post('/:id/complete', completeWorkout);
router.delete('/:id', deleteWorkout);

module.exports = router;
