const Groq = require('groq-sdk');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const { getCache, setCache } = require('./redisClient');

let groq = null;
function getGroqClient() {
    if (!groq) {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groq;
}

/**
 * Extract text from a file buffer based on mime type.
 */
async function extractText(fileBuffer, mimeType, fileName) {
    try {
        if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
            const data = await pdfParse(fileBuffer);
            return data.text || '';
        }
        if (mimeType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
            return fileBuffer.toString('utf-8');
        }
        // For unsupported types, return filename as context
        return `Document: ${fileName}`;
    } catch (err) {
        console.error('Text extraction error:', err.message);
        return `Document: ${fileName}`;
    }
}

/**
 * Auto-tag a document using Groq LLM.
 * @param {Buffer} fileBuffer - File contents
 * @param {string} mimeType - MIME type
 * @param {string} fileName - Original file name
 * @returns {Promise<{tags: string[], metadata: object}>}
 */
async function autoTagDocument(fileBuffer, mimeType, fileName) {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const cacheKey = `ai_tags:hash:${fileHash}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        console.log('⚡ Using cached AI tags for document hash:', fileHash);
        return cachedData;
    }

    const text = await extractText(fileBuffer, mimeType, fileName);

    // Truncate long documents (Groq context limit)
    const truncated = text.length > 8000 ? text.substring(0, 8000) + '\n...[truncated]' : text;

    const prompt = `You are a document classification system.

Analyze the document content and return ONLY valid JSON with this exact structure:

{
  "system_metadata": {
    "primary_domain": "ONE OF: Academics, Finance, Operations, Governance, Research, General",
    "sensitivity": "ONE OF: Non-Sensitive, Internal-Only, Restricted, Highly-Sensitive",
    "vault_target": "ONE OF: Academic_Vault, Finance_Vault, Operations_Vault, Governance_Vault, Research_Vault, General_Vault"
  },
  "document_identity": {
    "type_tags": ["from: Assessment, Administrative, Financial, Creative, Legal, Technical, Official, Report, Invoice, Marksheet, Transcript, Assignment, Publication, Newsletter, Certificate, Memo"],
    "academic_year": "YYYY or Unknown",
    "department_owner": "ONE OF: Computer Science, Electrical, Mechanical, Civil, Management, Sciences, Administration, Finance Department, General"
  },
  "discovery": {
    "keywords": ["5-15 relevant keywords extracted from the content"]
  }
}

RULES:
- Return ONLY the JSON. No markdown, no explanations.
- keywords should be meaningful search terms.
- Choose the MOST specific values.

DOCUMENT CONTENT:
${truncated}`;

    try {
        const completion = await getGroqClient().chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            max_completion_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(responseText);

        // Extract tags and metadata
        const tags = parsed.discovery?.keywords || [];
        const metadata = {
            primaryDomain: parsed.system_metadata?.primary_domain || 'General',
            sensitivity: parsed.system_metadata?.sensitivity || 'Non-Sensitive',
            vaultTarget: parsed.system_metadata?.vault_target || 'General_Vault',
            typeTags: parsed.document_identity?.type_tags || [],
            departmentOwner: parsed.document_identity?.department_owner || 'General',
            academicYear: parsed.document_identity?.academic_year || 'Unknown',
        };

        const result = { tags, metadata, raw: parsed };
        
        // Cache AI results for 30 days
        await setCache(cacheKey, result, 30 * 24 * 60 * 60);

        return result;
    } catch (err) {
        console.error('Groq auto-tag error:', err.message);
        // Return fallback tags from filename
        const fileNameTags = fileName
            .replace(/\.[^.]+$/, '')
            .split(/[_\-\s]+/)
            .filter((w) => w.length > 2);
        return {
            tags: fileNameTags,
            metadata: {
                primaryDomain: 'General',
                sensitivity: 'Non-Sensitive',
                vaultTarget: 'General_Vault',
                typeTags: [],
                departmentOwner: 'General',
                academicYear: 'Unknown',
            },
            raw: null,
        };
    }
}

module.exports = { autoTagDocument, extractText };
