import { create } from 'zustand'
import { agents } from './ai'
import { computeAutoLayout } from './lib/autoLayout'
import type {
  AgentActionResult,
  CoherenceResult,
  StrategyRevision,
  EvidenceStatus,
  ExpandDirection,
  GeneratedNode,
  GeneratedEdge,
  ImpactSuggestion,
  NodeType,
  NodeVersion,
  OppEdge,
  OppNode,
  PanelAgent,
  PanelCapture,
  PanelMessage,
  Project,
  RelationshipType,
  Storyline,
  Strategy,
} from './types'
import { CANVAS_COMPONENT_TYPES } from './constants'

const STORAGE_KEY = 'opportunity-graph-ai/v1'
const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

interface PersistedState {
  project: Project | null
  nodes: OppNode[]
  edges: OppEdge[]
  versions: NodeVersion[]
  suggestions: ImpactSuggestion[]
  storylines: Storyline[]
  strategy: Strategy
  activeStorylineId: string | null
}

const EMPTY_STRATEGY: Strategy = { whoToWin: '', wedge: '', refuse: '' }

// Seed a first storyline with the first candidate node selected per component.
function makeDefaultStoryline(nodes: OppNode[], name = 'Storyline 1'): Storyline {
  const selections: Partial<Record<NodeType, string>> = {}
  for (const t of CANVAS_COMPONENT_TYPES) {
    const first = nodes.find((n) => n.nodeType === t)
    if (first) selections[t] = first.id
  }
  return { id: uid(), name, selections, createdAt: now() }
}

// Append newly-cast panel agents (e.g. customer personas added mid-discussion)
// to the existing roster, keeping order and dropping any duplicate ids.
function mergeRoster(existing: PanelAgent[], incoming: PanelAgent[]): PanelAgent[] {
  const seen = new Set(existing.map((a) => a.agentId))
  const fresh = incoming.filter((a) => !seen.has(a.agentId))
  return fresh.length ? [...existing, ...fresh] : existing
}

interface AppState extends PersistedState {
  selectedNodeId: string | null
  generating: boolean
  generateError: string | null
  agentBusy: ExpandDirection | 'research' | 'challenge' | 'validate' | 'reframe' | null
  agentResult: AgentActionResult | null
  agentError: string | null
  impactChecking: boolean
  impactModalOpen: boolean
  // Bumped whenever positions change wholesale so the canvas can re-fit the view.
  layoutNonce: number
  filterNodeTypes: Set<NodeType>
  filterEvidenceStatuses: Set<EvidenceStatus>
  view: 'start' | 'discuss' | 'graph' | 'validation_plan' | 'canvas'

  // Strategy Canvas actions
  selectIngredient(componentType: NodeType, nodeId: string | null): void
  createStoryline(name?: string): void
  renameStoryline(id: string, name: string): void
  deleteStoryline(id: string): void
  setActiveStoryline(id: string): void
  updateStrategy(patch: Partial<Strategy>): void

  // Coherence agent (per active storyline; kept in memory, recomputed on demand)
  coherence: CoherenceResult | null
  coherenceBusy: boolean
  coherenceError: string | null
  scoreCoherence(): Promise<void>
  clearCoherence(): void

  // Strategy revision (bottom-up loop: findings propose strategy edits)
  strategyRevision: StrategyRevision | null
  strategyRevisionBusy: boolean
  strategyRevisionError: string | null
  reviseStrategyFromFindings(): Promise<void>
  applyStrategyRevision(): void
  dismissStrategyRevision(): void

  // Discovery panel state (in-memory; a discussion ends when a map is generated)
  discussion: {
    rawIdea: string
    roster: PanelAgent[]
    messages: PanelMessage[]
    focusBrief: string
    readyToMap: boolean
    captures: PanelCapture[]
  } | null
  panelBusy: boolean
  panelError: string | null

