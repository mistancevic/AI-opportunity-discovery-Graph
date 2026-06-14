// POST /functions/v1/revise-strategy
// Body: {
//   raw_idea: string,
//   strategy: { who_to_win, wedge, refuse },
//   findings: [{ component_type, title, description, evidence_status }]
// }
// Returns the Strategy revision JSON (snake_case).
//
// The bottom-up loop: given what the findings now show (the storyline's
// ingredients and their evidence status), propose how the STRATEGY itself
// should change so the bet matches reality. The user accepts or rejects.
//
// Deploy:  supabase functions deploy revise-strategy

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const REVISION_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    no_change_needed: { type: 'boolean' },
    proposed: {
      type: 'object',
      properties: {
        who_to_win: { type: 'string' },
        wedge: { type: 'string' },
        refuse: { type: 'string' },
      },
      required: ['who_to_win', 'wedge', 'refuse'],
      additionalProperties: false,
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['whoToWin', 'wedge', 'refuse'] },
          from: { type: 'string' },
          to: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['field', 'from', 'to', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'no_change_needed', 'proposed', 'changes'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are the strategy-revision engine for an opportunity discovery tool. Strategy is a bet with three parts: who_to_win (the customer we commit to), wedge (the angle incumbents won't copy), refuse (the trade-offs we won't make).

Discovery is two-directional: the idea is judged against the strategy, AND the strategy must bend to meet the reality of the findings. Your job is the second direction. Given the findings - the current storyline's ingredients and their EVIDENCE STATUS - propose how the strategy should change so the bet matches what the evidence actually shows.

Evidence status meaning: assumption (unproven), researched_signal / interview_signal / behavioral_signal (increasingly strong evidence), payment_signal / validated (proven), invalidated (disproven).

RULES:
1. Weight findings by evidence strength. A "validated" or "payment_signal" finding is hard ground the strategy can commit to; an "invalidated" finding means any strategy resting on it must change. "assumption" findings are weak - don't overhaul the strategy on unproven inputs.
2. Only propose changes the findings actually justify. If the strategy still matches reality, set no_change_needed = true, return an empty changes array, and set proposed = the current strategy unchanged.
3. "proposed" is the FULL revised strategy (all three fields), even fields you didn't change (copy them through).
4. Each entry in "changes" names one field, its from/to text, and a reason that cites the specific finding driving it.
5. Keep each field's text short and concrete - a sentence or two, written as a real founder's bet, not jargon.
6. Do not invent findings. Reason only from what you are given.`

interface WireFinding {
  component_type?: string
  title?: string
  description?: string
  evidence_status?: string
}

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { raw_idea, strategy, findings } = parsed.body as {
    raw_idea?: string
    strategy?: { who_to_win?: string; wedge?: string; refuse?: string }
    findings?: WireFinding[]
  }

  if (!Array.isArray(findings) || findings.length === 0) {
    return errorResponse(400, 'findings must be a non-empty array (pick ingredients on the canvas first)')
  }

  const findingsBlock = findings
    .filter((f) => typeof f.component_type === 'string' && typeof f.title === 'string')
    .map(
      (f) =>
        `- [${f.evidence_status ?? 'assumption'}] ${f.component_type}: ${f.title}${
          f.description ? ` — ${String(f.description).slice(0, 240)}` : ''
        }`,
    )
    .join('\n')

  const s = strategy ?? {}
  const userPrompt = `Raw idea:
${raw_idea ?? ''}

Current strategy:
- Who we want to win: ${s.who_to_win || '(blank)'}
- Our wedge: ${s.wedge || '(blank)'}
- What we refuse to do: ${s.refuse || '(blank)'}

Findings (storyline ingredients with their evidence status):
${findingsBlock}

Propose how the strategy should change to match these findings.`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: REVISION_SCHEMA,
    effort: 'medium',
    label: 'revise-strategy',
  })
  if (!result.ok) return result.response
  return jsonResponse(result.data)
})
