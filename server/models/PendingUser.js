const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * PendingUser — holds registration data + OTP until the user verifies.
 * TTL index: document auto-deleted by MongoDB after 15 minutes if not verified.
 */
const pendingUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  otp: {
    type: String,
    required: true,
    select: false  // never expose hashed OTP in responses
  },
  otpExpires: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // TTL: MongoDB removes the document automatically after 15 minutes
    expires: 900
  }
});

// Before saving, hash the OTP and password
pendingUserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.isModified('otp') && !this.otp.startsWith('$2')) {
    // Only hash if it's a plain OTP (not already hashed)
    const salt = await bcrypt.genSalt(10);
    this.otp = await bcrypt.hash(this.otp, salt);
  }
  next();
});

pendingUserSchema.methods.matchOtp = async function (enteredOtp) {
  return await bcrypt.compare(enteredOtp, this.otp);
};

// Fast email lookup on every OTP auth path
pendingUserSchema.index({ email: 1 });

module.exports = mongoose.model('PendingUser', pendingUserSchema);
