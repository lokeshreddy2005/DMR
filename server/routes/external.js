const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadToS3, getDownloadUrl, deleteFromS3 } = require('../services/s3');
const { checkQuota } = require('../services/storageQuota');
const { autoTagDocument } = require('../services/autoTagger');
const { routeDocumentToVaults } = require('../services/vaultRouter');

const router = express.Router();

// ─── CORS for external API ──────────────────────────────────────
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ─── (#40) Require strict API key or JWT authentication ─────────
router.use(authMiddleware);

// ─── Multer setup ───────────────────────────────────────────────
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

// ─── (#48) Flexible Tag Input Handling ──────────────────────────
// Accepts: JSON array, JSON string that parses to array, or comma-separated string
function parseFlexibleTags(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(t => String(t).trim()).filter(Boolean);
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
                return parsed.map(t => String(t).trim()).filter(Boolean);
            }
        } catch (e) {
            // Not valid JSON — treat as comma-separated string
        }
        return input.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

// ─── (#49) Consistent Error Response Builder ────────────────────
function errorResponse(res, status, error, details = null) {
    const body = { success: false, error };
    if (details) body.details = details;
    return res.status(status).json(body);
}

// ─── (#51) Resolve user's effective role for a document ─────────
function resolveUserRole(doc, userId) {
    const uid = userId.toString();

    // Owner check
    const uploaderId = doc.uploadedBy?._id?.toString() || doc.uploadedBy?.toString();
    if (uploaderId === uid) return 'owner';

    // Explicit permission check
    const perm = (doc.permissions || []).find(p => {
        const permUid = p.user?._id?.toString() || p.user?.toString();
        return permUid === uid;
    });
    if (perm) {
        // Check expiry
        if (perm.expiresAt && new Date(perm.expiresAt) < new Date()) return null;
        return perm.role || perm.level || 'viewer';
    }

    return null;
}

// ─── (#51) Check document access (with org membership) ──────────
async function checkExternalAccess(doc, userId) {
    const uid = userId.toString();

    // Owner
    const uploaderId = doc.uploadedBy?._id?.toString() || doc.uploadedBy?.toString();
    if (uploaderId === uid) return { hasAccess: true, role: 'owner' };

    // Public
    if (doc.space === 'public') return { hasAccess: true, role: 'viewer' };

    // Organization membership
    if (doc.space === 'organization' && doc.organization) {
        const orgId = doc.organization._id || doc.organization;
        const org = await Organization.findById(orgId);
        if (org && org.isMember(userId)) {
            const orgRole = org.getMemberRole(userId);
            return { hasAccess: true, role: orgRole === 'admin' ? 'collaborator' : 'viewer' };
        }
    }

    // Explicit permission
    const role = resolveUserRole(doc, userId);
    if (role) return { hasAccess: true, role };

    return { hasAccess: false, role: null };
}

// ─── (#51) Build capability flags from role ─────────────────────
function buildCapabilities(role) {
    const ROLE_CAPS = {
        owner:        { canView: true, canDownload: true, canEdit: true, canShare: true, canDelete: true },
        collaborator: { canView: true, canDownload: true, canEdit: true, canShare: true, canDelete: false },
        viewer:       { canView: true, canDownload: true, canEdit: false, canShare: false, canDelete: false },
    };
    return ROLE_CAPS[role] || { canView: true, canDownload: false, canEdit: false, canShare: false, canDelete: false };
}

