const SYSTEM_PROMPT =
  "You are a smart assistant inside the 'MySpace' productivity app. You help the user analyze their notes, tasks, and recordings. Always respond in Arabic in a clear, organized manner."
const MODEL = 'gemini-3.8-flash'
const MAX_MESSAGE_LENGTH = 8000
const MAX_CONTEXT_LENGTH = 20000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!payload || typeof payload !== 'object') return jsonResponse({ error: 'Invalid request body' }, 400)

  const body = payload as { message?: unknown; context?: unknown }
  if (typeof body.message !== 'string' || !body.message.trim()) {
    return jsonResponse({ error: 'A message is required' }, 400)
  }
  if (body.message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({ error: 'Message is too long' }, 413)
  }
  if (body.context !== undefined && typeof body.context !== 'string') {
    return jsonResponse({ error: 'Context must be text' }, 400)
  }
  if (typeof body.context === 'string' && body.context.length > MAX_CONTEXT_LENGTH) {
    return jsonResponse({ error: 'Context is too long' }, 413)
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Gemini service is not configured' }, 503)

  const prompt = body.context?.trim()
    ? `${body.message.trim()}\n\nالمصدر المرفق:\n${body.context.trim()}`
    : body.message.trim()

  let geminiResponse: Response
  try {
    geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    })
  } catch {
    return jsonResponse({ error: 'Gemini request failed' }, 502)
  }

  const result = (await geminiResponse.json().catch(() => null)) as GeminiResponse | null
  if (!geminiResponse.ok) return jsonResponse({ error: 'Gemini request failed' }, 502)

  const answer = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.trim())
    .filter((part): part is string => !!part)
    .join('\n')
    .trim()

  if (!answer) return jsonResponse({ error: 'Gemini returned no response' }, 502)
  return jsonResponse({ response: answer })
})
