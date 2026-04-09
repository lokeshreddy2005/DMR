const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/DMR 3/DMR/server/.env' });
const Document = require('d:/DMR 3/DMR/server/models/Document');
const User = require('d:/DMR 3/DMR/server/models/User');

async function check() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'bill@gmail.com' });
    console.log('User bill@gmail.com:', user ? { id: user._id, name: user.name } : 'Not found');

    const doc = await Document.findOne({ fileName: /LLM.*manipulation/i });
    console.log('Document "LLM manipulation":', doc ? { id: doc._id, fileName: doc.fileName, space: doc.space } : 'Not found');

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
