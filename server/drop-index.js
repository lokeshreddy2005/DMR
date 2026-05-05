require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

async function fixIndices() {
    await connectDB();
    try {
        const db = mongoose.connection.db;
        const vaultsCollection = db.collection('vaults');
        const indexes = await vaultsCollection.indexes();
        console.log('Current indexes on vaults:', indexes.map(i => i.name));
        
        for (let index of indexes) {
            if (index.name !== '_id_' && index.name !== 'id_1') {
                console.log(`Dropping index: ${index.name}`);
                await vaultsCollection.dropIndex(index.name);
            }
        }
        console.log('Successfully dropped old indices');
    } catch (err) {
        console.error('Error dropping indices:', err);
    }
    process.exit(0);
}

fixIndices();
