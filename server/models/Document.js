const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  vault: {
    type: String,
    required: true,
    enum: ['finance', 'hr', 'project', 'uncategorized'],
    default: 'uncategorized',
  },
  tags: [{
    type: String,
    trim: true,
  }],
  content: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
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

module.exports = mongoose.model('Document', documentSchema);
