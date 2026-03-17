const express = require('express');
const Document = require('../models/Document');
const { getDownloadUrl } = require('../services/s3');

const router = express.Router();

/**
 * GET /api/public/documents
 * List all public documents — no authentication required.
 * Query: ?tag=keyword  (filter by tag)
 */
router.get('/documents', async (req, res) => {
    try {
        const { tag } = req.query;
        let query = { space: 'public' };

        if (tag) {
            query.tags = { $regex: new RegExp(tag, 'i') };
        }

        const documents = await Document.find(query)
            .populate('uploadedBy', 'name avatarColor')
            .select('-permissions -s3Key')
            .sort({ uploadDate: -1 });

        res.json({ documents });
    } catch (err) {
        console.error('Public docs error:', err);
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

/**
 * GET /api/public/documents/search?q=keyword
 * Search public documents by keyword (searches tags + fileName).
 */
router.get('/documents/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
        }

        const regex = new RegExp(q.trim(), 'i');
        const documents = await Document.find({
            space: 'public',
            $or: [
                { tags: { $elemMatch: { $regex: regex } } },
                { fileName: { $regex: regex } },
                { 'metadata.primaryDomain': { $regex: regex } },
                { 'metadata.typeTags': { $elemMatch: { $regex: regex } } },
                { description: { $regex: regex } },
            ],
        })
            .populate('uploadedBy', 'name avatarColor')
            .select('-permissions -s3Key')
            .sort({ uploadDate: -1 })
            .limit(50);

        res.json({ documents, query: q });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed.' });
    }
});

/**
 * GET /api/public/documents/tags
 * Get all distinct tags from public documents, with counts.
 */
router.get('/documents/tags', async (req, res) => {
    try {
        const tagAgg = await Document.aggregate([
            { $match: { space: 'public', isTagged: true } },
            { $unwind: '$tags' },
            { $group: { _id: { $toLower: '$tags' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 100 },
        ]);

        const tags = tagAgg.map((t) => ({ tag: t._id, count: t.count }));
        res.json({ tags });
    } catch (err) {
        console.error('Tags aggregation error:', err);
        res.status(500).json({ error: 'Failed to fetch tags.' });
    }
});

/**
 * GET /api/public/documents/:id
 * View a single public document — no auth required.
 */
router.get('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('uploadedBy', 'name avatarColor')
            .select('-permissions -s3Key');

        if (!doc || doc.space !== 'public') {
            return res.status(404).json({ error: 'Document not found.' });
        }

        res.json({ document: doc });
    } catch (err) {
        console.error('Public doc detail error:', err);
        res.status(500).json({ error: 'Failed to fetch document.' });
    }
});

/**
 * GET /api/public/documents/:id/download
 * Download a public document — no auth required.
 */
router.get('/documents/:id/download', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.space !== 'public') {
            return res.status(404).json({ error: 'Document not found.' });
        }

        const downloadUrl = await getDownloadUrl(doc.s3Key);
        res.json({ downloadUrl, fileName: doc.fileName });
    } catch (err) {
        console.error('Public download error:', err);
        res.status(500).json({ error: 'Failed to generate download URL.' });
    }
});

module.exports = router;
