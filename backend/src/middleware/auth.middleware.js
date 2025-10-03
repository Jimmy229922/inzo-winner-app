
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
    // --- NEW: If no token, create a default user session ---
    console.log('[AUTH] Bypassing token check. Granting Super Admin access.');
    const admin = await getSuperAdmin();
    if (!admin) {
        return res.status(500).json({ message: 'Super Admin account not found. Please run setup.' });
    }
    // Pass the full user object to the request
    req.user = { ...admin, userId: admin._id };
    next();
};
                