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
 * Body fields: space, organizationId (optional), description (optional)
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

    // Validate org membership for organization uploads
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
        error: `Storage quota exceeded. Used ${usedMB} MB of ${limitMB} MB. Free up space or contact admin.`,
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

    // Create document metadata in MongoDB
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

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');

    // Cleanup temp file
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
      // Also include docs shared with the user
    } else if (space === 'organization' && organizationId) {
      const org = await Organization.findById(organizationId);
      if (!org || !org.isMember(req.user._id)) {
        return res.status(403).json({ error: 'Not a member of this organization.' });
      }
      query = { space: 'organization', organization: organizationId };
    } else {
      // Default: return all docs the user can see
      query = {
        $or: [
          { space: 'public' },
          { space: 'private', uploadedBy: req.user._id },
          { space: 'private', 'permissions.user': req.user._id },
          { space: 'organization', 'permissions.user': req.user._id },
        ],
      };

      // Also include org docs where user is a member
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
 * GET /api/documents/stats
 * Get document counts by space.
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
 * Get storage usage summary with quotas.
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
 * Get single document details.
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email avatarColor')
      .populate('permissions.user', 'name email avatarColor')
      .populate('organization', 'name avatarColor');

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    // Check access
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
 * Update document metadata.
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
 * Delete document from S3 and MongoDB.
 */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can delete this document.' });
    }

    // Delete from S3
    try {
      await deleteFromS3(doc.s3Key);
    } catch (s3Err) {
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
 * Get a signed download URL.
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
 * Grant access to a user. Body: { email, level }
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
    if (!['viewer', 'editor', 'owner'].includes(level || 'viewer')) {
      return res.status(400).json({ error: 'Invalid permission level.' });
    }

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ error: 'No user found with that email.' });
    }

    // Check if already has permission
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
 * Revoke a user's access.
 */
router.delete('/:id/permissions/:userId', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can manage permissions.' });
    }

    // Cannot revoke own access
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

/**
 * Helper: Check if user has access to a document.
 */
async function checkDocAccess(doc, userId) {
  if (doc.space === 'public') return true;
  if (doc.uploadedBy.toString() === userId.toString() ||
    doc.uploadedBy._id?.toString() === userId.toString()) return true;
  if (doc.permissions.some((p) =>
    (p.user.toString() === userId.toString()) ||
    (p.user._id?.toString() === userId.toString())
  )) return true;

  // Check org membership for org docs
  if (doc.space === 'organization' && doc.organization) {
    const orgId = doc.organization._id || doc.organization;
    const org = await Organization.findById(orgId);
    if (org && org.isMember(userId)) return true;
  }

  return false;
}

/**
 * Helper: Cleanup temp file.
 */
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Cleanup error:', err);
    });
  }
}

module.exports = router;
