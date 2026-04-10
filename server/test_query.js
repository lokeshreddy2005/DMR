const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Document = require('./models/Document');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dmr_test_clone');
    const u = await User.findOne({ name: 'qwerty' });
    console.log("Found test user qwerty:", !!u);
    if (!u) process.exit(1);

    // Let's manually run the query logic
    const email = 'abc@gmail.com';
    const recipientUser = await User.findOne({ email: email.toLowerCase() });
    console.log("Found recipient user:", !!recipientUser);

    let accessQuery;
    if (recipientUser) {
        accessQuery = {
            uploadedBy: u._id,
            permissions: { $elemMatch: { user: recipientUser._id, role: { $ne: 'owner' } } }
        };
    } else {
        console.log("Should return empty!");
        accessQuery = { _id: null }; // Equivalent to returning empty
    }

    console.log("Access Query:", JSON.stringify(accessQuery));
    const docs = await Document.find(accessQuery);
    console.log("Documents found:", docs.length);
    process.exit(0);
})();
