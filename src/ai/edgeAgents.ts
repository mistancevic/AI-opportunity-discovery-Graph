// AgentService implementation backed by Supabase Edge Functions.
// Wired so far: generateInitialMap (Build 2), expandNode (Build 3),
// challengeNode + validateNode (Build 4). Research, reframe, and impact
// still use the mocks until Builds 5-6.

import type { AgentService } from './agents'
import type {
  ChallengeResult,
  ExpandNodeResult,
  GenerateMapResult,
  GeneratedEdge,
  GeneratedNode,
  OppNode,
  ValidationResult,
} from '../types'
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

interface WireChallengeResult {
  challenge_summary: string
  objections: string[]
  critical_assumptions: string[]
  contradicting_signals_to_check: string[]
  risk_level: 'low' | 'medium' | 'high'
  suggested_tests: {
    test_name: string
    how_to_run: string
    pass_signal: string
    fail_signal: string
  }[]
}

interface WireValidationResult {
  validation_goal: string
  test_type: ValidationResult['testType']
  target_user: string
  script_or_steps: string[]
  pass_signal: string
  fail_signal: string
  timebox: string
}

function nodePayload(node: OppNode) {
  return {
    node_type: node.nodeType,
    title: node.title,
    description: node.description,
    evidence_status: node.evidenceStatus,
  }
}

interface WireExpandResult {
  summary: string
  // Same shape as WireNode but the expand contract carries why_it_matters
  // and no assumptions array.
  new_nodes: (Omit<WireNode, 'assumptions'> & { assumptions?: string[]; why_it_matters: string })[]
  new_edges: WireEdge[]
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

  async challengeNode(node, projectContext): Promise<ChallengeResult> {
    const wire = await callEdgeFunction<WireChallengeResult>('challenge-node', {
      selected_node: nodePayload(node),
      project_context: { raw_idea: projectContext.rawIdea },
    })
    return {
      challengeSummary: wire.challenge_summary,
      objections: wire.objections,
      criticalAssumptions: wire.critical_assumptions,
      contradictingSignalsToCheck: wire.contradicting_signals_to_check,
      riskLevel: wire.risk_level,
      suggestedTests: wire.suggested_tests.map((t) => ({
        testName: t.test_name,
        howToRun: t.how_to_run,
        passSignal: t.pass_signal,
        failSignal: t.fail_signal,
      })),
    }
  },

  async validateNode(node, projectContext): Promise<ValidationResult> {
    const wire = await callEdgeFunction<WireValidationResult>('validate-node', {
      selected_node: nodePayload(node),
      project_context: { raw_idea: projectContext.rawIdea },
    })
    return {
      validationGoal: wire.validation_goal,
      testType: wire.test_type,
      targetUser: wire.target_user,
      scriptOrSteps: wire.script_or_steps,
      passSignal: wire.pass_signal,
      failSignal: wire.fail_signal,
      timebox: wire.timebox,
    }
  },

  async expandNode(node, direction, projectContext): Promise<ExpandNodeResult> {
    const wire = await callEdgeFunction<WireExpandResult>('expand-node', {
      selected_node: nodePayload(node),
      direction,
      project_context: {
        raw_idea: projectContext.rawIdea,
        existing_titles: projectContext.existingTitles,
      },
    })

    // Belt-and-suspenders dedupe: the prompt forbids duplicates, but a
    // duplicated title would silently confuse the map if it slipped through.
    const existing = new Set(projectContext.existingTitles.map((t) => t.toLowerCase()))
    const newNodes = wire.new_nodes
      .filter((n) => !existing.has(n.title.toLowerCase()))
      .map((n) => ({
        tempId: n.temp_id,
        nodeType: n.node_type,
        title: n.title,
        description: n.why_it_matters ? `${n.description}\n\nWhy it matters: ${n.why_it_matters}` : n.description,
        evidenceStatus: n.evidence_status,
        confidenceScore: n.confidence_score,
        assumptions: n.assumptions ?? [],
        suggestedNextAction: n.suggested_next_action ?? '',
      }))
    const kept = new Set(newNodes.map((n) => n.tempId))

    return {
      summary: wire.summary,
      newNodes,
      // The function uses the literal temp id "selected" for the selected
      // node; the store expects the placeholder "__selected__".
      newEdges: wire.new_edges
        .filter((e) => kept.has(e.target_temp_id))
        .map((e) => ({
          sourceTempId: e.source_temp_id === 'selected' ? '__selected__' : e.source_temp_id,
          targetTempId: e.target_temp_id,
          relationshipType: e.relationship_type,
          explanation: e.explanation,
        })),
    }
  },
}
