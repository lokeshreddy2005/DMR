const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true 
    },
    entity: { 
        type: String, 
        required: true 
    },
    entityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        default: null 
    },
    performedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['user', 'admin', 'superadmin'], 
        required: true 
    },
    organizationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization', 
        default: null 
    },
    details: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {} 
    },
    ipAddress: { 
        type: String, 
        default: '' 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
});

auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ organizationId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
