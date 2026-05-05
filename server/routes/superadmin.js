const express = require('express');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLogger');
const { superAdminRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('superadmin'));
router.use(superAdminRateLimiter);

// Get all teams (organizations)
router.get('/organizations', async (req, res) => {
    try {
        const orgs = await Organization.find()
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json({ organizations: orgs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// Create a new team
router.post('/organizations', auditLog('create_team', 'organization'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Team name is required.' });

        const org = new Organization({
            name: name.trim(),
            description: description?.trim() || '',
            createdBy: req.user._id,
        });

        await org.save();
        res.status(201).json({ message: 'Team created', organization: org });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Set total storage limit for a team
router.patch('/organizations/:id/quota', auditLog('update_team_quota', 'organization'), async (req, res) => {
    try {
        const { totalStorageLimitBytes } = req.body;
        if (totalStorageLimitBytes == null || totalStorageLimitBytes < 0) {
            return res.status(400).json({ error: 'Invalid storage limit.' });
        }

        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Team not found.' });

        org.storageQuota.totalStorageLimitBytes = totalStorageLimitBytes;
        await org.save();

        res.json({ message: 'Team quota updated', organization: org });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update team quota' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find()
            .populate('organizationId', 'name')
            .sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Change a user's role and/or organization
router.patch('/users/:id/role', auditLog('update_user_role', 'user'), async (req, res) => {
    try {
        const { role, organizationId } = req.body;
        const updates = {};

        if (role) {
            if (!['user', 'admin', 'superadmin'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role.' });
            }
            updates.role = role;
        }

        if (organizationId !== undefined) {
            updates.organizationId = organizationId;
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('organizationId', 'name');

        if (!user) return res.status(404).json({ error: 'User not found.' });

        res.json({ message: 'User updated', user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
