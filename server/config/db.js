const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Accept both MONGO_URI and MONGO_URL
    const uri = process.env.MONGO_URI || process.env.MONGO_URL;
    if (!uri) {
      throw new Error('MongoDB connection string not set. Add MONGO_URI to your .env file.');
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
