const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const { ROLE_PRESETS, VALID_ROLES } = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadToS3, getDownloadUrl, deleteFromS3 } = require('../services/s3');
const { checkQuota, getStorageSummary } = require('../services/storageQuota');
const { autoTagDocument } = require('../services/autoTagger');
const RecentAccess = require('../models/RecentAccess');

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

    const { space, organizationId, description, autoTag, manualTags } = req.body;

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
      permissions: [Document.buildPermission(req.user._id, 'owner', req.user._id)],
      metadata: { extension: path.extname(req.file.originalname).toLowerCase() }
    });

    // Handle Initial Manual Tags
    let initialTags = [];
    if (manualTags) {
        if (Array.isArray(manualTags)) {
            initialTags = manualTags;
        } else if (typeof manualTags === 'string') {
            try {
                const parsed = JSON.parse(manualTags);
                if (Array.isArray(parsed)) {
                    initialTags = parsed;
                } else {
                    initialTags = manualTags.split(',').map(s => s.trim()).filter(Boolean);
                }
            } catch (e) {
                initialTags = manualTags.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
    }
    
    if (initialTags.length > 0) {
      doc.tags = initialTags;
      doc.isTagged = true;
    }

    // Auto-tag if requested
    if (autoTag === 'true' || autoTag === true) {
      try {
        console.log(`🏷️  Auto-tagging "${req.file.originalname}"...`);
        const tagResult = await autoTagDocument(fileBuffer, req.file.mimetype, req.file.originalname);
        doc.tags = [...new Set([...initialTags, ...tagResult.tags])];
        doc.metadata = tagResult.metadata;
        doc.isTagged = doc.tags.length > 0;
        doc.isAITagged = true;
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
 * PUT /api/documents/:id/change-space
 * Move a document between spaces (e.g. private -> public or org), triggering auto-tagging optionally.
 */
router.put('/:id/change-space', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.isOwner(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can change document space.' });
    }

    const { targetSpace, organizationId, autoTag } = req.body;

    if (targetSpace === 'public') {
      if (doc.space === 'public') {
        return res.status(400).json({ error: 'Document is already public.' });
      }
      const quota = await checkQuota('public', req.user._id, null, doc.fileSize);
      if (!quota.allowed) {
        return res.status(413).json({ error: 'Public storage quota exceeded.' });
      }
      doc.space = 'public';
      doc.organization = null;
    } else if (targetSpace === 'organization') {
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required.' });
      }
      const org = await Organization.findById(organizationId);
      if (!org || !org.isMember(req.user._id)) {
        return res.status(403).json({ error: 'You are not a member of this organization.' });
      }
      const quota = await checkQuota('organization', req.user._id, organizationId, doc.fileSize);
      if (!quota.allowed) {
        return res.status(413).json({ error: 'Organization storage quota exceeded.' });
      }
      if (doc.space === 'organization' && doc.organization?.toString() === organizationId.toString()) {
         return res.status(400).json({ error: 'Document is already in this organization.' });
      }
      doc.space = 'organization';
      doc.organization = organizationId;
    } else {
       return res.status(400).json({ error: 'Invalid target space.' });
    }

    // Auto-tag the document
    if (autoTag === 'true' || autoTag === true) {
      try {
        console.log(`🏷️  Auto-tagging "${doc.fileName}" (space change)...`);
        const downloadUrl = await getDownloadUrl(doc.s3Key);
        const response = await fetch(downloadUrl);
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        const tagResult = await autoTagDocument(fileBuffer, doc.mimeType, doc.fileName);
        doc.tags = [...new Set([...doc.tags, ...tagResult.tags])];
        if (!doc.metadata?.primaryDomain) doc.metadata = tagResult.metadata;
        doc.isTagged = doc.tags.length > 0;
        doc.isAITagged = true;
        console.log(`✅ Tagged with ${tagResult.tags.length} keywords`);
      } catch (tagErr) {
        console.error('Auto-tag warning:', tagErr.message);
      }
    }

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');
    if (doc.organization) await doc.populate('organization', 'name avatarColor');

    res.json({ message: 'Document moved successfully!', document: doc });
  } catch (err) {
    console.error('Change space error:', err);
    res.status(500).json({ error: 'Failed to move document.' });
  }
});

/**
 * PUT /api/documents/:id/tags
 * Manually update tags of a document
 */
router.put('/:id/tags', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canEdit(req.user._id)) {
      return res.status(403).json({ error: 'You do not have edit access to this document.' });
    }

    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'Tags must be an array.' });

    doc.tags = tags;
    doc.isTagged = doc.tags.length > 0;
    if (doc.tags.length === 0) doc.isAITagged = false;

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');
    if (doc.organization) await doc.populate('organization', 'name avatarColor');

    res.json({ message: 'Tags updated successfully.', document: doc });
  } catch (err) {
    console.error('Update tags error:', err);
    res.status(500).json({ error: 'Failed to update tags.' });
  }
});

