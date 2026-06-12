# Opportunity Graph AI

An AI-assisted visual discovery workspace that turns one raw idea into a claim-based opportunity graph, then helps you explore, challenge, research, and validate each node before you build.

**Key product decision:** this is not a generic AI mind map. Every node is a *claim* with an evidence status and a confidence score, and the map's job is to tell you what to validate next.

## Current state: Build 1 — static working prototype

This is Build 1 from the MVP plan: the full UI and interaction model running on **mock AI agents**. The mock agents return deterministic, claim-shaped output that follows the same JSON contracts as the future Supabase Edge Functions, so the whole flow can be exercised end-to-end without API keys. Data persists in `localStorage`.

What works:

- **Start screen** — one textarea, one raw idea, no onboarding form (`Use Example Idea` for a one-click demo).
- **Generated opportunity map** — raw idea + market, customer segment, problem, current alternatives, demand signals, product concept, business model, risks, validation steps. Rendered with React Flow: drag, zoom, connect, select.
- **Node side panel** — edit title/description, set evidence status (assumption → researched / interview / behavioral / payment signal → validated / invalidated), set confidence, see assumptions and linked nodes, delete.
- **Node expansion** — upstream (causes & context), downstream (specifics & tests), lateral (adjacent options).
- **AI agent actions** — Research, Challenge, Validate, Reframe on any selected node. A validation result can be converted into a `validation_step` node with one click.
- **Cross-reference impact** — editing a node's meaning triggers the impact agent; suggested updates to related nodes are shown in a review modal and applied only when you accept them. AI never overwrites your work.
- **Today's Next Step** panel — the single most important unknown and the action to take today.
- **Validation Plan view** — highest-risk assumption, target customer, problem to test, interview questions, pass/fail signals, next action.
- **Filters** — by node type and evidence status; manual node creation.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed URL, click **Use Example Idea**, and explore.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- [React Flow / xyflow](https://reactflow.dev/) for the graph canvas
- Zustand for state, `localStorage` for persistence (Build 1)
- Supabase schema ready in `supabase/migrations/0001_init.sql` (projects, nodes, edges, node_versions, agent_runs, impact_suggestions, evidence_items, with RLS)

## Architecture notes for the next builds

- `src/ai/agents.ts` defines the `AgentService` interface — one method per agent endpoint (`generate-map`, `expand-node`, `research-node`, `challenge-node`, `validate-node`, `reframe-node`, `analyze-impact`).
- `src/ai/mockAgents.ts` is the current implementation. Build 2+ replaces it with `fetch()` calls to Supabase Edge Functions; flip the export in `src/ai/index.ts`. No UI code changes needed.
- `src/types.ts` mirrors both the prompt contracts (agent inputs/outputs) and the Supabase tables.
- `src/store.ts` holds all app logic (graph mutations, versioning, impact suggestion lifecycle). Its `persist()` calls are the seam where the localStorage layer gets swapped for Supabase reads/writes.

Build order from the spec: ① this prototype → ② real `generateInitialMap` Edge Function → ③ real `expandNode` → ④ challenge + validation agents → ⑤ impact agent → ⑥ research agent with web search.

## Product rules encoded in the app

- Every node is a claim, not a label.
- Every AI-generated node starts as `evidence_status = assumption`.
- AI never overwrites related nodes automatically — cross-reference updates are suggestions to accept, edit, or reject.
- The map should always point to one next validation action.
