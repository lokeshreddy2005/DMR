const express = require('express');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All organization routes require authentication
router.use(authMiddleware);

/**
 * POST /api/orgs
 * Create a new organization.
 */
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Organization name must be at least 2 characters.' });
        }

        const org = new Organization({
            name: name.trim(),
            description: description?.trim() || '',
            createdBy: req.user._id,
        });

        await org.save();
        await org.populate('members.user', 'name email avatarColor');

        res.status(201).json({ message: 'Organization created!', organization: org });
    } catch (err) {
        console.error('Create org error:', err);
        res.status(500).json({ error: 'Failed to create organization.' });
    }
});

/**
 * GET /api/orgs
 * List organizations the current user belongs to.
 */
router.get('/', async (req, res) => {
    try {
        const orgs = await Organization.find({
            'members.user': req.user._id,
        })
            .populate('members.user', 'name email avatarColor')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({ organizations: orgs });
    } catch (err) {
        console.error('List orgs error:', err);
        res.status(500).json({ error: 'Failed to fetch organizations.' });
    }
});

/**
 * GET /api/orgs/:id
 * Get organization details.
 */
router.get('/:id', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id)
            .populate('members.user', 'name email avatarColor')
            .populate('createdBy', 'name email');

        if (!org) {
            return res.status(404).json({ error: 'Organization not found.' });
        }

        if (!org.isMember(req.user._id)) {
            return res.status(403).json({ error: 'You are not a member of this organization.' });
        }

        res.json({ organization: org });
    } catch (err) {
        console.error('Get org error:', err);
        res.status(500).json({ error: 'Failed to fetch organization.' });
    }
});

/**
 * PUT /api/orgs/:id
 * Update organization name/description (admin only).
 */
router.put('/:id', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        if (!org.isAdmin(req.user._id)) {
            return res.status(403).json({ error: 'Only admins can update organization settings.' });
        }

        const { name, description, sharingPolicy } = req.body;
        if (name) org.name = name.trim();
        if (description !== undefined) org.description = description.trim();
        if (sharingPolicy?.defaultRole) {
            const validRoles = ['previewer', 'viewer', 'downloader', 'manager'];
            if (validRoles.includes(sharingPolicy.defaultRole)) {
                if (!org.sharingPolicy) org.sharingPolicy = {};
                org.sharingPolicy.defaultRole = sharingPolicy.defaultRole;
            }
        }

        await org.save();
        await org.populate('members.user', 'name email avatarColor');

        res.json({ message: 'Organization updated!', organization: org });
    } catch (err) {
        console.error('Update org error:', err);
        res.status(500).json({ error: 'Failed to update organization.' });
    }
});

/**
 * DELETE /api/orgs/:id
 * Delete organization (admin only).
 * Also deletes all documents belonging to this organization.
 */
router.delete('/:id', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        if (!org.isAdmin(req.user._id)) {
            return res.status(403).json({ error: 'Only admins can delete organizations.' });
        }

        // Delete all documents belonging to this organization
        const Document = require('../models/Document');
        const { deleteFromS3 } = require('../services/s3');
        const orgDocs = await Document.find({ space: 'organization', organization: req.params.id });

        for (const doc of orgDocs) {
            try { await deleteFromS3(doc.s3Key); } catch (s3Err) {
                console.error(`S3 delete warning for ${doc.fileName}:`, s3Err.message);
            }
        }

        if (orgDocs.length > 0) {
            await Document.deleteMany({ space: 'organization', organization: req.params.id });
            console.log(`🗑️  Deleted ${orgDocs.length} org documents for "${org.name}".`);
        }

        await Organization.findByIdAndDelete(req.params.id);
        res.json({ message: `Organization "${org.name}" and ${orgDocs.length} document(s) deleted.` });
    } catch (err) {
        console.error('Delete org error:', err);
        res.status(500).json({ error: 'Failed to delete organization.' });
    }
});

/**
 * POST /api/orgs/:id/members
 * Add a member to the organization (admin only).
 * Body: { email, role }
 */
router.post('/:id/members', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        if (!org.isAdmin(req.user._id)) {
            return res.status(403).json({ error: 'Only admins can add members.' });
        }

        const { email, role } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const userToAdd = await User.findOne({ email: email.toLowerCase() });
        if (!userToAdd) {
            return res.status(404).json({ error: 'No user found with that email.' });
        }

        if (org.isMember(userToAdd._id)) {
            return res.status(400).json({ error: 'User is already a member.' });
        }

        org.members.push({
            user: userToAdd._id,
            role: role || 'member',
        });

        await org.save();
        await org.populate('members.user', 'name email avatarColor');

        res.json({ message: `${userToAdd.name} added to the organization!`, organization: org });
    } catch (err) {
        console.error('Add member error:', err);
        res.status(500).json({ error: 'Failed to add member.' });
    }
});

/**
 * PUT /api/orgs/:id/members/:userId
 * Change a member's role (admin only).
 */
router.put('/:id/members/:userId', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        if (!org.isAdmin(req.user._id)) {
            return res.status(403).json({ error: 'Only admins can change roles.' });
        }

        const member = org.members.find(
            (m) => m.user.toString() === req.params.userId
        );
        if (!member) return res.status(404).json({ error: 'Member not found.' });

        const { role } = req.body;
        if (!['admin', 'member', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
        }

        member.role = role;
        await org.save();
        await org.populate('members.user', 'name email avatarColor');

        res.json({ message: 'Member role updated!', organization: org });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: 'Failed to update member role.' });
    }
});

/**
 * DELETE /api/orgs/:id/members/:userId
 * Remove a member (admin only, cannot remove self if last admin).
 */
router.delete('/:id/members/:userId', async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        if (!org.isAdmin(req.user._id)) {
            return res.status(403).json({ error: 'Only admins can remove members.' });
        }

        // Cannot remove the last admin
        if (req.params.userId === req.user._id.toString()) {
            const adminCount = org.members.filter((m) => m.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot remove yourself — you are the only admin.' });
            }
        }

        org.members = org.members.filter(
            (m) => m.user.toString() !== req.params.userId
        );

        await org.save();
        await org.populate('members.user', 'name email avatarColor');

        res.json({ message: 'Member removed.', organization: org });
    } catch (err) {
        console.error('Remove member error:', err);
        res.status(500).json({ error: 'Failed to remove member.' });
    }
});

module.exports = router;
