const mongoose = require('mongoose');

const recentAccessSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  lastOpenedAt: {
    type: Date,
    default: Date.now, // Will be updated on upsert
  },
});

// Compound unique index for upserts
recentAccessSchema.index({ user: 1, document: 1 }, { unique: true });

// TTL Index to expire documents after 90 days (7776000 seconds)
recentAccessSchema.index({ lastOpenedAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('RecentAccess', recentAccessSchema);
