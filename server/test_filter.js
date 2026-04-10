const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Document = require('./models/Document');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dmr_test_clone');
    const u = await User.findOne();
    if (!u) { console.log('no user'); process.exit(0); }
    console.log('User:', u.email, u._id);
    
    // Simulate req logic
    const req = { user: u, query: { space: 'shared-to-others', sharedToEmail: 'abc@gmail.com' } };
    const { space, sharedToEmail } = req.query;

    console.log("Simulating filter for:", sharedToEmail);
    let accessQuery = {};
    if (sharedToEmail && sharedToEmail.trim()) {
        const recipientUser = await User.findOne({ email: sharedToEmail.trim().toLowerCase() });
        console.log('Recipient found:', !!recipientUser);
        if (recipientUser) {
            accessQuery = {
                uploadedBy: req.user._id,
                permissions: { $elemMatch: { user: recipientUser._id, role: { $ne: 'owner' } } }
            };
        } else {
            console.log('Returns empty');
            process.exit(0);
        }
    }
    
    console.log('AccessQuery:', JSON.stringify(accessQuery));
    const docs = await Document.find(accessQuery);
    console.log('Docs found:', docs.length);
    process.exit(0);
})();
