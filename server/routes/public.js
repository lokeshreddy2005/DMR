const express = require('express');
const crypto = require('crypto');
const Document = require('../models/Document');
const { getDownloadUrl, getPreviewUrl, getS3ObjectStream } = require('../services/s3');
const zlib = require('zlib');
const { getCache, setCache } = require('../services/redisClient');

const router = express.Router();

// ─── Public Download Token Store ────────────────────────────────────────────────
const DOWNLOAD_TOKEN_EXPIRY_MS = 60 * 1000; // 60 seconds
const publicDownloadTokens = new Map();

// ─── Public Preview Token Store ─────────────────────────────────────────────────
const PREVIEW_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
const publicPreviewTokens = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of publicDownloadTokens.entries()) {
    if (now - data.createdAt > DOWNLOAD_TOKEN_EXPIRY_MS) {
      publicDownloadTokens.delete(token);
    }
  }
  for (const [token, data] of publicPreviewTokens.entries()) {
    if (now - data.createdAt > PREVIEW_TOKEN_EXPIRY_MS) {
      publicPreviewTokens.delete(token);
    }
  }
}, 2 * 60 * 1000);

/**
 * GET /api/public/secure-download/:token
 * Consume a one-time public download token and stream the file from S3.
 */
router.get('/secure-download/:token', async (req, res) => {
  try {
    const tokenData = publicDownloadTokens.get(req.params.token);

    if (!tokenData) {
      return res.status(404).json({ error: 'Download link expired or invalid.' });
    }

    if (Date.now() - tokenData.createdAt > DOWNLOAD_TOKEN_EXPIRY_MS) {
      publicDownloadTokens.delete(req.params.token);
      return res.status(410).json({ error: 'Download link has expired.' });
    }

    // Consume the token (single-use)
    publicDownloadTokens.delete(req.params.token);

    const s3Response = await getS3ObjectStream(tokenData.s3Key);

    const safeName = (tokenData.fileName || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', tokenData.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    if (tokenData.isCompressed) {
      if (tokenData.originalSize) res.setHeader('Content-Length', tokenData.originalSize);
      s3Response.Body.pipe(zlib.createGunzip()).pipe(res);
    } else {
      if (s3Response.ContentLength) {
        res.setHeader('Content-Length', s3Response.ContentLength);
      }
      s3Response.Body.pipe(res);
    }
  } catch (err) {
    console.error('Public secure download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file.' });
    }
  }
});

/**
 * GET /api/public/secure-preview/:token
 * Proxy the S3 object for public preview purposes (with range support).
 */
router.get('/secure-preview/:token', async (req, res) => {
  try {
    const tokenData = publicPreviewTokens.get(req.params.token);

    if (!tokenData) {
      return res.status(404).json({ error: 'Preview link expired or invalid.' });
    }

    if (Date.now() - tokenData.createdAt > PREVIEW_TOKEN_EXPIRY_MS) {
      publicPreviewTokens.delete(req.params.token);
      return res.status(410).json({ error: 'Preview link has expired.' });
    }

    const rangeHeader = req.headers.range;
    const s3Response = await getS3ObjectStream(tokenData.s3Key, rangeHeader);

    if (tokenData.isCompressed) {
      const safeName = (tokenData.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', tokenData.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      if (tokenData.originalSize) res.setHeader('Content-Length', tokenData.originalSize);
      s3Response.Body.pipe(zlib.createGunzip()).pipe(res);
      return;
    }

    const safeName = (tokenData.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', tokenData.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);

    if (s3Response.ContentLength) res.setHeader('Content-Length', s3Response.ContentLength);
    if (s3Response.ContentRange) res.setHeader('Content-Range', s3Response.ContentRange);
    if (s3Response.AcceptRanges) res.setHeader('Accept-Ranges', s3Response.AcceptRanges);

    res.status(rangeHeader && s3Response.ContentRange ? 206 : 200);
    s3Response.Body.pipe(res);
  } catch (err) {
    console.error('Public secure preview error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to preview file.' });
    }
  }
});

/**
 * GET /api/public/documents
 * List public documents with advanced filtering, search, and pagination.
 */
