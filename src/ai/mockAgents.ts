// Mock agent implementation. Returns deterministic, claim-shaped output that
// follows the same JSON contracts as the future Supabase Edge Functions, so
// the whole app can be exercised end-to-end without AI keys.

import type { AgentService } from './agents'
import type {
  DiscussResult,
  ExpandDirection,
  ExpandNodeResult,
  GeneratedNode,
  GenerateMapResult,
  ImpactResult,
  NodeType,
  OppNode,
  PanelAgent,
} from '../types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
let tempCounter = 0
const tempId = () => `tmp_${++tempCounter}_${Date.now()}`

function makeNode(partial: Omit<GeneratedNode, 'tempId' | 'evidenceStatus'>): GeneratedNode {
  return { tempId: tempId(), evidenceStatus: 'assumption', ...partial }
}

// Moderator keeps a human name; everyone else is labeled by their skill title.
const MOCK_ROSTER: PanelAgent[] = [
  { agentId: 'lead', name: 'Maya', role: 'Moderator', perspective: 'Synthesizes and asks the next sharp question', kind: 'lead' },
  { agentId: 'critic', name: 'Critic', role: 'Critic', perspective: 'Attacks weak assumptions', kind: 'critic' },
  { agentId: 'tenx', name: '10x Thinker', role: '10x thinker', perspective: 'Pushes the framing bigger', kind: 'tenx' },
  { agentId: 'wildcard', name: 'Wildcard', role: 'Wildcard', perspective: 'Throws lateral angles', kind: 'wildcard' },
  { agentId: 'spec1', name: 'Domain Specialist', role: 'Domain specialist', perspective: 'Brings domain reality (cast for this idea)', kind: 'specialist' },
]

