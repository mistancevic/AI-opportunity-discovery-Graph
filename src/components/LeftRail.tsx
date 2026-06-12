import { useState } from 'react'
import { useStore } from '../store'
import {
  ALL_EVIDENCE_STATUSES,
  ALL_NODE_TYPES,
  EVIDENCE_STATUS_COLORS,
  EVIDENCE_STATUS_LABELS,
  NODE_TYPE_LABELS,
} from '../constants'
import type { NodeType } from '../types'

const COLLAPSE_KEY = 'opportunity-graph-ai/left-rail-collapsed'

export function LeftRail() {
  const project = useStore((s) => s.project)
  const nodes = useStore((s) => s.nodes)
  const filterNodeTypes = useStore((s) => s.filterNodeTypes)
  const filterEvidenceStatuses = useStore((s) => s.filterEvidenceStatuses)
  const toggleFilterNodeType = useStore((s) => s.toggleFilterNodeType)
  const toggleFilterEvidenceStatus = useStore((s) => s.toggleFilterEvidenceStatus)
  const addManualNode = useStore((s) => s.addManualNode)

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<NodeType>('problem')

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  const activeFilters = filterNodeTypes.size + filterEvidenceStatuses.size
  const usedTypes = ALL_NODE_TYPES.filter((t) => nodes.some((n) => n.nodeType === t))

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-3 border-r border-slate-200 bg-white py-3">
        <button
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
          title="Expand panel"
          onClick={toggleCollapsed}
        >
          »
        </button>
        {activeFilters > 0 && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
            title={`${activeFilters} active filter${activeFilters > 1 ? 's' : ''}`}
          >
            {activeFilters}
          </span>
        )}
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300 [writing-mode:vertical-rl]">
          Filters & Today's Step
        </span>
      </aside>
    )
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Workspace</h2>
        <button
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          title="Collapse panel"
          onClick={toggleCollapsed}
        >
          «
        </button>
      </div>
      {project?.todayNextStep && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Today's Next Step</h3>
          <p className="mt-2 font-medium text-slate-800">{project.todayNextStep.suggestedAction}</p>
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-semibold">Biggest unknown:</span> {project.todayNextStep.biggestUnknown}
          </p>
          <p className="mt-1 text-xs text-slate-500">{project.todayNextStep.whyItMatters}</p>
        </section>
      )}

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Filter by node type</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {usedTypes.map((t) => (
            <button
              key={t}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                filterNodeTypes.has(t)
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => toggleFilterNodeType(t)}
            >
              {NODE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Filter by evidence</h3>
        <div className="mt-2 space-y-1">
          {ALL_EVIDENCE_STATUSES.map((st) => (
            <button
              key={st}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs ${
                filterEvidenceStatuses.has(st) ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100'
              }`}
              onClick={() => toggleFilterEvidenceStatus(st)}
            >
              <span className={`h-2 w-2 rounded-full ${EVIDENCE_STATUS_COLORS[st].dot}`} />
              {EVIDENCE_STATUS_LABELS[st]}
              <span className="ml-auto text-slate-400">{nodes.filter((n) => n.evidenceStatus === st).length}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-auto border-t border-slate-200 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Add node manually</h3>
        <select
          className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          value={newType}
          onChange={(e) => setNewType(e.target.value as NodeType)}
        >
          {ALL_NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {NODE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          placeholder="Node title (a concrete claim)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTitle.trim()) {
              addManualNode(newType, newTitle.trim())
              setNewTitle('')
            }
          }}
        />
        <button
          className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          disabled={!newTitle.trim()}
          onClick={() => {
            addManualNode(newType, newTitle.trim())
            setNewTitle('')
          }}
        >
          Add node
        </button>
      </section>
    </aside>
  )
}
