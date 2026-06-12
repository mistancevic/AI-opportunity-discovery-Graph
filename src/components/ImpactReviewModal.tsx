import { useState } from 'react'
import { useStore } from '../store'
import { NODE_TYPE_LABELS } from '../constants'

export function ImpactReviewModal() {
  const allSuggestions = useStore((s) => s.suggestions)
  const suggestions = allSuggestions.filter((x) => x.status === 'pending')
  const nodes = useStore((s) => s.nodes)
  const resolveSuggestion = useStore((s) => s.resolveSuggestion)
  const openImpactModal = useStore((s) => s.openImpactModal)
  const [edits, setEdits] = useState<Record<string, string>>({})

  const changedNode = suggestions[0] ? nodes.find((n) => n.id === suggestions[0].changedNodeId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Cross-reference impact</h2>
          {changedNode && (
            <p className="mt-1 text-sm text-slate-500">
              You changed <span className="font-medium text-slate-700">"{changedNode.title}"</span>. These related
              nodes may need updates. Nothing is changed without your approval.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {suggestions.length === 0 && <p className="text-sm text-slate-500">All suggestions reviewed.</p>}
          {suggestions.map((sg) => {
            const affected = nodes.find((n) => n.id === sg.affectedNodeId)
            if (!affected) return null
            return (
              <div key={sg.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                    {NODE_TYPE_LABELS[affected.nodeType]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      sg.impactType === 'contradiction'
                        ? 'bg-red-100 text-red-700'
                        : sg.impactType === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : sg.impactType === 'opportunity'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {sg.impactType}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800">{affected.title}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{sg.reason}</p>
                <textarea
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700"
                  rows={3}
                  value={edits[sg.id] ?? sg.suggestedDescription ?? ''}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [sg.id]: e.target.value }))}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    onClick={() =>
                      resolveSuggestion(
                        sg.id,
                        'accepted',
                        edits[sg.id] !== undefined && edits[sg.id] !== sg.suggestedDescription ? edits[sg.id] : undefined,
                      )
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => resolveSuggestion(sg.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-slate-200 p-4 text-right">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => openImpactModal(false)}
          >
            Close — review later
          </button>
        </div>
      </div>
    </div>
  )
}
