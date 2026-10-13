const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  multerSingle,
  uploadDocument,
  sendMessage,
  getChatHistory,
  deleteDocument,
  clearHistory
} = require('../controllers/nutritionChatController');

router.use(protect);

router.post('/upload', multerSingle('document'), uploadDocument);

router.post(
  '/message',
  [
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required.')
      .isLength({ max: 2000 }).withMessage('Message must be 2000 characters or less.')
  ],
  validate,
  sendMessage
);

router.get('/history', getChatHistory);
router.delete('/document', deleteDocument);
router.delete('/history', clearHistory);

module.exports = router;
