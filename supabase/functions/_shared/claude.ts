// Shared helpers for the AI agent Edge Functions.
// Each agent function provides a system prompt, a JSON schema, and a
// user-prompt builder; this module handles CORS, validation plumbing,
// the Claude call (structured outputs pinned to the schema), and the
// error taxonomy. Keep agents thin: prompt + schema + input validation.

import Anthropic from 'npm:@anthropic-ai/sdk'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export const NODE_TYPES = [
  'raw_idea',
  'market',
  'customer_segment',
  'problem',
  'current_alternative',
  'demand_signal',
  'product_concept',
  'business_model',
  'risk',
  'validation_step',
  'experiment',
  'evidence',
  'decision',
] as const

export const RELATIONSHIP_TYPES = [
  'contains',
  'causes',
  'depends_on',
  'supports',
  'contradicts',
  'reframes',
  'validates',
  'invalidates',
  'alternative_to',
  'risk_for',
  'requires_test',
] as const

interface ClaudeJSONRequest {
  system: string
  userPrompt: string
  schema: Record<string, unknown>
  maxTokens?: number
}

type ClaudeJSONResult = { ok: true; data: unknown } | { ok: false; response: Response }

export async function callClaudeJSON(req: ClaudeJSONRequest): Promise<ClaudeJSONResult> {
  const client = new Anthropic() // reads ANTHROPIC_API_KEY from the environment
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: req.maxTokens ?? 16000,
      thinking: { type: 'adaptive' },
      system: req.system,
      output_config: { format: { type: 'json_schema', schema: req.schema } },
      messages: [{ role: 'user', content: req.userPrompt }],
    })

    if (response.stop_reason === 'refusal') {
      return { ok: false, response: errorResponse(422, 'The model declined this request. Try rephrasing.') }
    }
    if (response.stop_reason === 'max_tokens') {
      return { ok: false, response: errorResponse(502, 'The model response was truncated. Try shorter input.') }
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return { ok: false, response: errorResponse(502, 'The model returned no text output.') }
    }
    return { ok: true, data: JSON.parse(textBlock.text) }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message)
      const retryable = err.status === 429 || err.status >= 500
      return {
        ok: false,
        response: errorResponse(
          retryable ? 503 : 502,
          retryable ? 'The AI service is busy. Please retry in a moment.' : 'AI request failed.',
        ),
      }
    }
    console.error('agent error', err)
    return { ok: false, response: errorResponse(500, 'Unexpected error.') }
  }
}

// Standard request envelope: OPTIONS/method handling + JSON body parsing.
export async function readJSONBody(req: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  if (req.method === 'OPTIONS') {
    return { ok: false, response: new Response('ok', { headers: corsHeaders }) }
  }
  if (req.method !== 'POST') {
    return { ok: false, response: errorResponse(405, 'Method not allowed') }
  }
  try {
    const body = await req.json()
    if (typeof body !== 'object' || body === null) {
      return { ok: false, response: errorResponse(400, 'Body must be a JSON object') }
    }
    return { ok: true, body: body as Record<string, unknown> }
  } catch {
    return { ok: false, response: errorResponse(400, 'Invalid JSON body') }
  }
}
