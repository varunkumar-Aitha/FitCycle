require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { startWaterReminderScheduler } = require('./services/waterReminderScheduler');

// Route imports
const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workouts');
const exerciseRoutes = require('./routes/exercises');
const foodRoutes = require('./routes/food');
const foodCatalogRoutes = require('./routes/foodCatalog');
const waterRoutes = require('./routes/water');
const dashboardRoutes = require('./routes/dashboard');
const gamemapRoutes = require('./routes/gamemap');

const path = require('path');
const app = express();

// Connect to MongoDB
connectDB();

// Start scheduled jobs
startWaterReminderScheduler();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Compress JSON/text responses only — exclude video/audio so HTTP range
// requests (needed for video seeking) are never broken by gzip.
app.use(compression({
  filter: (req, res) => {
    const ct = res.getHeader('Content-Type') || ''
    if (/^video\/|^audio\//.test(ct)) return false
    return compression.filter(req, res)
  }
}));

// Static files — mounted AFTER cors so video responses carry CORS headers
app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/food-catalog', foodCatalogRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gamemap', gamemapRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FitCycle API is running' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;
