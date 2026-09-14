const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { register, verifyOtp, resendOtp, login, getMe, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Step 1 — initiate registration, sends OTP
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, register);

// Step 2 — verify OTP, creates account + returns token
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], validate, verifyOtp);

// Resend OTP (rate-limited to once per 60s server-side)
router.post('/resend-otp', [
  body('email').isEmail().withMessage('Valid email is required')
], validate, resendOtp);

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, login);

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
