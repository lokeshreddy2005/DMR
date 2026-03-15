const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  level: {
    type: String,
    enum: ['owner', 'editor', 'viewer'],
    default: 'viewer',
  },
  grantedAt: {
    type: Date,
    default: Date.now,
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
  // Permissions
  permissions: [permissionSchema],
  uploadDate: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for formatted file size
documentSchema.virtual('formattedSize').get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
});

documentSchema.set('toJSON', { virtuals: true });

/**
 * Check if a user can view this document.
 */
documentSchema.methods.canView = function (userId) {
  if (this.space === 'public') return true;
  if (this.uploadedBy.toString() === userId.toString()) return true;
  return this.permissions.some(
    (p) => p.user.toString() === userId.toString()
  );
};

/**
 * Check if a user can edit this document.
 */
documentSchema.methods.canEdit = function (userId) {
  if (this.uploadedBy.toString() === userId.toString()) return true;
  return this.permissions.some(
    (p) => p.user.toString() === userId.toString() && (p.level === 'owner' || p.level === 'editor')
  );
};

/**
 * Check if a user is the owner (uploader or permission owner).
 */
documentSchema.methods.isOwner = function (userId) {
  if (this.uploadedBy.toString() === userId.toString()) return true;
  return this.permissions.some(
    (p) => p.user.toString() === userId.toString() && p.level === 'owner'
  );
};

module.exports = mongoose.model('Document', documentSchema);
