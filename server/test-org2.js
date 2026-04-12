const mongoose = require('mongoose');
const Organization = require('./models/Organization');
const User = require('./models/User');

mongoose.connect('mongodb://127.0.0.1:27017/dmr').then(async () => {
    const user = await User.findOne({ email: 'rakeshdivvela@gmail.com' }) || await User.findOne();
    console.log("Found User ID:", user._id);
    const orgs = await Organization.find({ 'members.user': user._id });
    console.log("Organizations for user:");
    orgs.forEach(o => {
       const m = o.members.find(m => m.user.toString() === user._id.toString());
       console.log(`- Org: ${o.name} | Role: ${m.role}`);
    });
    process.exit(0);
});
