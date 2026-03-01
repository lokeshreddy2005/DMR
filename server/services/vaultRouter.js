const Document = require('../models/Document');

// Maps vault names to descriptive labels
const VAULT_META = {
  finance: {
    label: 'Finance Vault',
    description: 'Invoices, budgets, receipts, and financial documents',
    icon: '💰',
  },
  hr: {
    label: 'HR Vault',
    description: 'Employee records, resumes, payroll, and HR documents',
    icon: '👥',
  },
  project: {
    label: 'Project Vault',
    description: 'Project plans, milestones, deliverables, and sprint docs',
    icon: '📋',
  },
  uncategorized: {
    label: 'Uncategorized',
    description: 'Documents that could not be automatically classified',
    icon: '📄',
  },
};

/**
 * Routes a document to the correct vault by saving it with the proper vault tag.
 * @param {Object} params
 * @param {string} params.fileName - Name of the uploaded file
 * @param {string} params.vault - Vault classification from auto-tagger
 * @param {string[]} params.tags - Keywords found
 * @param {string} params.content - Extracted text content
 * @param {number} params.fileSize - File size in bytes
 * @returns {Promise<Object>} Saved document
 */
async function routeToVault({ fileName, vault, tags, content, fileSize }) {
  const doc = new Document({
    fileName,
    vault,
    tags,
    content,
    fileSize,
  });

  await doc.save();

  return {
    document: doc,
    vaultInfo: VAULT_META[vault] || VAULT_META.uncategorized,
  };
}

/**
 * Get all documents, optionally filtered by vault.
 */
async function getDocuments(vaultFilter) {
  const query = vaultFilter ? { vault: vaultFilter } : {};
  return Document.find(query).sort({ uploadDate: -1 });
}

/**
 * Get document counts per vault for the dashboard.
 */
async function getVaultStats() {
  const stats = await Document.aggregate([
    {
      $group: {
        _id: '$vault',
        count: { $sum: 1 },
      },
    },
  ]);

  // Build a full stats object with 0 counts for empty vaults
  const result = {};
  for (const vault of Object.keys(VAULT_META)) {
    const stat = stats.find((s) => s._id === vault);
    result[vault] = {
      ...VAULT_META[vault],
      count: stat ? stat.count : 0,
    };
  }

  return result;
}

module.exports = { routeToVault, getDocuments, getVaultStats, VAULT_META };
