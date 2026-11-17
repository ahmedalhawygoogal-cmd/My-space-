const SYSTEM_PROMPT =
  "You are a smart assistant inside the 'MySpace' productivity app. You help the user analyze their notes, tasks, and recordings. Be clear and organized.";

// `gemini-flash-latest` is Google's "latest" alias for the current Flash model:
// the fastest tier, hot-swapped to each new Flash release. Pro / 2.x / 1.5 names
// are avoided on purpose — `gemini-1.5-flash` is retired and now 404s on v1beta.
const MODEL = 'gemini-flash-latest';

// Must stay well under the Edge Function wall-clock limit, so a slow upstream
// call fails fast with a readable error instead of being killed by the runtime.
const GEMINI_TIMEOUT_MS = 15_000;

// Caps generation time and payload size; a short answer is all the chat needs.
const MAX_OUTPUT_TOKENS = 500;

const MAX_MESSAGE_LENGTH = 8000;
const MAX_CONTEXT_LENGTH = 20000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload || typeof payload !== 'object') return jsonResponse({ error: 'Invalid request body' }, 400);
  if (typeof payload.message !== 'string' || !payload.message.trim()) {
    return jsonResponse({ error: 'A message is required' }, 400);
  }
  if (payload.message.length > MAX_MESSAGE_LENGTH) return jsonResponse({ error: 'Message is too long' }, 413);
  if (payload.context !== undefined && typeof payload.context !== 'string') {
    return jsonResponse({ error: 'Context must be text' }, 400);
  }
  if (typeof payload.context === 'string' && payload.context.length > MAX_CONTEXT_LENGTH) {
    return jsonResponse({ error: 'Context is too long' }, 413);
  }

  const lang = typeof payload.lang === 'string' && payload.lang.trim() ? payload.lang.trim().slice(0, 32) : 'ar';

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'Gemini service is not configured' }, 503);

  // Plain string concatenation only — no loops over the context and no copies of
  // it, so the request never does heavy synchronous work inside the isolate.
  const fullPrompt =
    SYSTEM_PROMPT +
    '\n\nYou must ALWAYS respond in the following language: ' +
    lang +
    '. Do not switch languages unless explicitly asked.' +
    '\n\nUser: ' +
    payload.message.trim() +
    (payload.context?.trim() ? '\n\nContext:\n' + payload.context.trim() : '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let geminiResponse: Response;
  let rawBody: string;

  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        }),
      },
    );

    // Read the body once, while the abort timer still covers it.
    rawBody = await geminiResponse.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonResponse(
        {
          error: 'AI took too long to respond',
          message: 'AI took too long to respond, please try a shorter message',
          code: 'AI_TIMEOUT',
        },
        504,
      );
    }
    return jsonResponse({ error: 'Fetch failed', details: String(error) }, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!geminiResponse.ok) {
    let errorMessage = 'Unknown error';
    try {
      const errorJson = JSON.parse(rawBody);
      errorMessage = errorJson?.error?.message || rawBody;
    } catch {
      errorMessage = rawBody;
    }
    return jsonResponse(
      { error: 'Gemini request failed', details: errorMessage, code: 'GEMINI_ERROR', status: geminiResponse.status },
      502,
    );
  }

  let result: any = null;
  try {
    result = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Gemini returned an invalid response', code: 'GEMINI_BAD_JSON' }, 502);
  }

  const answer = result?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text?.trim())
    .filter((part: any) => !!part)
    .join('\n')
    .trim();

  if (!answer) return jsonResponse({ error: 'Gemini returned no response', raw: result }, 502);

  return jsonResponse({ response: answer });
});
