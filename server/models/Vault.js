const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for performance
vaultSchema.index({ organizationId: 1 });
vaultSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Vault', vaultSchema);
