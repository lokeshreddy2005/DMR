const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate JWT token for a user.
 */
function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

/**
 * POST /api/auth/signup
 * Create a new user account.
 */
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }

        // Create user (force role to 'user' for public signup)
        const user = new User({ name, email, password, role: 'user' });
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarColor: user.avatarColor,
                role: user.role,
                organizationId: user.organizationId,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((e) => e.message);
            return res.status(400).json({ error: messages[0] });
        }
        res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT.
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find user and include password for comparison
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarColor: user.avatarColor,
                role: user.role,
                organizationId: user.organizationId,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

/**
 * GET /api/auth/me
 * Get current user's profile (protected).
 */
router.get('/me', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            avatarColor: req.user.avatarColor,
            role: req.user.role,
            organizationId: req.user.organizationId,
            createdAt: req.user.createdAt,
        },
    });
});

/**
 * PUT /api/auth/profile
 * Update user's name and/or email (protected).
 */
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, email } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (email) {
            // Check if email is already taken by another user
            const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
            if (existing) {
                return res.status(400).json({ error: 'Email is already in use by another account.' });
            }
            updates.email = email.toLowerCase();
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        });

        res.json({
            message: 'Profile updated successfully!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarColor: user.avatarColor,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        console.error('Profile update error:', err);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((e) => e.message);
            return res.status(400).json({ error: messages[0] });
        }
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

/**
 * PUT /api/auth/password
 * Change user's password (protected).
 */
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        // Get user with password
        const user = await User.findById(req.user._id).select('+password');
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully!' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

// /**
//  * GET /api/auth/users/search
//  * Search users for autocomplete filters (e.g., "Uploaded By").
//  */
router.get('/users/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json({ users: [] });
        }

        const regex = new RegExp(req.query.q.trim(), 'i');
        const users = await User.find({
            $or: [
                { name: { $regex: regex } },
                { email: { $regex: regex } }
            ]
        })
        .select('name email avatarColor')
        .limit(10);

        res.json({ users });
    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Failed to search users.' });
    }
});

module.exports = router;
