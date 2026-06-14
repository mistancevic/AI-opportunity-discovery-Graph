// Agent service interface. The app only talks to this interface, so the mock
// implementation can be replaced by Supabase Edge Function calls without
// touching any UI code. Each method mirrors one prompt contract / endpoint:
//   generateInitialMap -> POST /generate-map
//   expandNode         -> POST /expand-node
//   researchNode       -> POST /research-node
//   challengeNode      -> POST /challenge-node
//   validateNode       -> POST /validate-node
//   reframeNode        -> POST /reframe-node
//   analyzeImpact      -> POST /analyze-impact

import type {
  ChallengeResult,
  CoherenceResult,
  DiscussResult,
  EvidenceStatus,
  ExpandDirection,
  ExpandNodeResult,
  GenerateMapResult,
  ImpactResult,
  NodeType,
  OppNode,
  PanelAgent,
  PanelMessage,
  ReframeResult,
  ResearchResult,
  Strategy,
  StrategyRevision,
  ValidationResult,
} from '../types'

export interface AgentService {
  generateInitialMap(rawIdea: string, focusBrief?: string): Promise<GenerateMapResult>
  // Conversational narrowing: a facilitated panel (lead, critic, 10x,
  // wildcard, plus cast domain specialists) that converges on a focus
  // brief before the map is generated. history includes user turns.
  discussIdea(
    rawIdea: string,
    history: PanelMessage[],
    roster: PanelAgent[] | null,
  ): Promise<DiscussResult>
  expandNode(
    node: OppNode,
    direction: ExpandDirection,
    projectContext: { rawIdea: string; existingTitles: string[] },
  ): Promise<ExpandNodeResult>
  researchNode(node: OppNode, projectContext: { rawIdea: string }): Promise<ResearchResult>
  challengeNode(node: OppNode, projectContext: { rawIdea: string }): Promise<ChallengeResult>
  validateNode(node: OppNode, projectContext: { rawIdea: string }): Promise<ValidationResult>
  reframeNode(node: OppNode, projectContext: { rawIdea: string }): Promise<ReframeResult>
  analyzeImpact(
    changedNodeBefore: OppNode,
    changedNodeAfter: OppNode,
    relatedNodes: OppNode[],
  ): Promise<ImpactResult>
  // Sense-making: judge one storyline (selected ingredient per component) for
  // internal fit and against the stated strategy.
  scoreCoherence(
    selection: { componentType: NodeType; title: string; description: string }[],
    strategy: Strategy,
    rawIdea: string,
  ): Promise<CoherenceResult>
  // Bottom-up loop: given the findings (the storyline's ingredients and their
  // evidence status), propose how the strategy itself should change.
  reviseStrategy(
    findings: { componentType: NodeType; title: string; description: string; evidenceStatus: EvidenceStatus }[],
    strategy: Strategy,
    rawIdea: string,
  ): Promise<StrategyRevision>
}
