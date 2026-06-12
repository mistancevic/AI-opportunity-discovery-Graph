// AgentService implementation backed by Supabase Edge Functions.
// Build 2 wires up generateInitialMap; the remaining agents still use the
// mocks and will be replaced one by one in Builds 3-6.

import type { AgentService } from './agents'
import type { GenerateMapResult, GeneratedEdge, GeneratedNode } from '../types'
import { mockAgents } from './mockAgents'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const edgeConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `AI request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.error === 'string') message = data.error
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

// Wire shape of the Contract 1 response (snake_case, as the prompt contract defines).
interface WireNode {
  temp_id: string
  node_type: GeneratedNode['nodeType']
  title: string
  description: string
  evidence_status: GeneratedNode['evidenceStatus']
  confidence_score: number
  assumptions: string[]
  suggested_next_action: string
}

interface WireEdge {
  source_temp_id: string
  target_temp_id: string
  relationship_type: GeneratedEdge['relationshipType']
  explanation: string
}

interface WireMapResult {
  project_title: string
  summary: string
  nodes: WireNode[]
  edges: WireEdge[]
  today_next_step: {
    biggest_unknown: string
    suggested_action: string
    why_it_matters: string
  }
}

export const edgeAgents: AgentService = {
  ...mockAgents,

  async generateInitialMap(rawIdea: string): Promise<GenerateMapResult> {
    const wire = await callEdgeFunction<WireMapResult>('generate-map', { raw_idea: rawIdea })
    return {
      projectTitle: wire.project_title,
      summary: wire.summary,
      nodes: wire.nodes.map((n) => ({
        tempId: n.temp_id,
        nodeType: n.node_type,
        title: n.title,
        description: n.description,
        evidenceStatus: n.evidence_status,
        confidenceScore: n.confidence_score,
        assumptions: n.assumptions ?? [],
        suggestedNextAction: n.suggested_next_action ?? '',
      })),
      edges: wire.edges.map((e) => ({
        sourceTempId: e.source_temp_id,
        targetTempId: e.target_temp_id,
        relationshipType: e.relationship_type,
        explanation: e.explanation,
      })),
      todayNextStep: {
        biggestUnknown: wire.today_next_step.biggest_unknown,
        suggestedAction: wire.today_next_step.suggested_action,
        whyItMatters: wire.today_next_step.why_it_matters,
      },
    }
  },
}
