// POST /functions/v1/expand-node
// Body: {
//   selected_node: { node_type, title, description, evidence_status },
//   direction: "upstream" | "downstream" | "lateral",
//   project_context: { raw_idea: string, existing_titles: string[] }
// }
// Returns the Contract 2 "Expand selected node" JSON (snake_case).
// In edges, the literal temp id "selected" refers to the selected node.
//
// Deploy:  supabase functions deploy expand-node

import {
  callClaudeJSON,
  errorResponse,
  jsonResponse,
  readJSONBody,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
} from '../_shared/claude.ts'

const EXPAND_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    new_nodes: {
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
          why_it_matters: { type: 'string' },
          suggested_next_action: { type: 'string' },
        },
        required: [
          'temp_id',
          'node_type',
          'title',
          'description',
          'evidence_status',
          'confidence_score',
          'why_it_matters',
          'suggested_next_action',
        ],
        additionalProperties: false,
      },
    },
    new_edges: {
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
  },
  required: ['summary', 'new_nodes', 'new_edges'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a node expansion agent for an opportunity discovery graph.
You expand one selected node in exactly one direction:
- upstream = causes, context, root assumptions, market forces behind the node
- downstream = specifics, subsegments, concrete examples, testable experiments
- lateral = adjacent options, alternatives, neighboring opportunities

RULES:
1. Generate 3-7 new nodes.
2. Each new node must be a concrete claim, not a vague topic.
3. Do not duplicate any of the existing node titles you are given.
4. Each new node has evidence_status = "assumption" and a confidence_score between 0 and 1.
5. why_it_matters explains why this node deserves a place on the map; suggested_next_action is a concrete step the user could take this week.
6. Add one edge from the selected node to each new node. Use the literal temp id "selected" for the selected node. Typical relationship types: upstream -> "causes", downstream -> "contains" or "requires_test", lateral -> "alternative_to". Pick what fits best.
7. Do not restructure the rest of the map; only add.
8. Avoid theoretical business canvas language. Write like a practical product coach.`

const DIRECTIONS = ['upstream', 'downstream', 'lateral']

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { selected_node, direction, project_context } = parsed.body as {
    selected_node?: { node_type?: string; title?: string; description?: string; evidence_status?: string }
    direction?: string
    project_context?: { raw_idea?: string; existing_titles?: string[] }
  }

  if (!selected_node || typeof selected_node.title !== 'string' || !selected_node.title.trim()) {
    return errorResponse(400, 'selected_node with a title is required')
  }
  if (typeof direction !== 'string' || !DIRECTIONS.includes(direction)) {
    return errorResponse(400, `direction must be one of: ${DIRECTIONS.join(', ')}`)
  }
  const rawIdea = project_context?.raw_idea ?? ''
  const existingTitles = (project_context?.existing_titles ?? []).filter((t) => typeof t === 'string').slice(0, 200)

  const userPrompt = `Expand the selected node in the "${direction}" direction.

Selected node:
- Type: ${selected_node.node_type ?? 'unknown'}
- Title: ${selected_node.title}
- Description: ${selected_node.description ?? ''}
- Evidence status: ${selected_node.evidence_status ?? 'assumption'}

Project raw idea:
${rawIdea}

Existing node titles (do not duplicate):
${existingTitles.map((t) => `- ${t}`).join('\n')}`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: EXPAND_SCHEMA,
  })
  if (!result.ok) return result.response

  const data = result.data as { new_nodes?: unknown[] }
  if (!Array.isArray(data.new_nodes) || data.new_nodes.length === 0) {
    return errorResponse(502, 'The model returned no expansion nodes. Please try again.')
  }
  return jsonResponse(result.data)
})
