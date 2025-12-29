const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // The MONGODB_URI is loaded from the main server.js file
        await mongoose.connect(process.env.MONGODB_URI);
        const host = mongoose.connection?.host;
        const name = mongoose.connection?.name;
        const port = mongoose.connection?.port;
        console.log('[INFO] MongoDB connected successfully.', {
            host,
            port,
            db: name
        });
    } catch (err) {
        console.error('[CRITICAL] MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;