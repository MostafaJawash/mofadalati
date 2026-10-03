-- Mofadalati schema. Idempotent: safe to run repeatedly.
-- The database is the single source of truth for every visitor.

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admissions (
  id                   serial PRIMARY KEY,
  specialization       text NOT NULL,
  university           text,
  city                 text,
  category             text NOT NULL DEFAULT 'ministry',
  -- A track is "available" when it is offered at all. A NULL minimum on an
  -- available track means no total-score minimum (e.g. "جميع المتقدمين" or a
  -- subject-grade condition only).
  general_available    boolean NOT NULL DEFAULT true,
  general_minimum      numeric(5,2) CHECK (general_minimum BETWEEN 0 AND 100),
  general_conditions   text,
  parallel_available   boolean NOT NULL DEFAULT true,
  parallel_minimum     numeric(5,2) CHECK (parallel_minimum BETWEEN 0 AND 100),
  parallel_conditions  text,
  source_page          integer,
  source_order         integer,
  academic_year        text NOT NULL DEFAULT '2026-2027',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admissions_source_order_idx ON admissions (source_order);

-- One shared list. Positions are always contiguous 1..n (no upper limit).
CREATE TABLE IF NOT EXISTS preferences (
  id            serial PRIMARY KEY,
  position      integer NOT NULL CHECK (position >= 1),
  admission_id  integer NOT NULL REFERENCES admissions (id) ON DELETE CASCADE,
  track         text NOT NULL CHECK (track IN ('general', 'parallel')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferences_position_key UNIQUE (position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT preferences_option_key UNIQUE (admission_id, track)
);

-- Migration: earlier versions capped the list at 40 positions.
ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_position_check;
ALTER TABLE preferences ADD CONSTRAINT preferences_position_check CHECK (position >= 1);

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  action      text NOT NULL,
  actor       text NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);

-- A single-row table whose revision bumps on every data change. Clients poll
-- it cheaply to know when to re-fetch. Its row is also the mutex that
-- serializes preference mutations (SELECT ... FOR UPDATE).
CREATE TABLE IF NOT EXISTS sync_state (
  id          integer PRIMARY KEY CHECK (id = 1),
  revision    bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION bump_revision() RETURNS trigger AS $$
BEGIN
  UPDATE sync_state SET revision = revision + 1, updated_at = now() WHERE id = 1;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_bump ON settings;
CREATE TRIGGER settings_bump AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH STATEMENT EXECUTE FUNCTION bump_revision();

DROP TRIGGER IF EXISTS admissions_bump ON admissions;
CREATE TRIGGER admissions_bump AFTER INSERT OR UPDATE OR DELETE ON admissions
  FOR EACH STATEMENT EXECUTE FUNCTION bump_revision();

DROP TRIGGER IF EXISTS preferences_bump ON preferences;
CREATE TRIGGER preferences_bump AFTER INSERT OR UPDATE OR DELETE ON preferences
  FOR EACH STATEMENT EXECUTE FUNCTION bump_revision();

INSERT INTO settings (key, value) VALUES
  ('student_score', '83'),
  ('academic_year', '"2026-2027"'),
  ('site_title', '"المفاضلة الجامعية - الفرع العلمي"'),
  ('preferences_locked', 'false')
ON CONFLICT (key) DO NOTHING;
