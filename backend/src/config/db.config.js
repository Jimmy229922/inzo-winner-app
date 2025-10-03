const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // The MONGODB_URI is loaded from the main server.js file
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[INFO] MongoDB connected successfully.');
    } catch (err) {
        console.error('[CRITICAL] MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;