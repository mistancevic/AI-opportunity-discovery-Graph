import { useStore } from '../store'
import type { AgentActionResult } from '../types'

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="mt-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

export function AgentResultPanel({ nodeId, result }: { nodeId: string; result: AgentActionResult }) {
  const clearAgentResult = useStore((s) => s.clearAgentResult)
  const createValidationStepFromResult = useStore((s) => s.createValidationStepFromResult)
  const addManualNode = useStore((s) => s.addManualNode)

  return (
    <div className="border-b border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          {result.kind === 'research' && 'Research result'}
          {result.kind === 'challenge' && 'Challenge result'}
          {result.kind === 'validate' && 'Validation plan'}
          {result.kind === 'reframe' && 'Reframes'}
        </h3>
        <button className="text-xs text-slate-400 hover:text-slate-600" onClick={clearAgentResult}>
          Dismiss
        </button>
      </div>

      {result.kind === 'research' && (
        <>
          <p className="mt-2 text-xs text-slate-600">{result.data.researchSummary}</p>
          <Section title="Possible demand signals" items={result.data.possibleSignals} />
          <Section title="Current alternatives" items={result.data.currentAlternatives} />
          <Section title="Weak signals (don't trust)" items={result.data.weakSignals} />
          <Section title="Strong signals to validate" items={result.data.strongSignalsToValidate} />
          <Section title="Open questions" items={result.data.openQuestions} />
          <p className="mt-3 rounded-lg bg-indigo-100 p-2 text-xs text-indigo-800">
            <span className="font-semibold">Next action:</span> {result.data.nextAction}
          </p>
        </>
      )}

      {result.kind === 'challenge' && (
        <>
          <p className="mt-2 text-xs text-slate-600">{result.data.challengeSummary}</p>
          <p className="mt-2 text-xs">
            <span className="font-semibold text-slate-500">Risk level:</span>{' '}
            <span
              className={
                result.data.riskLevel === 'high'
                  ? 'font-semibold text-red-600'
                  : result.data.riskLevel === 'medium'
                    ? 'font-semibold text-amber-600'
                    : 'font-semibold text-green-600'
              }
            >
              {result.data.riskLevel}
            </span>
          </p>
          <Section title="Objections" items={result.data.objections} />
          <Section title="Critical assumptions" items={result.data.criticalAssumptions} />
          <Section title="Contradicting signals to check" items={result.data.contradictingSignalsToCheck} />
          <div className="mt-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested tests</h4>
            {result.data.suggestedTests.map((t, i) => (
              <div key={i} className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                <p className="font-semibold text-slate-700">{t.testName}</p>
                <p className="mt-1 text-slate-600">{t.howToRun}</p>
                <p className="mt-1 text-green-700">Pass: {t.passSignal}</p>
                <p className="text-red-600">Fail: {t.failSignal}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {result.kind === 'validate' && (
        <>
          <p className="mt-2 text-xs font-medium text-slate-700">{result.data.validationGoal}</p>
          <p className="mt-1 text-xs text-slate-500">
            {result.data.testType.replace(/_/g, ' ')} · {result.data.targetUser} · {result.data.timebox}
          </p>
          <Section title="Steps" items={result.data.scriptOrSteps} />
          <p className="mt-2 text-xs text-green-700">Pass: {result.data.passSignal}</p>
          <p className="text-xs text-red-600">Fail: {result.data.failSignal}</p>
          <button
            className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            onClick={() => createValidationStepFromResult(nodeId)}
          >
            Create validation step node
          </button>
        </>
      )}

      {result.kind === 'reframe' && (
        <div className="mt-2 space-y-2">
          {result.data.reframes.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
              <p className="font-semibold text-slate-700">{r.title}</p>
              <p className="mt-1 text-slate-500">{r.whyItMatters}</p>
              <button
                className="mt-2 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                onClick={() => addManualNode('product_concept', r.title)}
              >
                Add as node
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
