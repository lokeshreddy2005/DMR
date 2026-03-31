const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadToS3, getDownloadUrl, deleteFromS3 } = require('../services/s3');
const { checkQuota, getStorageSummary } = require('../services/storageQuota');
const { autoTagDocument } = require('../services/autoTagger');

const router = express.Router();

// All document routes require authentication
router.use(authMiddleware);

// Multer for temporary file upload (then forwarded to S3)
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

/**
 * POST /api/documents/upload
 * Upload a document to a space (public, private, or organization).
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { space, organizationId, description } = req.body;

    if (!space || !['public', 'private', 'organization'].includes(space)) {
      cleanupFile(req.file.path);
      return res.status(400).json({ error: 'Invalid space. Must be public, private, or organization.' });
    }

    // Validate org membership
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
      const role = org.getMemberRole(req.user._id);
      if (role === 'viewer') {
        cleanupFile(req.file.path);
        return res.status(403).json({ error: 'Viewers cannot upload documents.' });
      }
    }

    // Check storage quota
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
      return res.status(413).json({
        error: `Storage quota exceeded. Used ${usedMB} MB of ${limitMB} MB.`,
      });
    }

    // Read file and upload to S3
    const fileBuffer = fs.readFileSync(req.file.path);
    const { s3Key, s3Url } = await uploadToS3(
      fileBuffer,
      req.file.originalname,
      req.file.mimetype,
      space,
      organizationId
    );

    // Create document metadata
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
      permissions: [{ user: req.user._id, level: 'owner' }],
    });

    // Auto-tag if public
    if (space === 'public') {
      try {
        console.log(`🏷️  Auto-tagging "${req.file.originalname}"...`);
        const tagResult = await autoTagDocument(fileBuffer, req.file.mimetype, req.file.originalname);
        doc.tags = tagResult.tags;
        doc.metadata = tagResult.metadata;
        doc.isTagged = true;
        console.log(`✅ Tagged with ${tagResult.tags.length} keywords`);
      } catch (tagErr) {
        console.error('Auto-tag warning (non-blocking):', tagErr.message);
      }
    }

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');

    cleanupFile(req.file.path);

    res.status(201).json({
      message: 'Document uploaded successfully!',
      document: doc,
    });
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed.' });
  }
});

/**
 * PUT /api/documents/:id/make-public
 * Convert a private document to public, triggering auto-tagging.
 */
router.put('/:id/make-public', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can change document visibility.' });
    }

    if (doc.space === 'public') {
      return res.status(400).json({ error: 'Document is already public.' });
    }

    // Check public quota
    const quota = await checkQuota('public', req.user._id, null, doc.fileSize);
    if (!quota.allowed) {
      return res.status(413).json({ error: 'Public storage quota exceeded.' });
    }

    // Change space to public
    doc.space = 'public';
    doc.organization = null;

    // Auto-tag the document
    try {
      console.log(`🏷️  Auto-tagging "${doc.fileName}" (private→public)...`);
      const downloadUrl = await getDownloadUrl(doc.s3Key);
      // Fetch the file from S3 for tagging
      const response = await fetch(downloadUrl);
      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const tagResult = await autoTagDocument(fileBuffer, doc.mimeType, doc.fileName);
      doc.tags = tagResult.tags;
      doc.metadata = tagResult.metadata;
      doc.isTagged = true;
      console.log(`✅ Tagged with ${tagResult.tags.length} keywords`);
    } catch (tagErr) {
      console.error('Auto-tag warning:', tagErr.message);
      // Still make it public even if tagging fails
    }

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');

    res.json({ message: 'Document is now public!', document: doc });
  } catch (err) {
    console.error('Make public error:', err);
    res.status(500).json({ error: 'Failed to make document public.' });
  }
});

/**
 * GET /api/documents
 * List documents. Query params: space, organizationId
 */
