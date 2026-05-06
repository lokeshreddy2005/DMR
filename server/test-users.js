const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({}, 'email role');
    const roles = {};
    users.forEach(u => {
        const r = u.role || 'MISSING';
        roles[r] = (roles[r] || 0) + 1;
    });
    console.log(roles);
    mongoose.disconnect();
}).catch(console.error);
