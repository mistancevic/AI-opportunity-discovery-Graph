// POST /functions/v1/generate-map
// Body: { "raw_idea": string }
// Returns the Contract 1 "Generate initial map" JSON (snake_case).
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-map

import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const NODE_TYPES = [
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
] as const

const RELATIONSHIP_TYPES = [
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

// Structured-output schema for the Contract 1 response. Constraints the API
// doesn't support (min/max) are enforced by the prompt rules instead.
const MAP_SCHEMA = {
  type: 'object',
  properties: {
    project_title: { type: 'string' },
    summary: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          temp_id: { type: 'string' },
          node_type: { type: 'string', enum: [...NODE_TYPES] },
          title: { type: 'string' },
          description: { type: 'string' },
          evidence_status: { type: 'string', enum: ['assumption'] },
          confidence_score: { type: 'number' },
          assumptions: { type: 'array', items: { type: 'string' } },
          suggested_next_action: { type: 'string' },
        },
        required: [
          'temp_id',
          'node_type',
          'title',
          'description',
          'evidence_status',
          'confidence_score',
          'assumptions',
          'suggested_next_action',
        ],
        additionalProperties: false,
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source_temp_id: { type: 'string' },
          target_temp_id: { type: 'string' },
          relationship_type: { type: 'string', enum: [...RELATIONSHIP_TYPES] },
          explanation: { type: 'string' },
        },
        required: ['source_temp_id', 'target_temp_id', 'relationship_type', 'explanation'],
        additionalProperties: false,
      },
    },
    today_next_step: {
      type: 'object',
      properties: {
        biggest_unknown: { type: 'string' },
        suggested_action: { type: 'string' },
        why_it_matters: { type: 'string' },
      },
      required: ['biggest_unknown', 'suggested_action', 'why_it_matters'],
      additionalProperties: false,
    },
  },
  required: ['project_title', 'summary', 'nodes', 'edges', 'today_next_step'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are an opportunity discovery and demand validation agent.
Your job is to convert one raw idea into a practical opportunity graph.
Do not ask for more input.
Do not create theory.
Do not create generic business advice.
Every node must be useful for product discovery or validation.

RULES:
1. Create exactly 1 raw_idea node.
2. Create 1-3 nodes for each of these required types: market, customer_segment, problem, current_alternative, demand_signal, product_concept, business_model, risk, validation_step.
3. Each node must be written as a concrete claim, not a vague topic.
4. Each node must have evidence_status = "assumption".
5. confidence_score is between 0 and 1 and reflects how plausible the claim is before any evidence.
6. Each node's suggested_next_action must be a concrete step the user could take this week.
7. Add edges between related nodes; every node must be connected to at least one other node.
8. today_next_step must name the single most important unknown and one concrete action that tests it.
9. Avoid theoretical business canvas language. Write like a practical product coach.`

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  let rawIdea: unknown
  try {
    const body = await req.json()
    rawIdea = body.raw_idea
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }
  if (typeof rawIdea !== 'string' || !rawIdea.trim()) {
    return errorResponse(400, 'raw_idea must be a non-empty string')
  }
  if (rawIdea.length > 4000) {
    return errorResponse(400, 'raw_idea is too long (max 4000 characters)')
  }

  const client = new Anthropic() // reads ANTHROPIC_API_KEY from the environment

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: MAP_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Create an initial opportunity map for this raw idea:\n\n${rawIdea.trim()}`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return errorResponse(422, 'The model declined to process this idea. Try rephrasing it.')
    }
    if (response.stop_reason === 'max_tokens') {
      return errorResponse(502, 'The model response was truncated. Try a shorter idea.')
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return errorResponse(502, 'The model returned no text output.')
    }

    const map = JSON.parse(textBlock.text)
    // Structured outputs guarantee the schema; this guards product rules.
    if (!Array.isArray(map.nodes) || map.nodes.length < NODE_TYPES.length) {
      return errorResponse(502, 'The generated map is incomplete. Please try again.')
    }

    return new Response(JSON.stringify(map), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message)
      const retryable = err.status === 429 || err.status >= 500
      return errorResponse(
        retryable ? 503 : 502,
        retryable ? 'The AI service is busy. Please retry in a moment.' : 'AI request failed.',
      )
    }
    console.error('generate-map error', err)
    return errorResponse(500, 'Unexpected error generating the map.')
  }
})
