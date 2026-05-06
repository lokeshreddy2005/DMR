const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('./models/User');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const admin = await User.findOne({ role: 'admin' });
    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/organizations',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };

    const req = http.request(options, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            console.log("Status:", res.statusCode);
            console.log("Data snippet:", data.substring(0, 500));
        });
    });

    req.on('error', e => {
        console.error("Request error:", e);
    });

    req.end();
    
    // Also test users
    const req2 = http.request({...options, path: '/api/admin/users'}, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            console.log("Users Status:", res.statusCode);
            console.log("Users Data snippet:", data.substring(0, 500));
            mongoose.disconnect();
        });
    });
    req2.end();
}).catch(console.error);
