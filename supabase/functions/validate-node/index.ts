// POST /functions/v1/validate-node
// Body: {
//   selected_node: { node_type, title, description, evidence_status },
//   project_context: { raw_idea: string }
// }
// Returns the Validation Agent JSON (snake_case).
//
// Deploy:  supabase functions deploy validate-node

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    validation_goal: { type: 'string' },
    test_type: {
      type: 'string',
      enum: ['interview', 'landing_page', 'concierge', 'prototype', 'pricing_test'],
    },
    target_user: { type: 'string' },
    script_or_steps: { type: 'array', items: { type: 'string' } },
    pass_signal: { type: 'string' },
    fail_signal: { type: 'string' },
    timebox: { type: 'string' },
  },
  required: [
    'validation_goal',
    'test_type',
    'target_user',
    'script_or_steps',
    'pass_signal',
    'fail_signal',
    'timebox',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a validation planning agent for product discovery.
Your job is to turn a selected node (a claim) into one concrete, runnable validation test.

RULES:
1. Pick the cheapest test type that can genuinely falsify the claim: interview, landing_page, concierge, prototype, or pricing_test. Prefer interviews for problem/segment claims and behavioral tests (landing page, concierge, pricing) for demand/business-model claims.
2. target_user names exactly who to recruit and where to find them.
3. script_or_steps gives 4-7 concrete steps, including the key questions to ask or assets to build. Questions must probe past behavior ("tell me about the last time...") not hypothetical interest ("would you use...").
4. pass_signal and fail_signal must be observable and countable, not vibes.
5. timebox is realistic for a solo founder working evenings (days, not months).
6. Avoid theoretical business canvas language. Write like a practical product coach.`

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

  const userPrompt = `Create a validation test for this node.

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
    schema: VALIDATION_SCHEMA,
    effort: 'low',
    label: 'validate-node',
  })
  if (!result.ok) return result.response
  return jsonResponse(result.data)
})
