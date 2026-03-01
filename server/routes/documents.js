const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { autoTag } = require('../services/autoTagger');
const { routeToVault, getDocuments, getVaultStats } = require('../services/vaultRouter');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

/**
 * POST /api/upload
 * Upload a PDF, auto-tag it, and route it to the correct vault.
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Auto-tag the uploaded PDF
    const tagResult = await autoTag(req.file.path);

    // Route to the correct vault
    const result = await routeToVault({
      fileName: req.file.originalname,
      vault: tagResult.vault,
      tags: tagResult.tags,
      content: tagResult.content,
      fileSize: req.file.size,
    });

    // Clean up uploaded file (we've extracted the text)
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to clean up file:', err);
    });

    res.status(201).json({
      message: 'Document uploaded and classified successfully',
      document: result.document,
      vaultInfo: result.vaultInfo,
    });
  } catch (err) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

/**
 * GET /api/documents
 * Fetch all documents. Optional query: ?vault=finance
 */
router.get('/documents', async (req, res) => {
  try {
    const { vault } = req.query;
    const documents = await getDocuments(vault);
    res.json({ documents });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/documents/stats
 * Get document count per vault.
 */
router.get('/documents/stats', async (req, res) => {
  try {
    const stats = await getVaultStats();
    res.json({ stats });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
