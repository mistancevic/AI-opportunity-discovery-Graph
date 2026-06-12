// Single switch point between mock agents and real Supabase Edge Functions.
// When the Edge Functions exist, implement AgentService with fetch() calls
// to /functions/v1/<endpoint> and flip the export here.

import { mockAgents } from './mockAgents'
import type { AgentService } from './agents'

export const agents: AgentService = mockAgents
