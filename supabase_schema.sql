-- ============================================================
-- AuraDirector — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. MISSIONS — tracks every generation job
create table if not exists public.missions (
  id              bigserial primary key,
  mission_id      text unique not null,
  mode            text not null check (mode in ('instant', 'studio')),
  status          text not null default 'pending',
  brief           jsonb,
  proposal_id     text,
  world_bible     jsonb,
  scene_urls      jsonb default '[]'::jsonb,
  final_url       text,
  thinking_tokens integer default 0,
  error_msg       text,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

-- 2. CHARACTERS — visual seed embeddings per mission
create table if not exists public.characters (
  id                    bigserial primary key,
  mission_id            text not null references public.missions(mission_id) on delete cascade,
  name                  text not null,
  appearance_embedding  float8[],
  seed_url              text,
  visual_traits         jsonb,
  created_at            timestamptz default now()
);

-- 3. SCENES — per-scene generation results
create table if not exists public.scenes (
  scene_id          uuid primary key default gen_random_uuid(),
  mission_id        text not null references public.missions(mission_id) on delete cascade,
  scene_index       integer not null,
  video_url         text,
  consistency_score float8,
  status            text default 'pending',
  generated_at      timestamptz
);

-- 4. STUDIO PROPOSALS — creative proposals for Studio Workflow
create table if not exists public.studio_proposals (
  id            bigserial primary key,
  proposal_id   text unique not null,
  raw_idea      text,
  genre_hints   jsonb default '[]'::jsonb,
  tone_hints    jsonb default '[]'::jsonb,
  current_draft jsonb not null default '{}'::jsonb,
  status        text default 'drafting',
  approved_at   timestamptz,
  created_at    timestamptz default now()
);

-- 5. REVISION HISTORY — every AI revision of a proposal
create table if not exists public.revision_history (
  revision_id     uuid primary key default gen_random_uuid(),
  proposal_id     text not null references public.studio_proposals(proposal_id) on delete cascade,
  revision_num    integer not null,
  user_prompt     text,
  previous_draft  jsonb,
  new_draft       jsonb,
  changes_summary text,
  created_at      timestamptz default now()
);

-- ── Indexes for fast lookups ───────────────────────────────────────────────────
create index if not exists idx_missions_mission_id on public.missions(mission_id);
create index if not exists idx_characters_mission_id on public.characters(mission_id);
create index if not exists idx_scenes_mission_id on public.scenes(mission_id);
create index if not exists idx_proposals_proposal_id on public.studio_proposals(proposal_id);
create index if not exists idx_revisions_proposal_id on public.revision_history(proposal_id);

-- ── Row Level Security (RLS) — service role bypasses all policies ─────────────
alter table public.missions          enable row level security;
alter table public.characters        enable row level security;
alter table public.scenes            enable row level security;
alter table public.studio_proposals  enable row level security;
alter table public.revision_history  enable row level security;
