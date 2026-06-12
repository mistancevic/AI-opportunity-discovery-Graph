import { useState } from 'react'
import { useStore } from '../store'
import { EXAMPLE_IDEA } from '../constants'
import { edgeConfigured } from '../ai'

export function StartScreen() {
  const [idea, setIdea] = useState('')
  const generating = useStore((s) => s.generating)
  const generateError = useStore((s) => s.generateError)
  const generateMap = useStore((s) => s.generateMap)

  const submit = (text: string) => {
    if (!text.trim() || generating) return
    void generateMap(text.trim())
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900">Start with one raw idea.</h1>
        <p className="mt-2 text-slate-500">
          No canvas. No long form. Just describe what you want to explore.
        </p>
        <textarea
          className="mt-6 h-40 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          placeholder="Write your idea..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          disabled={generating}
        />
        <div className="mt-4 flex gap-3">
          <button
            className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!idea.trim() || generating}
            onClick={() => submit(idea)}
          >
            {generating ? 'Generating map…' : 'Generate Opportunity Map'}
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            disabled={generating}
            onClick={() => {
              setIdea(EXAMPLE_IDEA)
              submit(EXAMPLE_IDEA)
            }}
          >
            Use Example Idea
          </button>
        </div>
        {generateError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {generateError}
          </p>
        )}
        <p className="mt-6 text-sm text-slate-400">
          Every generated node is a claim, not a fact. The map's job is to show you what to validate next.
          {!edgeConfigured && ' Running on built-in mock AI — connect Supabase to enable real generation.'}
        </p>
      </div>
    </div>
  )
}