/**
 * ──────────────────────────────────────────────────────────────────
 * POST /api/external/upload
 * (#40) Secure API Upload Endpoint
 * (#41) Manual Tag Support
 * (#42) Automatic AI Tagging
 * (#48) Flexible Tag Input Handling
 * (#49) Error Handling & Response Messages
 * ──────────────────────────────────────────────────────────────────
 */
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        // (#49) Validate file presence
        if (!req.file) {
            return errorResponse(res, 400, 'No file uploaded. Attach a file with the field name "document".');
        }

        const { space, organizationId, description, autoTag, manualTags } = req.body;

        // (#49) Validate space
        if (!space || !['public', 'private', 'organization'].includes(space)) {
            cleanupFile(req.file.path);
            return errorResponse(res, 400,
                'Invalid or missing "space" parameter. Must be one of: public, private, organization.',
                `Received: "${space || '(empty)'}"`
            );
        }

        // (#40) Validate organization membership + (#51) role check
        if (space === 'organization') {
            if (!organizationId) {
                cleanupFile(req.file.path);
                return errorResponse(res, 400, 'organizationId is required when space is "organization".');
            }
            const org = await Organization.findById(organizationId);
            if (!org) {
                cleanupFile(req.file.path);
                return errorResponse(res, 404, 'Organization not found.', `ID: ${organizationId}`);
            }
            if (!org.isMember(req.user._id)) {
                cleanupFile(req.file.path);
                return errorResponse(res, 403, 'You are not a member of this organization.');
            }
            const orgRole = org.getMemberRole(req.user._id);
            if (orgRole === 'viewer') {
                cleanupFile(req.file.path);
                return errorResponse(res, 403, 'Organization viewers cannot upload documents. Contact an admin to upgrade your role.');
            }
        }

        // (#40) Check storage quota
        const quota = await checkQuota(
            space,
            req.user._id,
            space === 'organization' ? organizationId : null,
            req.file.size
        );
        if (!quota.allowed) {
            cleanupFile(req.file.path);
            const usedMB = (quota.used / 1024 / 1024).toFixed(1);
            const limitMB = (quota.limit / 1024 / 1024).toFixed(0);
            return errorResponse(res, 413,
                `Storage quota exceeded. Used ${usedMB} MB of ${limitMB} MB.`,
                `File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB, remaining: ${((quota.limit - quota.used) / 1024 / 1024).toFixed(2)} MB`
            );
        }

        // Read file into memory only if auto-tagging is enabled
        let fileBuffer = null;
        if (autoTag === 'true' || autoTag === true) {
            fileBuffer = fs.readFileSync(req.file.path);
        }

        // Stream file to S3 (with automatic gzip for compressible MIME types)
        let s3Result;
        try {
            s3Result = await uploadToS3(
                req.file.path,
                req.file.originalname,
                req.file.mimetype,
                space,
                organizationId
            );
        } finally {
            // Guarantee cleanup of temporary file even if S3 upload fails
            cleanupFile(req.file.path);
        }

        const { s3Key, s3Url, isCompressed, compressedSize } = s3Result;

        const ext = path.extname(req.file.originalname);
        const baseName = path.basename(req.file.originalname, ext);

        const doc = new Document({
            fileName: baseName,
            description: description?.trim() || '',
            space,
            organization: space === 'organization' ? organizationId : null,
            uploadedBy: req.user._id,
            s3Key,
            s3Url,
            mimeType: req.file.mimetype,
            originalSize: req.file.size,
            fileSize: compressedSize,
            isCompressed,
            permissions: [Document.buildPermission(req.user._id, 'owner', req.user._id)],
            metadata: { extension: ext.toLowerCase() }
        });

        // ─── (#41) Manual Tag Support with (#48) Flexible Input ─────
        const parsedManualTags = parseFlexibleTags(manualTags);
        if (parsedManualTags.length > 0) {
            doc.tags = parsedManualTags;
            doc.isTagged = true;
        }

        // ─── (#42) Automatic AI Tagging ─────────────────────────────
        if (autoTag === 'true' || autoTag === true) {
            try {
                console.log(`🏷️  Auto-tagging "${req.file.originalname}"...`);
                if (!fileBuffer) fileBuffer = fs.readFileSync(req.file.path); // Fallback
                const tagResult = await autoTagDocument(fileBuffer, req.file.mimetype, req.file.originalname);
                doc.tags = [...new Set([...doc.tags, ...tagResult.tags])];
                doc.metadata = { ...doc.metadata, ...tagResult.metadata };
                doc.isTagged = doc.tags.length > 0;
                doc.isAITagged = true;
                console.log(`✅ Tagged with ${tagResult.tags.length} AI keywords`);
            } catch (tagErr) {
                console.error('Auto-tag warning (non-blocking):', tagErr.message);
            }
        }

        // Vault routing (if tags exist)
        if (doc.tags.length > 0) {
            try {
                const vaults = await routeDocumentToVaults(doc.tags, doc.metadata, doc.fileName);
                doc.metadata.vaults = vaults;
                doc.isVaultRouted = true;
            } catch (vaultErr) {
                console.error('Vault routing warning (non-blocking):', vaultErr.message);
            }
        }

        await doc.save();

        if (isCompressed) {
            const savedPct = ((1 - compressedSize / req.file.size) * 100).toFixed(1);
            console.log(`🗜️  Compressed "${req.file.originalname}": ${(req.file.size / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (saved ${savedPct}%)`);
        }

        // (#49) Detailed success response
        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully.',
            document: {
                id: doc._id,
                fileName: doc.fileName,
                description: doc.description,
                space: doc.space,
                mimeType: doc.mimeType,
                originalSize: doc.originalSize,
                fileSize: doc.fileSize,
                isCompressed: doc.isCompressed,
                tags: doc.tags,
                isAITagged: doc.isAITagged,
                isVaultRouted: doc.isVaultRouted,
                uploadDate: doc.uploadDate,
                organization: doc.organization || null,
            }
        });
    } catch (err) {
        if (req.file) cleanupFile(req.file.path);
        console.error('External Upload error:', err);
        errorResponse(res, 500, 'Upload failed. Please try again.', err.message);
    }
});

