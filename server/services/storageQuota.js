const Document = require('../models/Document');
const Organization = require('../models/Organization');

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
        { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]);
    return result[0]?.total || 0;
}

async function getPrivateUsage(userId) {
    const result = await Document.aggregate([
        { $match: { space: 'private', uploadedBy: userId } },
        { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]);
    return result[0]?.total || 0;
}

async function getOrgUsage(orgId) {
    const result = await Document.aggregate([
        { $match: { space: 'organization', organization: orgId } },
        { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]);
    return result[0]?.total || 0;
}

/**
 * Check if upload is allowed (within quota).
 * Returns { allowed, used, limit, remaining } or throws error.
 */
async function checkQuota(space, userId, orgId, fileSize) {
    let used, limit;

    if (space === 'public') {
        used = await getPublicUsage();
        limit = QUOTAS.PUBLIC_TOTAL;
    } else if (space === 'private') {
        used = await getPrivateUsage(userId);
        limit = QUOTAS.PRIVATE_PER_USER;
    } else if (space === 'organization') {
        used = await getOrgUsage(orgId);
        limit = QUOTAS.ORG_TOTAL;
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
    const publicUsed = await getPublicUsage();
    const privateUsed = await getPrivateUsage(userId);

    // Get all user's orgs
    const userOrgs = await Organization.find({ 'members.user': userId }).select('_id name');
    const orgUsages = [];
    for (const org of userOrgs) {
        const used = await getOrgUsage(org._id);
        orgUsages.push({
            orgId: org._id,
            orgName: org.name,
            used,
            limit: QUOTAS.ORG_TOTAL,
            percentage: Math.round((used / QUOTAS.ORG_TOTAL) * 100),
        });
    }

    return {
        public: {
            used: publicUsed,
            limit: QUOTAS.PUBLIC_TOTAL,
            percentage: Math.round((publicUsed / QUOTAS.PUBLIC_TOTAL) * 100),
        },
        private: {
            used: privateUsed,
            limit: QUOTAS.PRIVATE_PER_USER,
            percentage: Math.round((privateUsed / QUOTAS.PRIVATE_PER_USER) * 100),
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
