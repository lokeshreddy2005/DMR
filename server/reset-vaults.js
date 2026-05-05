require('dotenv').config();
const mongoose = require('mongoose');
const Vault = require('./models/Vault');
const { connectDB } = require('./config/db');

async function resetVaults() {
    await connectDB();
    await Vault.deleteMany({});
    console.log('Cleared vaults');
    process.exit(0);
}
resetVaults();
