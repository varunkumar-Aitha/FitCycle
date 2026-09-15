const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const { sendOtpEmail } = require('../services/emailService');

// Fields safe to expose to the client — never includes password, XP internals, etc.
const USER_PUBLIC_FIELDS = 'name email calorieGoal proteinGoal waterGoal planStartDate createdAt';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/** Generate a 6-digit numeric OTP */
const generateOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

// ─────────────────────────────────────────────
// @desc    Initiate registration — sends OTP
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    console.log("REGISTER: START");
    const { name, email: rawEmail, password } = req.body;
    const email = rawEmail.toLowerCase().trim();

    // Block if a verified account already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    console.log("REGISTER: generating OTP");
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    console.log("REGISTER: OTP generated");

    // Remove any previous pending entry for this email (e.g. user clicked resend)
    console.log("REGISTER: saving OTP/user");
    await PendingUser.deleteMany({ email });

    // Create pending record (password + OTP will be hashed by pre-save hook)
    await PendingUser.create({ name, email, password, otp, otpExpires });
    console.log("REGISTER: OTP/user saved");

    // Send OTP email (console-only in dev if EMAIL_USER not set)
    console.log("REGISTER: sending email");
    await sendOtpEmail({ to: email, name, otp });
    console.log("REGISTER: EMAIL SENT");

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email address. Please verify to complete registration.',
      email // return email so frontend can pre-fill the OTP screen
    });
    console.log("REGISTER: COMPLETE");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @desc    Verify OTP — creates the real User
// @route   POST /api/auth/verify-otp
// @access  Public
// ─────────────────────────────────────────────
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const pending = await PendingUser.findOne({ email }).select('+password +otp');

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration found. Please register again.'
      });
    }

    // Check OTP expiry
    if (new Date() > pending.otpExpires) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please register again.'
      });
    }

    // Throttle: max 5 wrong attempts
    if (pending.attempts >= 5) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please register again.'
      });
    }

    const isMatch = await pending.matchOtp(otp.trim());

    if (!isMatch) {
      pending.attempts += 1;
      await pending.save();
      const remaining = 5 - pending.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // OTP is correct — create the real User.
    // pending.password is already bcrypt-hashed by PendingUser's pre-save hook.
    // Use collection.insertOne to bypass the User pre-save hook and avoid
    // double-hashing, but include ALL schema defaults so gamification fields exist.
    const now = new Date();
    const savedUser = await User.collection.insertOne({
      name: pending.name,
      email: pending.email,
      password: pending.password, // already bcrypt-hashed
      calorieGoal: 2200,
      proteinGoal: 120,
      waterGoal: 3000,
      planStartDate: now,
      createdAt: now,
      // Gamification defaults (must mirror User schema)
      xp: 0,
      workoutXP: 0,
      nutritionXP: 0,
      waterXP: 0,
      fitnessLevel: 1,
      totalWorkouts: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      totalSetsCompleted: 0,
      totalExercisesCompleted: 0,
      achievements: [],
      waterReminderEnabled: false,
      waterReminderHours: [8, 10, 12, 14, 16, 18, 20, 22]
    });

    // Clean up the pending record
    await PendingUser.deleteOne({ _id: pending._id });

    const insertedId = savedUser.insertedId;
    const token = generateToken(insertedId);

    res.status(201).json({
      success: true,
      message: 'Account verified and created successfully!',
      token,
      user: {
        _id: insertedId,
        name: pending.name,
        email: pending.email,
        calorieGoal: 2200,
        proteinGoal: 120,
        waterGoal: 3000,
        planStartDate: now,
        createdAt: now
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
// ─────────────────────────────────────────────
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const pending = await PendingUser.findOne({ email }).select('+otp');

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration found. Please register again.'
      });
    }

    // Rate-limit: only allow resend after 60 seconds from creation
    const secondsSinceCreated = (Date.now() - new Date(pending.createdAt).getTime()) / 1000;
    if (secondsSinceCreated < 60) {
      const waitSeconds = Math.ceil(60 - secondsSinceCreated);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before requesting a new OTP.`
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Hash new OTP and reset attempt counter
    const salt = await bcrypt.genSalt(10);
    pending.otp = await bcrypt.hash(otp, salt);
    pending.otpExpires = otpExpires;
    pending.attempts = 0;
    pending.createdAt = new Date(); // reset TTL clock

    // Use updateOne to bypass pre-save hook (OTP already hashed manually above)
    await PendingUser.updateOne(
      { _id: pending._id },
      {
        otp: pending.otp,
        otpExpires,
        attempts: 0,
        createdAt: new Date()
      }
    );

    await sendOtpEmail({ to: email, name: pending.name, otp });

    res.json({
      success: true,
      message: 'A new OTP has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        calorieGoal: user.calorieGoal,
        proteinGoal: user.proteinGoal,
        waterGoal: user.waterGoal,
        planStartDate: user.planStartDate,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // Only return the safe public fields — never the full document
    const user = await User.findById(req.user._id).select(USER_PUBLIC_FIELDS);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @desc    Update user profile/goals
// @route   PUT /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
const updateMe = async (req, res, next) => {
  try {
    const { name, calorieGoal, proteinGoal, waterGoal, planStartDate } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, calorieGoal, proteinGoal, waterGoal, planStartDate },
      { new: true, runValidators: true, select: USER_PUBLIC_FIELDS }
    );

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, verifyOtp, resendOtp, login, getMe, updateMe };