  startDiscussion(rawIdea: string): Promise<void>
  sendPanelMessage(text: string): Promise<void>
  capturePanelLine(componentType: NodeType, text: string): void
  removeCapture(id: string): void
  generateMap(rawIdea: string, focusBrief?: string): Promise<void>
  resetProject(): void
  selectNode(id: string | null): void
  setView(view: AppState['view']): void
  updateNode(id: string, patch: Partial<OppNode>, changeReason: string): Promise<void>
  setNodePosition(id: string, x: number, y: number, save?: boolean): void
  addManualNode(nodeType: NodeType, title: string): void
  deleteNode(id: string): void
  connectNodes(sourceId: string, targetId: string, rel: RelationshipType): void
  autoArrange(): void
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
  const empty: PersistedState = {
    project: null,
    nodes: [],
    edges: [],
    versions: [],
    suggestions: [],
    storylines: [],
    strategy: EMPTY_STRATEGY,
    activeStorylineId: null,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // Merge with defaults so projects saved before the canvas existed load.
      return { ...empty, ...JSON.parse(raw) }
    }
  } catch {
    // corrupted state — start fresh
  }
  return empty
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
      storylines: s.storylines,
      strategy: s.strategy,
      activeStorylineId: s.activeStorylineId,
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
  impactChecking: false,
  impactModalOpen: false,
  layoutNonce: 0,
  filterNodeTypes: new Set<NodeType>(),
  filterEvidenceStatuses: new Set<EvidenceStatus>(),
  view: initial.project ? 'graph' : 'start',
  discussion: null,
  panelBusy: false,
  panelError: null,
  coherence: null,
  coherenceBusy: false,
  coherenceError: null,
  strategyRevision: null,
  strategyRevisionBusy: false,
  strategyRevisionError: null,

  async startDiscussion(rawIdea) {
    set({
      view: 'discuss',
      discussion: { rawIdea, roster: [], messages: [], focusBrief: '', readyToMap: false, captures: [] },
      panelBusy: true,
      panelError: null,
    })
    try {
      const result = await agents.discussIdea(rawIdea, [], null)
      const d = get().discussion
      if (!d) return
      set({
        discussion: {
          ...d,
          roster: mergeRoster(d.roster, result.roster),
          messages: [...d.messages, ...result.messages],
          focusBrief: result.focusBrief || d.focusBrief,
          readyToMap: result.readyToMap,
        },
      })
    } catch (err) {
      set({ panelError: err instanceof Error ? err.message : 'The panel failed to start.' })
    } finally {
      set({ panelBusy: false })
    }
  },

  async sendPanelMessage(text) {
    const d = get().discussion
    if (!d || !text.trim()) return
    const userMessage: PanelMessage = { agentId: 'user', agentName: 'You', text: text.trim() }
    const history = [...d.messages, userMessage]
    set({ discussion: { ...d, messages: history }, panelBusy: true, panelError: null })
    try {
      const result = await agents.discussIdea(d.rawIdea, history, d.roster.length ? d.roster : null)
      const d2 = get().discussion
      if (!d2) return
      set({
        discussion: {
          ...d2,
          // Merge so customer personas cast mid-discussion accumulate.
          roster: mergeRoster(d2.roster, result.roster),
          messages: [...d2.messages, ...result.messages],
          focusBrief: result.focusBrief || d2.focusBrief,
          readyToMap: result.readyToMap || d2.readyToMap,
        },
      })
    } catch (err) {
      set({ panelError: err instanceof Error ? err.message : 'The panel failed to respond.' })
    } finally {
      set({ panelBusy: false })
    }
  },

  capturePanelLine(componentType, text) {
    const d = get().discussion
    if (!d || !text.trim()) return
    const capture: PanelCapture = { id: uid(), componentType, text: text.trim() }
    set({ discussion: { ...d, captures: [...d.captures, capture] } })
  },

  removeCapture(id) {
    const d = get().discussion
    if (!d) return
    set({ discussion: { ...d, captures: d.captures.filter((c) => c.id !== id) } })
  },

  async generateMap(rawIdea, focusBrief) {
    set({ generating: true, generateError: null })
    try {
      const result = await agents.generateInitialMap(rawIdea, focusBrief)
      const projectId = uid()
      const positions = layoutPositions(result.nodes.length)
      const { nodes, idMap } = materializeNodes(result.nodes, projectId, positions, 'ai')
      const edges = materializeEdges(result.edges, projectId, idMap)

      // Materialize anything captured during the discussion as user-authored
      // candidate nodes, linked under the raw idea so they're not floating.
      const captures = get().discussion?.captures ?? []
      const rawIdeaNode = nodes.find((n) => n.nodeType === 'raw_idea')
      for (const c of captures) {
        const id = uid()
        nodes.push({
          id,
          projectId,
          parentNodeId: null,
          nodeType: c.componentType,
          title: c.text.length > 90 ? `${c.text.slice(0, 87)}…` : c.text,
          description: `Captured from the discovery panel.\n\n"${c.text}"`,
          evidenceStatus: 'assumption',
          confidenceScore: 0.3,
          assumptions: [],
          reasoning: '',
          suggestedNextAction: '',
          positionX: 0,
          positionY: 0,
          createdBy: 'user',
          createdAt: now(),
          updatedAt: now(),
        })
        if (rawIdeaNode) {
          edges.push({
            id: uid(),
            projectId,
            sourceNodeId: rawIdeaNode.id,
            targetNodeId: id,
            relationshipType: 'contains',
            strength: 0.5,
            explanation: 'Captured from the discovery panel.',
            createdBy: 'user',
            createdAt: now(),
          })
        }
      }

      // Replace the placeholder positions with a proper layered layout -
      // real maps vary in size and the naive ring overlaps badly.
      const layout = computeAutoLayout(nodes, edges)
      for (const n of nodes) {
        const pos = layout.get(n.id)
        if (pos) {
          n.positionX = pos.x
          n.positionY = pos.y
        }
      }
      const project: Project = {
        id: projectId,
        title: result.projectTitle,
        rawIdea,
        todayNextStep: result.todayNextStep,
        createdAt: now(),
        updatedAt: now(),
      }
      const storyline = makeDefaultStoryline(nodes)
      const next: PersistedState = {
        project,
        nodes,
        edges,
        versions: [],
        suggestions: [],
        storylines: [storyline],
        strategy: EMPTY_STRATEGY,
        activeStorylineId: storyline.id,
      }
      persist(next)
      set({
        ...next,
        view: 'graph',
        selectedNodeId: null,
        agentResult: null,
        discussion: null,
        layoutNonce: get().layoutNonce + 1,
      })
    } catch (err) {
      set({ generateError: err instanceof Error ? err.message : 'Map generation failed. Please try again.' })
    } finally {
      set({ generating: false })
    }
  },

  resetProject() {
    const next: PersistedState = {
      project: null,
      nodes: [],
      edges: [],
      versions: [],
      suggestions: [],
      storylines: [],
      strategy: EMPTY_STRATEGY,
      activeStorylineId: null,
    }
    persist(next)
    set({ ...next, view: 'start', selectedNodeId: null, agentResult: null, discussion: null })
  },

  selectNode(id) {
    set({ selectedNodeId: id, agentResult: null, agentError: null })
  },

  selectIngredient(componentType, nodeId) {
    const s = get()
    const id = s.activeStorylineId
    if (!id) return
    const storylines = s.storylines.map((st) => {
      if (st.id !== id) return st
      const selections = { ...st.selections }
      if (nodeId === null) delete selections[componentType]
      else selections[componentType] = nodeId
      return { ...st, selections }
    })
    persist({ ...s, storylines })
    // Selection changed -> the previous judgment no longer applies.
    set({ storylines, coherence: null })
  },

  createStoryline(name) {
    const s = get()
    // New storylines start from the active one so you tweak a copy to compare.
    const base = s.storylines.find((st) => st.id === s.activeStorylineId)
    const storyline: Storyline = {
      id: uid(),
      name: name?.trim() || `Storyline ${s.storylines.length + 1}`,
      selections: base ? { ...base.selections } : makeDefaultStoryline(s.nodes).selections,
      createdAt: now(),
    }
    const storylines = [...s.storylines, storyline]
    persist({ ...s, storylines, activeStorylineId: storyline.id })
    set({ storylines, activeStorylineId: storyline.id })
  },

  renameStoryline(id, name) {
    const s = get()
    const storylines = s.storylines.map((st) => (st.id === id ? { ...st, name: name.trim() || st.name } : st))
    persist({ ...s, storylines })
    set({ storylines })
  },

  deleteStoryline(id) {
    const s = get()
    if (s.storylines.length <= 1) return // always keep at least one
    const storylines = s.storylines.filter((st) => st.id !== id)
    const activeStorylineId = s.activeStorylineId === id ? storylines[0].id : s.activeStorylineId
    persist({ ...s, storylines, activeStorylineId })
    set({ storylines, activeStorylineId })
  },

  setActiveStoryline(id) {
    const s = get()
    if (!s.storylines.some((st) => st.id === id)) return
    persist({ ...s, activeStorylineId: id })
    set({ activeStorylineId: id, coherence: null, coherenceError: null, strategyRevision: null })
  },

  updateStrategy(patch) {
    const s = get()
    const strategy = { ...s.strategy, ...patch }
    persist({ ...s, strategy })
    // The judged story and any pending revision are now stale.
    set({ strategy, coherence: null, strategyRevision: null })
  },

  async scoreCoherence() {
    const s = get()
    const active = s.storylines.find((st) => st.id === s.activeStorylineId)
    if (!active || !s.project) return
    const selection = CANVAS_COMPONENT_TYPES.flatMap((t) => {
      const nodeId = active.selections[t]
      const node = nodeId ? s.nodes.find((n) => n.id === nodeId) : undefined
      return node ? [{ componentType: t, title: node.title, description: node.description }] : []
    })
    if (selection.length < 2) {
      set({ coherenceError: 'Pick at least two ingredients before scoring coherence.' })
      return
    }
    set({ coherenceBusy: true, coherenceError: null, coherence: null })
    try {
      const result = await agents.scoreCoherence(selection, s.strategy, s.project.rawIdea)
      set({ coherence: result })
    } catch (err) {
      set({ coherenceError: err instanceof Error ? err.message : 'Coherence scoring failed.' })
    } finally {
      set({ coherenceBusy: false })
    }
  },

  clearCoherence() {
    set({ coherence: null, coherenceError: null })
  },

  async reviseStrategyFromFindings() {
    const s = get()
    const active = s.storylines.find((st) => st.id === s.activeStorylineId)
    if (!active || !s.project) return
    const findings = CANVAS_COMPONENT_TYPES.flatMap((t) => {
      const nodeId = active.selections[t]
      const node = nodeId ? s.nodes.find((n) => n.id === nodeId) : undefined
      return node
        ? [{ componentType: t, title: node.title, description: node.description, evidenceStatus: node.evidenceStatus }]
        : []
    })
    if (findings.length === 0) {
      set({ strategyRevisionError: 'Pick ingredients on the canvas first — the strategy is revised against them.' })
      return
    }
    set({ strategyRevisionBusy: true, strategyRevisionError: null, strategyRevision: null })
    try {
      const revision = await agents.reviseStrategy(findings, s.strategy, s.project.rawIdea)
      set({ strategyRevision: revision })
    } catch (err) {
      set({ strategyRevisionError: err instanceof Error ? err.message : 'Strategy revision failed.' })
    } finally {
      set({ strategyRevisionBusy: false })
    }
  },

  applyStrategyRevision() {
    const s = get()
    if (!s.strategyRevision) return
    const strategy = { ...s.strategyRevision.proposed }
    persist({ ...s, strategy })
    // Applying the revised bet invalidates the previous coherence judgment.
    set({ strategy, strategyRevision: null, coherence: null })
  },

  dismissStrategyRevision() {
    set({ strategyRevision: null, strategyRevisionError: null })
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
    set({ impactChecking: true })
    try {
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
    } catch (err) {
      // The edit itself already saved; a failed impact check must not undo it.
      set({ agentError: err instanceof Error ? err.message : 'Impact check failed.' })
    } finally {
      set({ impactChecking: false })
    }
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

  autoArrange() {
    const s = get()
    if (!s.nodes.length) return
    const layout = computeAutoLayout(s.nodes, s.edges)
    const nodes = s.nodes.map((n) => {
      const pos = layout.get(n.id)
      return pos ? { ...n, positionX: pos.x, positionY: pos.y } : n
    })
    persist({ ...s, nodes })
    set({ nodes, layoutNonce: s.layoutNonce + 1 })
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
    if (!node || !s.project) return
    const context = { rawIdea: s.project.rawIdea }
    set({ agentBusy: action, agentResult: null, agentError: null })
    try {
      let result: AgentActionResult
      switch (action) {
        case 'research':
          result = { kind: 'research', data: await agents.researchNode(node, context) }
          break
        case 'challenge':
          result = { kind: 'challenge', data: await agents.challengeNode(node, context) }
          break
        case 'validate':
          result = { kind: 'validate', data: await agents.validateNode(node, context) }
          break
        case 'reframe':
          result = { kind: 'reframe', data: await agents.reframeNode(node, context) }
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
