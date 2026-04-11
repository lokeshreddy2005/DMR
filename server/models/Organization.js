const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'member', 'viewer'],
        default: 'member',
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
});

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: '',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    members: [memberSchema],
    sharingPolicy: {
        defaultRole: {
            type: String,
            enum: ['previewer', 'viewer', 'downloader', 'editor', 'sharer', 'manager'],
            default: 'viewer',
        },
    },
    avatarColor: {
        type: String,
        default: function () {
            const colors = [
                '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
                '#f59e0b', '#f43f5e', '#ec4899', '#6366f1',
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Ensure creator is always an admin member
organizationSchema.pre('save', function (next) {
    if (this.isNew) {
        const creatorExists = this.members.some(
            (m) => m.user.toString() === this.createdBy.toString()
        );
        if (!creatorExists) {
            this.members.push({ user: this.createdBy, role: 'admin' });
        }
    }
    next();
});

// Helper: check if user is a member
organizationSchema.methods.isMember = function (userId) {
    if (!userId) return false;
    const isCreator = this.createdBy.toString() === userId.toString();
    const isMember = this.members.some((m) => m.user.toString() === userId.toString());
    return isCreator || isMember;
};

// Helper: get member role
organizationSchema.methods.getMemberRole = function (userId) {
    const member = this.members.find((m) => m.user.toString() === userId.toString());
    return member ? member.role : null;
};

// Helper: check if user is admin
organizationSchema.methods.isAdmin = function (userId) {
    if (!userId) return false;
    const isCreator = this.createdBy.toString() === userId.toString();
    const role = this.getMemberRole(userId);
    return isCreator || role === 'admin';
};

module.exports = mongoose.model('Organization', organizationSchema);
