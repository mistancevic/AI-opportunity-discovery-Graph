import { useState } from 'react'
import { useStore } from '../store'
import {
  ALL_EVIDENCE_STATUSES,
  EVIDENCE_STATUS_COLORS,
  EVIDENCE_STATUS_LABELS,
  NODE_TYPE_LABELS,
} from '../constants'
import type { EvidenceStatus, ExpandDirection } from '../types'
import { AgentResultPanel } from './AgentResultPanel'

export function SidePanel({ nodeId }: { nodeId: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === nodeId))
  const edges = useStore((s) => s.edges)
  const allNodes = useStore((s) => s.nodes)
  const agentBusy = useStore((s) => s.agentBusy)
  const agentResult = useStore((s) => s.agentResult)
  const expandNode = useStore((s) => s.expandNode)
  const runAgentAction = useStore((s) => s.runAgentAction)
  const updateNode = useStore((s) => s.updateNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const selectNode = useStore((s) => s.selectNode)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(node?.title ?? '')
  const [description, setDescription] = useState(node?.description ?? '')

  if (!node) return null

  const linked = edges
    .filter((e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId)
    .map((e) => {
      const otherId = e.sourceNodeId === nodeId ? e.targetNodeId : e.sourceNodeId
      const other = allNodes.find((n) => n.id === otherId)
      return other ? { edge: e, other } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const colors = EVIDENCE_STATUS_COLORS[node.evidenceStatus]
  const busy = agentBusy !== null

  const saveEdit = () => {
    setEditing(false)
    if (title === node.title && description === node.description) return
    void updateNode(nodeId, { title, description }, 'Manual edit')
  }

  const directions: { key: ExpandDirection; label: string; hint: string }[] = [
    { key: 'upstream', label: 'Upstream', hint: 'causes & context' },
    { key: 'downstream', label: 'Downstream', hint: 'specifics & tests' },
    { key: 'lateral', label: 'Lateral', hint: 'adjacent options' },
  ]
  const actions = ['research', 'challenge', 'validate', 'reframe'] as const

  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {NODE_TYPE_LABELS[node.nodeType]}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              onClick={() => {
                if (editing) saveEdit()
                else {
                  setTitle(node.title)
                  setDescription(node.description)
                  setEditing(true)
                }
              }}
            >
              {editing ? 'Save' : 'Edit'}
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              onClick={() => {
                if (confirm('Delete this node and its connections?')) deleteNode(nodeId)
              }}
            >
              Delete
            </button>
            <button className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100" onClick={() => selectNode(null)}>
              ✕
            </button>
          </div>
        </div>

        {editing ? (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="h-28 w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">Saving a meaningful change triggers a cross-reference impact check.</p>
          </div>
        ) : (
          <>
            <h2 className="mt-3 text-base font-semibold text-slate-900">{node.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{node.description || 'No description yet.'}</p>
          </>
        )}

        <div className="mt-4 flex items-center gap-3">
          <select
            className={`rounded-lg border px-2 py-1 text-xs font-medium ${colors.badge} ${colors.border}`}
            value={node.evidenceStatus}
            onChange={(e) =>
              void updateNode(nodeId, { evidenceStatus: e.target.value as EvidenceStatus }, 'Evidence status change')
            }
          >
            {ALL_EVIDENCE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {EVIDENCE_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Confidence
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={node.confidenceScore}
              onChange={(e) =>
                void updateNode(nodeId, { confidenceScore: Number(e.target.value) }, 'Confidence change')
              }
            />
            {Math.round(node.confidenceScore * 100)}%
          </label>
        </div>
      </div>

      <div className="border-b border-slate-200 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Expand</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {directions.map((d) => (
            <button
              key={d.key}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => void expandNode(nodeId, d.key)}
            >
              {agentBusy === d.key ? 'Expanding…' : d.label}
              <span className="block text-[10px] font-normal text-slate-400">{d.hint}</span>
            </button>
          ))}
        </div>

        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">AI agents</h3>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {actions.map((a) => (
            <button
              key={a}
              className="rounded-lg bg-slate-800 px-2 py-2 text-xs font-medium capitalize text-white hover:bg-slate-700 disabled:opacity-40"
              disabled={busy}
              onClick={() => void runAgentAction(nodeId, a)}
            >
              {agentBusy === a ? '…' : a}
            </button>
          ))}
        </div>
      </div>

      {agentResult && <AgentResultPanel nodeId={nodeId} result={agentResult} />}

      {node.assumptions.length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Assumptions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
            {node.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {node.reasoning && (
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">AI reasoning</h3>
          <p className="mt-2 text-sm text-slate-600">{node.reasoning}</p>
        </div>
      )}

      {node.suggestedNextAction && (
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Suggested next action</h3>
          <p className="mt-2 text-sm text-slate-600">{node.suggestedNextAction}</p>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Linked nodes ({linked.length})</h3>
        <ul className="mt-2 space-y-1.5">
          {linked.map(({ edge, other }) => (
            <li key={edge.id}>
              <button
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                onClick={() => selectNode(other.id)}
              >
                <span className="text-slate-400">{edge.relationshipType.replace(/_/g, ' ')} → </span>
                <span className="font-medium text-slate-700">{other.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
