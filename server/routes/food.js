const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getFoodEntries, createFoodEntry, createBulkFoodEntries, updateFoodEntry, deleteFoodEntry, getWeeklyFood } = require('../controllers/foodController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/weekly', getWeeklyFood);
router.get('/', getFoodEntries);

router.post('/bulk', createBulkFoodEntries);

router.post('/', [
  body('foodName').trim().notEmpty().withMessage('Food name is required'),
  body('calories').isNumeric().withMessage('Calories must be a number'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('mealType').isIn(['Breakfast', 'Lunch', 'Dinner', 'Snacks']).withMessage('Invalid meal type')
], validate, createFoodEntry);

router.put('/:id', updateFoodEntry);
router.delete('/:id', deleteFoodEntry);

module.exports = router;
