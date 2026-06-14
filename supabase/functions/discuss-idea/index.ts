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
          kind: { type: 'string', enum: ['lead', 'critic', 'tenx', 'wildcard', 'specialist', 'customer'] },
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

CASTING (you are the casting director - you may add agents on the FIRST turn and on LATER turns):
- kind "specialist": 1-2 domain experts, cast on the first turn, tailored to the idea's domain. Name = professional title (e.g. "Registered Dietitian", "Fleet Operations Manager"). NOT a human name.
- kind "customer": a specific CUSTOMER SEGMENT brought into the room as a persona. The name IS the segment - a concrete, evocative archetype label tailored to THIS idea. Examples: for a nutrition app -> "Late-Night Eater", "Macro-Counting Lifter", "New-Year Resolutioner"; for a logistics idea -> "Owner-Operator Trucker", "Warehouse Shift Lead". NEVER a generic placeholder like "Target Customer" / "Customer Persona", and never a human first name. Each persona speaks ENTIRELY in first person from that exact segment's lived experience - what they do today, what they'd pay for, what they'd ignore, what annoys them. They are NOT an analyst; they never talk about "the market" - only about their own week.
  Cast 2-3 DISTINCT candidate segments as soon as the idea suggests them (often turn 1), each with its own concrete name and its own point of view. Make them DISAGREE where their realities differ - contrasting how different named segments react is the sharpest way to discover which segment to focus on. Cast a fresh segment if the discussion pivots.

ROSTER RULES:
- First turn (no roster given): return the full roster = four fixed members + your specialist(s) + any customer persona(s), each with a unique agent_id.
- Later turns (roster given): return in "roster" ONLY brand-new agents you are adding this turn (usually a new customer persona, or none). Reuse existing agent_ids for everyone already on the roster; never re-list or rename them.

EVERY TURN:
1. Choose 1-3 panel members to speak. Not everyone talks every turn; pick whoever adds the most right now. Bring a customer persona in whenever testing whether the narrowed frame survives contact with the real customer - their lived reaction is the sharpest way to narrow the decision.
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
    ? `Current roster (reuse these agent_ids; in "roster" return ONLY brand-new agents you add this turn, e.g. a customer persona, or none):\n${roster!
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
