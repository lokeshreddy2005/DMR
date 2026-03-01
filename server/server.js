const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');
const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', documentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Smart Upload Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   POST /api/upload        - Upload & auto-tag a PDF`);
    console.log(`   GET  /api/documents     - List all documents`);
    console.log(`   GET  /api/documents/stats - Vault statistics`);
    console.log(`   GET  /api/health        - Health check`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
