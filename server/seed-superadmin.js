require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
    const args = process.argv.slice(2);
    let email, password, name;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--email') email = args[i + 1];
        if (args[i] === '--password') password = args[i + 1];
        if (args[i] === '--name') name = args[i + 1];
    }

    if (!email || !password || !name) {
        console.error('Usage: node seed-superadmin.js --email <email> --password <password> --name <name>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('User already exists, updating role to superadmin...');
            existingUser.role = 'superadmin';
            existingUser.name = name;
            existingUser.password = password; // Will be hashed by pre-save hook
            await existingUser.save();
            console.log('User updated successfully.');
        } else {
            const user = new User({
                name,
                email: email.toLowerCase(),
                password,
                role: 'superadmin'
            });
            await user.save();
            console.log('Super Admin created successfully.');
        }
    } catch (err) {
        console.error('Error seeding superadmin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
