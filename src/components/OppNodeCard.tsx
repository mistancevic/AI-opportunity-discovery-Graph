import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { OppNode } from '../types'
import { EVIDENCE_STATUS_COLORS, EVIDENCE_STATUS_LABELS, NODE_TYPE_ACCENTS, NODE_TYPE_LABELS } from '../constants'

export type OppFlowNode = Node<{ node: OppNode }, 'opp'>

export function OppNodeCard({ data, selected }: NodeProps<OppFlowNode>) {
  const n = data.node
  const colors = EVIDENCE_STATUS_COLORS[n.evidenceStatus]
  const confidence = n.confidenceScore >= 0.66 ? 'High' : n.confidenceScore >= 0.4 ? 'Medium' : 'Low'
  return (
    <div
      className={`w-60 rounded-xl border-2 bg-white shadow-sm transition-shadow ${colors.border} ${
        selected ? 'shadow-lg ring-2 ring-indigo-500' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <div className={`rounded-t-[10px] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ${NODE_TYPE_ACCENTS[n.nodeType]}`}>
        {NODE_TYPE_LABELS[n.nodeType]}
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-semibold leading-snug text-slate-900">{n.title}</div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${colors.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
            {EVIDENCE_STATUS_LABELS[n.evidenceStatus]}
          </span>
          <span className="text-slate-400">Confidence: {confidence}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  )
}
