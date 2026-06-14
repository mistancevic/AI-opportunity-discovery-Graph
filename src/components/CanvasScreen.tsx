import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { TopBar } from './TopBar'
import {
  CANVAS_COMPONENT_TYPES,
  EVIDENCE_STATUS_COLORS,
  NODE_TYPE_ACCENTS,
  NODE_TYPE_LABELS,
} from '../constants'
import type { CoherenceResult, NodeType, Strategy, StrategyRevision } from '../types'

const FIELD_LABELS: Record<keyof Strategy, string> = {
  whoToWin: 'Who we want to win',
  wedge: 'Our wedge',
  refuse: 'What we refuse to do',
}

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
  const coherence = useStore((s) => s.coherence)
  const coherenceBusy = useStore((s) => s.coherenceBusy)
  const coherenceError = useStore((s) => s.coherenceError)
  const scoreCoherence = useStore((s) => s.scoreCoherence)
  const strategyRevision = useStore((s) => s.strategyRevision)
  const strategyRevisionBusy = useStore((s) => s.strategyRevisionBusy)
  const strategyRevisionError = useStore((s) => s.strategyRevisionError)
  const reviseStrategyFromFindings = useStore((s) => s.reviseStrategyFromFindings)
  const applyStrategyRevision = useStore((s) => s.applyStrategyRevision)
  const dismissStrategyRevision = useStore((s) => s.dismissStrategyRevision)

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
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Strategy (your bet)</span>
          <button
            className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            disabled={strategyRevisionBusy}
            onClick={() => void reviseStrategyFromFindings()}
            title="Let the findings (your selected ingredients and their evidence) propose how the strategy should change"
          >
            {strategyRevisionBusy ? 'Revising…' : '↻ Revise from findings'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        {strategyRevisionError && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {strategyRevisionError}
          </p>
        )}
        {strategyRevision && (
          <StrategyRevisionPanel
            revision={strategyRevision}
            onApply={applyStrategyRevision}
            onDismiss={dismissStrategyRevision}
          />
        )}
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

      {/* Component lanes — horizontal columns on desktop, stacked full-width on mobile */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-3 p-4 md:h-full md:flex-row md:flex-nowrap" style={{ minWidth: 'min-content' }}>
          {CANVAS_COMPONENT_TYPES.map((type) => {
            const candidates = nodes.filter((n) => n.nodeType === type)
            const selectedId = active?.selections[type]
            return (
              <div key={type} className="flex w-full shrink-0 flex-col rounded-xl border border-slate-200 bg-white md:h-full md:w-64">
                <div className={`rounded-t-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${NODE_TYPE_ACCENTS[type]}`}>
                  {NODE_TYPE_LABELS[type]}
                  <span className="ml-1 font-normal opacity-80">({candidates.length})</span>
                </div>
                <div className="space-y-2 p-2 md:flex-1 md:overflow-y-auto">
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

      {/* Storyline summary + coherence */}
      {active && (
        <div className="shrink-0 overflow-y-auto border-t border-slate-200 bg-white px-4 py-3 md:max-h-[42%]">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm text-slate-700">
                <span className="font-semibold text-indigo-700">{active.name}: </span>
                {storyAsSentence(active.selections, nodeById)}
              </div>
              <button
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={coherenceBusy}
                onClick={() => void scoreCoherence()}
                title="Judge whether this story holds together and serves your strategy"
              >
                {coherenceBusy ? 'Sensing…' : coherence ? 'Re-check coherence' : 'Check coherence'}
              </button>
            </div>

            {coherenceError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {coherenceError}
              </p>
            )}

            {coherence && <CoherencePanel result={coherence} />}
          </div>
        </div>
      )}
    </div>
  )
}

function StrategyRevisionPanel({
  revision,
  onApply,
  onDismiss,
}: {
  revision: StrategyRevision
  onApply: () => void
  onDismiss: () => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-800">{revision.summary}</p>
        <button className="shrink-0 text-xs text-slate-400 hover:text-slate-600" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      {revision.changes.length > 0 && (
        <ul className="mt-2 space-y-2">
          {revision.changes.map((c, i) => (
            <li key={i} className="rounded-lg border border-amber-200 bg-white p-2 text-xs">
              <div className="font-semibold text-amber-800">{FIELD_LABELS[c.field]}</div>
              {c.from.trim() && <div className="mt-0.5 text-slate-400 line-through">{c.from}</div>}
              <div className="text-slate-800">{c.to}</div>
              <div className="mt-1 text-[11px] text-slate-500">{c.reason}</div>
            </li>
          ))}
        </ul>
      )}
      {!revision.noChangeNeeded && (
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            onClick={onApply}
          >
            Apply revised strategy
          </button>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            onClick={onDismiss}
          >
            Keep current
          </button>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 66 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-600">{pct}%</span>
    </div>
  )
}

function CoherencePanel({ result }: { result: CoherenceResult }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-1.5">
        <ScoreBar label="Internal fit" score={result.internalScore} />
        {result.strategyScore !== null && <ScoreBar label="Serves strategy" score={result.strategyScore} />}
      </div>

      <p className="text-sm font-medium text-slate-800">{result.verdict}</p>

      <div className="grid gap-3 md:grid-cols-2">
        {result.tensions.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Tensions</h4>
            <ul className="mt-1 space-y-1.5">
              {result.tensions.map((t, i) => (
                <li key={i} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-slate-700">
                  <span className="font-semibold text-rose-700">
                    {t.between.map((b) => NODE_TYPE_LABELS[b]).join(' ↔ ')}:{' '}
                  </span>
                  {t.issue}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.strengths.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-green-600">Reinforcing</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {result.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {result.gaps.length > 0 && (
        <p className="text-xs text-slate-500">
          <span className="font-semibold">Gaps:</span> {result.gaps.join(' · ')}
        </p>
      )}

      <div className="rounded-lg bg-indigo-50 p-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Best next change</h4>
        <p className="mt-1 text-sm text-slate-800">
          {result.bestNextChange.componentType && (
            <span className="font-semibold">{NODE_TYPE_LABELS[result.bestNextChange.componentType]}: </span>
          )}
          {result.bestNextChange.change}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{result.bestNextChange.why}</p>
      </div>
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
