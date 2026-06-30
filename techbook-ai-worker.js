/**
 * TechBook AI Proxy — Cloudflare Worker
 * ==========================================
 * DEPLOY IN 2 MINUTES:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Click "Workers & Pages" → "Create Application" → "Create Worker"
 * 3. Name it: techbook-ai-proxy
 * 4. Paste this entire file → Click "Deploy"
 * 5. Go to Settings → Variables → Add:
 *       Variable name:  ANTHROPIC_API_KEY
 *       Value:          your-api-key-here   (from console.anthropic.com)
 * 6. Copy your worker URL (e.g. https://techbook-ai-proxy.YOUR.workers.dev)
 * 7. Paste it as AI_PROXY in the HTML file (line with "const AI_PROXY =")
 * ==========================================
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405, headers: CORS_HEADERS
      });
    }

    try {
      const body = await request.json();
      const { system, messages } = body;

      if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: 'Invalid messages' }), {
          status: 400, headers: CORS_HEADERS
        });
      }

      // Call Anthropic API (server-side, no CORS issue)
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',   // Fast + cheap for chat
          max_tokens: 800,
          system: system || 'You are TechBook Bot, a helpful academic assistant.',
          messages: messages,
        }),
      });

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        throw new Error(`Anthropic: ${anthropicRes.status} — ${err}`);
      }

      const data = await anthropicRes.json();
      const reply = data.content?.[0]?.text || 'Sorry, no response.';

      return new Response(JSON.stringify({ reply }), {
        status: 200, headers: CORS_HEADERS
      });

    } catch (err) {
      console.error('Worker error:', err.message);
      return new Response(JSON.stringify({
        reply: "I'm having trouble connecting. Please try again!\n\n📧 techbook.ac.in@gmail.com\n📞 +91 87924 04950"
      }), { status: 200, headers: CORS_HEADERS });
    }
  }
};