/**
 * POST /api/documents/:id/tags/ai
 * Trigger AI tagging for an existing document
 */
router.post('/:id/tags/ai', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canEdit(req.user._id)) {
      return res.status(403).json({ error: 'You do not have edit access to this document.' });
    }

    console.log(`🏷️  Auto-tagging triggered manually for "${doc.fileName}"...`);
    const downloadUrl = await getDownloadUrl(doc.s3Key);
    const response = await fetch(downloadUrl);
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    const tagResult = await autoTagDocument(fileBuffer, doc.mimeType, doc.fileName);
    
    doc.tags = [...new Set([...doc.tags, ...tagResult.tags])];
    if (!doc.metadata?.primaryDomain) doc.metadata = tagResult.metadata;
    doc.isTagged = doc.tags.length > 0;
    doc.isAITagged = true;

    await doc.save();
    await doc.populate('uploadedBy', 'name email avatarColor');
    if (doc.organization) await doc.populate('organization', 'name avatarColor');

    res.json({ message: 'AI auto-tagging successful!', document: doc });
  } catch (err) {
    console.error('AI tag error:', err);
    res.status(500).json({ error: 'Failed to generate AI tags.' });
  }
});

/**
 * GET /api/documents
 * List documents with advanced filtering, search, and pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { 
      space, organizationId, 
      q, page = 1, limit = 20, 
      minSize, maxSize, 
      startDate, endDate, 
      extension, tags,
      uploadedBy, permissionLevel,
      isTagged, departmentOwner, isAITagged
    } = req.query;

    let accessQuery = {};

    // 1. Establish Base Permissions (Who can see what)
    if (space === 'public') {
      accessQuery = { space: 'public' };
    } else if (space === 'private') {
      accessQuery = { space: 'private', uploadedBy: req.user._id };
    } else if (space === 'shared') {
      accessQuery = { 
        uploadedBy: { $ne: req.user._id },
        'permissions.user': req.user._id
      };
    } else if (space === 'organization' && organizationId) {
      const org = await Organization.findById(organizationId);
      if (!org || !org.isMember(req.user._id)) {
        return res.status(403).json({ error: 'Not a member of this organization.' });
      }
      accessQuery = { space: 'organization', organization: organizationId };
    } else {
      accessQuery = {
        $or: [
          { space: 'public' },
          { space: 'private', uploadedBy: req.user._id },
          { space: 'private', 'permissions.user': req.user._id },
        ],
      };
      const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
      if (userOrgs.length > 0) {
        accessQuery.$or.push({ space: 'organization', organization: { $in: userOrgs.map((o) => o._id) } });
      }
    }

    // 2. Compile Additional Filters
    let filterQuery = {};

    // Text Search Integration
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

    // Size Range Filter
    if (minSize || maxSize) {
      filterQuery.fileSize = {};
      if (minSize) filterQuery.fileSize.$gte = Number(minSize);
      if (maxSize) filterQuery.fileSize.$lte = Number(maxSize);
    }

    // Date Range Filter
    if (startDate || endDate) {
      filterQuery.uploadDate = {};
      if (startDate) filterQuery.uploadDate.$gte = new Date(startDate);
      if (endDate) filterQuery.uploadDate.$lte = new Date(endDate);
    }

    // Exact String Filters
    if (extension) {
      filterQuery['metadata.extension'] = extension.toLowerCase();
    }
    
    if (departmentOwner) {
      filterQuery['metadata.departmentOwner'] = departmentOwner;
    }
    
    // Array Subset Match
    if (tags) {
      const tagsArray = tags.split(',');
      filterQuery.tags = { $in: tagsArray };
    }

    // Phase 1B: Relational & Permission Filters
    if (uploadedBy) {
      filterQuery.uploadedBy = uploadedBy;
    }
    if (space !== 'organization' && organizationId) {
      filterQuery.organization = organizationId;
    }
    if (permissionLevel) {
      filterQuery.permissions = { 
        $elemMatch: { 
          user: req.user._id, 
          $or: [{ level: permissionLevel }, { role: permissionLevel }] 
        } 
      };  
    }

    if (isTagged !== undefined) {
      filterQuery.isTagged = isTagged === 'true';
    }

    if(isAITagged !== undefined) {
      filterQuery.isAITagged = isAITagged === 'true';
    }

    // 3. Merge Queries & Execute
    const finalQuery = Object.keys(filterQuery).length > 0 
      ? { $and: [accessQuery, filterQuery] } 
      : accessQuery;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [documents, totalCount] = await Promise.all([
      Document.find(finalQuery)
        .populate('uploadedBy', 'name email avatarColor')
        .populate('organization', 'name avatarColor')
        .sort({ uploadDate: -1 })
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
    console.error('Fetch docs error:', err);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

/**
 * GET /api/documents/tags/search
 * Autocomplete search for tags
 */
