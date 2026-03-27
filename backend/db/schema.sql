CREATE EXTENSION IF NOT EXISTS vector;

-- ── SHARED ────────────────────────────────────────────────────────────────────

CREATE TABLE missions (
  mission_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            TEXT NOT NULL,             -- 'instant' | 'studio'
  brief           JSONB,                     -- Instant Create brief
  proposal_id     UUID,                      -- Studio Workflow proposal ref
  world_bible     JSONB,
  status          TEXT DEFAULT 'pending',
  -- pending|planning|ingredients|scene_0|scene_1|scene_2|scoring|assembling|complete|error
  scene_urls      TEXT[] DEFAULT '{}',
  audio_url       TEXT,
  final_url       TEXT,
  error_msg       TEXT,
  thinking_tokens INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE characters (
  character_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id           UUID REFERENCES missions(mission_id),
  name                 TEXT,
  appearance_embedding VECTOR(512),
  seed_url             TEXT,
  visual_traits        JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scenes (
  scene_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id        UUID REFERENCES missions(mission_id),
  scene_index       INTEGER,
  veo_prompt        TEXT,
  video_url         TEXT,
  consistency_score FLOAT,
  status            TEXT DEFAULT 'pending',
  generated_at      TIMESTAMPTZ
);

CREATE TABLE soundtracks (
  audio_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          UUID REFERENCES missions(mission_id),
  weighted_prompt_log JSONB,
  final_audio_url     TEXT,
  duration_seconds    FLOAT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── STUDIO WORKFLOW ONLY ──────────────────────────────────────────────────────

CREATE TABLE studio_proposals (
  proposal_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_idea        TEXT NOT NULL,             -- user's raw idea text
  genre_hints     TEXT[],                    -- optional genre hints from user
  tone_hints      TEXT[],                    -- optional tone hints
  current_draft   JSONB NOT NULL,            -- latest ProposalDraft
  revision_log    JSONB[] DEFAULT '{}',      -- history of all drafts + revision prompts
  status          TEXT DEFAULT 'drafting',   -- drafting|revising|approved|generating
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE revision_history (
  revision_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID REFERENCES studio_proposals(proposal_id),
  revision_num    INTEGER,
  user_prompt     TEXT,                      -- what the user asked to change
  previous_draft  JSONB,
  new_draft       JSONB,
  changes_summary TEXT,                      -- AI-generated plain-English diff
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON characters
  USING ivfflat (appearance_embedding vector_cosine_ops)
  WITH (lists = 100);
