// POST /functions/v1/generate-map
// Body: { "raw_idea": string }
// Returns the Contract 1 "Generate initial map" JSON (snake_case).
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-map

import {
  callClaudeJSON,
  errorResponse,
  jsonResponse,
  readJSONBody,
  RELATIONSHIP_TYPES,
} from '../_shared/claude.ts'

// The initial map uses the core node types only; experiment/evidence/decision
// nodes appear later through expansion and agent actions.
const MAP_NODE_TYPES = [
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
          node_type: { type: 'string', enum: [...MAP_NODE_TYPES] },
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

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const rawIdea = parsed.body.raw_idea
  const focusBrief = parsed.body.focus_brief

  if (typeof rawIdea !== 'string' || !rawIdea.trim()) {
    return errorResponse(400, 'raw_idea must be a non-empty string')
  }
  if (rawIdea.length > 4000) {
    return errorResponse(400, 'raw_idea is too long (max 4000 characters)')
  }

  let userPrompt = `Create an initial opportunity map for this raw idea:\n\n${rawIdea.trim()}`
  if (typeof focusBrief === 'string' && focusBrief.trim()) {
    userPrompt += `\n\nFocus brief from the discovery panel discussion (the user already narrowed the idea - build the map around THIS focus, not the broad idea):\n${focusBrief.trim().slice(0, 2000)}\n\nBecause the focus is settled, keep the map tight: exactly 1 node per required type unless a second is truly essential. Sharper and fewer beats broad.`
  }

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: MAP_SCHEMA,
    effort: 'medium',
    label: 'generate-map',
  })
  if (!result.ok) return result.response

  const map = result.data as { nodes?: unknown[] }
  // Structured outputs guarantee the schema; this guards product rules.
  if (!Array.isArray(map.nodes) || map.nodes.length < MAP_NODE_TYPES.length) {
    return errorResponse(502, 'The generated map is incomplete. Please try again.')
  }
  return jsonResponse(result.data)
})
