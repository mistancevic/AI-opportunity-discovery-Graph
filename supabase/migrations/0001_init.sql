-- Opportunity Graph AI — initial schema.
-- Apply with the Supabase CLI (supabase db push) once a Supabase project is linked.

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null,
  raw_idea text not null,
  today_next_step jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_node_id uuid references nodes(id) on delete set null,
  node_type text not null check (node_type in (
    'raw_idea','market','customer_segment','problem','current_alternative',
    'demand_signal','product_concept','business_model','risk','validation_step',
    'experiment','evidence','decision'
  )),
  title text not null,
  description text not null default '',
  evidence_status text not null default 'assumption' check (evidence_status in (
    'assumption','researched_signal','interview_signal','behavioral_signal',
    'payment_signal','validated','invalidated'
  )),
  confidence_score numeric not null default 0.3 check (confidence_score between 0 and 1),
  assumptions jsonb not null default '[]',
  reasoning text not null default '',
  suggested_next_action text not null default '',
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  created_by text not null default 'ai' check (created_by in ('user','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_node_id uuid not null references nodes(id) on delete cascade,
  target_node_id uuid not null references nodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'contains','causes','depends_on','supports','contradicts','reframes',
    'validates','invalidates','alternative_to','risk_for','requires_test'
  )),
  strength numeric not null default 0.5 check (strength between 0 and 1),
  explanation text not null default '',
  created_by text not null default 'ai' check (created_by in ('user','ai')),
  created_at timestamptz not null default now()
);

create table node_versions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references nodes(id) on delete cascade,
  version_number integer not null,
  title text not null,
  description text not null,
  evidence_status text not null,
  confidence_score numeric not null,
  change_reason text not null default '',
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  node_id uuid references nodes(id) on delete set null,
  agent_type text not null check (agent_type in (
    'map_generator','node_expander','research_agent','challenge_agent',
    'validation_agent','reframe_agent','impact_agent','synthesis_agent'
  )),
  input jsonb not null default '{}',
  output jsonb,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  created_at timestamptz not null default now()
);

create table impact_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  changed_node_id uuid not null references nodes(id) on delete cascade,
  affected_node_id uuid not null references nodes(id) on delete cascade,
  suggested_change jsonb not null default '{}',
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected','edited')),
  created_at timestamptz not null default now()
);

create table evidence_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  node_id uuid not null references nodes(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'internet_signal','interview_quote','survey_result','waitlist_signup',
    'payment_signal','usage_signal','manual_note'
  )),
  source_title text not null default '',
  source_url text,
  quote text,
  summary text not null default '',
  strength text not null default 'weak' check (strength in ('weak','medium','strong')),
  created_at timestamptz not null default now()
);

-- Row level security: users only see their own projects and child rows.
alter table projects enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table node_versions enable row level security;
alter table agent_runs enable row level security;
alter table impact_suggestions enable row level security;
alter table evidence_items enable row level security;

create policy "own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own nodes" on nodes for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "own edges" on edges for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "own node_versions" on node_versions for all
  using (exists (select 1 from nodes n join projects p on p.id = n.project_id
                 where n.id = node_id and p.user_id = auth.uid()));
create policy "own agent_runs" on agent_runs for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "own impact_suggestions" on impact_suggestions for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "own evidence_items" on evidence_items for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create index nodes_project_idx on nodes(project_id);
create index edges_project_idx on edges(project_id);
create index edges_source_idx on edges(source_node_id);
create index edges_target_idx on edges(target_node_id);
create index impact_suggestions_project_idx on impact_suggestions(project_id);
