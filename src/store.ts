import { create } from 'zustand'
import { agents } from './ai'
import type {
  AgentActionResult,
  EvidenceStatus,
  ExpandDirection,
  GeneratedNode,
  GeneratedEdge,
  ImpactSuggestion,
  NodeType,
  NodeVersion,
  OppEdge,
  OppNode,
  Project,
  RelationshipType,
} from './types'

const STORAGE_KEY = 'opportunity-graph-ai/v1'
const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

interface PersistedState {
  project: Project | null
  nodes: OppNode[]
  edges: OppEdge[]
  versions: NodeVersion[]
  suggestions: ImpactSuggestion[]
}

interface AppState extends PersistedState {
  selectedNodeId: string | null
  generating: boolean
  generateError: string | null
  agentBusy: ExpandDirection | 'research' | 'challenge' | 'validate' | 'reframe' | null
  agentResult: AgentActionResult | null
  agentError: string | null
  impactModalOpen: boolean
  filterNodeTypes: Set<NodeType>
  filterEvidenceStatuses: Set<EvidenceStatus>
  view: 'start' | 'graph' | 'validation_plan'

  generateMap(rawIdea: string): Promise<void>
  resetProject(): void
  selectNode(id: string | null): void
  setView(view: AppState['view']): void
  updateNode(id: string, patch: Partial<OppNode>, changeReason: string): Promise<void>
  setNodePosition(id: string, x: number, y: number, save?: boolean): void
  addManualNode(nodeType: NodeType, title: string): void
  deleteNode(id: string): void
  connectNodes(sourceId: string, targetId: string, rel: RelationshipType): void
  expandNode(id: string, direction: ExpandDirection): Promise<void>
  runAgentAction(id: string, action: 'research' | 'challenge' | 'validate' | 'reframe'): Promise<void>
  clearAgentResult(): void
  createValidationStepFromResult(nodeId: string): void
  resolveSuggestion(id: string, decision: 'accepted' | 'rejected', editedDescription?: string): void
  openImpactModal(open: boolean): void
  toggleFilterNodeType(t: NodeType): void
  toggleFilterEvidenceStatus(s: EvidenceStatus): void
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted state — start fresh
  }
  return { project: null, nodes: [], edges: [], versions: [], suggestions: [] }
}

function persist(s: PersistedState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      project: s.project,
      nodes: s.nodes,
      edges: s.edges,
      versions: s.versions,
      suggestions: s.suggestions,
    }),
  )
}

// Radial layout: raw_idea in the center, first ring around it.
function layoutPositions(count: number): { x: number; y: number }[] {
  const cx = 500
  const cy = 350
  const r = 330
  const positions = [{ x: cx, y: cy }]
  for (let i = 1; i < count; i++) {
    const angle = ((i - 1) / (count - 1)) * 2 * Math.PI - Math.PI / 2
    positions.push({ x: cx + r * Math.cos(angle) * 1.5, y: cy + r * Math.sin(angle) })
  }
  return positions
}

