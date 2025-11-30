
const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('[CRITICAL] MONGODB_URI is missing in environment.');
        process.exit(1);
    }
    console.log('[DB] Attempting MongoDB connection to', uri);
    const start = Date.now();
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
        const ms = Date.now() - start;
        console.log(`[DB] MongoDB connected. Time=${ms}ms Host=${mongoose.connection.host} DB=${mongoose.connection.name}`);
    } catch (err) {
        console.error('[CRITICAL] MongoDB connection error:', err.message);
        console.error('[CRITICAL] Stack:', err.stack?.split('\n').slice(0,3).join('\n'));
        process.exit(1);
    }
};

module.exports = connectDB;
                