export const mockAgents: AgentService = {
  async discussIdea(rawIdea, history): Promise<DiscussResult> {
    await delay(700)
    const userTurns = history.filter((m) => m.agentId === 'user').length
    const lastUser = [...history].reverse().find((m) => m.agentId === 'user')?.text ?? ''
    if (userTurns === 0) {
      return {
        roster: MOCK_ROSTER,
        messages: [
          { agentId: 'critic', agentName: 'Critic', text: `"${rawIdea.slice(0, 60)}..." - as stated, everyone and no one is the customer. That worries me.` },
          { agentId: 'spec1', agentName: 'Domain Specialist', text: 'From inside this domain: the people who feel this most are not who founders usually assume.' },
          { agentId: 'lead', agentName: 'Maya', text: 'Let us narrow before we map. Who exactly do you picture using this in week one - and what were they doing about the problem last week?' },
        ],
        readyToMap: false,
        focusBrief: '',
      }
    }
    if (userTurns === 1) {
      // A segment has emerged - cast a customer persona to voice it firsthand.
      return {
        roster: [
          {
            agentId: 'cust1',
            name: 'Target Customer',
            role: 'Customer persona',
            perspective: 'Speaks in first person from lived experience (cast for the emerging segment)',
            kind: 'customer',
          },
        ],
        messages: [
          { agentId: 'tenx', agentName: '10x Thinker', text: 'If that segment is right, what does this look like when 10,000 of them rely on it weekly? That version might be the real product.' },
          { agentId: 'cust1', agentName: 'Target Customer', text: `Honestly? Last week I just muddled through with what I already use. I would not go looking for a new tool unless it saved me real time on day one - and I would not pay upfront.` },
          { agentId: 'lead', agentName: 'Maya', text: `You heard the customer - "saves real time on day one, no upfront pay." What is the angle here that an incumbent with 100x your budget would refuse to copy?` },
        ],
        readyToMap: false,
        focusBrief: `Early focus: ${lastUser.slice(0, 120)}`,
      }
    }
    return {
      roster: [],
      messages: [
        { agentId: 'critic', agentName: 'Critic', text: 'I can live with this framing - it is narrow enough to be testable, which is all I ask.' },
        { agentId: 'lead', agentName: 'Maya', text: 'I think we have a focus: a specific segment, a recent pain, and an angle the big players will not chase. Shall we generate the focused map?' },
      ],
      readyToMap: true,
      focusBrief: `Focus from discussion: ${history
        .filter((m) => m.agentId === 'user')
        .map((m) => m.text)
        .join(' | ')
        .slice(0, 400)}`,
    }
  },

  async generateInitialMap(rawIdea: string): Promise<GenerateMapResult> {
    await delay(900)
    const short = rawIdea.length > 60 ? rawIdea.slice(0, 57) + '…' : rawIdea

    const raw = makeNode({
      nodeType: 'raw_idea',
      title: short || 'Raw idea',
      description: rawIdea,
      confidenceScore: 0.5,
      assumptions: ['This idea is worth exploring before building'],
      suggestedNextAction: 'Expand the customer segment node downstream to find a narrower segment.',
    })
    const market = makeNode({
      nodeType: 'market',
      title: 'AI-assisted product discovery tools',
      description:
        'A growing market of tools that help teams decide what to build, sitting between brainstorming tools and analytics.',
      confidenceScore: 0.4,
      assumptions: ['The market is growing', 'Buyers see discovery as a distinct job'],
      suggestedNextAction: 'Check how crowded the discovery-tool category is.',
    })
    const segment = makeNode({
      nodeType: 'customer_segment',
      title: 'Founders and product teams',
      description:
        'Possible users include founders, product managers, innovation teams, and product coaches who evaluate ideas before building.',
      confidenceScore: 0.45,
      assumptions: ['These users evaluate ideas regularly', 'They feel the pain often enough to adopt a tool'],
      suggestedNextAction: 'Expand downstream to find a narrower first segment.',
    })
    const problem = makeNode({
      nodeType: 'problem',
      title: 'Hard to validate demand before building',
      description:
        'People generate ideas fast but jump from idea to solution too quickly, without structuring market, problem, and demand evidence.',
      confidenceScore: 0.5,
      assumptions: ['Users recognize this as their problem, not just an abstract one'],
      suggestedNextAction: 'Run the Challenge agent on this node.',
    })
    const alternatives = makeNode({
      nodeType: 'current_alternative',
      title: 'ChatGPT, Miro, Notion, spreadsheets, interviews',
      description:
        'Users currently combine general AI chat, whiteboards, docs, spreadsheets, and ad-hoc interviews. Fragmented but free and familiar.',
      confidenceScore: 0.55,
      assumptions: ['The fragmentation is painful enough to switch from'],
      suggestedNextAction: 'List what each alternative fails to do.',
    })
    const signals = makeNode({
      nodeType: 'demand_signal',
      title: 'Search trends, competitor demand, founder pain, paid pilots',
      description:
        'Signals to collect: search volume for validation tools, traction of adjacent tools, founder complaints, willingness to pay for pilots.',
      confidenceScore: 0.3,
      assumptions: ['These signals are observable within weeks'],
      suggestedNextAction: 'Run the Research agent to list concrete signals to check.',
    })
    const concept = makeNode({
      nodeType: 'product_concept',
      title: 'AI opportunity graph with node actions',
      description:
        'A claim-based graph where every node can be expanded, researched, challenged, validated, and reframed, with cross-reference impact suggestions.',
      confidenceScore: 0.45,
      assumptions: ['A graph beats a document for this job'],
      suggestedNextAction: 'Reframe this node to explore adjacent concepts.',
    })
    const model = makeNode({
      nodeType: 'business_model',
      title: 'Subscription, paid validation reports, advisor workflow',
      description:
        'Possible models: monthly workspace subscription, one-off paid validation reports, or a coach/advisor bundle.',
      confidenceScore: 0.3,
      assumptions: ['Users will pay before the idea is validated'],
      suggestedNextAction: 'Test willingness to pay with a pricing question in interviews.',
    })
    const risk = makeNode({
      nodeType: 'risk',
      title: 'Generic AI output, weak evidence, crowded market',
      description:
        'Main risks: the AI produces generic advice, users never attach real evidence, and the category is crowded with AI brainstorming tools.',
      confidenceScore: 0.6,
      assumptions: ['These risks are addressable with claim-based design'],
      suggestedNextAction: 'Run the Challenge agent on the product concept.',
    })
    const validation = makeNode({
      nodeType: 'validation_step',
      title: 'Interviews, landing page, concierge test',
      description:
        'First tests: 10 problem interviews with the narrowed segment, a landing page measuring sign-ups, and a concierge validation run.',
      confidenceScore: 0.4,
      assumptions: ['10 interviews are enough for a directional signal'],
      suggestedNextAction: 'Run the Validate agent to turn this into a concrete test.',
    })

    const nodes = [raw, market, segment, problem, alternatives, signals, concept, model, risk, validation]
    const edge = (s: GeneratedNode, t: GeneratedNode, rel: GenerateMapResult['edges'][number]['relationshipType'], why: string) => ({
      sourceTempId: s.tempId,
      targetTempId: t.tempId,
      relationshipType: rel,
      explanation: why,
    })

    return {
      projectTitle: short || 'New opportunity',
      summary:
        'Initial opportunity map generated from the raw idea. Every node is an unvalidated claim — start by narrowing the customer segment.',
      nodes,
      edges: [
        edge(raw, market, 'contains', 'The idea exists inside this market context.'),
        edge(raw, segment, 'contains', 'The idea targets this customer group.'),
        edge(raw, problem, 'contains', 'The idea addresses this problem.'),
        edge(raw, concept, 'contains', 'The idea takes shape as this concept.'),
        edge(segment, problem, 'supports', 'The segment is assumed to feel this problem.'),
        edge(problem, alternatives, 'alternative_to', 'These are how the problem is solved today.'),
        edge(problem, signals, 'requires_test', 'Demand signals would confirm the problem is real.'),
        edge(concept, model, 'depends_on', 'The concept needs a viable model.'),
        edge(risk, concept, 'risk_for', 'These risks threaten the concept.'),
        edge(validation, problem, 'validates', 'These steps test the problem claim.'),
        edge(validation, segment, 'validates', 'These steps test the segment claim.'),
      ],
      todayNextStep: {
        biggestUnknown: 'Does the target segment care enough about validating ideas to use a dedicated tool weekly?',
        suggestedAction: 'Interview 5 people in the segment who recently considered building something new.',
        whyItMatters: 'This validates the customer/problem branch before investing in product features.',
      },
    }
  },

  async expandNode(node, direction, projectContext): Promise<ExpandNodeResult> {
    await delay(700)
    const suggestions = expansionLibrary(node, direction)
    const existing = new Set(projectContext.existingTitles.map((t) => t.toLowerCase()))
    const fresh = suggestions.filter((s) => !existing.has(s.title.toLowerCase()))
    return {
      newNodes: fresh,
      newEdges: fresh.map((n) => ({
        sourceTempId: '__selected__', // replaced with the real node id by the store
        targetTempId: n.tempId,
        relationshipType: direction === 'upstream' ? 'causes' : direction === 'lateral' ? 'alternative_to' : 'contains',
        explanation:
          direction === 'upstream'
            ? `Context or cause behind "${node.title}".`
            : direction === 'lateral'
              ? `Adjacent option to "${node.title}".`
              : `More specific version of "${node.title}".`,
      })),
      summary: `Expanded "${node.title}" ${direction}. Each suggestion is a claim — keep only the ones worth testing.`,
    }
  },

  async researchNode(node) {
    await delay(800)
    return {
      researchSummary: `Research angles for "${node.title}". In the MVP these are AI-generated directions to investigate manually; a web-search agent can attach real sources later.`,
      possibleSignals: [
        'Search volume and trend for the core problem keywords',
        'Activity in founder/PM communities about this exact pain',
        'Traction and pricing of the closest existing tools',
        'People paying for consultants or courses to solve this today',
      ],
      currentAlternatives: [
        'General AI chat (ChatGPT) used ad hoc',
        'Whiteboards and docs (Miro, Notion)',
        'Spreadsheets with manual scoring',
        'Direct customer interviews without structure',
      ],
      openQuestions: [
        `Who exactly feels "${node.title}" most acutely?`,
        'How often does the pain occur — weekly or once a year?',
        'What budget exists for solving it?',
      ],
      weakSignals: ['Generic interest ("sounds cool")', 'Upvotes without follow-up behavior'],
      strongSignalsToValidate: [
        'A recent, specific story of the pain occurring',
        'An existing paid workaround',
        'Willingness to commit time or money to a pilot',
      ],
      nextAction: `Pick one possible signal and spend 30 minutes checking it, then attach the result as evidence on "${node.title}".`,
    }
  },

  async challengeNode(node) {
    await delay(800)
    return {
      challengeSummary: `Stress test for "${node.title}": the claim may be too broad, not urgent, or already solved well enough by free tools.`,
      objections: [
        'The target user may not feel this pain often enough to adopt a new tool.',
        'Free general-purpose tools may be "good enough", making switching costs the real competitor.',
        'The claim may describe what users should want, not what they actually do.',
      ],
      criticalAssumptions: [
        'The pain recurs frequently (weekly, not yearly).',
        'Users already try to solve it with a workaround.',
        'The user, not someone else, owns the decision and budget.',
      ],
      contradictingSignalsToCheck: [
        'Users describing the problem but never having tried any workaround',
        'Churn patterns in adjacent discovery tools',
      ],
      riskLevel: node.evidenceStatus === 'assumption' ? 'high' : 'medium',
      suggestedTests: [
        {
          testName: 'Recent-pain interview',
          howToRun: 'Ask 5 target users: "Tell me about the last time this happened to you."',
          passSignal: 'They describe a specific, recent situation with a workaround they tried.',
          failSignal: 'They speak only in generalities and cannot recall a concrete instance.',
        },
        {
          testName: 'Workaround audit',
          howToRun: 'Ask what they currently use and what it costs them in time or money.',
          passSignal: 'A real workaround exists and is painful or expensive.',
          failSignal: 'No workaround — the pain may not be real enough.',
        },
      ],
    }
  },

  async validateNode(node) {
    await delay(800)
    return {
      validationGoal: `Test whether "${node.title}" holds with real users before building on it.`,
      testType: 'interview',
      targetUser: 'People in the narrowed customer segment who faced this situation in the last 30 days',
      scriptOrSteps: [
        'Recruit 10 people matching the segment (communities, LinkedIn, warm intros).',
        'Core question: "Tell me about the last idea you almost built but did not."',
        'Probe for: recent pain, current workaround, time or money already spent.',
        'Close with: "If a tool gave you a clear next validation step, what would that be worth?"',
        'Log every answer as an evidence item on this node.',
      ],
      passSignal: 'At least 6 of 10 describe recent pain, a current workaround, and willingness to pay for clarity.',
      failSignal: 'Most say the idea is interesting but cannot describe a recent, real situation.',
      timebox: '1 week',
    }
  },

  async reframeNode(node) {
    await delay(700)
    return {
      reframes: [
        {
          title: `Demand validation graph for founders`,
          whyItMatters: 'Positions the product around the outcome (validated demand) instead of the artifact (mind map).',
        },
        {
          title: 'Opportunity evidence board for product teams',
          whyItMatters: 'Centers evidence collection, which differentiates from brainstorming tools.',
        },
        {
          title: 'Decision map for what to test next',
          whyItMatters: 'Frames the product as a daily decision aid rather than a planning document.',
        },
        {
          title: `${node.title} — as a coached workflow`,
          whyItMatters: 'Explores a service-led wedge: coaches use the graph with clients before self-serve.',
        },
      ],
    }
  },

  async analyzeImpact(before, after, relatedNodes): Promise<ImpactResult> {
    await delay(900)
    const dependentTypes: NodeType[] = [
      'problem',
      'current_alternative',
      'demand_signal',
      'business_model',
      'validation_step',
    ]
    const affected = relatedNodes
      .filter((n) => n.id !== after.id && dependentTypes.includes(n.nodeType))
      .slice(0, 5)
      .map((n) => ({
        nodeId: n.id,
        impactType: 'update' as const,
        suggestedTitle: null,
        suggestedDescription: suggestUpdate(n, before, after),
        reason: `"${n.title}" was written against "${before.title}". The change to "${after.title}" may make it stale.`,
        confidenceScore: 0.6,
      }))
    return {
      impactSummary: affected.length
        ? `You changed "${before.title}" → "${after.title}". ${affected.length} related node(s) may need updates.`
        : 'No related nodes appear to be affected by this change.',
      affectedNodes: affected,
    }
  },
}

