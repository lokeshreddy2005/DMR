const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    id: {
        type: String,
        required: [true, 'Vault ID is required'],
        unique: true,
        trim: true,
        lowercase: true,
    },
    label: {
        type: String,
        required: [true, 'Vault label is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    keywords: {
        type: [String],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Vault', vaultSchema);
