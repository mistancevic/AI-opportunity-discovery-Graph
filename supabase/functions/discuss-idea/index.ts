// POST /functions/v1/discuss-idea
// Body: {
//   raw_idea: string,
//   roster: PanelAgent[] | null,   // null on the first turn -> casting runs
//   history: [{ speaker: string, text: string }]  // speaker: "user" or agent name
// }
// Returns one panel turn: { roster, messages, ready_to_map, focus_brief }
//
// The panel: a lead facilitator, three fixed perspectives (critic, 10x,
// wildcard), and 1-2 temporary domain specialists cast on the first turn.
// Its job is to narrow a raw idea into a differentiated focus (segment,
// problem, blue-ocean angle) before the opportunity map is generated.
//
// Deploy:  supabase functions deploy discuss-idea

import { callClaudeJSON, errorResponse, jsonResponse, readJSONBody } from '../_shared/claude.ts'

const DISCUSS_SCHEMA = {
  type: 'object',
  properties: {
    roster: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          perspective: { type: 'string' },
          kind: { type: 'string', enum: ['lead', 'critic', 'tenx', 'wildcard', 'specialist'] },
        },
        required: ['agent_id', 'name', 'role', 'perspective', 'kind'],
        additionalProperties: false,
      },
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['agent_id', 'text'],
        additionalProperties: false,
      },
    },
    ready_to_map: { type: 'boolean' },
    focus_brief: { type: 'string' },
  },
  required: ['roster', 'messages', 'ready_to_map', 'focus_brief'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You run a discovery panel that helps a founder narrow one raw idea into a focused, differentiated opportunity BEFORE it gets mapped. The goal is a blue-ocean focus: exact customer, sharpest pain, and an angle incumbents will not copy - not a broad inventory of everything.

NAMING RULE (important):
- The lead (moderator) is the only member with a human first name (e.g. "Maya"). The user should always know the moderator is a person guiding the room.
- EVERY other member's "name" is their SKILL TITLE, not a human name - so the user instantly knows which expertise is speaking. Use: "Critic", "10x Thinker", "Wildcard", and for specialists their professional title (e.g. "Registered Dietitian", "Fleet Operations Manager"). Never give these members human first names.

PANEL MEMBERS (fixed):
- kind "lead": name = a human first name. Facilitates. Synthesizes what was said, asks ONE sharp question at a time, proposes a focus when it emerges.
- kind "critic": name = "Critic". Attacks weak assumptions and vague segments. Short, pointed.
- kind "tenx": name = "10x Thinker". Pushes the framing 10x bigger - what is the version of this that matters at scale?
- kind "wildcard": name = "Wildcard". Throws one unexpected lateral angle - adjacent market, inverted business model, unusual wedge.

CASTING (first turn only, when no roster is given):
You are also the casting director. Invent 1-2 TEMPORARY specialist agents (kind "specialist") tailored to this idea's specific domain. Their name is their professional title (e.g. "Registered Dietitian" for a nutrition app, "Fleet Operations Manager" for a logistics idea) - NOT a human name. Give each a role and a one-line perspective. Include the four fixed members plus your specialists in the roster, each with a unique agent_id. On later turns (roster provided), return an empty roster array and reuse the given agent_ids.

EVERY TURN:
1. Choose 1-3 panel members to speak. Not everyone talks every turn; pick whoever adds the most right now. Specialists speak when domain reality matters.
2. Each message is 1-3 conversational sentences. No lists, no headers, no lectures.
3. The lead ALWAYS speaks last, ending with exactly one question or one concrete proposal to the user.
4. Never re-ask something the user already answered. Build on their words.
5. Maintain focus_brief: a running 2-4 sentence synthesis of what is agreed so far (segment, problem, differentiating angle). Update it every turn.
6. Set ready_to_map = true once segment + problem + a differentiated angle are reasonably clear - typically after 2-4 user replies. Converging beats completeness; do not drag the discussion out. When ready, the lead's final message should propose generating the focused map.`

interface WireRosterAgent {
  agent_id?: string
  name?: string
  role?: string
  perspective?: string
  kind?: string
}

Deno.serve(async (req) => {
  const parsed = await readJSONBody(req)
  if (!parsed.ok) return parsed.response
  const { raw_idea, roster, history } = parsed.body as {
    raw_idea?: string
    roster?: WireRosterAgent[] | null
    history?: { speaker?: string; text?: string }[]
  }

  if (typeof raw_idea !== 'string' || !raw_idea.trim()) {
    return errorResponse(400, 'raw_idea must be a non-empty string')
  }
  const turns = (history ?? [])
    .filter((h) => typeof h.text === 'string' && h.text.trim())
    .slice(-40) // keep the prompt bounded on long discussions
  const hasRoster = Array.isArray(roster) && roster.length > 0

  const rosterBlock = hasRoster
    ? `Current roster (reuse these agent_ids; return an empty roster array):\n${roster!
        .map((a) => `- ${a.agent_id} | ${a.name} | ${a.kind} | ${a.role}`)
        .join('\n')}`
    : 'No roster yet - this is the FIRST turn. Run the casting step and open the discussion.'

  const historyBlock = turns.length
    ? `Discussion so far:\n${turns.map((h) => `${h.speaker}: ${h.text}`).join('\n')}`
    : 'No discussion yet.'

  const userPrompt = `Raw idea:
${raw_idea.trim()}

${rosterBlock}

${historyBlock}

Produce the next panel turn.`

  const result = await callClaudeJSON({
    system: SYSTEM_PROMPT,
    userPrompt,
    schema: DISCUSS_SCHEMA,
    effort: 'medium',
    label: 'discuss-idea',
  })
  if (!result.ok) return result.response

  const data = result.data as { messages?: unknown[] }
  if (!Array.isArray(data.messages) || data.messages.length === 0) {
    return errorResponse(502, 'The panel returned no messages. Please try again.')
  }
  return jsonResponse(result.data)
})
