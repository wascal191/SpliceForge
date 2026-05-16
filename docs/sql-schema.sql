-- ============================================================
-- SpliceForge — Complete Database Schema
-- PostgreSQL 15 / Supabase
--
-- Run this entire file against a fresh Supabase project to
-- create all tables, indexes, foreign-key constraints, RLS
-- policies, helper views, and RPCs.
--
-- Re-running is safe: every CREATE uses IF NOT EXISTS / OR
-- REPLACE, and policies are dropped before recreating.
--
-- Execution order matters — tables are created top-down so
-- FKs always reference tables that already exist. The org
-- tables come first; tenant tables (projects → … → splices)
-- carry an organization_id FK that the application uses for
-- multi-tenant isolation.
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
  role                TEXT        NOT NULL DEFAULT 'editor'
                                  CHECK (role IN ('owner','editor','viewer')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Invite tokens: shareable links to join an organization.
-- Tokens are stored as SHA-256 hashes (token_hash); the raw token is shown
-- to the owner once at creation and never persisted. `uses`/`max_uses` and
-- `expires_at` are consulted by the consume_invite_token RPC (Section 9).
CREATE TABLE IF NOT EXISTS organization_invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash          TEXT        NOT NULL UNIQUE,
  created_by          UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  uses                INTEGER     NOT NULL DEFAULT 0,
  max_uses            INTEGER     NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_org_members_user        ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org         ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_org         ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token_hash  ON organization_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invites_expires_at  ON organization_invites(expires_at);


-- ============================================================
-- SECTION 2: NETWORK MAP STRUCTURE
-- ============================================================
-- Every tenant table carries an organization_id FK. The application
-- (src/lib/guards.ts → requireAuthContext) filters every query by this
-- column; defence-in-depth happens in the policies in Section 7.

-- Projects: top-level logical container (e.g., "Downtown Expansion").
CREATE TABLE IF NOT EXISTS projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

-- Bedsheets: a named set of pages inside a project (e.g., "Feeder Plant").
-- map_center_* / map_zoom remember the geo-view viewport per bedsheet.
CREATE TABLE IF NOT EXISTS bedsheets (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID             NOT NULL REFERENCES projects(id)       ON DELETE CASCADE,
  name            TEXT             NOT NULL,
  map_center_lat  DOUBLE PRECISION,
  map_center_lng  DOUBLE PRECISION,
  map_zoom        REAL,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bedsheets_org     ON bedsheets(organization_id);
CREATE INDEX IF NOT EXISTS idx_bedsheets_project ON bedsheets(project_id);

-- Pages: individual canvas views within a bedsheet.
--   data_json stores page metadata:
--     { color?: string, header?: { nodeName?, address?, description? } }
CREATE TABLE IF NOT EXISTS pages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bedsheet_id     UUID        NOT NULL REFERENCES bedsheets(id)     ON DELETE CASCADE,
  page_index      INTEGER     NOT NULL,
  title           TEXT,
  data_json       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_org      ON pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_pages_bedsheet ON pages(bedsheet_id);
CREATE INDEX IF NOT EXISTS idx_pages_index    ON pages(bedsheet_id, page_index);


-- ============================================================
-- SECTION 3: CANVAS ELEMENTS
-- ============================================================

-- Elements: a physical or logical node on a canvas page.
--   type     : 'cable' | 'splitter' | 'equipment' | 'closure' | 'continuation'
--   config_json examples (see docs/data-model.md for full reference):
--
--   Cable:        { "fiberCount": 48, "colorScheme": "EIA598", "moduleFiberCount": 12 }
--   Splitter:     { "ratio": "1:8", "inputCount": 1, "outputCount": 8 }
--   Equipment:    { "inputCount": 2, "outputCount": 2 }
--   Closure:      { "inputCount": 12, "outputCount": 12, "trayCount": 4,
--                   "collapsedTrays": [], "trayNotes": {} }
--   Continuation: { "targetPageId": "<uuid>", "targetPageLabel": "Page 2",
--                   "inputCount": 1, "outputCount": 1 }
--
-- The geo_* columns are nullable; an un-localized element has them all NULL.
CREATE TABLE IF NOT EXISTS elements (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id         UUID             NOT NULL REFERENCES pages(id)         ON DELETE CASCADE,
  type            TEXT             NOT NULL
                                   CHECK (type IN ('cable','splitter','equipment','closure','continuation')),
  label           TEXT             NOT NULL,
  position_x      FLOAT            NOT NULL DEFAULT 0,
  position_y      FLOAT            NOT NULL DEFAULT 0,
  config_json     JSONB,
  geo_lat         DOUBLE PRECISION,
  geo_lng         DOUBLE PRECISION,
  geo_path_json   JSONB,
  geo_address     TEXT,
  geo_updated_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elements_org  ON elements(organization_id);
CREATE INDEX IF NOT EXISTS idx_elements_page ON elements(page_id);

CREATE INDEX IF NOT EXISTS idx_elements_geo
  ON elements (geo_lat, geo_lng)
  WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_elements_page_geo
  ON elements (page_id)
  WHERE geo_lat IS NOT NULL OR geo_path_json IS NOT NULL;


-- ============================================================
-- SECTION 4: PORTS & SPLICES
-- ============================================================

-- Ports: individual connectable fiber endpoints on an element.
--   port_index  : 0-based; determines fiber color from the cable's color scheme.
--   fiber_count : number of fibers represented by this port (typically 1 for
--                 individual fibers; larger for bundled ports on splitters).
--   colors      : pre-computed hex color array for this port.
--   status      : 'unoccupied' | 'occupied'
--   label       : optional custom annotation (e.g., "DST-1736 / Rio Bayamón").
CREATE TABLE IF NOT EXISTS ports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  element_id      UUID        NOT NULL REFERENCES elements(id)      ON DELETE CASCADE,
  port_index      INTEGER     NOT NULL,
  fiber_count     INTEGER     NOT NULL DEFAULT 1,
  colors          TEXT[]      NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'unoccupied'
                              CHECK (status IN ('unoccupied','occupied')),
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ports_org     ON ports(organization_id);
CREATE INDEX IF NOT EXISTS idx_ports_element ON ports(element_id);

-- Splices: a permanent fiber connection between two ports (a canvas edge).
--   port_from / port_to : order is not semantically significant; either end can be source.
--   comment             : optional technician note shown as edge label on canvas.
--   color               : hex color used for trace rendering (resolved at draw time).
CREATE TABLE IF NOT EXISTS splices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  port_from       UUID        NOT NULL REFERENCES ports(id)         ON DELETE CASCADE,
  port_to         UUID        NOT NULL REFERENCES ports(id)         ON DELETE CASCADE,
  comment         TEXT,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (port_from <> port_to)
);

CREATE INDEX IF NOT EXISTS idx_splices_org       ON splices(organization_id);
CREATE INDEX IF NOT EXISTS idx_splices_port_from ON splices(port_from);
CREATE INDEX IF NOT EXISTS idx_splices_port_to   ON splices(port_to);


-- ============================================================
-- SECTION 5: CABLE LIBRARY
-- ============================================================

-- Reusable cable configurations saved by users, scoped to the organization.
CREATE TABLE IF NOT EXISTS library_cables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  fiber_count         INTEGER     NOT NULL CHECK (fiber_count > 0),
  color_scheme        TEXT        NOT NULL DEFAULT 'EIA598',
  module_fiber_count  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_cables_org ON library_cables(organization_id);


-- ============================================================
-- SECTION 6: ROW-LEVEL SECURITY
-- ============================================================
-- Two policy classes:
--
--   1. Organization tables (organizations / organization_members /
--      organization_invites) are accessed via the service-role admin client
--      from src/lib/supabase/admin.ts, which bypasses RLS. The policies
--      here deny direct anon/authenticated access as a hard backstop.
--
--      EXCEPTION: organization_members has a SELECT policy permitting
--      `user_id = auth.uid()` so a user can read their own row directly
--      (used to bootstrap the membership lookup in requireAuthContext).
--      A subselect back into organization_members in the USING clause
--      causes infinite recursion (Postgres 42P17) — do NOT add one.
--
--   2. Tenant tables (projects/bedsheets/pages/elements/ports/splices/
--      library_cables) are accessed via the SSR client with the user's
--      auth cookie. The policies allow access only to rows whose
--      organization_id appears in the caller's membership set. The
--      application also redundantly filters by organization_id in every
--      query as defence-in-depth.

ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bedsheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ports                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE splices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_cables        ENABLE ROW LEVEL SECURITY;

-- ── Org-table policies ──────────────────────────────────────
DROP POLICY IF EXISTS no_anon_orgs          ON organizations;
DROP POLICY IF EXISTS no_anon_invites       ON organization_invites;
DROP POLICY IF EXISTS org_members_select    ON organization_members;
DROP POLICY IF EXISTS org_members_no_write  ON organization_members;

CREATE POLICY no_anon_orgs    ON organizations        FOR ALL TO anon USING (false);
CREATE POLICY no_anon_invites ON organization_invites FOR ALL TO anon USING (false);

-- Self-only SELECT on organization_members (NO subselect to avoid 42P17).
CREATE POLICY org_members_select
  ON organization_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Writes go exclusively through the service-role admin client.
CREATE POLICY org_members_no_write
  ON organization_members
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);


-- ── Tenant-table policies ───────────────────────────────────
-- Restrict reads/writes to rows whose organization_id is in the caller's
-- membership set. The membership lookup hits idx_org_members_user.
DROP POLICY IF EXISTS tenant_projects       ON projects;
DROP POLICY IF EXISTS tenant_bedsheets      ON bedsheets;
DROP POLICY IF EXISTS tenant_pages          ON pages;
DROP POLICY IF EXISTS tenant_elements       ON elements;
DROP POLICY IF EXISTS tenant_ports          ON ports;
DROP POLICY IF EXISTS tenant_splices        ON splices;
DROP POLICY IF EXISTS tenant_library_cables ON library_cables;

CREATE POLICY tenant_projects ON projects FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_bedsheets ON bedsheets FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_pages ON pages FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_elements ON elements FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_ports ON ports FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_splices ON splices FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY tenant_library_cables ON library_cables FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- ============================================================
-- SECTION 7: HELPER VIEWS
-- ============================================================

-- Convenience view: full splice list with element labels and port indexes.
-- Each row is restricted by the splices/ports/elements/pages tenant policies,
-- so the view inherits multi-tenant isolation automatically.
CREATE OR REPLACE VIEW splice_summary AS
SELECT
  s.id                  AS splice_id,
  s.organization_id,
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


-- ============================================================
-- SECTION 8: RPC — ATOMIC ORG + OWNER PROVISIONING
-- ============================================================
-- Source: docs/migrations/2026-05-12-org-rpc.sql
--
-- Wraps the org-insert + owner-member-insert pair in a single transaction
-- so we never end up with an orphaned organization if the member insert
-- fails (or vice versa). Called by src/lib/actions/organizations.ts and
-- src/app/auth/callback/route.ts.

CREATE OR REPLACE FUNCTION public.create_org_with_owner(
  p_name    TEXT,
  p_user_id UUID
)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
BEGIN
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_org_name';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user_id';
  END IF;

  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO organizations (name)
  VALUES (btrim(p_name))
  RETURNING * INTO v_org;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org.id, p_user_id, 'owner');

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_org_with_owner(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_org_with_owner(TEXT, UUID) FROM anon, authenticated;


-- ============================================================
-- SECTION 9: RPC — ATOMIC INVITE CONSUMPTION
-- ============================================================
-- Source: docs/migrations/2026-05-12-invite-rpc.sql
--
-- Locks the invite row by token_hash, validates expiry + remaining uses
-- + per-org member cap, inserts the membership, increments uses (or
-- deletes the row if cap reached). Prevents two concurrent joins from
-- both squeezing past the 5-user cap.
--
-- Errors (caught and mapped in src/lib/actions/invites.ts):
--   token_not_found  — bad / missing token
--   token_expired    — past expires_at
--   token_exhausted  — uses >= max_uses
--   cap_exceeded     — org already at max members
--   already_member   — user already in this org
--
-- The 5-user cap is hard-coded here. The canonical app-side value lives
-- in src/env.ts (MAX_MEMBERS_PER_ORG) — update both together if tier
-- pricing changes.

CREATE OR REPLACE FUNCTION public.consume_invite_token(
  p_token_hash TEXT,
  p_user_id    UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite       organization_invites%ROWTYPE;
  v_member_count INTEGER;
  v_max_members  CONSTANT INTEGER := 5;
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  SELECT * INTO v_invite
  FROM organization_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  IF v_invite.uses IS NOT NULL
     AND v_invite.max_uses IS NOT NULL
     AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'token_exhausted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_invite.organization_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM organization_members
  WHERE organization_id = v_invite.organization_id;

  IF v_member_count >= v_max_members THEN
    RAISE EXCEPTION 'cap_exceeded';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, p_user_id, 'editor');

  IF (v_invite.uses + 1) >= v_invite.max_uses THEN
    DELETE FROM organization_invites WHERE id = v_invite.id;
  ELSE
    UPDATE organization_invites
      SET uses = v_invite.uses + 1
      WHERE id = v_invite.id;
  END IF;

  RETURN v_invite.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_invite_token(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_invite_token(TEXT, UUID) FROM anon, authenticated;