function suggestUpdate(node: OppNode, before: OppNode, after: OppNode): string {
  switch (node.nodeType) {
    case 'problem':
      return `Rewrite the problem from the perspective of "${after.title}": what do they specifically struggle with that "${before.title}" did not?`
    case 'current_alternative':
      return `Re-list the alternatives "${after.title}" actually use today — they likely differ from those of "${before.title}".`
    case 'demand_signal':
      return `Refocus demand signals on where "${after.title}" gather and what they search for.`
    case 'business_model':
      return `Reconsider pricing and packaging for "${after.title}" — their budget and buying process may differ.`
    case 'validation_step':
      return `Update the validation step to recruit and interview "${after.title}" instead of "${before.title}".`
    default:
      return `Review "${node.title}" against the change from "${before.title}" to "${after.title}".`
  }
}

function expansionLibrary(node: OppNode, direction: ExpandDirection): GeneratedNode[] {
  const mk = (nodeType: NodeType, title: string, description: string) =>
    makeNode({
      nodeType,
      title,
      description,
      confidenceScore: 0.3,
      assumptions: [],
      suggestedNextAction: 'Decide whether this claim is worth testing; delete it if not.',
    })

  if (direction === 'downstream') {
    switch (node.nodeType) {
      case 'customer_segment':
        return [
          mk('customer_segment', 'First-time startup founders', 'Founders on their first venture; high idea volume, low validation experience.'),
          mk('customer_segment', 'Solo AI app builders', 'Individuals shipping AI apps alone; many ideas, scarce time, money on the line.'),
          mk('customer_segment', 'Product managers in B2B SaaS', 'PMs who must justify roadmap bets with discovery evidence.'),
          mk('customer_segment', 'Product discovery coaches', 'Coaches who run discovery with client teams and need a shared artifact.'),
        ]
      case 'problem':
        return [
          mk('problem', 'No criteria for which idea deserves MVP effort', 'Users cannot rank competing ideas by evidence, so they pick by excitement.'),
          mk('problem', 'Interest is mistaken for demand', 'Positive comments are treated as validation; behavior and payment are not measured.'),
          mk('experiment', 'Idea triage checklist test', 'Give 5 users a simple evidence checklist and observe whether it changes their decision.'),
        ]
      case 'validation_step':
        return [
          mk('experiment', '10 problem interviews', 'Recruit 10 segment members; ask about the last idea they almost built.'),
          mk('experiment', 'Landing page smoke test', 'One-page value proposition; measure email sign-ups against 100 targeted visitors.'),
          mk('experiment', 'Concierge validation run', 'Manually produce one validation report for a real founder and observe usage.'),
        ]
      default:
        return [
          mk(node.nodeType, `${node.title} — narrowest credible version`, 'The most specific, testable version of this claim.'),
          mk(node.nodeType, `${node.title} — first observable example`, 'A concrete instance you could point to this week.'),
          mk('experiment', `Smallest test of "${node.title}"`, 'The cheapest experiment that could falsify this claim.'),
        ]
    }
  }

  if (direction === 'upstream') {
    return [
      mk('market', 'AI made idea generation cheap', 'Generating plausible ideas now costs minutes, shifting the bottleneck to validation.'),
      mk('problem', 'No clear validation workflow exists', 'Discovery advice is scattered across books, threads, and courses; nothing operationalizes it.'),
      mk('problem', 'Interest is confused with demand', 'Founders treat engagement as proof, leading to unvalidated builds.'),
      mk('market', 'Existing discovery tools are fragmented', 'Whiteboards, docs, and chat each hold a piece; nothing connects claims to evidence.'),
    ]
  }

  // lateral
  return [
    mk('product_concept', 'AI validation assistant', 'A chat-first assistant that walks users through validation steps without a graph.'),
    mk('product_concept', 'Discovery interview generator', 'Generates interview scripts and synthesizes transcripts into evidence.'),
    mk('product_concept', 'Evidence board', 'A kanban of claims by evidence status, without graph visualization.'),
    mk('product_concept', 'Market signal scanner', 'Monitors search and community signals for a chosen problem space.'),
  ]
}
