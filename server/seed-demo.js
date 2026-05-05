require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Seed Super Admin
        let superadmin = await User.findOne({ email: 'superadmin@dmr.com' });
        if (!superadmin) {
            superadmin = new User({
                name: 'System Super Admin',
                email: 'superadmin@dmr.com',
                password: 'YourSecurePassword',
                role: 'superadmin'
            });
            await superadmin.save();
            console.log('Super Admin created.');
        } else {
            console.log('Super Admin already exists.');
        }

        // 2. Seed an Organization
        let org = await Organization.findOne({ name: 'Acme Corp' });
        if (!org) {
            org = new Organization({
                name: 'Acme Corp',
                description: 'Demo Organization',
                createdBy: superadmin._id,
                storageQuota: {
                    totalStorageLimitBytes: 50 * 1024 * 1024 * 1024,
                    publicSpaceLimitBytes: 10 * 1024 * 1024 * 1024,
                    teamSpaceLimitBytes: 20 * 1024 * 1024 * 1024,
                }
            });
            await org.save();
            console.log('Demo Organization created.');
        }

        // 3. Seed an Admin for the Organization
        let admin = await User.findOne({ email: 'admin@dmr.com' });
        if (!admin) {
            admin = new User({
                name: 'Acme Admin',
                email: 'admin@dmr.com',
                password: 'password123',
                role: 'admin',
                organizationId: org._id,
                privateStorageLimitBytes: 5 * 1024 * 1024 * 1024
            });
            await admin.save();
            console.log('Demo Admin created.');
        } else {
            console.log('Demo Admin already exists.');
        }

    } catch (err) {
        console.error('Error seeding:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
