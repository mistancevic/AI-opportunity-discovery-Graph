// POST /functions/v1/challenge-node
// Body: {
//   selected_node: { node_type, title, description, evidence_status },
//   project_context: { raw_idea: string }
// }
// Returns the Contract 3 "Challenge selected node" JSON (snake_case).
//
// Deploy:  supabase functions deploy challenge-node

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const CHALLENGE_SCHEMA = {
  type: 'object',
  properties: {
    challenge_summary: { type: 'string' },
    objections: { type: 'array', items: { type: 'string' } },
    critical_assumptions: { type: 'array', items: { type: 'string' } },
    contradicting_signals_to_check: { type: 'array', items: { type: 'string' } },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    suggested_tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test_name: { type: 'string' },
          how_to_run: { type: 'string' },
          pass_signal: { type: 'string' },
          fail_signal: { type: 'string' },
        },
        required: ['test_name', 'how_to_run', 'pass_signal', 'fail_signal'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'challenge_summary',
    'objections',
    'critical_assumptions',
    'contradicting_signals_to_check',
    'risk_level',
    'suggested_tests',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a skeptical product discovery reviewer.
Your job is to challenge a selected node so the user does not fall in love with weak assumptions.

RULES:
1. Identify why this node may be false, weak, too broad, or not urgent.
2. Identify current real-world behavior that may contradict it.
3. Identify what must be true for this node to matter.
4. Suggest 2-3 validation tests, each with a concrete pass and fail signal.
5. Do not be negative for the sake of it. Be useful. If the claim is genuinely strong, say so and set risk_level accordingly.
6. Ground every objection in the specific claim, not generic startup advice.
7. risk_level reflects how dangerous it would be to build on this node unvalidated.`

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

  const userPrompt = `Challenge this node.

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
    schema: CHALLENGE_SCHEMA,
    effort: 'medium',
    label: 'challenge-node',
  })
  if (!result.ok) return result.response
  return jsonResponse(result.data)
})
