const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Vault = require('../models/Vault');
const Document = require('../models/Document');

const router = express.Router();

// Admin middleware
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin role required.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Server error checking admin role' });
    }
};

router.use(authMiddleware);
router.use(requireAdmin);

// ─── SYSTEM STATS ────────────────────────────────────────────────────────────
// Helper: Permanently delete items that have been in trash for more than 14 days
const cleanupTrash = async () => {
    try {
        const now = new Date();
        const deletedUsers = await User.find({ isDeleted: true, scheduledDeletionDate: { $lte: now } });
        const deletedOrgs = await Organization.find({ isDeleted: true, scheduledDeletionDate: { $lte: now } });

        for (const u of deletedUsers) {
            await Document.deleteMany({ uploadedBy: u._id });
            await User.findByIdAndDelete(u._id);
        }
        for (const o of deletedOrgs) {
            await Document.deleteMany({ organization: o._id });
            await Organization.findByIdAndDelete(o._id);
        }
    } catch (e) {
        console.error('Trash cleanup error:', e);
    }
};

router.get('/stats', async (req, res) => {
    try {
        await cleanupTrash();
        const [
            totalUsers, totalAdmins, totalOrgs, totalDocs,
            storageAgg, publicStorageAgg, vaultCount, savingsAgg
        ] = await Promise.all([
            User.countDocuments({ role: 'user', isDeleted: { $ne: true } }),
            User.countDocuments({ role: 'admin', isDeleted: { $ne: true } }),
            Organization.countDocuments({ isDeleted: { $ne: true } }),
            Document.countDocuments({ isDeleted: { $ne: true } }),
            Document.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: null, total: { $sum: '$fileSize' } } }]),
            Document.aggregate([{ $match: { space: 'public', isDeleted: { $ne: true } } }, { $group: { _id: null, total: { $sum: '$fileSize' } } }]),
            Vault.countDocuments(),
            Document.aggregate([
                { $match: { isDeleted: { $ne: true }, isCompressed: true } },
                { $group: { _id: null, totalSaved: { $sum: { $subtract: ["$originalSize", "$fileSize"] } } } }
            ])
        ]);

        res.json({
            totalUsers,
            totalAdmins,
            totalOrgs,
            totalDocs,
            totalStorageUsed: storageAgg[0]?.total || 0,
            publicStorageUsed: publicStorageAgg[0]?.total || 0,
            vaultCount,
            compressionSavings: savingsAgg[0]?.totalSaved || 0,
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ─── USERS ───────────────────────────────────────────────────────────────────

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ isDeleted: { $ne: true } }).select('-password -apiKeys').sort({ createdAt: -1 });
        
        // Calculate real storage used per user (private space)
        const usersWithStorage = await Promise.all(users.map(async (user) => {
            const agg = await Document.aggregate([
                { $match: { space: 'private', uploadedBy: user._id, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$fileSize' } } }
            ]);
            const userObj = user.toObject();
            userObj.storageUsed = agg[0]?.total || 0;
            return userObj;
        }));
        
        res.json(usersWithStorage);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create a new user manually
router.post('/users', async (req, res) => {
    try {
        const { name, email, password, role, storageLimit } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password, // Mongoose pre-save hook will hash this
            role: role === 'admin' ? 'admin' : 'user',
            storageLimit: storageLimit || 5368709120 // Default 5GB
        });

        await newUser.save();
        
        const userObj = newUser.toObject();
        delete userObj.password;
        
        res.status(201).json(userObj);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user storage limit
router.put('/users/:id/limit', async (req, res) => {
    try {
        const { storageLimit } = req.body;
        if (typeof storageLimit !== 'number' || storageLimit < 0) {
            return res.status(400).json({ error: 'storageLimit must be a non-negative number' });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { storageLimit },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user limit' });
    }
});

// Change user role (promote to admin / demote to user)
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be "user" or "admin"' });
        }
        // Prevent self-demotion
        if (req.params.id === req.user.id.toString() && role !== 'admin') {
            return res.status(400).json({ error: 'You cannot demote yourself' });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Delete a user (Soft Delete)
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user.id.toString()) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }
        
        const now = new Date();
        const scheduledDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days later

        const user = await User.findByIdAndUpdate(req.params.id, {
            isDeleted: true,
            deletedAt: now,
            scheduledDeletionDate: scheduledDate
        }, { new: true });

        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Mark their documents as deleted too
        await Document.updateMany({ uploadedBy: req.params.id }, { isDeleted: true });
        
        res.json({ message: `User ${user.name} moved to trash. Permanent deletion in 14 days.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

// Get all organizations
router.get('/organizations', async (req, res) => {
    try {
        const orgs = await Organization.find({ isDeleted: { $ne: true } })
            .populate('createdBy', 'name email avatarColor')
            .sort({ createdAt: -1 });
        // Add member count and actual storage used
        const orgsWithCount = await Promise.all(orgs.map(async (org) => {
            const agg = await Document.aggregate([
                { $match: { space: 'organization', organization: org._id, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$fileSize' } } }
            ]);
            return {
                ...org.toObject(),
                memberCount: org.members.length,
                storageUsed: agg[0]?.total || 0,
            };
        }));
        res.json(orgsWithCount);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// Update organization storage limit
router.put('/organizations/:id/limit', async (req, res) => {
    try {
        const { storageLimit } = req.body;
        if (typeof storageLimit !== 'number' || storageLimit < 0) {
            return res.status(400).json({ error: 'storageLimit must be a non-negative number' });
        }
        const org = await Organization.findByIdAndUpdate(
            req.params.id,
            { storageLimit },
            { new: true }
        ).populate('createdBy', 'name email');
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update organization limit' });
    }
});

// Delete an organization (Soft Delete)
router.delete('/organizations/:id', async (req, res) => {
    try {
        const now = new Date();
        const scheduledDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days later

        const org = await Organization.findByIdAndUpdate(req.params.id, {
            isDeleted: true,
            deletedAt: now,
            scheduledDeletionDate: scheduledDate
        }, { new: true });

        if (!org) return res.status(404).json({ error: 'Organization not found' });
        
        // Move org docs to deleted
        await Document.updateMany({ organization: req.params.id }, { isDeleted: true });
        
        res.json({ message: `Organization "${org.name}" moved to trash. Permanent deletion in 14 days.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete organization' });
    }
});

// ─── VAULTS ──────────────────────────────────────────────────────────────────

// Get all vaults
router.get('/vaults', async (req, res) => {
    try {
        const vaults = await Vault.find().sort({ label: 1 });
        res.json(vaults);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch vaults' });
    }
});

// Create new vault
router.post('/vaults', async (req, res) => {
    try {
        const { id, label, description, keywords } = req.body;
        if (!id || !label) return res.status(400).json({ error: 'id and label are required' });

        const existingVault = await Vault.findOne({ id: id.toLowerCase() });
        if (existingVault) return res.status(400).json({ error: 'Vault with this ID already exists' });

        const vault = new Vault({
            id: id.toLowerCase().replace(/\s+/g, '_'),
            label,
            description: description || '',
            keywords: Array.isArray(keywords) ? keywords : [],
        });
        await vault.save();
        res.status(201).json(vault);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create vault', details: err.message });
    }
});

// Update/edit vault
router.put('/vaults/:id', async (req, res) => {
    try {
        const { label, description, keywords } = req.body;
        const vault = await Vault.findOneAndUpdate(
            { id: req.params.id },
            {
                ...(label && { label }),
                ...(description !== undefined && { description }),
                ...(keywords !== undefined && { keywords: Array.isArray(keywords) ? keywords : [] }),
            },
            { new: true }
        );
        if (!vault) return res.status(404).json({ error: 'Vault not found' });
        res.json(vault);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update vault', details: err.message });
    }
});

// Delete vault
router.delete('/vaults/:id', async (req, res) => {
    try {
        const vault = await Vault.findOneAndDelete({ id: req.params.id });
        if (!vault) return res.status(404).json({ error: 'Vault not found' });
        res.json({ message: 'Vault deleted successfully', vault });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete vault', details: err.message });
    }
});

// ─── ADMIN DOCUMENT ACCESS ───────────────────────────────────────────────────

// Get private documents of a specific user (admin view)
router.get('/users/:id/documents', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const filter = {
            uploadedBy: req.params.id,
            space: 'private',
            deleted: { $ne: true },
        };
        const [docs, total] = await Promise.all([
            Document.find(filter).sort({ uploadDate: -1 }).skip(skip).limit(limit).populate('uploadedBy', 'name email avatarColor'),
            Document.countDocuments(filter),
        ]);
        res.json({ documents: docs, totalCount: total, totalPages: Math.ceil(total / limit), page });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user documents' });
    }
});