function materializeNodes(
  generated: GeneratedNode[],
  projectId: string,
  positions: { x: number; y: number }[],
  createdBy: 'user' | 'ai',
): { nodes: OppNode[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  const nodes = generated.map((g, i) => {
    const id = uid()
    idMap.set(g.tempId, id)
    return {
      id,
      projectId,
      parentNodeId: null,
      nodeType: g.nodeType,
      title: g.title,
      description: g.description,
      evidenceStatus: g.evidenceStatus,
      confidenceScore: g.confidenceScore,
      assumptions: g.assumptions ?? [],
      reasoning: '',
      suggestedNextAction: g.suggestedNextAction ?? '',
      positionX: positions[i]?.x ?? 100 + i * 60,
      positionY: positions[i]?.y ?? 100 + i * 60,
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    } satisfies OppNode
  })
  return { nodes, idMap }
}

function materializeEdges(
  generated: GeneratedEdge[],
  projectId: string,
  idMap: Map<string, string>,
  selectedNodeId?: string,
): OppEdge[] {
  return generated.flatMap((e) => {
    const source = e.sourceTempId === '__selected__' ? selectedNodeId : idMap.get(e.sourceTempId)
    const target = idMap.get(e.targetTempId)
    if (!source || !target) return []
    return [
      {
        id: uid(),
        projectId,
        sourceNodeId: source,
        targetNodeId: target,
        relationshipType: e.relationshipType,
        strength: 0.5,
        explanation: e.explanation,
        createdBy: 'ai' as const,
        createdAt: now(),
      },
    ]
  })
}

const initial = load()

export const useStore = create<AppState>((set, get) => ({
  ...initial,
  selectedNodeId: null,
  generating: false,
  generateError: null,
  agentBusy: null,
  agentResult: null,
  agentError: null,
  impactModalOpen: false,
  filterNodeTypes: new Set<NodeType>(),
  filterEvidenceStatuses: new Set<EvidenceStatus>(),
  view: initial.project ? 'graph' : 'start',

  async generateMap(rawIdea) {
    set({ generating: true, generateError: null })
    try {
      const result = await agents.generateInitialMap(rawIdea)
      const projectId = uid()
      const positions = layoutPositions(result.nodes.length)
      const { nodes, idMap } = materializeNodes(result.nodes, projectId, positions, 'ai')
      const edges = materializeEdges(result.edges, projectId, idMap)
      const project: Project = {
        id: projectId,
        title: result.projectTitle,
        rawIdea,
        todayNextStep: result.todayNextStep,
        createdAt: now(),
        updatedAt: now(),
      }
      const next = { project, nodes, edges, versions: [], suggestions: [] }
      persist(next)
      set({ ...next, view: 'graph', selectedNodeId: null, agentResult: null })
    } catch (err) {
      set({ generateError: err instanceof Error ? err.message : 'Map generation failed. Please try again.' })
    } finally {
      set({ generating: false })
    }
  },

  resetProject() {
    const next: PersistedState = { project: null, nodes: [], edges: [], versions: [], suggestions: [] }
    persist(next)
    set({ ...next, view: 'start', selectedNodeId: null, agentResult: null })
  },

  selectNode(id) {
    set({ selectedNodeId: id, agentResult: null, agentError: null })
  },

  setView(view) {
    set({ view })
  },

  async updateNode(id, patch, changeReason) {
    const s = get()
    const before = s.nodes.find((n) => n.id === id)
    if (!before) return
    const after: OppNode = { ...before, ...patch, updatedAt: now() }
    const version: NodeVersion = {
      id: uid(),
      nodeId: id,
      versionNumber: s.versions.filter((v) => v.nodeId === id).length + 1,
      title: before.title,
      description: before.description,
      evidenceStatus: before.evidenceStatus,
      confidenceScore: before.confidenceScore,
      changeReason,
      createdAt: now(),
    }
    const nodes = s.nodes.map((n) => (n.id === id ? after : n))
    const versions = [...s.versions, version]
    persist({ ...s, nodes, versions })
    set({ nodes, versions })

    // Cross-reference check: only when the meaning changed, not on drag/status tweaks.
    const meaningChanged = patch.title !== undefined || patch.description !== undefined
    if (!meaningChanged) return

    const related = nodes.filter((n) =>
      s.edges.some(
        (e) =>
          (e.sourceNodeId === id && e.targetNodeId === n.id) ||
          (e.targetNodeId === id && e.sourceNodeId === n.id),
      ),
    )
    // Include same-project dependent nodes even without a direct edge.
    const candidates = related.length ? related : nodes.filter((n) => n.id !== id)
    const impact = await agents.analyzeImpact(before, after, candidates)
    if (!impact.affectedNodes.length) return
    const suggestions: ImpactSuggestion[] = impact.affectedNodes.map((a) => ({
      id: uid(),
      projectId: before.projectId,
      changedNodeId: id,
      affectedNodeId: a.nodeId,
      impactType: a.impactType,
      suggestedTitle: a.suggestedTitle,
      suggestedDescription: a.suggestedDescription,
      reason: a.reason,
      status: 'pending',
      createdAt: now(),
    }))
    const s2 = get()
    const allSuggestions = [...s2.suggestions.filter((x) => x.status !== 'pending'), ...suggestions]
    persist({ ...s2, suggestions: allSuggestions })
    set({ suggestions: allSuggestions, impactModalOpen: true })
  },

  setNodePosition(id, x, y, save = true) {
    const s = get()
    const nodes = s.nodes.map((n) => (n.id === id ? { ...n, positionX: x, positionY: y } : n))
    if (save) persist({ ...s, nodes })
    set({ nodes })
  },

  addManualNode(nodeType, title) {
    const s = get()
    if (!s.project) return
    const node: OppNode = {
      id: uid(),
      projectId: s.project.id,
      parentNodeId: null,
      nodeType,
      title,
      description: '',
      evidenceStatus: 'assumption',
      confidenceScore: 0.3,
      assumptions: [],
      reasoning: '',
      suggestedNextAction: '',
      positionX: 200 + Math.random() * 400,
      positionY: 150 + Math.random() * 300,
      createdBy: 'user',
      createdAt: now(),
      updatedAt: now(),
    }
    const nodes = [...s.nodes, node]
    persist({ ...s, nodes })
    set({ nodes, selectedNodeId: node.id })
  },

  deleteNode(id) {
    const s = get()
    const nodes = s.nodes.filter((n) => n.id !== id)
    const edges = s.edges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id)
    const suggestions = s.suggestions.filter((x) => x.changedNodeId !== id && x.affectedNodeId !== id)
    persist({ ...s, nodes, edges, suggestions })
    set({ nodes, edges, suggestions, selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId })
  },

  connectNodes(sourceId, targetId, rel) {
    const s = get()
    if (!s.project || sourceId === targetId) return
    const exists = s.edges.some((e) => e.sourceNodeId === sourceId && e.targetNodeId === targetId)
    if (exists) return
    const edge: OppEdge = {
      id: uid(),
      projectId: s.project.id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relationshipType: rel,
      strength: 0.5,
      explanation: '',
      createdBy: 'user',
      createdAt: now(),
    }
    const edges = [...s.edges, edge]
    persist({ ...s, edges })
    set({ edges })
  },

  async expandNode(id, direction) {
    const s = get()
    const node = s.nodes.find((n) => n.id === id)
    if (!node || !s.project) return
    set({ agentBusy: direction, agentError: null })
    try {
      const result = await agents.expandNode(node, direction, {
        rawIdea: s.project.rawIdea,
        existingTitles: s.nodes.map((n) => n.title),
      })
      // Place new nodes in a fan around the selected node.
      const baseAngle = direction === 'upstream' ? Math.PI : direction === 'downstream' ? 0 : -Math.PI / 2
      const positions = result.newNodes.map((_, i) => {
        const spread = (i - (result.newNodes.length - 1) / 2) * 0.5
        return {
          x: node.positionX + 380 * Math.cos(baseAngle + spread),
          y: node.positionY + 260 * Math.sin(baseAngle + spread),
        }
      })
      const { nodes: newNodes, idMap } = materializeNodes(result.newNodes, s.project.id, positions, 'ai')
      const newEdges = materializeEdges(result.newEdges, s.project.id, idMap, id)
      const s2 = get()
      const nodes = [...s2.nodes, ...newNodes]
      const edges = [...s2.edges, ...newEdges]
      persist({ ...s2, nodes, edges })
      set({ nodes, edges })
    } catch (err) {
      set({ agentError: err instanceof Error ? err.message : 'Expansion failed. Please try again.' })
    } finally {
      set({ agentBusy: null })
    }
  },

  async runAgentAction(id, action) {
    const s = get()
    const node = s.nodes.find((n) => n.id === id)
    if (!node) return
    set({ agentBusy: action, agentResult: null, agentError: null })
    try {
      let result: AgentActionResult
      switch (action) {
        case 'research':
          result = { kind: 'research', data: await agents.researchNode(node) }
          break
        case 'challenge':
          result = { kind: 'challenge', data: await agents.challengeNode(node) }
          break
        case 'validate':
          result = { kind: 'validate', data: await agents.validateNode(node) }
          break
        case 'reframe':
          result = { kind: 'reframe', data: await agents.reframeNode(node) }
          break
      }
      set({ agentResult: result })
    } catch (err) {
      set({ agentError: err instanceof Error ? err.message : 'Agent action failed. Please try again.' })
    } finally {
      set({ agentBusy: null })
    }
  },

  clearAgentResult() {
    set({ agentResult: null })
  },

  createValidationStepFromResult(nodeId) {
    const s = get()
    const result = s.agentResult
    const source = s.nodes.find((n) => n.id === nodeId)
    if (!result || result.kind !== 'validate' || !source || !s.project) return
    const v = result.data
    const node: OppNode = {
      id: uid(),
      projectId: s.project.id,
      parentNodeId: nodeId,
      nodeType: 'validation_step',
      title: v.validationGoal,
      description: [
        `Test type: ${v.testType}`,
        `Target user: ${v.targetUser}`,
        `Steps:\n${v.scriptOrSteps.map((x) => `- ${x}`).join('\n')}`,
        `Pass signal: ${v.passSignal}`,
        `Fail signal: ${v.failSignal}`,
        `Timebox: ${v.timebox}`,
      ].join('\n\n'),
      evidenceStatus: 'assumption',
      confidenceScore: 0.4,
      assumptions: [],
      reasoning: `Generated by the Validation agent from "${source.title}".`,
      suggestedNextAction: 'Run this test and attach results as evidence.',
      positionX: source.positionX + 320,
      positionY: source.positionY + 180,
      createdBy: 'ai',
      createdAt: now(),
      updatedAt: now(),
    }
    const edge: OppEdge = {
      id: uid(),
      projectId: s.project.id,
      sourceNodeId: node.id,
      targetNodeId: nodeId,
      relationshipType: 'validates',
      strength: 0.7,
      explanation: 'Validation step generated for this node.',
      createdBy: 'ai',
      createdAt: now(),
    }
    const nodes = [...s.nodes, node]
    const edges = [...s.edges, edge]
    persist({ ...s, nodes, edges })
    set({ nodes, edges, agentResult: null, selectedNodeId: node.id })
  },

  resolveSuggestion(id, decision, editedDescription) {
    const s = get()
    const suggestion = s.suggestions.find((x) => x.id === id)
    if (!suggestion) return
    let nodes = s.nodes
    if (decision === 'accepted') {
      const description = editedDescription ?? suggestion.suggestedDescription
      nodes = s.nodes.map((n) =>
        n.id === suggestion.affectedNodeId
          ? {
              ...n,
              title: suggestion.suggestedTitle ?? n.title,
              description: description ? `${n.description}\n\n[Update needed] ${description}` : n.description,
              evidenceStatus: 'assumption' as EvidenceStatus,
              updatedAt: now(),
            }
          : n,
      )
    }
    const suggestions = s.suggestions.map((x) =>
      x.id === id ? { ...x, status: editedDescription ? ('edited' as const) : decision } : x,
    )
    const open = suggestions.some((x) => x.status === 'pending')
    persist({ ...s, nodes, suggestions })
    set({ nodes, suggestions, impactModalOpen: open })
  },

  openImpactModal(open) {
    set({ impactModalOpen: open })
  },

  toggleFilterNodeType(t) {
    const next = new Set(get().filterNodeTypes)
    next.has(t) ? next.delete(t) : next.add(t)
    set({ filterNodeTypes: next })
  },

  toggleFilterEvidenceStatus(st) {
    const next = new Set(get().filterEvidenceStatuses)
    next.has(st) ? next.delete(st) : next.add(st)
    set({ filterEvidenceStatuses: next })
  },
}))
