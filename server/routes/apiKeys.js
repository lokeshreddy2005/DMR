const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Require standard JWT authentication for API key management
router.use(authMiddleware);

/**
 * GET /api/api-keys
 * Returns all API keys for the current user
 */
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ apiKeys: user.apiKeys || [] });
    } catch (err) {
        console.error('Fetch API Keys error:', err);
        res.status(500).json({ error: 'Failed to fetch API keys.' });
    }
});

/**
 * POST /api/api-keys
 * Generates a new API key for the current user
 */
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'API key name is required.' });
        }

        const user = await User.findById(req.user._id);
        
        // Generate a new secure API key
        const randomBytes = crypto.randomBytes(32).toString('hex');
        const prefix = 'dmr_';
        const apiKey = `${prefix}${randomBytes}`;

        const newKey = {
            name: name.trim(),
            key: apiKey,
            createdAt: new Date()
        };

        user.apiKeys.push(newKey);
        await user.save();

        res.status(201).json({ 
            message: 'API Key generated successfully', 
            apiKey: newKey 
        });
    } catch (err) {
        console.error('Generate API Key error:', err);
        res.status(500).json({ error: 'Failed to generate API key.' });
    }
});

/**
 * DELETE /api/api-keys/:id
 * Revokes a specific API key
 */
router.delete('/:id', async (req, res) => {
    try {
        const keyId = req.params.id;
        const user = await User.findById(req.user._id);
        
        const keyExists = user.apiKeys.some(k => k._id.toString() === keyId);
        if (!keyExists) {
            return res.status(404).json({ error: 'API key not found.' });
        }

        user.apiKeys = user.apiKeys.filter(k => k._id.toString() !== keyId);
        await user.save();

        res.json({ message: 'API Key revoked successfully' });
    } catch (err) {
        console.error('Revoke API Key error:', err);
        res.status(500).json({ error: 'Failed to revoke API key.' });
    }
});

module.exports = router;