router.get('/tags/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ tags: [] });

    // Restrict search space to what the user can reasonably see
    const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
    const accessQuery = {
      $or: [
        { space: 'public' },
        { space: 'private', uploadedBy: req.user._id },
        { space: 'private', 'permissions.user': req.user._id },
        { space: 'organization', organization: { $in: userOrgs.map(o => o._id) } },
      ],
    };

    const tagAgg = await Document.aggregate([
      { $match: accessQuery },
      { $match: { tags: { $regex: new RegExp(q, 'i') } } },
      { $unwind: '$tags' },
      { $match: { tags: { $regex: new RegExp(q, 'i') } } },
      { $group: { _id: { $toLower: '$tags' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const tags = tagAgg.map((t) => ({ tag: t._id }));
    res.json({ tags });
  } catch (err) {
    console.error('Tags search error:', err);
    res.status(500).json({ error: 'Failed to search tags.' });
  }
});

/**
 * GET /api/documents/recent-activity
 * Logged via recent access tracker
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const recent = await RecentAccess.find({ user: req.user._id })
      .sort({ lastOpenedAt: -1 })
      .limit(10)
      .populate({
        path: 'document',
        populate: [
          { path: 'uploadedBy', select: 'name email avatarColor' },
          { path: 'organization', select: 'name avatarColor' }
        ]
      });

    const validRecents = [];
    for (const r of recent) {
      if (r.document) {
        const hasAccess = await checkDocAccess(r.document, req.user._id);
        if (hasAccess) {
          validRecents.push({
            ...r.document.toObject(),
            lastOpenedAt: r.lastOpenedAt
          });
        }
      }
    }
    res.json({ documents: validRecents });
  } catch (err) {
    console.error('Fetch recent activity error:', err);
    res.status(500).json({ error: 'Failed to fetch recent activity.' });
  }
});

/**
 * GET /api/documents/departments/search
 * Search distinct department owners for autocomplete filters.
 */
router.get('/departments/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ departments: [] });
    }

    const regex = new RegExp(q.trim(), 'i');

    // Filter by access logic
    const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
    const accessQuery = {
      $or: [
        { space: 'public' },
        { space: 'private', uploadedBy: req.user._id },
        { space: 'private', 'permissions.user': req.user._id },
        { space: 'organization', organization: { $in: userOrgs.map(o => o._id) } },
      ],
    };

    const departments = await Document.distinct('metadata.departmentOwner', {
      ...accessQuery,
      'metadata.departmentOwner': { $regex: regex }
    });

    res.json({ departments: departments.slice(0, 10) });
  } catch (err) {
    console.error('Department search error:', err);
    res.status(500).json({ error: 'Failed to search departments.' });
  }
});

