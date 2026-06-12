import type { EvidenceStatus, NodeType, RelationshipType } from './types'

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  raw_idea: 'Raw Idea',
  market: 'Market',
  customer_segment: 'Customer Segment',
  problem: 'Problem',
  current_alternative: 'Current Alternative',
  demand_signal: 'Demand Signal',
  product_concept: 'Product Concept',
  business_model: 'Business Model',
  risk: 'Risk',
  validation_step: 'Validation Step',
  experiment: 'Experiment',
  evidence: 'Evidence',
  decision: 'Decision',
}

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  assumption: 'Assumption',
  researched_signal: 'Researched Signal',
  interview_signal: 'Interview Signal',
  behavioral_signal: 'Behavioral Signal',
  payment_signal: 'Payment Signal',
  validated: 'Validated',
  invalidated: 'Invalidated',
}

// Evidence status → color. Gray = assumption, blue = researched/interview,
// yellow = behavioral (needs more), green = payment/validated, red = invalidated.
export const EVIDENCE_STATUS_COLORS: Record<EvidenceStatus, { dot: string; badge: string; border: string }> = {
  assumption: { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700', border: 'border-gray-300' },
  researched_signal: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800', border: 'border-blue-400' },
  interview_signal: { dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-800', border: 'border-sky-400' },
  behavioral_signal: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-400' },
  payment_signal: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-400' },
  validated: { dot: 'bg-green-600', badge: 'bg-green-100 text-green-800', border: 'border-green-500' },
  invalidated: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800', border: 'border-red-500' },
}

export const NODE_TYPE_ACCENTS: Record<NodeType, string> = {
  raw_idea: 'bg-indigo-600',
  market: 'bg-cyan-600',
  customer_segment: 'bg-violet-600',
  problem: 'bg-rose-600',
  current_alternative: 'bg-amber-600',
  demand_signal: 'bg-sky-600',
  product_concept: 'bg-blue-600',
  business_model: 'bg-emerald-600',
  risk: 'bg-red-600',
  validation_step: 'bg-teal-600',
  experiment: 'bg-teal-500',
  evidence: 'bg-lime-600',
  decision: 'bg-purple-600',
}

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'contains',
  'causes',
  'depends_on',
  'supports',
  'contradicts',
  'reframes',
  'validates',
  'invalidates',
  'alternative_to',
  'risk_for',
  'requires_test',
]

export const ALL_NODE_TYPES = Object.keys(NODE_TYPE_LABELS) as NodeType[]
export const ALL_EVIDENCE_STATUSES = Object.keys(EVIDENCE_STATUS_LABELS) as EvidenceStatus[]

export const EXAMPLE_IDEA =
  'I want to create an AI-assisted mind map app for opportunity discovery and demand validation.'
