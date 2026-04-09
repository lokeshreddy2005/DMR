require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const organizationRoutes = require('./routes/organizations');
const publicRoutes = require('./routes/public');
const apiKeyRoutes = require('./routes/apiKeys');
const externalRoutes = require('./routes/external');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',      // Local dev
  'http://localhost:3000',       // Local dev
  'https://document-management-repository.vercel.app', // Production Vercel
];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

// Preflight request handler
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/orgs', organizationRoutes);
app.use('/api/public', publicRoutes); // No auth required
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/external', externalRoutes); // External API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 DMR Server running on http://localhost:${PORT}`);
    console.log(`📡 Routes: /api/auth, /api/documents, /api/orgs, /api/public, /api/api-keys, /api/external, /api/health`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
