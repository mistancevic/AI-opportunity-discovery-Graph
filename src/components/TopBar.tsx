import { useStore } from '../store'

export function TopBar() {
  const project = useStore((s) => s.project)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const resetProject = useStore((s) => s.resetProject)
  const pending = useStore((s) => s.suggestions.filter((x) => x.status === 'pending').length)
  const impactChecking = useStore((s) => s.impactChecking)
  const openImpactModal = useStore((s) => s.openImpactModal)
  const autoArrange = useStore((s) => s.autoArrange)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <span className="font-semibold text-indigo-700">Opportunity Graph AI</span>
      <span className="truncate text-sm text-slate-500">{project?.title}</span>
      <div className="ml-auto flex items-center gap-2">
        {impactChecking && (
          <span className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            Analyzing impact…
          </span>
        )}
        {pending > 0 && (
          <button
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
            onClick={() => openImpactModal(true)}
          >
            {pending} impact suggestion{pending > 1 ? 's' : ''}
          </button>
        )}
        {view === 'graph' && (
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            title="Re-arrange all nodes into a clean layered layout"
            onClick={autoArrange}
          >
            Auto-arrange
          </button>
        )}
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            view === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setView('graph')}
        >
          Map
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            view === 'validation_plan' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setView('validation_plan')}
        >
          Validation Plan
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          onClick={() => {
            if (confirm('Start over with a new idea? The current map will be cleared.')) resetProject()
          }}
        >
          New Idea
        </button>
      </div>
    </header>
  )
}
