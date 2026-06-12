import { useStore } from '../store'
import { TopBar } from './TopBar'
import { EVIDENCE_STATUS_COLORS, EVIDENCE_STATUS_LABELS } from '../constants'

export function ValidationPlanView() {
  const project = useStore((s) => s.project)
  const nodes = useStore((s) => s.nodes)
  const setView = useStore((s) => s.setView)
  const selectNode = useStore((s) => s.selectNode)

  // Highest-risk assumption: lowest confidence node still at 'assumption'.
  const assumptions = nodes
    .filter((n) => n.evidenceStatus === 'assumption' && n.nodeType !== 'raw_idea')
    .sort((a, b) => a.confidenceScore - b.confidenceScore)
  const highestRisk = assumptions[0]
  const segment = nodes.find((n) => n.nodeType === 'customer_segment')
  const problem = nodes.find((n) => n.nodeType === 'problem')
  const validationSteps = nodes.filter((n) => n.nodeType === 'validation_step' || n.nodeType === 'experiment')

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <TopBar />
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900">Validation Plan</h1>
        <p className="mt-1 text-sm text-slate-500">Generated from the current state of the map.</p>

        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-red-700">1 · Highest-risk assumption</h2>
          {highestRisk ? (
            <>
              <p className="mt-2 font-medium text-slate-800">{highestRisk.title}</p>
              <p className="mt-1 text-sm text-slate-600">{highestRisk.description}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No unvalidated assumptions left — update evidence statuses as you learn.</p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">2 · Target customer</h2>
          <p className="mt-2 text-sm text-slate-700">{segment?.title ?? 'Not defined yet — add a customer segment node.'}</p>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">3 · Problem to test</h2>
          <p className="mt-2 text-sm text-slate-700">{problem?.title ?? 'Not defined yet — add a problem node.'}</p>
          {problem && <p className="mt-1 text-xs text-slate-500">{problem.description}</p>}
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">4 · Interview questions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
            <li>Tell me about the last time {problem ? `"${problem.title.toLowerCase()}"` : 'this problem'} happened to you.</li>
            <li>What did you do about it? What did that cost you in time or money?</li>
            <li>What have you tried before? Why did you stop?</li>
            <li>If this were solved, what would change for you next week?</li>
          </ul>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-green-700">5 · Pass signal</h2>
            <p className="mt-2 text-sm text-slate-700">
              They describe recent, specific pain, a workaround they already use, and willingness to commit time or money.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700">6 · Fail signal</h2>
            <p className="mt-2 text-sm text-slate-700">
              They say it is interesting but cannot recall a recent real situation or any attempt to solve it.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-indigo-700">7 · Next action</h2>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {project?.todayNextStep?.suggestedAction ?? 'Generate a map to get a suggested next action.'}
          </p>
          {project?.todayNextStep && <p className="mt-1 text-xs text-slate-500">{project.todayNextStep.whyItMatters}</p>}
        </section>

        {validationSteps.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Validation steps on the map</h2>
            <ul className="mt-2 space-y-2">
              {validationSteps.map((n) => (
                <li key={n.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      selectNode(n.id)
                      setView('graph')
                    }}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${EVIDENCE_STATUS_COLORS[n.evidenceStatus].dot}`} />
                    <span className="font-medium text-slate-800">{n.title}</span>
                    <span className="ml-auto text-xs text-slate-400">{EVIDENCE_STATUS_LABELS[n.evidenceStatus]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
