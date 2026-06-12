// Automatic graph layout using dagre. Produces a left-to-right layered
// layout from the graph's edges, so generated maps are readable instead of
// overlapping. Node dimensions match the rendered card size in OppNodeCard.

import dagre from '@dagrejs/dagre'
import type { OppEdge, OppNode } from '../types'

const NODE_WIDTH = 260
const NODE_HEIGHT = 120

export function computeAutoLayout(
  nodes: OppNode[],
  edges: OppEdge[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', ranksep: 160, nodesep: 60, marginx: 60, marginy: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of edges) {
    if (e.sourceNodeId !== e.targetNodeId) {
      g.setEdge(e.sourceNodeId, e.targetNodeId)
    }
  }

  dagre.layout(g)

  return new Map(
    nodes.map((n) => {
      const pos = g.node(n.id)
      // dagre returns center coordinates; React Flow positions are top-left.
      return [n.id, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }]
    }),
  )
}
