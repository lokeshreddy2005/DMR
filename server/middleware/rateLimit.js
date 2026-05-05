// Simple in-memory rate limiter for Admin and SuperAdmin routes
const limits = {};

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const ip in limits) {
        if (now - limits[ip].resetTime > 0) {
            delete limits[ip];
        }
    }
}, 5 * 60 * 1000);

function rateLimit(options) {
    const { windowMs, max, message } = options;
    return (req, res, next) => {
        const key = req.user ? req.user._id.toString() : req.ip;
        const now = Date.now();

        if (!limits[key]) {
            limits[key] = { count: 1, resetTime: now + windowMs };
            return next();
        }

        if (now > limits[key].resetTime) {
            limits[key] = { count: 1, resetTime: now + windowMs };
            return next();
        }

        limits[key].count++;

        if (limits[key].count > max) {
            const retryAfter = Math.ceil((limits[key].resetTime - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ error: message || 'Too many requests, please try again later.' });
        }

        next();
    };
}

const adminRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP/User to 100 requests per windowMs
    message: 'Too many requests from this user, please try again after a minute'
});

const superAdminRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // limit each IP/User to 200 requests per windowMs
    message: 'Too many requests from this user, please try again after a minute'
});

module.exports = { rateLimit, adminRateLimiter, superAdminRateLimiter };
