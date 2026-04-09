const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadToS3, getDownloadUrl } = require('../services/s3');
const { checkQuota } = require('../services/storageQuota');
const { autoTagDocument } = require('../services/autoTagger');

const router = express.Router();

// CORS for external API
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Require strict API key or JWT authentication
router.use(authMiddleware);

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

function cleanupFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Cleanup error:', err);
        });
    }
}

/**
 * POST /api/external/upload
 * Upload a document directly.
 */
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const { space, organizationId, description, autoTag } = req.body;

        if (!space || !['public', 'private', 'organization'].includes(space)) {
            cleanupFile(req.file.path);
            return res.status(400).json({ error: 'Invalid space. Must be public, private, or organization.' });
        }

        if (space === 'organization') {
            if (!organizationId) {
                cleanupFile(req.file.path);
                return res.status(400).json({ error: 'Organization ID is required for organization uploads.' });
            }
            const org = await Organization.findById(organizationId);
            if (!org || !org.isMember(req.user._id)) {
                cleanupFile(req.file.path);
                return res.status(403).json({ error: 'You are not a member of this organization.' });
            }
        }

        const quota = await checkQuota(
            space,
            req.user._id,
            space === 'organization' ? organizationId : null,
            req.file.size
        );
        if (!quota.allowed) {
            cleanupFile(req.file.path);
            return res.status(413).json({ error: 'Storage quota exceeded.' });
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        const { s3Key, s3Url } = await uploadToS3(
            fileBuffer,
            req.file.originalname,
            req.file.mimetype,
            space,
            organizationId
        );

        const doc = new Document({
            fileName: req.file.originalname,
            description: description?.trim() || '',
            space,
            organization: space === 'organization' ? organizationId : null,
            uploadedBy: req.user._id,
            s3Key,
            s3Url,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            permissions: [Document.buildPermission(req.user._id, 'owner', req.user._id)],
            metadata: { extension: path.extname(req.file.originalname).toLowerCase() }
        });

        if (autoTag === 'true' || autoTag === true) {
            try {
                const tagResult = await autoTagDocument(fileBuffer, req.file.mimetype, req.file.originalname);
                doc.tags = tagResult.tags;
                doc.metadata = { ...doc.metadata, ...tagResult.metadata };
                doc.isTagged = doc.tags.length > 0;
                doc.isAITagged = true;
            } catch (tagErr) {
                console.error('Auto-tag warning:', tagErr.message);
            }
        }

        await doc.save();
        cleanupFile(req.file.path);

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: doc._id,
                fileName: doc.fileName,
                space: doc.space,
                size: doc.fileSize,
                tags: doc.tags,
                uploadDate: doc.uploadDate
            }
        });
    } catch (err) {
        if (req.file) cleanupFile(req.file.path);
        console.error('External Upload error:', err);
        res.status(500).json({ error: 'Upload failed.', details: err.message });
    }
});

/**
 * GET /api/external/documents/:id
 * Retrieve document metadata and download link.
 */
router.get('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('uploadedBy', 'name email')
            .populate('organization', 'name');

        if (!doc) return res.status(404).json({ error: 'Document not found.' });

        const isOwner = doc.uploadedBy._id.toString() === req.user._id.toString();
        const isPublic = doc.space === 'public';
        
        let hasAccess = isOwner || isPublic;

        if (!hasAccess && doc.space === 'organization') {
            const org = await Organization.findById(doc.organization._id);
            if (org && org.isMember(req.user._id)) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            const hasPerm = doc.permissions.some(p => p.user.toString() === req.user._id.toString());
            if (hasPerm) hasAccess = true;
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this document.' });
        }

        const downloadUrl = await getDownloadUrl(doc.s3Key);

        res.json({
            success: true,
            document: {
                id: doc._id,
                fileName: doc.fileName,
                description: doc.description,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                tags: doc.tags,
                space: doc.space,
                uploadDate: doc.uploadDate,
                uploader: doc.uploadedBy.name,
                organization: doc.organization ? doc.organization.name : null,
            },
            downloadUrl
        });
    } catch (err) {
        console.error('External Fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve document.', details: err.message });
    }
});

module.exports = router;
