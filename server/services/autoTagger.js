const fs = require('fs');
const pdfParse = require('pdf-parse');

// Keyword rules for vault classification
const VAULT_RULES = {
  finance: [
    'invoice', 'receipt', 'budget', 'expense', 'revenue',
    'payment', 'tax', 'financial', 'accounting', 'profit',
    'loss', 'balance sheet', 'income', 'cost', 'billing',
    'transaction', 'ledger', 'audit', 'fiscal', 'dividend',
  ],
  hr: [
    'employee', 'salary', 'leave', 'hiring', 'resume',
    'onboarding', 'payroll', 'benefits', 'recruitment',
    'performance review', 'attendance', 'termination',
    'human resource', 'workforce', 'compensation',
    'appraisal', 'training', 'candidate', 'interview', 'offer letter',
  ],
  project: [
    'project', 'milestone', 'deadline', 'deliverable', 'sprint',
    'task', 'timeline', 'scope', 'requirement', 'stakeholder',
    'gantt', 'roadmap', 'backlog', 'agile', 'scrum',
    'iteration', 'release', 'planning', 'kickoff', 'retrospective',
  ],
};

/**
 * Extracts text from a PDF file and auto-tags it based on keyword matching.
 * @param {string} filePath - Absolute path to the uploaded PDF file
 * @returns {Promise<{vault: string, tags: string[], content: string}>}
 */
async function autoTag(filePath) {
  // Read and parse the PDF
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text.toLowerCase();

  // Score each vault by counting keyword matches
  const scores = {};
  const matchedTags = {};

  for (const [vault, keywords] of Object.entries(VAULT_RULES)) {
    scores[vault] = 0;
    matchedTags[vault] = [];

    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        scores[vault] += matches.length;
        matchedTags[vault].push(keyword);
      }
    }
  }

  // Determine winning vault
  let bestVault = 'uncategorized';
  let bestScore = 0;
  let tags = [];

  for (const [vault, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestVault = vault;
      tags = matchedTags[vault];
    }
  }

  // If no keywords matched at all, mark as uncategorized
  if (bestScore === 0) {
    bestVault = 'uncategorized';
    tags = [];
  }

  return {
    vault: bestVault,
    tags: [...new Set(tags)], // deduplicate
    content: pdfData.text.substring(0, 2000), // store first 2000 chars
  };
}

module.exports = { autoTag, VAULT_RULES };
