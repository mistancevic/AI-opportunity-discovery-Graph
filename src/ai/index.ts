// Single switch point between mock agents and Supabase Edge Functions.
// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, real AI map
// generation is used (Build 2); everything else still runs on mocks until
// its Edge Function ships. Without env config the whole app runs on mocks.

import { mockAgents } from './mockAgents'
import { edgeAgents, edgeConfigured } from './edgeAgents'
import type { AgentService } from './agents'

export const agents: AgentService = edgeConfigured ? edgeAgents : mockAgents
export { edgeConfigured }