router.get('/', async (req, res) => {
  try {
    const { space, organizationId } = req.query;
    let query = {};

    if (space === 'public') {
      query = { space: 'public' };
    } else if (space === 'private') {
      query = { space: 'private', uploadedBy: req.user._id };
    } else if (space === 'shared') {
      query = { 
        uploadedBy: { $ne: req.user._id },
        'permissions.user': req.user._id
      };
    } else if (space === 'organization' && organizationId) {
      const org = await Organization.findById(organizationId);
      if (!org || !org.isMember(req.user._id)) {
        return res.status(403).json({ error: 'Not a member of this organization.' });
      }
      query = { space: 'organization', organization: organizationId };
    } else {
      query = {
        $or: [
          { space: 'public' },
          { space: 'private', uploadedBy: req.user._id },
          { space: 'private', 'permissions.user': req.user._id },
        ],
      };
      const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
      if (userOrgs.length > 0) {
        query.$or.push({ space: 'organization', organization: { $in: userOrgs.map((o) => o._id) } });
      }
    }

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email avatarColor')
      .populate('organization', 'name avatarColor')
      .sort({ uploadDate: -1 });

    res.json({ documents });
  } catch (err) {
    console.error('Fetch docs error:', err);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

/**
 * GET /api/documents/recent
 * Get recent documents across all spaces the user has access to
 */
router.get('/recent', async (req, res) => {
  try {
    const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
    const orgIds = userOrgs.map((o) => o._id);

    const query = {
      $or: [
        { space: 'public' },
        { space: 'private', uploadedBy: req.user._id },
        { space: 'private', 'permissions.user': req.user._id },
        { space: 'organization', organization: { $in: orgIds } },
      ],
    };

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email avatarColor')
      .populate('organization', 'name avatarColor')
      .sort({ uploadDate: -1 })
      .limit(5);

    res.json({ documents });
  } catch (err) {
    console.error('Fetch recent docs error:', err);
    res.status(500).json({ error: 'Failed to fetch recent documents.' });
  }
});

/**
 * GET /api/documents/search
 * Search all documents user has access to by keyword
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }

    const regex = new RegExp(q.trim(), 'i');
    
    const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
    const orgIds = userOrgs.map((o) => o._id);

    const accessQuery = {
      $or: [
        { space: 'public' },
        { space: 'private', uploadedBy: req.user._id },
        { space: 'private', 'permissions.user': req.user._id },
        { space: 'organization', organization: { $in: orgIds } },
      ],
    };

    const searchQuery = {
      $or: [
        { tags: { $elemMatch: { $regex: regex } } },
        { fileName: { $regex: regex } },
        { 'metadata.primaryDomain': { $regex: regex } },
        { 'metadata.typeTags': { $elemMatch: { $regex: regex } } },
        { description: { $regex: regex } },
      ],
    };

    const documents = await Document.find({ $and: [accessQuery, searchQuery] })
      .populate('uploadedBy', 'name email avatarColor')
      .populate('organization', 'name avatarColor')
      .sort({ uploadDate: -1 })
      .limit(50);

    res.json({ documents, query: q });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

/**
 * GET /api/documents/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const userOrgs = await Organization.find({ 'members.user': userId }).select('_id');
    const orgIds = userOrgs.map((o) => o._id);

    const [publicCount, privateCount, orgCount] = await Promise.all([
      Document.countDocuments({ space: 'public' }),
      Document.countDocuments({
        space: 'private',
        $or: [{ uploadedBy: userId }, { 'permissions.user': userId }],
      }),
      Document.countDocuments({
        space: 'organization',
        organization: { $in: orgIds },
      }),
    ]);

    res.json({
      stats: {
        public: { count: publicCount, label: 'Public', icon: '🌐' },
        private: { count: privateCount, label: 'Private', icon: '🔒' },
        organization: { count: orgCount, label: 'Organizations', icon: '🏢' },
        total: publicCount + privateCount + orgCount,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

/**
 * GET /api/documents/storage
 */
router.get('/storage', async (req, res) => {
  try {
    const summary = await getStorageSummary(req.user._id);
    res.json({ storage: summary });
  } catch (err) {
    console.error('Storage error:', err);
    res.status(500).json({ error: 'Failed to fetch storage info.' });
  }
});

/**
 * GET /api/documents/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email avatarColor')
      .populate('permissions.user', 'name email avatarColor')
      .populate('organization', 'name avatarColor');

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!await checkDocAccess(doc, req.user._id)) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    res.json({ document: doc });
  } catch (err) {
    console.error('Get doc error:', err);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
});

/**
 * PUT /api/documents/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canEdit(req.user._id)) {
      return res.status(403).json({ error: 'You do not have edit access.' });
    }

    const { description, fileName } = req.body;
    if (description !== undefined) doc.description = description.trim();
    if (fileName) doc.fileName = fileName.trim();

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');

    res.json({ message: 'Document updated!', document: doc });
  } catch (err) {
    console.error('Update doc error:', err);
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

/**
 * DELETE /api/documents/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can delete this document.' });
    }

    try { await deleteFromS3(doc.s3Key); } catch (s3Err) {
      console.error('S3 delete warning:', s3Err.message);
    }

    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document deleted.' });
  } catch (err) {
    console.error('Delete doc error:', err);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

/**
 * GET /api/documents/:id/download
 */
router.get('/:id/download', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!await checkDocAccess(doc, req.user._id)) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    const downloadUrl = await getDownloadUrl(doc.s3Key);
    res.json({ downloadUrl, fileName: doc.fileName });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to generate download URL.' });
  }
});

/**
 * POST /api/documents/:id/permissions
 */
router.post('/:id/permissions', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can manage permissions.' });
    }

    const { email, level } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ error: 'No user found with that email.' });
    }

    const existingIdx = doc.permissions.findIndex(
      (p) => p.user.toString() === targetUser._id.toString()
    );
    if (existingIdx >= 0) {
      doc.permissions[existingIdx].level = level || 'viewer';
    } else {
      doc.permissions.push({ user: targetUser._id, level: level || 'viewer' });
    }

    await doc.save();
    await doc.populate('permissions.user', 'name email avatarColor');

    res.json({ message: `Access granted to ${targetUser.name}!`, document: doc });
  } catch (err) {
    console.error('Grant permission error:', err);
    res.status(500).json({ error: 'Failed to grant permission.' });
  }
});

/**
 * DELETE /api/documents/:id/permissions/:userId
 */
router.delete('/:id/permissions/:userId', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can manage permissions.' });
    }

    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot revoke your own access.' });
    }

    doc.permissions = doc.permissions.filter(
      (p) => p.user.toString() !== req.params.userId
    );

    await doc.save();
    await doc.populate('permissions.user', 'name email avatarColor');

    res.json({ message: 'Access revoked.', document: doc });
  } catch (err) {
    console.error('Revoke permission error:', err);
    res.status(500).json({ error: 'Failed to revoke permission.' });
  }
});

// --- Helpers --- //

async function checkDocAccess(doc, userId) {
  if (doc.space === 'public') return true;
  if (doc.uploadedBy.toString() === userId.toString() ||
    doc.uploadedBy._id?.toString() === userId.toString()) return true;
  if (doc.permissions.some((p) =>
    (p.user.toString() === userId.toString()) ||
    (p.user._id?.toString() === userId.toString())
  )) return true;
  if (doc.space === 'organization' && doc.organization) {
    const orgId = doc.organization._id || doc.organization;
    const org = await Organization.findById(orgId);
    if (org && org.isMember(userId)) return true;
  }
  return false;
}

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Cleanup error:', err);
    });
  }
}

module.exports = router;