/**
 * GET /api/documents/users/search
 * Search users who have uploaded documents accessible to the current user.
 * Used for the "Uploaded By" autocomplete filter.
 */
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ users: [] });
    }

    const regex = new RegExp(q.trim(), 'i');

    // 1. Establish the same access logic used in other search routes
    const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
    const accessQuery = {
      $or: [
        { space: 'public' },
        { space: 'private', uploadedBy: req.user._id },
        { space: 'private', 'permissions.user': req.user._id },
        { space: 'organization', organization: { $in: userOrgs.map(o => o._id) } },
      ],
    };

    // 2. Find all unique user IDs who have uploaded accessible documents
    const uploaderIds = await Document.distinct('uploadedBy', accessQuery);

    // 3. Search for those specific users by name or email
    const users = await User.find({
      _id: { $in: uploaderIds },
      $or: [
        { name: { $regex: regex } },
        { email: { $regex: regex } }
      ]
    })
    .select('name email avatarColor')
    .limit(10);

    res.json({ users });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Failed to search users.' });
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

// /**
//  * GET /api/documents/search
//  * Search all documents user has access to by keyword
//  */
// router.get('/search', async (req, res) => {
//   try {
//     const { q } = req.query;
//     if (!q || q.trim().length < 2) {
//       return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
//     }

//     const regex = new RegExp(q.trim(), 'i');
    
//     const userOrgs = await Organization.find({ 'members.user': req.user._id }).select('_id');
//     const orgIds = userOrgs.map((o) => o._id);

//     const accessQuery = {
//       $or: [
//         { space: 'public' },
//         { space: 'private', uploadedBy: req.user._id },
//         { space: 'private', 'permissions.user': req.user._id },
//         { space: 'organization', organization: { $in: orgIds } },
//       ],
//     };

//     const searchQuery = {
//       $or: [
//         { tags: { $elemMatch: { $regex: regex } } },
//         { fileName: { $regex: regex } },
//         { 'metadata.primaryDomain': { $regex: regex } },
//         { 'metadata.typeTags': { $elemMatch: { $regex: regex } } },
//         { description: { $regex: regex } },
//       ],
//     };

//     const documents = await Document.find({ $and: [accessQuery, searchQuery] })
//       .populate('uploadedBy', 'name email avatarColor')
//       .populate('organization', 'name avatarColor')
//       .sort({ uploadDate: -1 })
//       .limit(50);

//     res.json({ documents, query: q });
//   } catch (err) {
//     console.error('Search error:', err);
//     res.status(500).json({ error: 'Search failed.' });
//   }
// });

