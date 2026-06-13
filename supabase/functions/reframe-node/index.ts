// POST /functions/v1/reframe-node
// Body: {
//   selected_node: { node_type, title, description, evidence_status },
//   project_context: { raw_idea: string }
// }
// Returns the Reframe Agent JSON (snake_case).
//
// Deploy:  supabase functions deploy reframe-node

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const REFRAME_SCHEMA = {
  type: 'object',
  properties: {
    reframes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why_it_matters: { type: 'string' },
        },
        required: ['title', 'why_it_matters'],
        additionalProperties: false,
      },
    },
  },
  required: ['reframes'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a reframing agent for product opportunity discovery.
Your job is to create genuinely different angles on a selected node, so the user
escapes their first framing instead of polishing it.

RULES:
1. Produce 3-5 reframes. Each must change something structural: the outcome promised, the customer who pays, the job being done, the wedge into the market, or the category the product competes in.
2. A reframe is not a synonym or a tagline polish. "AI mind map app" -> "demand validation graph for founders" changes the category and buyer; that is the bar.
3. why_it_matters explains what becomes easier to validate, sell, or build if this framing is right - one or two sentences, concrete.
4. At least one reframe should feel uncomfortable: it drops or demotes something the current framing treats as core.
5. Ground every reframe in the specific node and project; no generic pivots.`

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { selected_node, project_context } = parsed.body as {
    selected_node?: { node_type?: string; title?: string; description?: string; evidence_status?: string }
    project_context?: { raw_idea?: string }
  }

  if (!selected_node || typeof selected_node.title !== 'string' || !selected_node.title.trim()) {
    return errorResponse(400, 'selected_node with a title is required')
  }

  const userPrompt = `Create reframes for this node.

Selected node:
- Type: ${selected_node.node_type ?? 'unknown'}
- Title: ${selected_node.title}
- Description: ${selected_node.description ?? ''}
- Evidence status: ${selected_node.evidence_status ?? 'assumption'}

Project raw idea:
${project_context?.raw_idea ?? ''}`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: REFRAME_SCHEMA,
    effort: 'low',
    label: 'reframe-node',
  })
  if (!result.ok) return result.response

  const data = result.data as { reframes?: unknown[] }
  if (!Array.isArray(data.reframes) || data.reframes.length === 0) {
    return errorResponse(502, 'The model returned no reframes. Please try again.')
  }
  return jsonResponse(result.data)
})
