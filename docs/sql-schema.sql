-- ============================================================
-- SpliceForge — Complete Database Schema
-- PostgreSQL 15 / Supabase
--
-- Run this entire file against a fresh Supabase project to
-- create all tables, indexes, foreign-key constraints, and
-- Row-Level Security policies.
--
-- Execution order matters — tables are created bottom-up so
-- FKs always reference tables that already exist.
-- ============================================================


-- ============================================================
-- SECTION 1: ORGANIZATION & AUTH TABLES
-- ============================================================

-- Organizations: top-level tenant container.
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  plan            TEXT        NOT NULL DEFAULT 'trial',  -- 'trial' | 'pro' | 'enterprise'
  api_base_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members: maps Supabase auth.users to organizations.
CREATE TABLE IF NOT EXISTS organization_members (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role                TEXT        NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'viewer'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Invite tokens: shareable links to join an organization.
-- One active token per organization at a time.
CREATE TABLE IF NOT EXISTS organization_invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token               TEXT        NOT NULL UNIQUE,
  created_by          UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_members_user       ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org        ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_org        ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token      ON organization_invites(token);


-- ============================================================
-- SECTION 2: NETWORK MAP STRUCTURE
-- ============================================================

-- Projects: top-level logical container (e.g., "Downtown Expansion").
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bedsheets: a named set of pages inside a project (e.g., "Feeder Plant").
CREATE TABLE IF NOT EXISTS bedsheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pages: individual canvas views within a bedsheet.
--   data_json stores page metadata:
--     { color?: string, header?: { nodeName?, address?, description? } }
CREATE TABLE IF NOT EXISTS pages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bedsheet_id  UUID        NOT NULL REFERENCES bedsheets(id)  ON DELETE CASCADE,
  page_index   INTEGER     NOT NULL,
  title        TEXT,
  data_json    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_bedsheet ON pages(bedsheet_id);
CREATE INDEX IF NOT EXISTS idx_pages_index    ON pages(bedsheet_id, page_index);


-- ============================================================
-- SECTION 3: CANVAS ELEMENTS
-- ============================================================

-- Elements: a physical or logical node on a canvas page.
--   type     : 'cable' | 'splitter' | 'equipment' | 'closure' | 'continuation'
--   config_json examples (see docs/data-model.md for full reference):
--
--   Cable:
--     { "fiberCount": 48, "colorScheme": "EIA598", "moduleFiberCount": 12 }
--
--   Splitter:
--     { "ratio": "1:8", "inputCount": 1, "outputCount": 8 }
--
--   Equipment:
--     { "inputCount": 2, "outputCount": 2 }
--
--   Closure:
--     { "inputCount": 12, "outputCount": 12, "trayCount": 4,
--       "collapsedTrays": [], "trayNotes": {} }
--
--   Continuation:
--     { "targetPageId": "<uuid>", "targetPageLabel": "Page 2",
--       "inputCount": 1, "outputCount": 1 }
CREATE TABLE IF NOT EXISTS elements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID        NOT NULL REFERENCES pages(id)       ON DELETE CASCADE,
  type        TEXT        NOT NULL
                          CHECK (type IN ('cable','splitter','equipment','closure','continuation')),
  label       TEXT        NOT NULL,
  position_x  FLOAT       NOT NULL DEFAULT 0,
  position_y  FLOAT       NOT NULL DEFAULT 0,
  config_json JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elements_page ON elements(page_id);


-- ============================================================
-- SECTION 4: PORTS & SPLICES
-- ============================================================

-- Ports: individual connectable fiber endpoints on an element.
--   port_index : 0-based; determines fiber color from the cable's color scheme.
--   colors     : pre-computed hex color array for this port.
--   status     : 'unoccupied' | 'occupied'
--   label      : optional custom annotation (e.g., "DST-1736 / Rio Bayamón").
CREATE TABLE IF NOT EXISTS ports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id  UUID        NOT NULL REFERENCES elements(id)    ON DELETE CASCADE,
  port_index  INTEGER     NOT NULL,
  colors      TEXT[]      NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'unoccupied'
                          CHECK (status IN ('unoccupied','occupied')),
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ports_element ON ports(element_id);

-- Splices: a permanent fiber connection between two ports (a canvas edge).
--   port_from / port_to : order is not semantically significant; either end can be source.
--   comment             : optional technician note shown as edge label on canvas.
--   color               : hex color used for trace rendering (resolved at draw time).
CREATE TABLE IF NOT EXISTS splices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  port_from   UUID        NOT NULL REFERENCES ports(id)       ON DELETE CASCADE,
  port_to     UUID        NOT NULL REFERENCES ports(id)       ON DELETE CASCADE,
  comment     TEXT,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (port_from <> port_to)
);

CREATE INDEX IF NOT EXISTS idx_splices_port_from ON splices(port_from);
CREATE INDEX IF NOT EXISTS idx_splices_port_to   ON splices(port_to);


-- ============================================================
-- SECTION 5: CABLE LIBRARY
-- ============================================================

-- Reusable cable configurations saved by users.
CREATE TABLE IF NOT EXISTS library_cables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  fiber_count         INTEGER     NOT NULL CHECK (fiber_count > 0),
  color_scheme        TEXT        NOT NULL DEFAULT 'EIA598',
  module_fiber_count  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 6: ROW-LEVEL SECURITY
-- ============================================================
-- The organization/auth tables are accessed exclusively via the
-- Supabase service role key (createAdminClient), which bypasses
-- RLS. The network map tables below are accessed via the anon
-- key (authenticated SSR client) and therefore need RLS.
--
-- The policies below allow any authenticated user to fully
-- manage all records. For stricter per-organization data
-- isolation, add an organization_id FK to the projects table
-- and filter by the user's organization in each policy.
-- ============================================================

ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bedsheets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE splices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_cables ENABLE ROW LEVEL SECURITY;

-- organizations / members / invites: accessed via service role only.
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites  ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to all map tables.
CREATE POLICY "auth_all_projects"       ON projects       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bedsheets"      ON bedsheets      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_pages"          ON pages          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_elements"       ON elements       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ports"          ON ports          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_splices"        ON splices        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_library"        ON library_cables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypasses RLS on org tables; these deny direct anon access.
CREATE POLICY "no_anon_orgs"     ON organizations        FOR ALL TO anon USING (false);
CREATE POLICY "no_anon_members"  ON organization_members FOR ALL TO anon USING (false);
CREATE POLICY "no_anon_invites"  ON organization_invites FOR ALL TO anon USING (false);


-- ============================================================
-- SECTION 7: HELPER VIEWS (OPTIONAL)
-- ============================================================

-- Convenience view: full splice list with element labels and port indexes.
CREATE OR REPLACE VIEW splice_summary AS
SELECT
  s.id                  AS splice_id,
  s.comment,
  s.color,
  pf.id                 AS port_from_id,
  pf.port_index         AS port_from_index,
  ef.label              AS from_element_label,
  ef.type               AS from_element_type,
  pgf.id                AS from_page_id,
  pt.id                 AS port_to_id,
  pt.port_index         AS port_to_index,
  et.label              AS to_element_label,
  et.type               AS to_element_type,
  pgt.id                AS to_page_id,
  s.created_at
FROM splices s
JOIN ports    pf  ON pf.id = s.port_from
JOIN elements ef  ON ef.id = pf.element_id
JOIN pages    pgf ON pgf.id = ef.page_id
JOIN ports    pt  ON pt.id = s.port_to
JOIN elements et  ON et.id = pt.element_id
JOIN pages    pgt ON pgt.id = et.page_id;