/**
 * GET /api/documents/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const userOrgs = await Organization.find({ 'members.user': userId }).select('_id');
    const orgIds = userOrgs.map((o) => o._id);

    const [publicCount, privateCount, orgCount, sharedCount] = await Promise.all([
      Document.countDocuments({ space: 'public' }),
      Document.countDocuments({
        space: 'private',
        uploadedBy: userId,
      }),
      Document.countDocuments({
        space: 'organization',
        organization: { $in: orgIds },
      }),
      Document.countDocuments({
        uploadedBy: { $ne: userId },
        'permissions.user': userId
      }),
    ]);

    res.json({
      stats: {
        public: { count: publicCount, label: 'Public', icon: '🌐' },
        private: { count: privateCount, label: 'Private', icon: '🔒' },
        shared: { count: sharedCount, label: 'Shared with Me', icon: '👥' },
        organization: { count: orgCount, label: 'Organizations', icon: '🏢' },
        total: publicCount + privateCount + orgCount + sharedCount,
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

    if (!doc.canDeleteDoc(req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to delete this document.' });
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

    // For non-public docs, check canDownload flag
    if (doc.space !== 'public' && !doc.canDownload(req.user._id)) {
      // Also allow if user is an org member viewing org docs
      if (!(doc.space === 'organization' && doc.organization)) {
        return res.status(403).json({ error: 'You do not have download permission for this document.' });
      }
    }

    // // Usage Tracking Logging
    await RecentAccess.findOneAndUpdate(
      { user: req.user._id, document: doc._id },
      { lastOpenedAt: new Date() },
      { upsert: true }
    );

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

    if (!doc.canManageAccess(req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to manage access.' });
    }

    const { email, role, expiresIn } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ error: 'No user found with that email.' });
    }

    // Prevent sharing to the document uploader (they already own it)
    if (doc.uploadedBy.toString() === targetUser._id.toString()) {
      return res.status(400).json({ error: 'Cannot share with the document owner — they already have full access.' });
    }

    // Determine role: use provided role, or org default, or fallback to viewer
    let assignRole = role || 'viewer';
    if (!role && doc.space === 'organization' && doc.organization) {
      const org = await Organization.findById(doc.organization);
      if (org?.sharingPolicy?.defaultRole) {
        assignRole = org.sharingPolicy.defaultRole;
      }
    }

    if (!VALID_ROLES.includes(assignRole)) {
      return res.status(400).json({ error: `Invalid role. Valid roles: ${VALID_ROLES.join(', ')}` });
    }

    // Don't allow granting 'owner' role through this endpoint
    if (assignRole === 'owner') {
      return res.status(400).json({ error: 'Cannot grant owner role. Use transfer ownership instead.' });
    }

    // Enforce maxShares limit (0 = unlimited)
    const existingIdx = doc.permissions.findIndex(
      (p) => (p.user._id?.toString() || p.user.toString()) === targetUser._id.toString()
    );
    if (existingIdx < 0) {
      // This is a NEW share — check the limit
      const maxShares = doc.sharingPolicy?.maxShares || 0;
      if (maxShares > 0) {
        const nonOwnerShares = doc.permissions.filter(p => p.role !== 'owner' && p.level !== 'owner').length;
        if (nonOwnerShares >= maxShares) {
          return res.status(400).json({
            error: `Share limit reached. This document can be shared with at most ${maxShares} user(s). Remove existing shares to add new ones.`
          });
        }
      }
    }

    // Compute expiry if expiresIn is provided (in hours)
    let expiresAt = null;
    if (expiresIn && Number(expiresIn) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresIn) * 60 * 60 * 1000);
    }

    const newPerm = Document.buildPermission(targetUser._id, assignRole, req.user._id, expiresAt);

    if (existingIdx >= 0) {
      // Never allow modifying the owner's permission
      const existingPerm = doc.permissions[existingIdx];
      if (existingPerm.role === 'owner' || existingPerm.level === 'owner') {
        return res.status(400).json({ error: 'Cannot modify the owner\'s permissions.' });
      }
      // Preserve grantedAt from original, update the rest
      newPerm.grantedAt = doc.permissions[existingIdx].grantedAt;
      doc.permissions[existingIdx] = newPerm;
    } else {
      doc.permissions.push(newPerm);
    }

    await doc.save();
    await doc.populate('permissions.user', 'name email avatarColor');
    await doc.populate('permissions.grantedBy', 'name email');

    res.json({ message: `${assignRole} access granted to ${targetUser.name}!`, document: doc });
  } catch (err) {
    console.error('Grant permission error:', err);
    res.status(500).json({ error: 'Failed to grant permission.' });
  }
});

/**
 * PUT /api/documents/:id/sharing-policy
 * Update document sharing policy (owner only).
 */
