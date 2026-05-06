const mongoose = require('mongoose');
require('dotenv').config();
const Organization = require('./models/Organization');
const Document = require('./models/Document');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const orgs = await Organization.find()
        .populate('createdBy', 'name email avatarColor')
        .sort({ createdAt: -1 });
    
    const orgsWithCount = await Promise.all(orgs.map(async (org) => {
        const agg = await Document.aggregate([
            { $match: { space: 'organization', organization: org._id, isDeleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$fileSize' } } }
        ]);
        return {
            ...org.toObject(),
            memberCount: org.members.length,
            storageUsed: agg[0]?.total || 0,
        };
    }));
    
    console.log(JSON.stringify(orgsWithCount.filter(o => o.storageUsed > 0).map(o => ({name: o.name, storageUsed: o.storageUsed})), null, 2));
    mongoose.disconnect();
}).catch(console.error);
