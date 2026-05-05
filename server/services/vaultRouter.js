const Groq = require('groq-sdk');
const { VAULT_THRESHOLD } = require('../constants/vaults');
const Vault = require('../models/Vault');

//Vault Router Service

const groqVault = new Groq({ apiKey: process.env.GROQ_VAULT_API_KEY });

/**
 * Route a document to one or more vaults based on its tags and metadata.
 */
async function routeDocumentToVaults(tags = [], metadata = {}, fileName = '') {
    // Fetch all active vaults from DB
    const vaults = await Vault.find();
    if (!vaults || vaults.length === 0) {
        console.warn('No vaults found in DB, skipping routing.');
        return [];
    }
    // Build a concise document summary for the prompt
    const docSummary = [
        fileName ? `File name: ${fileName}` : '',
        metadata.primaryDomain ? `Primary domain: ${metadata.primaryDomain}` : '',
        metadata.departmentOwner ? `Department: ${metadata.departmentOwner}` : '',
        metadata.typeTags?.length ? `Document types: ${metadata.typeTags.join(', ')}` : '',
        tags.length ? `Keywords: ${tags.join(', ')}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    // Build vault catalogue for the prompt
    const vaultList = vaults.map(
        (v) => `- "${v.id}": ${v.label} — ${v.description} (hints: ${v.keywords.join(', ')})`
    ).join('\n');

    // Generate JSON template from DB vaults
    const vaultScoresTemplate = vaults.reduce((acc, v) => {
        acc[v.id] = 0.0;
        return acc;
    }, {});

    const prompt = `You are a document vault classification system.

Given the document information below, assign a confidence score (0.0 to 1.0) to EACH vault indicating how well the document fits that vault. Be precise — most documents should score high in only 1–3 vaults.

DOCUMENT:
${docSummary}

VAULTS:
${vaultList}

Return ONLY valid JSON in exactly this format:
{
  "vault_scores": ${JSON.stringify(vaultScoresTemplate, null, 4)}
}

RULES:
- Every vault must have a score. Use 0.0 for clearly irrelevant vaults.
- Scores must be between 0.0 and 1.0 (two decimal places max).
- Return ONLY the JSON object, no markdown, no explanation.`;

    try {
        const completion = await groqVault.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.05,
            max_completion_tokens: 512,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(responseText);
        const rawScores = parsed.vault_scores || {};

        // Keep all vaults and normalize across all of them so probabilities sum to 1.0 (100%).
        const allVaults = vaults.map((v) => {
            const value = parseFloat(rawScores[v.id]);
            const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
            return {
                vaultId: v.id,
                label: v.label,
                score: safeValue,
                routedAt: new Date(),
            };
        });

        const total = allVaults.reduce((sum, v) => sum + v.score, 0);
        if (total > 0) {
            allVaults.forEach((v) => {
                v.score = v.score / total;
            });
        } else {
            // If model returns unusable scores, default to miscellaneous with full probability.
            allVaults.forEach((v) => {
                v.score = v.vaultId === 'miscellaneous' ? 1 : 0;
            });
        }

        // Stabilize rounding drift while keeping sum exactly 1.0.
        allVaults.forEach((v) => {
            v.score = Number(v.score.toFixed(6));
        });
        const roundedSum = allVaults.reduce((sum, v) => sum + v.score, 0);
        const drift = Number((1 - roundedSum).toFixed(6));
        if (drift !== 0) {
            const topIdx = allVaults.reduce((bestIdx, current, idx, arr) => (
                current.score > arr[bestIdx].score ? idx : bestIdx
            ), 0);
            allVaults[topIdx].score = Number(Math.max(0, allVaults[topIdx].score + drift).toFixed(6));
        }

        // Keep highest-confidence vaults first for UI readability.
        allVaults.sort((a, b) => b.score - a.score);
        return allVaults;
    } catch (err) {
        console.error('Vault router error:', err.message);
        // On any error, return a valid probability distribution across all vaults.
        return vaults.map((v) => ({
            vaultId: v.id,
            label: v.label,
            score: v.id === 'miscellaneous' ? 1 : 0,
            routedAt: new Date(),
        }));
    }
}

module.exports = { routeDocumentToVaults, VAULT_THRESHOLD };
