// POST /functions/v1/research-node
// Body: {
//   selected_node: { node_type, title, description, evidence_status },
//   project_context: { raw_idea: string }
// }
// Returns the Research Agent JSON (snake_case).
//
// MVP behavior per spec: AI-generated research angles that tell the user
// exactly what to look for and how to distinguish weak signals from strong
// validation evidence. Live web search is a deliberate later enhancement so
// the product stays a discovery system, not a search tool.
//
// Deploy:  supabase functions deploy research-node

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    research_summary: { type: 'string' },
    possible_signals: { type: 'array', items: { type: 'string' } },
    current_alternatives: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
    weak_signals: { type: 'array', items: { type: 'string' } },
    strong_signals_to_validate: { type: 'array', items: { type: 'string' } },
    next_action: { type: 'string' },
  },
  required: [
    'research_summary',
    'possible_signals',
    'current_alternatives',
    'open_questions',
    'weak_signals',
    'strong_signals_to_validate',
    'next_action',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a research agent for product opportunity discovery.
Your job is to give the user a focused research plan around one node (a claim),
so 30 minutes of their own searching produces evidence instead of noise.

RULES:
1. possible_signals: concrete, checkable demand signals - name the specific places to look (communities, search queries, marketplaces, competitor pricing pages), not categories.
2. current_alternatives: what the target users actually use today for this job, including non-obvious ones (spreadsheets, manual workarounds, doing nothing).
3. open_questions: the questions research must answer before this node can be trusted.
4. weak_signals: things that look like validation but are not (upvotes, "sounds cool" comments, generic interest).
5. strong_signals_to_validate: evidence that would genuinely move this node beyond assumption (recent specific pain stories, paid workarounds, time or money already spent).
6. next_action: one 30-minute research task the user can do today, ending with attaching the result as evidence on this node.
7. Ground everything in the specific claim and project; no generic startup advice.`

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

  const userPrompt = `Create a research plan for this node.

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
    schema: RESEARCH_SCHEMA,
    effort: 'low',
    label: 'research-node',
  })
  if (!result.ok) return result.response
  return jsonResponse(result.data)
})