// Admin delete any document
router.delete('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        res.json({ message: 'Document deleted by admin', document: doc });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ─── TRASH MANAGEMENT ────────────────────────────────────────────────────────
// Get all trashed items
router.get('/trash', async (req, res) => {
    try {
        const [users, orgs] = await Promise.all([
            User.find({ isDeleted: true }).select('name email avatarColor deletedAt scheduledDeletionDate'),
            Organization.find({ isDeleted: true }).select('name avatarColor deletedAt scheduledDeletionDate').populate('createdBy', 'name email')
        ]);
        res.json({ users, organizations: orgs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trash items' });
    }
});

// Restore a trashed item
router.post('/trash/restore/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        let item;
        if (type === 'user') {
            item = await User.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, scheduledDeletionDate: null }, { new: true });
            if (item) await Document.updateMany({ uploadedBy: id, space: { $ne: 'deleted_forever' } }, { isDeleted: false });
        } else if (type === 'organization') {
            item = await Organization.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null, scheduledDeletionDate: null }, { new: true });
            if (item) await Document.updateMany({ organization: id, space: { $ne: 'deleted_forever' } }, { isDeleted: false });
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }

        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: `${type === 'user' ? 'User' : 'Organization'} restored successfully`, item });
    } catch (err) {
        res.status(500).json({ error: 'Failed to restore item' });
    }
});

// Permanently delete a trashed item
router.delete('/trash/permanent/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (type === 'user') {
            if (id === req.user.id.toString()) return res.status(400).json({ error: 'Cannot delete self' });
            await Document.deleteMany({ uploadedBy: id });
            await User.findByIdAndDelete(id);
        } else if (type === 'organization') {
            await Document.deleteMany({ organization: id });
            await Organization.findByIdAndDelete(id);
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }
        res.json({ message: 'Permanently deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete permanently' });
    }
});

module.exports = router;

