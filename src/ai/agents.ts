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
  ExpandDirection,
  ExpandNodeResult,
  GenerateMapResult,
  ImpactResult,
  OppNode,
  ReframeResult,
  ResearchResult,
  ValidationResult,
} from '../types'

export interface AgentService {
  generateInitialMap(rawIdea: string): Promise<GenerateMapResult>
  expandNode(
    node: OppNode,
    direction: ExpandDirection,
    projectContext: { rawIdea: string; existingTitles: string[] },
  ): Promise<ExpandNodeResult>
  researchNode(node: OppNode): Promise<ResearchResult>
  challengeNode(node: OppNode): Promise<ChallengeResult>
  validateNode(node: OppNode): Promise<ValidationResult>
  reframeNode(node: OppNode): Promise<ReframeResult>
  analyzeImpact(
    changedNodeBefore: OppNode,
    changedNodeAfter: OppNode,
    relatedNodes: OppNode[],
  ): Promise<ImpactResult>
}