/**
 * ──────────────────────────────────────────────────────────────────
 * PUT /api/external/documents/:id/tags
 * (#41) Manual Tag Support — update tags on existing document
 * (#48) Flexible Tag Input Handling
 * ──────────────────────────────────────────────────────────────────
 */
router.put('/documents/:id/tags', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return errorResponse(res, 404, 'Document not found.');

        if (!doc.canEdit(req.user._id)) {
            return errorResponse(res, 403, 'You do not have edit access to this document.');
        }

        const { tags, autoTag } = req.body;

        const parsedTags = parseFlexibleTags(tags);
        doc.tags = parsedTags;
        doc.isTagged = parsedTags.length > 0;

        if (parsedTags.length === 0) {
            doc.isAITagged = false;
            doc.metadata.vaults = [];
            doc.isVaultRouted = false;
        }

        // Optionally also trigger AI tagging
        if (autoTag === 'true' || autoTag === true) {
            try {
                const downloadUrl = await getDownloadUrl(doc.s3Key);
                const response = await fetch(downloadUrl);
                const fileBuffer = Buffer.from(await response.arrayBuffer());
                const tagResult = await autoTagDocument(fileBuffer, doc.mimeType, doc.fileName);
                doc.tags = [...new Set([...doc.tags, ...tagResult.tags])];
                doc.metadata = { ...doc.metadata, ...tagResult.metadata };
                doc.isTagged = doc.tags.length > 0;
                doc.isAITagged = true;
            } catch (tagErr) {
                console.error('Auto-tag warning:', tagErr.message);
            }
        }

        // Re-run vault routing
        if (doc.tags.length > 0) {
            try {
                const vaults = await routeDocumentToVaults(doc.tags, doc.metadata, doc.fileName);
                doc.metadata.vaults = vaults;
                doc.isVaultRouted = true;
            } catch (vaultErr) {
                console.error('Vault routing warning:', vaultErr.message);
            }
        }

        await doc.save();

        res.json({
            success: true,
            message: `Tags updated successfully. Document now has ${doc.tags.length} tag(s).`,
            document: {
                id: doc._id,
                fileName: doc.fileName,
                tags: doc.tags,
                isAITagged: doc.isAITagged,
                isVaultRouted: doc.isVaultRouted,
            }
        });
    } catch (err) {
        console.error('External tag update error:', err);
        errorResponse(res, 500, 'Failed to update tags.', err.message);
    }
});

/**
 * ──────────────────────────────────────────────────────────────────
 * GET /api/external/documents
 * (#52) List / search documents the authenticated user can access
 * ──────────────────────────────────────────────────────────────────
 */
router.get('/documents', async (req, res) => {
    try {
        const { space, organizationId, q, tags, page = 1, limit = 20 } = req.query;

        let accessQuery = {};
        if (space === 'public') {
            accessQuery = { space: 'public' };
        } else if (space === 'private') {
            accessQuery = { space: 'private', uploadedBy: req.user._id };
        } else if (space === 'organization' && organizationId) {
            const org = await Organization.findById(organizationId);
            if (!org || !org.isMember(req.user._id)) {
                return errorResponse(res, 403, 'Not a member of this organization.');
            }
            accessQuery = { space: 'organization', organization: organizationId };
        } else {
            const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
            accessQuery = {
                $or: [
                    { space: 'public' },
                    { space: 'private', uploadedBy: req.user._id },
                    { permissions: { $elemMatch: { user: req.user._id } } },
                    ...(userOrgs.length > 0
                        ? [{ space: 'organization', organization: { $in: userOrgs.map(o => o._id) } }]
                        : []),
                ],
            };
        }

        let filterQuery = {};
        if (q && q.trim().length >= 2) {
            const regex = new RegExp(q.trim(), 'i');
            filterQuery.$or = [
                { fileName: { $regex: regex } },
                { description: { $regex: regex } },
                { tags: { $elemMatch: { $regex: regex } } },
            ];
        }
        if (tags) {
            const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagArr.length > 0) {
                filterQuery.tags = { $in: tagArr.map(t => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) };
            }
        }

        const finalQuery = Object.keys(filterQuery).length > 0
            ? { $and: [accessQuery, filterQuery] }
            : accessQuery;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);

        const [documents, totalCount] = await Promise.all([
            Document.find(finalQuery)
                .select('fileName description space mimeType fileSize tags uploadDate organization uploadedBy isTagged isAITagged')
                .populate('uploadedBy', 'name email')
                .populate('organization', 'name')
                .sort({ uploadDate: -1 })
                .skip(skip)
                .limit(limitNum),
            Document.countDocuments(finalQuery),
        ]);

        res.json({
            success: true,
            documents: documents.map(doc => ({
                id: doc._id,
                fileName: doc.fileName,
                description: doc.description,
                space: doc.space,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                tags: doc.tags,
                isAITagged: doc.isAITagged || false,
                uploadDate: doc.uploadDate,
                uploader: doc.uploadedBy?.name || 'Unknown',
                organization: doc.organization?.name || null,
            })),
            pagination: {
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
                limit: limitNum,
            },
        });
    } catch (err) {
        console.error('External list error:', err);
        errorResponse(res, 500, 'Failed to list documents.', err.message);
    }
});

