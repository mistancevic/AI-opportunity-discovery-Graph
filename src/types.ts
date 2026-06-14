// Domain model for the Opportunity Graph.
// Mirrors the Supabase tables in supabase/migrations so the local store
// can later be swapped for a Supabase-backed persistence layer.

export type NodeType =
  | 'raw_idea'
  | 'market'
  | 'customer_segment'
  | 'problem'
  | 'current_alternative'
  | 'demand_signal'
  | 'product_concept'
  | 'business_model'
  | 'risk'
  | 'validation_step'
  | 'experiment'
  | 'evidence'
  | 'decision'

export type EvidenceStatus =
  | 'assumption'
  | 'researched_signal'
  | 'interview_signal'
  | 'behavioral_signal'
  | 'payment_signal'
  | 'validated'
  | 'invalidated'

export type RelationshipType =
  | 'contains'
  | 'causes'
  | 'depends_on'
  | 'supports'
  | 'contradicts'
  | 'reframes'
  | 'validates'
  | 'invalidates'
  | 'alternative_to'
  | 'risk_for'
  | 'requires_test'

export type ExpandDirection = 'upstream' | 'downstream' | 'lateral'

export type AgentType =
  | 'map_generator'
  | 'node_expander'
  | 'research_agent'
  | 'challenge_agent'
  | 'validation_agent'
  | 'reframe_agent'
  | 'impact_agent'
  | 'synthesis_agent'

export interface Project {
  id: string
  title: string
  rawIdea: string
  todayNextStep: TodayNextStep | null
  createdAt: string
  updatedAt: string
}

export interface OppNode {
  id: string
  projectId: string
  parentNodeId: string | null
  nodeType: NodeType
  title: string
  description: string
  evidenceStatus: EvidenceStatus
  confidenceScore: number // 0..1
  assumptions: string[]
  reasoning: string
  suggestedNextAction: string
  positionX: number
  positionY: number
  createdBy: 'user' | 'ai'
  createdAt: string
  updatedAt: string
}

export interface OppEdge {
  id: string
  projectId: string
  sourceNodeId: string
  targetNodeId: string
  relationshipType: RelationshipType
  strength: number
  explanation: string
  createdBy: 'user' | 'ai'
  createdAt: string
}

export interface NodeVersion {
  id: string
  nodeId: string
  versionNumber: number
  title: string
  description: string
  evidenceStatus: EvidenceStatus
  confidenceScore: number
  changeReason: string
  createdAt: string
}

export interface AgentRun {
  id: string
  projectId: string
  nodeId: string | null
  agentType: AgentType
  input: unknown
  output: unknown
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export type ImpactType = 'update' | 'warning' | 'contradiction' | 'opportunity'

export interface ImpactSuggestion {
  id: string
  projectId: string
  changedNodeId: string
  affectedNodeId: string
  impactType: ImpactType
  suggestedTitle: string | null
  suggestedDescription: string | null
  reason: string
  status: 'pending' | 'accepted' | 'rejected' | 'edited'
  createdAt: string
}

export interface TodayNextStep {
  biggestUnknown: string
  suggestedAction: string
  whyItMatters: string
}

// ---- Agent contracts (mirror the prompt contracts; the mock agents and the
// future Edge Functions both return these shapes) ----

export interface GeneratedNode {
  tempId: string
  nodeType: NodeType
  title: string
  description: string
  evidenceStatus: EvidenceStatus
  confidenceScore: number
  assumptions: string[]
  suggestedNextAction: string
}

export interface GeneratedEdge {
  sourceTempId: string
  targetTempId: string
  relationshipType: RelationshipType
  explanation: string
}

export interface GenerateMapResult {
  projectTitle: string
  summary: string
  nodes: GeneratedNode[]
  edges: GeneratedEdge[]
  todayNextStep: TodayNextStep
}

export interface ExpandNodeResult {
  newNodes: GeneratedNode[]
  newEdges: GeneratedEdge[]
  summary: string
}

export interface ResearchResult {
  researchSummary: string
  possibleSignals: string[]
  currentAlternatives: string[]
  openQuestions: string[]
  weakSignals: string[]
  strongSignalsToValidate: string[]
  nextAction: string
}

export interface SuggestedTest {
  testName: string
  howToRun: string
  passSignal: string
  failSignal: string
}

export interface ChallengeResult {
  challengeSummary: string
  objections: string[]
  criticalAssumptions: string[]
  contradictingSignalsToCheck: string[]
  riskLevel: 'low' | 'medium' | 'high'
  suggestedTests: SuggestedTest[]
}

export interface ValidationResult {
  validationGoal: string
  testType: 'interview' | 'landing_page' | 'concierge' | 'prototype' | 'pricing_test'
  targetUser: string
  scriptOrSteps: string[]
  passSignal: string
  failSignal: string
  timebox: string
}

export interface Reframe {
  title: string
  whyItMatters: string
}

export interface ReframeResult {
  reframes: Reframe[]
}

export interface ImpactResult {
  impactSummary: string
  affectedNodes: {
    nodeId: string
    impactType: ImpactType
    suggestedTitle: string | null
    suggestedDescription: string | null
    reason: string
    confidenceScore: number
  }[]
}

export type AgentActionResult =
  | { kind: 'research'; data: ResearchResult }
  | { kind: 'challenge'; data: ChallengeResult }
  | { kind: 'validate'; data: ValidationResult }
  | { kind: 'reframe'; data: ReframeResult }

// ---- Discovery panel (conversational narrowing before map generation) ----

export type PanelAgentKind = 'lead' | 'critic' | 'tenx' | 'wildcard' | 'specialist' | 'customer'

export interface PanelAgent {
  agentId: string
  name: string
  role: string
  perspective: string
  kind: PanelAgentKind
}

export interface PanelMessage {
  // 'user' for the human; otherwise a roster agentId.
  agentId: string
  agentName: string
  text: string
}

export interface DiscussResult {
  // Populated on the first turn (when the casting step runs); empty after.
  roster: PanelAgent[]
  messages: PanelMessage[]
  readyToMap: boolean
  // Running synthesis of the agreed focus: segment, problem, angle.
  focusBrief: string
}
