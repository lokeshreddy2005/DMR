const Groq = require('groq-sdk');
const { VAULTS, VAULT_MAP, VAULT_THRESHOLD } = require('../constants/vaults');

//Vault Router Service

const groqVault = new Groq({ apiKey: process.env.GROQ_VAULT_API_KEY });

/**
 * Route a document to one or more vaults based on its tags and metadata.
 */
async function routeDocumentToVaults(tags = [], metadata = {}, fileName = '') {
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
    const vaultList = VAULTS.map(
        (v) => `- "${v.id}": ${v.label} — ${v.description} (hints: ${v.keywords.join(', ')})`
    ).join('\n');

    const prompt = `You are a document vault classification system.

Given the document information below, assign a confidence score (0.0 to 1.0) to EACH vault indicating how well the document fits that vault. Be precise — most documents should score high in only 1–3 vaults.

DOCUMENT:
${docSummary}

VAULTS:
${vaultList}

Return ONLY valid JSON in exactly this format:
{
  "vault_scores": {
    "academics": 0.0,
    "finance": 0.0,
    "operations": 0.0,
    "governance": 0.0,
    "research": 0.0,
    "hr": 0.0,
    "engineering": 0.0,
    "marketing": 0.0,
    "it_systems": 0.0,
    "student_affairs": 0.0,
    "library_archives": 0.0,
    "events": 0.0,
    "miscellaneous": 0.0
  }
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

        // Filter to vaults above threshold, map to full objects
        const routed = VAULTS.filter((v) => {
            const score = parseFloat(rawScores[v.id]);
            return !isNaN(score) && score >= VAULT_THRESHOLD;
        }).map((v) => ({
            vaultId: v.id,
            label: v.label,
            score: Math.round(parseFloat(rawScores[v.id]) * 100) / 100,
            routedAt: new Date(),
        }));

        // Sort by score descending
        routed.sort((a, b) => b.score - a.score);

        // Fallback: if nothing qualifies, assign miscellaneous
        if (routed.length === 0) {
            console.warn('⚠️  Vault router: no vault met threshold — falling back to miscellaneous');
            return [
                {
                    vaultId: 'miscellaneous',
                    label: VAULT_MAP['miscellaneous'].label,
                    score: 1.0,
                    routedAt: new Date(),
                },
            ];
        }

        return routed;
    } catch (err) {
        console.error('Vault router error:', err.message);
        // On any error, fall back to miscellaneous so docs are never un-routed
        return [
            {
                vaultId: 'miscellaneous',
                label: VAULT_MAP['miscellaneous'].label,
                score: 1.0,
                routedAt: new Date(),
            },
        ];
    }
}

module.exports = { routeDocumentToVaults, VAULT_THRESHOLD };
