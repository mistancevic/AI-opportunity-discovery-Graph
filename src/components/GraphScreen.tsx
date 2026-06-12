import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, NodeChange } from '@xyflow/react'
import { useStore } from '../store'
import { OppNodeCard } from './OppNodeCard'
import type { OppFlowNode } from './OppNodeCard'
import { TopBar } from './TopBar'
import { LeftRail } from './LeftRail'
import { SidePanel } from './SidePanel'
import { ImpactReviewModal } from './ImpactReviewModal'

const nodeTypes = { opp: OppNodeCard }

export function GraphScreen() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const filterNodeTypes = useStore((s) => s.filterNodeTypes)
  const filterEvidenceStatuses = useStore((s) => s.filterEvidenceStatuses)
  const selectNode = useStore((s) => s.selectNode)
  const setNodePosition = useStore((s) => s.setNodePosition)
  const connectNodes = useStore((s) => s.connectNodes)
  const impactModalOpen = useStore((s) => s.impactModalOpen)

  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (filterNodeTypes.size === 0 || filterNodeTypes.has(n.nodeType)) &&
          (filterEvidenceStatuses.size === 0 || filterEvidenceStatuses.has(n.evidenceStatus)),
      ),
    [nodes, filterNodeTypes, filterEvidenceStatuses],
  )

  // Semi-controlled React Flow: it owns transient state (drag, measuring,
  // selection) locally; the store is the source of truth for content and
  // resting positions, synced in via this effect.
  const [flowNodes, setFlowNodes] = useState<OppFlowNode[]>([])
  useEffect(() => {
    setFlowNodes((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]))
      return visibleNodes.map((n) => {
        const existing = prevById.get(n.id)
        return {
          id: n.id,
          type: 'opp' as const,
          position: { x: n.positionX, y: n.positionY },
          data: { node: n },
          selected: n.id === selectedNodeId,
          measured: existing?.measured,
        }
      })
    })
  }, [visibleNodes, selectedNodeId])

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])
  const flowEdges: Edge[] = useMemo(
    () =>
      edges
        .filter((e) => visibleIds.has(e.sourceNodeId) && visibleIds.has(e.targetNodeId))
        .map((e) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          label: e.relationshipType.replace(/_/g, ' '),
          labelStyle: { fontSize: 10, fill: '#64748b' },
          style: { stroke: '#cbd5e1' },
          animated: e.relationshipType === 'validates' || e.relationshipType === 'requires_test',
        })),
    [edges, visibleIds],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<OppFlowNode>[]) => {
      setFlowNodes((nds) => applyNodeChanges(changes, nds))
      for (const c of changes) {
        if (c.type === 'position' && c.position && !c.dragging) {
          setNodePosition(c.id, c.position.x, c.position.y)
        }
      }
    },
    [setNodePosition],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) connectNodes(c.source, c.target, 'supports')
    },
    [connectNodes],
  )

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftRail />
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => selectNode(n.id)}
            onPaneClick={() => selectNode(null)}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e2e8f0" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        {selectedNodeId && <SidePanel key={selectedNodeId} nodeId={selectedNodeId} />}
      </div>
      {impactModalOpen && <ImpactReviewModal />}
    </div>
  )
}