router.get('/documents', async (req, res) => {
    try {
        
        const { 
            q, page = 1, limit = 20, 
            minSize, maxSize, 
            startDate, endDate, 
            extension, tags, tagsMode,
            isTagged, departmentOwner,
            uploadedBy, academicYear, organizationId, sort
        } = req.query;

        const accessQuery = { space: 'public' };
        let filterQuery = {};

        if (q && q.trim().length >= 2) {
            const regex = new RegExp(q.trim(), 'i');
            filterQuery.$or = [
                { tags: { $elemMatch: { $regex: regex } } },
                { fileName: { $regex: regex } },
                { 'metadata.primaryDomain': { $regex: regex } },
                { 'metadata.typeTags': { $elemMatch: { $regex: regex } } },
                { description: { $regex: regex } },
            ];
        }

        if (minSize || maxSize) {
            filterQuery.fileSize = {};
            if (minSize) filterQuery.fileSize.$gte = Number(minSize);
            if (maxSize) filterQuery.fileSize.$lte = Number(maxSize);
        }

        if (startDate || endDate) {
            filterQuery.uploadDate = {};
            if (startDate) filterQuery.uploadDate.$gte = new Date(startDate);
            if (endDate) filterQuery.uploadDate.$lte = new Date(endDate);
        }

        if (extension) {
            const extLower = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
            const escapedExt = extLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const MIME_MAP = {
                '.pdf': ['application/pdf'],
                '.doc': ['application/msword'],
                '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                '.xls': ['application/vnd.ms-excel'],
                '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                '.ppt': ['application/vnd.ms-powerpoint'],
                '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
                '.txt': ['text/plain'],
                '.png': ['image/png'],
                '.jpg': ['image/jpeg'],
                '.jpeg': ['image/jpeg'],
                '.gif': ['image/gif'],
                '.mp4': ['video/mp4'],
                '.mp3': ['audio/mpeg'],
                '.zip': ['application/zip', 'application/x-zip-compressed'],
            };
            const mimeTypes = MIME_MAP[extLower] || [];

            const extConditions = [
                { 'metadata.extension': extLower },
                { fileName: { $regex: `${escapedExt}$`, $options: 'i' } }
            ];
            if (mimeTypes.length > 0) {
                extConditions.push({ mimeType: { $in: mimeTypes } });
            }

            filterQuery.$and = [
                ...(filterQuery.$and || []),
                { $or: extConditions }
            ];
        }
        
        if (departmentOwner) {
            filterQuery['metadata.departmentOwner'] = departmentOwner;
        }

        if (tags) {
            const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
            const tagRegexes = tagsArray.map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            filterQuery.tags = tagsMode === 'all' ? { $all: tagRegexes } : { $in: tagRegexes };
        }

        if (isTagged !== undefined) {
             filterQuery.isTagged = isTagged === 'true';
        }

        if (uploadedBy) {
            const ids = uploadedBy.split(',').filter(Boolean);
            filterQuery.uploadedBy = ids.length === 1 ? ids[0] : { $in: ids };
        }

        if (academicYear) {
            filterQuery['metadata.academicYear'] = academicYear;
        }

        if (organizationId) {
            filterQuery.organization = organizationId;
        }

        const finalQuery = Object.keys(filterQuery).length > 0 
            ? { $and: [accessQuery, filterQuery] } 
            : accessQuery;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        let sortOption = { uploadDate: -1 };
        if (sort === 'oldest') sortOption = { uploadDate: 1 };
        else if (sort === 'sizeAsc') sortOption = { fileSize: 1 };
        else if (sort === 'sizeDesc') sortOption = { fileSize: -1 };
        else if (sort === 'nameAsc') sortOption = { fileName: 1 };
        else if (sort === 'nameDesc') sortOption = { fileName: -1 };

        const [documents, totalCount] = await Promise.all([
            Document.find(finalQuery)
                .populate('uploadedBy', 'name avatarColor')
                .select('-permissions -shareLogs -s3Key')
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum),
            Document.countDocuments(finalQuery)
        ]);

        const totalPages = Math.ceil(totalCount / limitNum);

        res.json({ 
            documents,
            totalCount,
            currentPage: parseInt(page),
            totalPages
        });
    } catch (err) {
        console.error('Public docs error:', err);
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

/**
 * GET /api/public/documents/tags
 * Get all distinct tags from public documents, with counts.
 */
router.get('/documents/tags', async (req, res) => {
    try {
        const cacheKey = 'tags:public:all';
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return res.json({ tags: cachedData });
        }

        const tagAgg = await Document.aggregate([
            { $match: { space: 'public', isTagged: true } },
            { $unwind: '$tags' },
            { $group: { _id: { $toLower: '$tags' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 500 },
        ]);

        const tags = tagAgg.map((t) => ({ tag: t._id, count: t.count }));
        
        await setCache(cacheKey, tags, 3600); // 1 hour

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
        const cacheKey = `doc:public:${req.params.id}`;
        let doc = await getCache(cacheKey);
        
        if (!doc) {
            const dbDoc = await Document.findById(req.params.id)
                .populate('uploadedBy', 'name avatarColor')
                .select('-permissions -shareLogs -s3Key');

            if (!dbDoc || dbDoc.space !== 'public') {
                return res.status(404).json({ error: 'Document not found.' });
            }
            
            doc = dbDoc.toJSON ? dbDoc.toJSON() : dbDoc;
            await setCache(cacheKey, doc, 900); // 15 mins
        }

        res.json({ document: doc });
    } catch (err) {
        console.error('Public doc detail error:', err);
        res.status(500).json({ error: 'Failed to fetch document.' });
    }
});

/**
 * GET /api/public/documents/:id/preview
 * Preview a public document inline — no auth required.
 */
router.get('/documents/:id/preview', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.space !== 'public') {
            return res.status(404).json({ error: 'Document not found.' });
        }

        const previewToken = crypto.randomBytes(32).toString('hex');
        publicPreviewTokens.set(previewToken, {
            s3Key: doc.s3Key,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            isCompressed: doc.isCompressed || false,
            originalSize: doc.originalSize || 0,
            documentId: doc._id.toString(),
            createdAt: Date.now(),
        });
        
        const previewUrl = `${process.env.API_URL || 'http://localhost:5000'}/api/public/secure-preview/${previewToken}`;
        res.json({ previewUrl, fileName: doc.fileName, mimeType: doc.mimeType, fileSize: doc.fileSize });
    } catch (err) {
        console.error('Public preview error:', err);
        res.status(500).json({ error: 'Failed to generate preview URL.' });
    }
});

