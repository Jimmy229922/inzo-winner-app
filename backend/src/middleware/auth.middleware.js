
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
        // Ensure all required user fields are included
        req.user = { 
            ...admin,
            _id: admin._id, // Ensure _id is set for Mongoose operations
            userId: admin._id, // Keep userId for backward compatibility
            role: admin.role || 'super_admin' 
        };
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
        const user = await User.findById(decoded.userId || decoded._id).select('-password').lean();

        if (!user) {
            console.error('[AUTH] User not found for token:', decoded);
            return res.status(401).json({ message: 'Invalid token. User not found.' });
        }

        // Ensure all required fields are present in the user object
        req.user = {
            ...user,
            _id: user._id, // Ensure _id is set
            userId: user._id, // Keep userId for backward compatibility
            role: user.role || decoded.role // Fallback to token role if needed
        };

        // Debug log to track user context
        // console.debug(`[AUTH] User context set: ID=${req.user._id}, Role=${req.user.role}`);
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        res.status(401).json({ message: 'Invalid token.' });
    }
};
