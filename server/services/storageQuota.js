const Document = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');

/**
 * Get storage usage for a specific context.
 */
async function getPublicUsage(orgId) {
    const result = await Document.aggregate([
        { $match: { space: 'public', organizationId: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

async function getPrivateUsage(userId, orgId) {
    const result = await Document.aggregate([
        { $match: { space: 'private', uploadedBy: userId, organizationId: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

async function getTeamUsage(orgId) {
    const result = await Document.aggregate([
        { $match: { space: 'organization', organizationId: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

async function getTotalOrgUsage(orgId) {
    const result = await Document.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

/**
 * Check if upload is allowed (within quota).
 * Returns { allowed, used, limit, remaining } or throws error.
 */
async function checkQuota(space, userId, orgId, fileSize) {
    if (!orgId) throw new Error('Organization ID is required');

    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found');

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const quota = org.storageQuota;
    
    // First, check if the organization's TOTAL limit is exceeded
    const totalOrgUsage = await getTotalOrgUsage(orgId);
    if (totalOrgUsage.total + fileSize > quota.totalStorageLimitBytes) {
        return { 
            allowed: false, 
            used: totalOrgUsage.total, 
            limit: quota.totalStorageLimitBytes, 
            remaining: Math.max(0, quota.totalStorageLimitBytes - totalOrgUsage.total) 
        };
    }

    let used, limit;

    if (space === 'public') {
        used = (await getPublicUsage(orgId)).total;
        limit = quota.publicSpaceLimitBytes;
    } else if (space === 'private') {
        used = (await getPrivateUsage(userId, orgId)).total;
        limit = user.privateStorageLimitBytes;
    } else if (space === 'organization') {
        used = (await getTeamUsage(orgId)).total;
        limit = quota.teamSpaceLimitBytes;
    } else {
        throw new Error('Invalid space type');
    }

    const remaining = limit - used;
    const allowed = fileSize <= remaining;

    return { allowed, used, limit, remaining };
}

/**
 * Get full storage summary for a user.
 */
async function getStorageSummary(userId) {
    const user = await User.findById(userId);
    if (!user || !user.organizationId) {
        return {
            public: { used: 0, count: 0, limit: 0, percentage: 0 },
            private: { used: 0, count: 0, limit: 0, percentage: 0 },
            organizations: []
        };
    }

    const orgId = user.organizationId;
    const org = await Organization.findById(orgId);
    if (!org) throw new Error('Organization not found');

    const quota = org.storageQuota;

    const publicData = await getPublicUsage(orgId);
    const privateData = await getPrivateUsage(userId, orgId);
    const teamData = await getTeamUsage(orgId);
    const totalData = await getTotalOrgUsage(orgId);

    return {
        public: {
            used: publicData.total,
            count: publicData.count,
            limit: quota.publicSpaceLimitBytes,
            percentage: quota.publicSpaceLimitBytes ? Math.round((publicData.total / quota.publicSpaceLimitBytes) * 100) : 0,
        },
        private: {
            used: privateData.total,
            count: privateData.count,
            limit: user.privateStorageLimitBytes,
            percentage: user.privateStorageLimitBytes ? Math.round((privateData.total / user.privateStorageLimitBytes) * 100) : 0,
        },
        organizations: [{
            orgId: org._id,
            orgName: org.name,
            used: teamData.total,
            count: teamData.count,
            limit: quota.teamSpaceLimitBytes,
            percentage: quota.teamSpaceLimitBytes ? Math.round((teamData.total / quota.teamSpaceLimitBytes) * 100) : 0,
            
            // Added total org usage for the admin/superadmin UI
            totalOrgUsed: totalData.total,
            totalOrgLimit: quota.totalStorageLimitBytes,
            totalOrgPercentage: quota.totalStorageLimitBytes ? Math.round((totalData.total / quota.totalStorageLimitBytes) * 100) : 0
        }],
    };
}

function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = { checkQuota, getStorageSummary, formatBytes, getPublicUsage, getPrivateUsage, getTeamUsage, getTotalOrgUsage };
