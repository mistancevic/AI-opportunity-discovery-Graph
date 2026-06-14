import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { TopBar } from './TopBar'
import {
  CANVAS_COMPONENT_TYPES,
  EVIDENCE_STATUS_COLORS,
  NODE_TYPE_ACCENTS,
  NODE_TYPE_LABELS,
} from '../constants'
import type { NodeType, Strategy } from '../types'

const STRATEGY_FIELDS: { key: keyof Strategy; label: string; placeholder: string }[] = [
  { key: 'whoToWin', label: 'Who we want to win', placeholder: 'The customer we are betting the company on…' },
  { key: 'wedge', label: 'Our wedge', placeholder: 'The angle incumbents won’t copy…' },
  { key: 'refuse', label: 'What we refuse to do', placeholder: 'The trade-offs we deliberately won’t make…' },
]

export function CanvasScreen() {
  const project = useStore((s) => s.project)
  const nodes = useStore((s) => s.nodes)
  const storylines = useStore((s) => s.storylines)
  const activeStorylineId = useStore((s) => s.activeStorylineId)
  const strategy = useStore((s) => s.strategy)
  const selectIngredient = useStore((s) => s.selectIngredient)
  const createStoryline = useStore((s) => s.createStoryline)
  const renameStoryline = useStore((s) => s.renameStoryline)
  const deleteStoryline = useStore((s) => s.deleteStoryline)
  const setActiveStoryline = useStore((s) => s.setActiveStoryline)
  const updateStrategy = useStore((s) => s.updateStrategy)

  // Lazily create a storyline for projects saved before the canvas existed.
  useEffect(() => {
    if (project && storylines.length === 0) createStoryline('Storyline 1')
  }, [project, storylines.length, createStoryline])

  const active = storylines.find((s) => s.id === activeStorylineId) ?? storylines[0]
  const nodeById = (id?: string) => (id ? nodes.find((n) => n.id === id) : undefined)

  if (!project) return null

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <TopBar />

      {/* Strategy bar */}
      <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-slate-200 bg-white px-4 py-3 md:grid-cols-3">
        {STRATEGY_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">{f.label}</span>
            <textarea
              className="h-14 resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
              placeholder={f.placeholder}
              value={strategy[f.key]}
              onChange={(e) => updateStrategy({ [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      {/* Storyline tabs */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Storylines</span>
        {storylines.map((s) => (
          <StorylineTab
            key={s.id}
            name={s.name}
            active={s.id === active?.id}
            canDelete={storylines.length > 1}
            onSelect={() => setActiveStoryline(s.id)}
            onRename={(name) => renameStoryline(s.id, name)}
            onDelete={() => deleteStoryline(s.id)}
          />
        ))}
        <button
          className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
          onClick={() => createStoryline()}
          title="Branch a new storyline from this one to compare"
        >
          + Compare another
        </button>
      </div>

      {/* Component columns */}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 p-4" style={{ minWidth: 'min-content' }}>
          {CANVAS_COMPONENT_TYPES.map((type) => {
            const candidates = nodes.filter((n) => n.nodeType === type)
            const selectedId = active?.selections[type]
            return (
              <div key={type} className="flex h-full w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-white">
                <div className={`rounded-t-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${NODE_TYPE_ACCENTS[type]}`}>
                  {NODE_TYPE_LABELS[type]}
                  <span className="ml-1 font-normal opacity-80">({candidates.length})</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {candidates.length === 0 && (
                    <p className="px-1 py-2 text-xs text-slate-400">
                      No candidates yet. Expand a node or add one on the map.
                    </p>
                  )}
                  {candidates.map((n) => {
                    const selected = n.id === selectedId
                    const colors = EVIDENCE_STATUS_COLORS[n.evidenceStatus]
                    return (
                      <button
                        key={n.id}
                        className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => selectIngredient(type, selected ? null : n.id)}
                        title={selected ? 'Click to unpick from this storyline' : 'Pick for this storyline'}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
                          <span className="font-medium text-slate-800">{n.title}</span>
                          {selected && <span className="ml-auto text-indigo-600">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Storyline summary */}
      {active && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-5xl text-sm text-slate-700">
            <span className="font-semibold text-indigo-700">{active.name}: </span>
            {storyAsSentence(active.selections, nodeById)}
          </div>
          <p className="mx-auto mt-1 max-w-5xl text-xs text-slate-400">
            Coherence scoring — does this story hold together, and against your strategy — arrives in the next build.
          </p>
        </div>
      )}
    </div>
  )
}

function storyAsSentence(
  selections: Partial<Record<NodeType, string>>,
  nodeById: (id?: string) => { title: string } | undefined,
): string {
  const seg = nodeById(selections.customer_segment)?.title
  const prob = nodeById(selections.problem)?.title
  const concept = nodeById(selections.product_concept)?.title
  const model = nodeById(selections.business_model)?.title
  if (!seg && !prob && !concept) return 'Pick one ingredient per column to form a storyline.'
  const parts: string[] = []
  if (seg) parts.push(`For ${seg.toLowerCase()}`)
  if (prob) parts.push(`who struggle with "${prob.toLowerCase()}"`)
  if (concept) parts.push(`we offer ${concept.toLowerCase()}`)
  if (model) parts.push(`monetized via ${model.toLowerCase()}`)
  return parts.join(', ') + '.'
}

function StorylineTab({
  name,
  active,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  name: string
  active: boolean
  canDelete: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  if (editing) {
    return (
      <input
        autoFocus
        className="w-32 rounded-full border border-indigo-400 px-3 py-1 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onRename(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onRename(draft)
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <span
      className={`group flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
        active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      <button onClick={onSelect} onDoubleClick={() => setEditing(true)} title="Double-click to rename">
        {name}
      </button>
      {active && (
        <button className="opacity-70 hover:opacity-100" onClick={() => setEditing(true)} title="Rename">
          ✎
        </button>
      )}
      {canDelete && (
        <button
          className="opacity-50 hover:opacity-100"
          onClick={() => {
            if (confirm(`Delete storyline "${name}"?`)) onDelete()
          }}
          title="Delete storyline"
        >
          ✕
        </button>
      )}
    </span>
  )
}
