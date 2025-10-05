
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let superAdminCache = null;

async function getSuperAdmin() {
    if (superAdminCache) return superAdminCache;
    // Fetch the full admin object once and cache it
    const admin = await User.findOne({ role: 'super_admin' }).lean();
    if (admin) superAdminCache = admin;
    return superAdminCache;
}

module.exports = async (req, res, next) => {
    // --- DEVELOPMENT ONLY: Bypass authentication for ease of development ---
    if (process.env.NODE_ENV === 'development') {
        const admin = await getSuperAdmin();
        if (!admin) {
            return res.status(500).json({ message: 'Super Admin account not found. Please run setup.' });
        }
        req.user = { ...admin, userId: admin._id }; // Pass the full user object
        return next();
    }

    // --- PRODUCTION: Real JWT Authentication ---
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password').lean();

        if (!user) {
            return res.status(401).json({ message: 'Invalid token. User not found.' });
        }

        // Attach the user object to the request
        req.user = { ...user, userId: user._id };
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        res.status(401).json({ message: 'Invalid token.' });
    }
};