router.put('/:id/sharing-policy', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    // Only the owner can change sharing policy
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the document owner can change sharing policy.' });
    }

    const { maxShares } = req.body;
    if (maxShares !== undefined) {
      const val = Math.max(0, parseInt(maxShares) || 0);
      if (!doc.sharingPolicy) doc.sharingPolicy = {};
      doc.sharingPolicy.maxShares = val;
    }

    await doc.save();
    res.json({ message: 'Sharing policy updated.', sharingPolicy: doc.sharingPolicy });
  } catch (err) {
    console.error('Update sharing policy error:', err);
    res.status(500).json({ error: 'Failed to update sharing policy.' });
  }
});

/**
 * PUT /api/documents/:id/link-sharing
 * Toggle and configure link-based sharing (owner/manager only).
 */
router.put('/:id/link-sharing', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canManageAccess(req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to manage link sharing.' });
    }

    const { enabled, mode, role } = req.body;
    const crypto = require('crypto');

    if (!doc.linkSharing) {
      doc.linkSharing = { enabled: false, mode: 'restricted', role: 'viewer', token: null };
    }

    if (enabled !== undefined) doc.linkSharing.enabled = !!enabled;
    if (mode && ['restricted', 'organization', 'anyone'].includes(mode)) doc.linkSharing.mode = mode;
    if (role && ['viewer', 'downloader', 'manager'].includes(role)) doc.linkSharing.role = role;

    // Generate token when enabling, clear when disabling
    if (doc.linkSharing.enabled && !doc.linkSharing.token) {
      doc.linkSharing.token = crypto.randomBytes(24).toString('hex');
    }
    if (!doc.linkSharing.enabled) {
      doc.linkSharing.token = null;
      doc.linkSharing.mode = 'restricted';
    }

    await doc.save();
    res.json({
      message: doc.linkSharing.enabled ? 'Link sharing enabled.' : 'Link sharing disabled.',
      linkSharing: doc.linkSharing,
    });
  } catch (err) {
    console.error('Update link sharing error:', err);
    res.status(500).json({ error: 'Failed to update link sharing.' });
  }
});

/**
 * DELETE /api/documents/:id/permissions/:userId
 */
router.delete('/:id/permissions/:userId', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canManageAccess(req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to manage access.' });
    }

    // Cannot revoke owner permission
    const targetPerm = doc.permissions.find(
      (p) => (p.user._id?.toString() || p.user.toString()) === req.params.userId
    );
    if (targetPerm?.role === 'owner') {
      return res.status(400).json({ error: 'Cannot revoke owner access.' });
    }

    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot revoke your own access.' });
    }

    doc.permissions = doc.permissions.filter(
      (p) => (p.user._id?.toString() || p.user.toString()) !== req.params.userId
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
 * GET /api/documents/:id/permissions
 * Get all permissions for a document (for the sharing panel).
 */
router.get('/:id/permissions', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('permissions.user', 'name email avatarColor')
      .populate('permissions.grantedBy', 'name email');
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!doc.canManageAccess(req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to view access details.' });
    }

    res.json({
      permissions: doc.permissions,
      availableRoles: VALID_ROLES.filter(r => r !== 'owner'),
      roleDescriptions: {
        viewer:     'Can view the document',
        downloader: 'Can view and download',
        editor:     'Can view, download, and edit',
        sharer:     'Can view, download, and share with others',
        manager:    'Can view, download, edit, share, and manage access',
      },
    });
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({ error: 'Failed to fetch permissions.' });
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
  // Check link sharing mode
  if (doc.linkSharing?.enabled) {
    if (doc.linkSharing.mode === 'anyone') return true;
    if (doc.linkSharing.mode === 'organization' && doc.space === 'organization' && doc.organization) {
      const orgId = doc.organization._id || doc.organization;
      const org = await Organization.findById(orgId);
      if (org && org.isMember(userId)) return true;
    }
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
