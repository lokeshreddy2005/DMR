const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware.
 * Extracts JWT from Authorization header, verifies it,
 * and attaches user to req.user.
 */
async function authMiddleware(req, res, next) {
    try {
        const apiKeyHeader = req.headers['x-api-key'];

        if (apiKeyHeader) {
            const user = await User.findOne({ 'apiKeys.key': apiKeyHeader });
            if (!user) {
                return res.status(401).json({ error: 'Invalid API Key.' });
            }
            req.user = user;
            return next();
        }

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

// ─── RBAC Middleware ───

// Role hierarchy: superadmin > admin > user
const ROLE_HIERARCHY = { user: 1, admin: 2, superadmin: 3 };

/**
 * Requires the user to have one of the exact specified roles.
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions. Requires one of: ' + allowedRoles.join(', ') });
        }
        next();
    };
}

/**
 * Requires the user to have a role at or above the specified minimum role in the hierarchy.
 */
function requireMinRole(minRole) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
        const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 999;
        if (userLevel < requiredLevel) {
            return res.status(403).json({ error: 'Insufficient permissions. Minimum role required: ' + minRole });
        }
        next();
    };
}

module.exports = { authMiddleware, optionalAuth, requireRole, requireMinRole, ROLE_HIERARCHY };
