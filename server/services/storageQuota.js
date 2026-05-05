const Document = require('../models/Document');
const Organization = require('../models/Organization');
const User = require('../models/User');

// Storage quotas in bytes
const QUOTAS = {
    PUBLIC_TOTAL: 500 * 1024 * 1024,       // 500 MB total public space
    PRIVATE_PER_USER: 100 * 1024 * 1024,   // 100 MB per user private space
    ORG_TOTAL: 200 * 1024 * 1024,          // 200 MB per organization
};

/**
 * Get storage usage for a specific context.
 */
async function getPublicUsage() {
    const result = await Document.aggregate([
        { $match: { space: 'public' } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

async function getPrivateUsage(userId) {
    const result = await Document.aggregate([
        { $match: { space: 'private', uploadedBy: userId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

async function getOrgUsage(orgId) {
    const result = await Document.aggregate([
        { $match: { space: 'organization', organization: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

/**
 * Check if upload is allowed (within quota).
 * Returns { allowed, used, limit, remaining } or throws error.
 */
async function checkQuota(space, userId, orgId, fileSize) {
    let used, limit;

    if (space === 'public') {
        used = (await getPublicUsage()).total;
        limit = QUOTAS.PUBLIC_TOTAL;
    } else if (space === 'private') {
        used = (await getPrivateUsage(userId)).total;
        const user = await User.findById(userId);
        limit = user ? user.storageLimit : QUOTAS.PRIVATE_PER_USER;
    } else if (space === 'organization') {
        used = (await getOrgUsage(orgId)).total;
        const org = await Organization.findById(orgId);
        limit = org ? org.storageLimit : QUOTAS.ORG_TOTAL;
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
    const publicData = await getPublicUsage();
    const privateData = await getPrivateUsage(userId);

    // Get all user's orgs
    const userOrgs = await Organization.find({ 'members.user': userId }).select('_id name storageLimit');
    const orgUsages = [];
    for (const org of userOrgs) {
        const orgData = await getOrgUsage(org._id);
        const orgLimit = org.storageLimit || QUOTAS.ORG_TOTAL;
        orgUsages.push({
            orgId: org._id,
            orgName: org.name,
            used: orgData.total,
            count: orgData.count,
            limit: orgLimit,
            percentage: Math.round((orgData.total / orgLimit) * 100),
        });
    }

    const user = await User.findById(userId);
    const userLimit = user ? user.storageLimit : QUOTAS.PRIVATE_PER_USER;

    return {
        public: {
            used: publicData.total,
            count: publicData.count,
            limit: QUOTAS.PUBLIC_TOTAL,
            percentage: Math.round((publicData.total / QUOTAS.PUBLIC_TOTAL) * 100),
        },
        private: {
            used: privateData.total,
            count: privateData.count,
            limit: userLimit,
            percentage: Math.round((privateData.total / userLimit) * 100),
        },
        organizations: orgUsages,
    };
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = { checkQuota, getStorageSummary, formatBytes, QUOTAS };