/**
 * ──────────────────────────────────────────────────────────────────
 * GET /api/external/documents/:id
 * (#52) Retrieve document metadata and download link
 * (#51) Role-based access — returns user's effective role
 * (#49) Comprehensive error responses
 * ──────────────────────────────────────────────────────────────────
 */
router.get('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('uploadedBy', 'name email')
            .populate('organization', 'name');

        if (!doc) {
            return errorResponse(res, 404, 'Document not found.', `ID: ${req.params.id}`);
        }

        const { hasAccess, role } = await checkExternalAccess(doc, req.user._id);

        if (!hasAccess) {
            return errorResponse(res, 403,
                'Access denied. You do not have permission to view this document.',
                'Request access from the document owner or an organization admin.'
            );
        }

        const downloadUrl = await getDownloadUrl(doc.s3Key);
        const caps = buildCapabilities(role);

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
                isAITagged: doc.isAITagged || false,
                isVaultRouted: doc.isVaultRouted || false,
                uploadDate: doc.uploadDate,
                uploader: {
                    name: doc.uploadedBy?.name || 'Unknown',
                    email: doc.uploadedBy?.email || '',
                },
                organization: doc.organization ? { id: doc.organization._id, name: doc.organization.name } : null,
            },
            access: { role, ...caps },
            downloadUrl,
        });
    } catch (err) {
        console.error('External Fetch error:', err);
        errorResponse(res, 500, 'Failed to retrieve document.', err.message);
    }
});

/**
 * ──────────────────────────────────────────────────────────────────
 * GET /api/external/documents/:id/download
 * (#52) Dedicated download endpoint — returns just the download URL
 * (#51) Role-based access — enforces download permission
 * ──────────────────────────────────────────────────────────────────
 */
router.get('/documents/:id/download', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('uploadedBy', 'name email');

        if (!doc) {
            return errorResponse(res, 404, 'Document not found.');
        }

        const { hasAccess, role } = await checkExternalAccess(doc, req.user._id);

        if (!hasAccess) {
            return errorResponse(res, 403, 'Access denied to this document.');
        }

        const caps = buildCapabilities(role);
        if (!caps.canDownload) {
            return errorResponse(res, 403,
                'You can view this document but do not have download permission.',
                `Your role: ${role}.`
            );
        }

        const downloadUrl = await getDownloadUrl(doc.s3Key);

        res.json({
            success: true,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            downloadUrl,
        });
    } catch (err) {
        console.error('External download error:', err);
        errorResponse(res, 500, 'Failed to generate download URL.', err.message);
    }
});

/**
 * ──────────────────────────────────────────────────────────────────
 * DELETE /api/external/documents/:id
 * (#51) Role-based delete — only owner can delete
 * ──────────────────────────────────────────────────────────────────
 */
router.delete('/documents/:id', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return errorResponse(res, 404, 'Document not found.');

        if (!doc.canDeleteDoc(req.user._id)) {
            return errorResponse(res, 403, 'Only the document owner can delete this document.');
        }

        try {
            await deleteFromS3(doc.s3Key);
        } catch (s3Err) {
            console.error('S3 delete warning:', s3Err.message);
        }

        await Document.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Document deleted successfully.',
            deletedId: req.params.id,
        });
    } catch (err) {
        console.error('External delete error:', err);
        errorResponse(res, 500, 'Failed to delete document.', err.message);
    }
});

module.exports = router;
