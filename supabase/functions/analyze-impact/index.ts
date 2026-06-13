// POST /functions/v1/analyze-impact
// Body: {
//   changed_node_before: { node_type, title, description },
//   changed_node_after: { node_type, title, description },
//   related_nodes: [{ node_id, node_type, title, description, evidence_status }]
// }
// Returns the Contract 4 "Cross-reference impact" JSON (snake_case).
//
// Deploy:  supabase functions deploy analyze-impact

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const IMPACT_SCHEMA = {
  type: 'object',
  properties: {
    impact_summary: { type: 'string' },
    affected_nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          node_id: { type: 'string' },
          impact_type: { type: 'string', enum: ['update', 'warning', 'contradiction', 'opportunity'] },
          suggested_change: { type: 'string' },
          reason: { type: 'string' },
          confidence_score: { type: 'number' },
        },
        required: ['node_id', 'impact_type', 'suggested_change', 'reason', 'confidence_score'],
        additionalProperties: false,
      },
    },
  },
  required: ['impact_summary', 'affected_nodes'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are an impact analysis agent for a product opportunity graph.
When one node changes, you identify which related nodes may need updates.

RULES:
1. Only include nodes whose meaning is genuinely affected by the change. It is correct to return an empty affected_nodes array when the change is cosmetic or local.
2. Never suggest changes that merely restate the changed node; the suggested_change must say concretely how the affected node should be rewritten or re-examined.
3. Mark each impact:
   - "update" = the node should be rewritten to stay consistent
   - "warning" = the node may be weakened; the user should re-check it
   - "contradiction" = the node now conflicts with the changed node
   - "opportunity" = the change opens a new angle worth adding
4. Use each node's node_id exactly as given.
5. confidence_score (0-1) reflects how certain you are the node is affected.
6. Do not overwrite user work; you are producing suggestions a human will accept or reject.
7. Be selective: 2-5 genuinely affected nodes beat a blanket list.`

interface WireNodeRef {
  node_id?: string
  node_type?: string
  title?: string
  description?: string
  evidence_status?: string
}

function nodeBlock(label: string, n: { node_type?: string; title?: string; description?: string }): string {
  return `${label}:
- Type: ${n.node_type ?? 'unknown'}
- Title: ${n.title ?? ''}
- Description: ${(n.description ?? '').slice(0, 600)}`
}

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { changed_node_before, changed_node_after, related_nodes } = parsed.body as {
    changed_node_before?: WireNodeRef
    changed_node_after?: WireNodeRef
    related_nodes?: WireNodeRef[]
  }

  if (!changed_node_before?.title || !changed_node_after?.title) {
    return errorResponse(400, 'changed_node_before and changed_node_after with titles are required')
  }
  if (!Array.isArray(related_nodes) || related_nodes.length === 0) {
    // Nothing to analyze - valid request, empty result.
    return jsonResponse({ impact_summary: 'No related nodes to analyze.', affected_nodes: [] })
  }

  const relatedList = related_nodes
    .filter((n) => typeof n.node_id === 'string' && typeof n.title === 'string')
    .slice(0, 30)
    .map(
      (n) =>
        `- node_id: ${n.node_id}
  type: ${n.node_type ?? 'unknown'}
  title: ${n.title}
  evidence: ${n.evidence_status ?? 'assumption'}
  description: ${(n.description ?? '').slice(0, 300)}`,
    )
    .join('\n')

  const userPrompt = `A node in the opportunity graph was changed. Find the cross-reference impact.

${nodeBlock('Changed node BEFORE', changed_node_before)}

${nodeBlock('Changed node AFTER', changed_node_after)}

Related nodes:
${relatedList}`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: IMPACT_SCHEMA,
    effort: 'low',
    label: 'analyze-impact',
  })
  if (!result.ok) return result.response

  // Drop any hallucinated node ids so the client never gets a dangling reference.
  const validIds = new Set(related_nodes.map((n) => n.node_id))
  const data = result.data as { impact_summary: string; affected_nodes: { node_id: string }[] }
  data.affected_nodes = data.affected_nodes.filter((a) => validIds.has(a.node_id))
  return jsonResponse(data)
})
