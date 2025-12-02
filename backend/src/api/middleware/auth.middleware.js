const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const authenticate = async function(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Token is malformed.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure we accept both legacy { userId } payloads and newer { _id } payloads
        const effectiveId = decoded._id || decoded.userId;
        if (!effectiveId) {
            console.error('[AUTH-ERROR] Token missing user identifier:', decoded);
            return res.status(401).json({ message: 'Invalid token structure: missing user ID' });
        }

        // Fetch full user details from database using the existing User model
        const User = mongoose.model('User');
        const user = await User.findById(effectiveId).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Attach the full user object to the request
        req.user = user;

        next();
    } catch (err) {
        console.warn('[AUTH-WARN] Token validation failed:', err.message);
        res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

module.exports = {
    authenticate
};
