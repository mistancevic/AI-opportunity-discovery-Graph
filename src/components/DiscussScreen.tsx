import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { PanelAgentKind } from '../types'

const KIND_STYLES: Record<PanelAgentKind, { chip: string; bubble: string }> = {
  lead: { chip: 'bg-indigo-600', bubble: 'border-indigo-200 bg-indigo-50' },
  critic: { chip: 'bg-rose-600', bubble: 'border-rose-200 bg-rose-50' },
  tenx: { chip: 'bg-emerald-600', bubble: 'border-emerald-200 bg-emerald-50' },
  wildcard: { chip: 'bg-amber-500', bubble: 'border-amber-200 bg-amber-50' },
  specialist: { chip: 'bg-cyan-600', bubble: 'border-cyan-200 bg-cyan-50' },
  customer: { chip: 'bg-fuchsia-600', bubble: 'border-fuchsia-200 bg-fuchsia-50' },
}

export function DiscussScreen() {
  const discussion = useStore((s) => s.discussion)
  const panelBusy = useStore((s) => s.panelBusy)
  const panelError = useStore((s) => s.panelError)
  const generating = useStore((s) => s.generating)
  const generateError = useStore((s) => s.generateError)
  const sendPanelMessage = useStore((s) => s.sendPanelMessage)
  const generateMap = useStore((s) => s.generateMap)
  const setView = useStore((s) => s.setView)

  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const messageCount = discussion?.messages.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageCount, panelBusy])

  if (!discussion) return null

  const kindOf = (agentId: string): PanelAgentKind | null =>
    discussion.roster.find((a) => a.agentId === agentId)?.kind ?? null

  const send = () => {
    if (!draft.trim() || panelBusy || generating) return
    void sendPanelMessage(draft)
    setDraft('')
  }

  const busy = panelBusy || generating

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <span className="font-semibold text-indigo-700">Discovery Panel</span>
        <span className="truncate text-sm text-slate-500">{discussion.rawIdea}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              discussion.readyToMap ? 'animate-pulse bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-400 hover:bg-indigo-500'
            }`}
            disabled={busy}
            title={
              discussion.readyToMap
                ? 'The panel agrees the focus is clear'
                : 'You can generate anytime; the panel will use whatever focus exists so far'
            }
            onClick={() => void generateMap(discussion.rawIdea, discussion.focusBrief || undefined)}
          >
            {generating ? 'Generating map…' : 'Generate focused map'}
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            disabled={busy}
            onClick={() => setView('start')}
          >
            Back
          </button>
        </div>
      </header>

      {discussion.roster.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
          {discussion.roster.map((a) => (
            <span
              key={a.agentId}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-1 pr-2.5 text-xs text-slate-700"
              title={`${a.role} — ${a.perspective}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${KIND_STYLES[a.kind].chip}`}
              >
                {a.name[0]}
              </span>
              {a.name}
              {a.kind === 'specialist' && <span className="text-slate-400">· cast for this idea</span>}
              {a.kind === 'customer' && <span className="text-fuchsia-500">· customer voice</span>}
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {discussion.messages.map((m, i) =>
            m.agentId === 'user' ? (
              <div key={i} className="self-end rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white shadow-sm">
                {m.text}
              </div>
            ) : (
              <div
                key={i}
                className={`max-w-[85%] self-start rounded-2xl rounded-bl-sm border px-4 py-2 shadow-sm ${
                  KIND_STYLES[kindOf(m.agentId) ?? 'lead'].bubble
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{m.agentName}</div>
                <div className="mt-0.5 text-sm text-slate-800">{m.text}</div>
              </div>
            ),
          )}
          {panelBusy && (
            <div className="self-start rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 shadow-sm">
              The panel is thinking…
            </div>
          )}
          {(panelError || generateError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {panelError || generateError}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {discussion.focusBrief && (
        <div className="border-t border-slate-200 bg-indigo-50/60 px-4 py-2">
          <div className="mx-auto max-w-3xl text-xs text-slate-600">
            <span className="font-semibold text-indigo-700">Focus so far:</span> {discussion.focusBrief}
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Answer the panel, push back, or steer the discussion…"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            disabled={!draft.trim() || busy}
            onClick={send}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
