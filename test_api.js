const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dmr_test_clone');
    const User = require('./server/models/User');

    // Get any user
    const user = await User.findOne();
    if (!user) { console.log('No user'); process.exit(0); }
    
    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1d' });
    
    // Make request
    const axios = require('axios');
    try {
        const res = await axios.get('http://localhost:5000/api/documents?space=shared-to-others&sharedToEmail=abc@gmail.com', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("RESPONSE JSON:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log("ERROR:", e.response ? e.response.data : e.message);
    }
    process.exit(0);
})();
