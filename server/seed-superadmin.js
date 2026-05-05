require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { connectDB } = require('./config/db');

const ADMINS = [
    { name: 'Root Admin',    email: 'root@dmr.admin',    password: 'RootAdmin@2024!' },
    { name: 'Sys Admin',     email: 'sysadmin@dmr.admin', password: 'SysAdmin@2024!' },
    { name: 'Lokesh Admin',  email: 'lokesh@dmr.admin',  password: 'Lokesh@Admin24!' },
];

async function seedAdmins() {
    await connectDB();
    for (const a of ADMINS) {
        let u = await User.findOne({ email: a.email });
        if (u) {
            u.role = 'admin';
            await u.save();
            console.log(`✅ Upgraded existing → ${a.email}`);
        } else {
            u = new User({ name: a.name, email: a.email, password: a.password, role: 'admin' });
            await u.save();
            console.log(`✅ Created admin → ${a.email} | ${a.password}`);
        }
    }
    process.exit(0);
}

seedAdmins().catch(e => { console.error(e); process.exit(1); });