/**
 * GET /api/public/documents/:id/download
 * Generate a one-time download token for a public document.
 */
router.get('/documents/:id/download', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.space !== 'public') {
            return res.status(404).json({ error: 'Document not found.' });
        }

        const downloadToken = crypto.randomBytes(32).toString('hex');
        publicDownloadTokens.set(downloadToken, {
            s3Key: doc.s3Key,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            isCompressed: doc.isCompressed || false,
            originalSize: doc.originalSize || 0,
            documentId: doc._id.toString(),
            createdAt: Date.now(),
        });

        res.json({ downloadToken, fileName: doc.fileName });
    } catch (err) {
        console.error('Public download error:', err);
        res.status(500).json({ error: 'Failed to generate download token.' });
    }
});

/**
 * GET /api/public/shared/:token
 * Access a document via a share link token — no auth required for 'anyone' mode.
 * Returns document info + download URL based on the link's role.
 */
router.get('/shared/:token', async (req, res) => {
    try {
        const doc = await Document.findOne({ 'linkSharing.token': req.params.token })
            .populate('uploadedBy', 'name avatarColor');

        if (!doc || !doc.linkSharing?.enabled) {
            return res.status(404).json({ error: 'Shared link not found or has been disabled.' });
        }

        // For 'organization' mode, this route won't work without auth
        // (the authenticated documents route + checkDocAccess handles that)
        if (doc.linkSharing.mode === 'organization') {
            return res.status(403).json({
                error: 'This document is shared with organization members only. Please log in.',
                requiresAuth: true,
                documentId: doc._id,
            });
        }

        // For 'anyone' mode, serve the document
        const linkRole = doc.linkSharing.role || 'viewer';
        const canDownload = linkRole === 'downloader' || linkRole === 'manager';

        const result = {
            document: {
                _id: doc._id,
                fileName: doc.fileName,
                description: doc.description,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                tags: doc.tags,
                uploadDate: doc.uploadDate,
                uploadedBy: doc.uploadedBy,
            },
            role: linkRole,
            canDownload,
        };

        if (canDownload) {
            result.downloadUrl = `${process.env.API_URL || 'http://localhost:5000'}/api/public/shared/${req.params.token}/download`;
        }

        res.json(result);
    } catch (err) {
        console.error('Shared link access error:', err);
        res.status(500).json({ error: 'Failed to access shared document.' });
    }
});

/**
 * GET /api/public/shared/:token/download
 * Download a document via a share link token.
 */
router.get('/shared/:token/download', async (req, res) => {
    try {
        const doc = await Document.findOne({ 'linkSharing.token': req.params.token });

        if (!doc || !doc.linkSharing?.enabled || doc.linkSharing.mode === 'organization') {
            return res.status(404).json({ error: 'Shared link not found, disabled, or requires login.' });
        }

        const linkRole = doc.linkSharing.role || 'viewer';
        if (linkRole !== 'downloader' && linkRole !== 'manager') {
            return res.status(403).json({ error: 'This shared link does not allow downloading.' });
        }

        const s3Response = await getS3ObjectStream(doc.s3Key);
        const safeName = (doc.fileName || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
        
        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

        if (doc.isCompressed) {
            if (doc.originalSize) res.setHeader('Content-Length', doc.originalSize);
            s3Response.Body.pipe(zlib.createGunzip()).pipe(res);
        } else {
            if (s3Response.ContentLength) {
                res.setHeader('Content-Length', s3Response.ContentLength);
            }
            s3Response.Body.pipe(res);
        }
    } catch (err) {
        console.error('Shared link download error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download shared document.' });
        }
    }
});

module.exports = router;
