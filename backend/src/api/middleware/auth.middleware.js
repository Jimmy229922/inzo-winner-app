const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
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
        req.user = decoded;
        next();
    } catch (err) {
        console.warn('[AUTH-WARN] Token validation failed:', err.message);
        res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};