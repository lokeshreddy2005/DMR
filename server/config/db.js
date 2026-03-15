const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('❌ MONGO_URI is not set in .env file');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
