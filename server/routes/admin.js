const express = require('express');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Vault = require('../models/Vault');
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLogger');
const { adminRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(authMiddleware);
router.use(requireMinRole('admin'));
router.use(adminRateLimiter);

// Middleware to ensure the user belongs to an organization
router.use((req, res, next) => {
    if (!req.user.organizationId) {
        return res.status(400).json({ error: 'You are not assigned to any team.' });
    }
    next();
});

// --- VAULTS ---

router.get('/vaults', async (req, res) => {
    try {
        const vaults = await Vault.find({ organizationId: req.user.organizationId })
            .populate('createdBy', 'name email');
        res.json({ vaults });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch vaults' });
    }
});

router.post('/vaults', auditLog('create_vault', 'vault'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Vault name is required.' });

        const vault = new Vault({
            name: name.trim(),
            description: description?.trim() || '',
            organizationId: req.user.organizationId,
            createdBy: req.user._id
        });

        await vault.save();
        res.status(201).json({ message: 'Vault created', vault });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'A vault with this name already exists in your team.' });
        }
        res.status(500).json({ error: 'Failed to create vault' });
    }
});

// --- QUOTA MANAGEMENT ---

router.patch('/org/quota', auditLog('update_org_quota', 'organization'), async (req, res) => {
    try {
        const { publicSpaceLimitBytes, teamSpaceLimitBytes } = req.body;
        const org = await Organization.findById(req.user.organizationId);
        
        if (!org) return res.status(404).json({ error: 'Team not found' });

        if (publicSpaceLimitBytes !== undefined) {
            if (publicSpaceLimitBytes < 0) return res.status(400).json({ error: 'Invalid public space limit' });
            org.storageQuota.publicSpaceLimitBytes = publicSpaceLimitBytes;
        }

        if (teamSpaceLimitBytes !== undefined) {
            if (teamSpaceLimitBytes < 0) return res.status(400).json({ error: 'Invalid team space limit' });
            org.storageQuota.teamSpaceLimitBytes = teamSpaceLimitBytes;
        }

        // Validate that total allocations don't exceed total limit
        const users = await User.find({ organizationId: org._id });
        const totalPrivate = users.reduce((sum, u) => sum + (u.privateStorageLimitBytes || 0), 0);
        
        const sumAllocated = org.storageQuota.publicSpaceLimitBytes + org.storageQuota.teamSpaceLimitBytes + totalPrivate;

        if (sumAllocated > org.storageQuota.totalStorageLimitBytes) {
            return res.status(400).json({ 
                error: 'Total allocated space exceeds the Team\'s total limit set by Super Admin.',
                details: { sumAllocated, totalLimit: org.storageQuota.totalStorageLimitBytes }
            });
        }

        await org.save();
        res.json({ message: 'Team space limits updated', organization: org });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update team limits' });
    }
});

// --- USER MANAGEMENT ---

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ organizationId: req.user.organizationId })
            .select('-password');
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

router.patch('/users/:id/quota', auditLog('update_user_quota', 'user'), async (req, res) => {
    try {
        const { privateStorageLimitBytes } = req.body;
        if (privateStorageLimitBytes == null || privateStorageLimitBytes < 0) {
            return res.status(400).json({ error: 'Invalid private space limit.' });
        }

        const user = await User.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
        if (!user) return res.status(404).json({ error: 'User not found in your team.' });

        const org = await Organization.findById(req.user.organizationId);
        
        // Calculate current allocated space minus this user's old limit, plus their new limit
        const allUsers = await User.find({ organizationId: org._id });
        const totalPrivateOthers = allUsers.reduce((sum, u) => sum + (u._id.toString() === user._id.toString() ? 0 : (u.privateStorageLimitBytes || 0)), 0);
        
        const sumAllocated = org.storageQuota.publicSpaceLimitBytes + org.storageQuota.teamSpaceLimitBytes + totalPrivateOthers + privateStorageLimitBytes;

        if (sumAllocated > org.storageQuota.totalStorageLimitBytes) {
            return res.status(400).json({ 
                error: 'Allocating this space exceeds the Team\'s total limit set by Super Admin.',
                details: { sumAllocated, totalLimit: org.storageQuota.totalStorageLimitBytes }
            });
        }

        user.privateStorageLimitBytes = privateStorageLimitBytes;
        await user.save();

        res.json({ message: 'User private space limit updated', user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user quota' });
    }
});

module.exports = router;
