// AgentService implementation backed by Supabase Edge Functions.
// All seven agents are wired: generateInitialMap (Build 2), expandNode
// (Build 3), challengeNode + validateNode (Build 4), analyzeImpact
// (Build 5), researchNode + reframeNode (Build 6). The mocks remain only
// as the zero-config fallback when Supabase env vars are absent.

import type { AgentService } from './agents'
import type {
  ChallengeResult,
  DiscussResult,
  ExpandNodeResult,
  GenerateMapResult,
  GeneratedEdge,
  GeneratedNode,
  ImpactResult,
  OppNode,
  PanelAgentKind,
  ReframeResult,
  ResearchResult,
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

interface WireImpactResult {
  impact_summary: string
  affected_nodes: {
    node_id: string
    impact_type: 'update' | 'warning' | 'contradiction' | 'opportunity'
    suggested_change: string
    reason: string
    confidence_score: number
  }[]
}

interface WireResearchResult {
  research_summary: string
  possible_signals: string[]
  current_alternatives: string[]
  open_questions: string[]
  weak_signals: string[]
  strong_signals_to_validate: string[]
  next_action: string
}

interface WireReframeResult {
  reframes: { title: string; why_it_matters: string }[]
}

interface WireDiscussResult {
  roster: {
    agent_id: string
    name: string
    role: string
    perspective: string
    kind: PanelAgentKind
  }[]
  messages: { agent_id: string; text: string }[]
  ready_to_map: boolean
  focus_brief: string
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

  async discussIdea(rawIdea, history, roster): Promise<DiscussResult> {
    const wire = await callEdgeFunction<WireDiscussResult>('discuss-idea', {
      raw_idea: rawIdea,
      roster:
        roster?.map((a) => ({
          agent_id: a.agentId,
          name: a.name,
          role: a.role,
          perspective: a.perspective,
          kind: a.kind,
        })) ?? null,
      history: history.map((m) => ({
        speaker: m.agentId === 'user' ? 'user' : m.agentName,
        text: m.text,
      })),
    })
    const newRoster = wire.roster.map((a) => ({
      agentId: a.agent_id,
      name: a.name,
      role: a.role,
      perspective: a.perspective,
      kind: a.kind,
    }))
    const allAgents = new Map((roster ?? newRoster).concat(newRoster).map((a) => [a.agentId, a]))
    return {
      roster: newRoster,
      messages: wire.messages.map((m) => ({
        agentId: m.agent_id,
        agentName: allAgents.get(m.agent_id)?.name ?? m.agent_id,
        text: m.text,
      })),
      readyToMap: wire.ready_to_map,
      focusBrief: wire.focus_brief,
    }
  },

  async generateInitialMap(rawIdea: string, focusBrief?: string): Promise<GenerateMapResult> {
    const wire = await callEdgeFunction<WireMapResult>('generate-map', {
      raw_idea: rawIdea,
      focus_brief: focusBrief ?? null,
    })
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

  async researchNode(node, projectContext): Promise<ResearchResult> {
    const wire = await callEdgeFunction<WireResearchResult>('research-node', {
      selected_node: nodePayload(node),
      project_context: { raw_idea: projectContext.rawIdea },
    })
    return {
      researchSummary: wire.research_summary,
      possibleSignals: wire.possible_signals,
      currentAlternatives: wire.current_alternatives,
      openQuestions: wire.open_questions,
      weakSignals: wire.weak_signals,
      strongSignalsToValidate: wire.strong_signals_to_validate,
      nextAction: wire.next_action,
    }
  },

  async reframeNode(node, projectContext): Promise<ReframeResult> {
    const wire = await callEdgeFunction<WireReframeResult>('reframe-node', {
      selected_node: nodePayload(node),
      project_context: { raw_idea: projectContext.rawIdea },
    })
    return {
      reframes: wire.reframes.map((r) => ({ title: r.title, whyItMatters: r.why_it_matters })),
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

  async analyzeImpact(before, after, relatedNodes): Promise<ImpactResult> {
    const wire = await callEdgeFunction<WireImpactResult>('analyze-impact', {
      changed_node_before: nodePayload(before),
      changed_node_after: nodePayload(after),
      related_nodes: relatedNodes.map((n) => ({
        node_id: n.id,
        node_type: n.nodeType,
        title: n.title,
        description: n.description,
        evidence_status: n.evidenceStatus,
      })),
    })
    return {
      impactSummary: wire.impact_summary,
      affectedNodes: wire.affected_nodes.map((a) => ({
        nodeId: a.node_id,
        impactType: a.impact_type,
        suggestedTitle: null,
        suggestedDescription: a.suggested_change,
        reason: a.reason,
        confidenceScore: a.confidence_score,
      })),
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
