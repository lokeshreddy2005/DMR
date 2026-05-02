const mongoose = require('mongoose');

// ─── Role Presets ───────────────────────────────────────────────
const ROLE_PRESETS = {
  viewer:       { canView: true, canDownload: true,  canEdit: false, canShare: false, canDelete: false, canManageAccess: false },
  collaborator: { canView: true, canDownload: true,  canEdit: true,  canShare: true,  canDelete: false, canManageAccess: true  },
  owner:        { canView: true, canDownload: true,  canEdit: true,  canShare: true,  canDelete: true,  canManageAccess: true  },
};

// Map old level/role values to new role names (backward compat)
const LEGACY_LEVEL_MAP = {
  owner: 'owner',
  editor: 'collaborator',
  manager: 'collaborator',
  sharer: 'collaborator',
  downloader: 'viewer',
  previewer: 'viewer',
  viewer: 'viewer',
};

const VALID_ROLES = Object.keys(ROLE_PRESETS);

// ─── Permission Schema ────────────────────────────────────────
const permissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: VALID_ROLES,
    default: 'viewer',
  },
  // Granular permission flags
  canView: { type: Boolean, default: true },
  canDownload: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canShare: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canManageAccess: { type: Boolean, default: false },
  expiresAt: {
    type: Date,
    default: null,
  },
  message: {
    type: String,
    trim: true,
    default: '',
  },
  grantedAt: {
    type: Date,
    default: Date.now,
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Keep legacy field for migration reads (won't be set on new docs)
  level: { type: String, default: undefined },
});

const shareLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['granted', 'updated', 'revoked', 'moved'],
    default: 'granted',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  role: {
    type: String,
    enum: VALID_ROLES,
    default: 'viewer',
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  message: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  eventAt: {
    type: Date,
    default: Date.now,
  },
  eventBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  sharedAt: {
    type: Date,
    default: Date.now,
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

const documentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: '',
  },
  // Sharing policy for this document
  sharingPolicy: {
    maxShares: { type: Number, default: 1 },
  },
  // Link-based sharing (Google Docs style)
  linkSharing: {
    enabled: { type: Boolean, default: false },
    mode: {
      type: String,
      enum: ['restricted', 'organization', 'anyone'],
      default: 'restricted',
    },
    role: {
      type: String,
      enum: ['viewer', 'collaborator'],
      default: 'viewer',
    },
    token: {
      type: String,
      default: null,
      index: true,
    },
  },
  space: {
    type: String,
    required: true,
    enum: ['public', 'private', 'organization'],
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // S3 storage
  s3Key: {
    type: String,
    required: true,
  },
  s3Url: {
    type: String,
    default: '',
  },
  mimeType: {
    type: String,
    default: 'application/octet-stream',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  // Auto-tagging
  tags: {
    type: [String],
    default: [],
  },
  metadata: {
    primaryDomain: { type: String, default: '' },
    sensitivity: { type: String, default: '' },
    vaults: {
      type: [
        {
          vaultId: { type: String, required: true },
          label: { type: String, default: '' },
          score: { type: Number, min: 0, max: 1, default: 0 },
          routedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    typeTags: { type: [String], default: [] },
    departmentOwner: { type: String, default: '' },
    extension: { type: String, default: '' },
  },
  isTagged: {
    type: Boolean,
    default: false,
  },
  isAITagged: {
    type: Boolean,
    default: false,
  },
  isVaultRouted: {
    type: Boolean,
    default: false,
  },
  // Permissions
  permissions: [permissionSchema],
  shareLogs: {
    type: [shareLogSchema],
    default: [],
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
});

// ─── Indexes for Performance ───
// Single Field Indexes for sorting/filtering
documentSchema.index({ uploadDate: -1 });
documentSchema.index({ 'metadata.extension': 1 });
documentSchema.index({ 'metadata.departmentOwner': 1 });
documentSchema.index({ 'metadata.vaults.vaultId': 1 });

// Text & Array Indexes
documentSchema.index({ tags: 1 });
documentSchema.index({ fileName: 'text', tags: 'text' });

// Virtual for formatted file size
documentSchema.virtual('formattedSize').get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
});

documentSchema.set('toJSON', { virtuals: true });

function getRefId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}

// ─── Helper: resolve a permission, handling legacy migration ───
function resolvePermission(perm) {
  // If this is a legacy permission with `level` but no `role`, migrate it
  if (perm.level && !perm.role) {
    const mappedRole = LEGACY_LEVEL_MAP[perm.level] || 'viewer';
    const flags = ROLE_PRESETS[mappedRole];
    perm.role = mappedRole;
    Object.assign(perm, flags);
  }
  return perm;
}

// ─── Find permission for a given userId ───
function findUserPerm(doc, userId) {
  const uid = getRefId(userId);
  const perm = doc.permissions.find((p) => {
    const pu = getRefId(p.user);
    return pu === uid;
  });
  if (!perm) return null;
  const resolved = resolvePermission(perm);
  // Soft expiry: if permission has expired, deny access
  if (resolved.expiresAt && new Date(resolved.expiresAt) < new Date()) {
    return { ...resolved, canView: false, canDownload: false, canEdit: false, canShare: false, canDelete: false, canManageAccess: false, expired: true };
  }
  return resolved;
}

// ─── Document-level helper methods ───

documentSchema.methods.getUserPermission = function (userId) {
  return findUserPerm(this, userId);
};

documentSchema.methods.canView = function (userId) {
  if (this.space === 'public') return true;
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.canView : false;
};

documentSchema.methods.canDownload = function (userId) {
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.canDownload : false;
};

documentSchema.methods.canEdit = function (userId) {
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.canEdit : false;
};

documentSchema.methods.canShare = function (userId) {
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.canShare : false;
};

documentSchema.methods.canDeleteDoc = function (userId) {
  // Only the original uploader (true owner) can delete
  return getRefId(this.uploadedBy) === getRefId(userId);
};

documentSchema.methods.canManageAccess = function (userId) {
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.canManageAccess : false;
};

documentSchema.methods.isOwner = function (userId) {
  if (getRefId(this.uploadedBy) === getRefId(userId)) return true;
  const perm = findUserPerm(this, userId);
  return perm ? perm.role === 'owner' : false;
};

// ─── Static helpers ───

documentSchema.statics.buildPermission = function (userId, role, grantedBy, expiresAt) {
  const preset = ROLE_PRESETS[role];
  if (!preset) throw new Error(`Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(', ')}`);
  return {
    user: userId,
    role,
    ...preset,
    expiresAt: expiresAt || null,
    grantedAt: new Date(),
    grantedBy: grantedBy || null,
  };
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
module.exports.ROLE_PRESETS = ROLE_PRESETS;
module.exports.VALID_ROLES = VALID_ROLES;
