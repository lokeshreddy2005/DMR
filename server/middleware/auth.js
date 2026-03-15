const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware.
 * Extracts JWT from Authorization header, verifies it,
 * and attaches user to req.user.
 */
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found. Token invalid.' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        }
        return res.status(500).json({ error: 'Authentication failed.' });
    }
}

/**
 * Optional auth middleware — attaches user if token present, but doesn't block.
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId);
        }
    } catch {
        // Silently continue without user
    }
    next();
}

module.exports = { authMiddleware, optionalAuth };
