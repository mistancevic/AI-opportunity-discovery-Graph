// POST /functions/v1/score-coherence
// Body: {
//   raw_idea: string,
//   strategy: { who_to_win, wedge, refuse },
//   selection: [{ component_type, title, description }]   // one per chosen component
// }
// Returns the Coherence agent JSON (snake_case).
//
// The sense-making machine: judges ONE storyline (a chosen ingredient per
// component) for internal fit and against the stated strategy, names the
// tensions, and proposes the single highest-leverage change.
//
// Deploy:  supabase functions deploy score-coherence

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody, NODE_TYPES } from '../_shared/claude.ts'

const COHERENCE_SCHEMA = {
  type: 'object',
  properties: {
    internal_score: { type: 'number' },
    // strategy_score is meaningful only when strategy_provided is true.
    strategy_provided: { type: 'boolean' },
    strategy_score: { type: 'number' },
    verdict: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    tensions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          between: { type: 'array', items: { type: 'string', enum: [...NODE_TYPES] } },
          issue: { type: 'string' },
        },
        required: ['between', 'issue'],
        additionalProperties: false,
      },
    },
    gaps: { type: 'array', items: { type: 'string' } },
    best_next_change: {
      type: 'object',
      properties: {
        // Empty string means a strategy-level change, not a single component.
        component_type: { type: 'string', enum: [...NODE_TYPES, ''] },
        change: { type: 'string' },
        why: { type: 'string' },
      },
      required: ['component_type', 'change', 'why'],
      additionalProperties: false,
    },
  },
  required: [
    'internal_score',
    'strategy_provided',
    'strategy_score',
    'verdict',
    'strengths',
    'tensions',
    'gaps',
    'best_next_change',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are the coherence engine for an opportunity discovery tool.
A "storyline" is one chosen ingredient per component (market, customer segment, problem, current alternative, demand signal, product concept, business model, risk, validation step). Your job is to judge whether these ingredients form ONE coherent story that holds together - and whether that story serves the founder's stated strategy.

A great opportunity is an INTERSECTION: the segment, the problem, the wedge, and the business model reinforce each other. Your value is spotting where they DON'T.

RULES:
1. internal_score (0-1): how well the chosen ingredients fit each other as a single story. Penalize mismatches (e.g. a price-sensitive segment paired with a premium model; a problem that the chosen segment doesn't actually feel; a validation step that doesn't test the riskiest link).
2. If the strategy (who_to_win, wedge, refuse) is essentially empty, set strategy_provided = false and strategy_score = 0 (it will be ignored). Otherwise set strategy_provided = true and strategy_score (0-1) = how well the storyline serves that strategy.
3. verdict: 1-2 sentences naming the single biggest thing that makes or breaks this story.
4. strengths: where ingredients genuinely reinforce each other.
5. tensions: concrete contradictions between specific components. "between" lists the 2 component types in tension; "issue" explains the conflict in one sentence. Only real tensions - an empty array is correct when the story is clean.
6. gaps: components that are missing or too vague to judge.
7. best_next_change: the SINGLE highest-leverage change to improve the story - the link most likely to break the whole thing if wrong. component_type is the component to change (or null if it's a strategy-level change).
8. Be specific to the actual ingredients given. No generic startup advice.`

interface WireSelectionItem {
  component_type?: string
  title?: string
  description?: string
}

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { raw_idea, strategy, selection } = parsed.body as {
    raw_idea?: string
    strategy?: { who_to_win?: string; wedge?: string; refuse?: string }
    selection?: WireSelectionItem[]
  }

  if (!Array.isArray(selection) || selection.length === 0) {
    return errorResponse(400, 'selection must be a non-empty array of chosen components')
  }

  const selectionBlock = selection
    .filter((s) => typeof s.component_type === 'string' && typeof s.title === 'string')
    .map((s) => `- ${s.component_type}: ${s.title}${s.description ? ` — ${String(s.description).slice(0, 300)}` : ''}`)
    .join('\n')

  const strategyBlock = strategy && (strategy.who_to_win || strategy.wedge || strategy.refuse)
    ? `Strategy (the founder's bet):
- Who we want to win: ${strategy.who_to_win ?? '(blank)'}
- Our wedge: ${strategy.wedge ?? '(blank)'}
- What we refuse to do: ${strategy.refuse ?? '(blank)'}`
    : 'Strategy: (not written yet — return null for strategy_score)'

  const userPrompt = `Raw idea:
${raw_idea ?? ''}

This storyline's chosen ingredients:
${selectionBlock}

${strategyBlock}

Judge the coherence of this storyline.`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: COHERENCE_SCHEMA,
    effort: 'medium',
    label: 'score-coherence',
  })
  if (!result.ok) return result.response
  return jsonResponse(result.data)
})
