const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Document = require('./models/Document');
const Organization = require('./models/Organization');
const Vault = require('./models/Vault');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const [
        totalUsers, totalAdmins, totalOrgs, totalDocs,
        storageAgg, vaultCount
    ] = await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'admin' }),
        Organization.countDocuments(),
        Document.countDocuments({ isDeleted: { $ne: true } }),
        Document.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: null, total: { $sum: '$fileSize' } } }]),
        Vault.countDocuments(),
    ]);

    console.log({
        totalUsers,
        totalAdmins,
        totalOrgs,
        totalDocs,
        totalStorageUsed: storageAgg[0]?.total || 0,
        vaultCount,
    });
    mongoose.disconnect();
}).catch(console.error);
