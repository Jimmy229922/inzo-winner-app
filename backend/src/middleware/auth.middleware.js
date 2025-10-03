
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let superAdminIdCache = null;

async function getSuperAdminId() {
    if (superAdminIdCache) return superAdminIdCache;
    const admin = await User.findOne({ role: 'super_admin' }).select('_id').lean();
    if (admin) superAdminIdCache = admin._id;
    return superAdminIdCache;
}

module.exports = async (req, res, next) => {
    // --- NEW: If no token, create a default user session ---
    console.log('[AUTH] Bypassing token check. Granting Super Admin access.');
    const adminId = await getSuperAdminId();
    if (!adminId) {
        return res.status(500).json({ message: 'Super Admin account not found. Please run setup.' });
    }
    req.user = { userId: adminId, role: 'super_admin' };
    next();
};
                