// Cloudflare Worker — translation proxy for the PAI marketing tool.
//
// Holds ANTHROPIC_API_KEY as a Worker secret and forwards translation
// requests to Claude Sonnet 4.6. The browser never sees the API key.
//
// Request:  POST  body = {
//   targetLanguages: string[],          // BCP-47 codes, e.g. ["pt-BR","es","ja"]
//   headlineText: string,
//   footerByline: string,
//   headlineHighlightWords: string,     // space-separated
// }
// Response: { translations: { [lang]: { headlineText, footerByline, headlineHighlightWords } } }

const SYSTEM_PROMPT = `You translate short marketing copy used inside slide compositions.

Input is JSON with:
- targetLanguages: array of BCP-47 codes (e.g. "pt-BR", "id", "es", "de", "fr", "tr", "zh", "ja", "ko", "ar")
- english.headlineText: the headline. May contain explicit "\\n" line breaks — preserve them exactly in every translation.
- english.footerByline: a short tagline (often a CTA).
- english.headlineHighlightWords: a space-separated list of words from the headline that are visually emphasized in a second color.

For each target language, produce:
1. headlineText — an idiomatic translation in natural marketing voice. Preserve newlines from the English source. Do NOT translate proper nouns, brand names, or product names (e.g. "Presentations.AI").
2. footerByline — translated naturally.
3. headlineHighlightWords — the equivalent words from your translated headlineText that carry the same emphasis as the English highlight words. These must be whole-word matches that appear verbatim in your translated headlineText, separated by spaces. If a concept doesn't translate to discrete words, return the closest-matching words from the translated headline.

Output STRICT JSON only. No prose, no markdown fences. Top-level object keyed by language code; each value an object with exactly { headlineText, footerByline, headlineHighlightWords }.`;

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;
const MAX_INPUT_CHARS = 4000;
const MAX_LANGUAGES = 20;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return jsonError(405, 'Method not allowed');
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonError(400, 'Invalid JSON body'); }

    const {
      targetLanguages,
      headlineText = '',
      footerByline = '',
      headlineHighlightWords = '',
    } = body;

    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return jsonError(400, 'targetLanguages must be a non-empty array');
    }
    if (targetLanguages.length > MAX_LANGUAGES) {
      return jsonError(400, `targetLanguages capped at ${MAX_LANGUAGES}`);
    }
    const totalChars = headlineText.length + footerByline.length + headlineHighlightWords.length;
    if (totalChars > MAX_INPUT_CHARS) {
      return jsonError(400, `input text exceeds ${MAX_INPUT_CHARS} characters`);
    }

    const userMsg = JSON.stringify({
      targetLanguages,
      english: { headlineText, footerByline, headlineHighlightWords },
    });

    let claudeResp;
    try {
      claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
    } catch (err) {
      return jsonError(502, `Upstream fetch failed: ${err.message}`);
    }

    if (!claudeResp.ok) {
      const text = await claudeResp.text();
      return jsonError(claudeResp.status, `Claude API error: ${text}`);
    }

    const data = await claudeResp.json();
    const content = data?.content?.[0]?.text || '';

    let translations;
    try { translations = JSON.parse(content); }
    catch { return jsonError(502, `Claude returned non-JSON: ${content.slice(0, 500)}`); }

    return jsonResponse(200, { translations });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(), 'content-type': 'application/json' },
  });
}

function jsonError(status, message) {
  return jsonResponse(status, { error: message });
}
