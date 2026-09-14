const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getWaterEntries, addWaterEntry, deleteWaterEntry, updateReminderSettings, getReminderSettings } = require('../controllers/waterController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', getWaterEntries);

router.post('/', [
  body('amountMl').isInt({ min: 1 }).withMessage('Amount must be a positive number')
], validate, addWaterEntry);

router.delete('/:id', deleteWaterEntry);

router.get('/reminder', getReminderSettings);
router.put('/reminder', updateReminderSettings);

module.exports = router;
