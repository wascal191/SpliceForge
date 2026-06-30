-- ============================================================
-- SpliceForge — Database schema for vanilla PostgreSQL 13+
--
-- Run once against a fresh database:
--   createdb spliceforge
--   psql spliceforge -f db/schema.sql
--
-- Or via the npm helper:
--   npm run db:init
--
-- Re-running is safe: every CREATE uses IF NOT EXISTS.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()


-- ============================================================
-- SECTION 1: AUTHENTICATION (Better Auth tables)
--
-- These tables are owned by Better Auth (https://better-auth.com).
-- Column names are camelCase + quoted to match Better Auth's
-- expectations. Better Auth IDs are TEXT (cuid-like), not UUID.
-- ============================================================

CREATE TABLE IF NOT EXISTS "user" (
  id              TEXT      PRIMARY KEY,
  name            TEXT      NOT NULL,
  email           TEXT      NOT NULL UNIQUE,
  "emailVerified" BOOLEAN   NOT NULL DEFAULT FALSE,
  image           TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  id          TEXT      PRIMARY KEY,
  "userId"    TEXT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token       TEXT      NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_user ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);

CREATE TABLE IF NOT EXISTS "account" (
  id                       TEXT      PRIMARY KEY,
  "userId"                 TEXT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accountId"              TEXT      NOT NULL,
  "providerId"             TEXT      NOT NULL,
  "accessToken"            TEXT,
  "refreshToken"           TEXT,
  "accessTokenExpiresAt"   TIMESTAMP,
  "refreshTokenExpiresAt"  TIMESTAMP,
  scope                    TEXT,
  "idToken"                TEXT,
  password                 TEXT,
  "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_user ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  id          TEXT      PRIMARY KEY,
  identifier  TEXT      NOT NULL,
  value       TEXT      NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 2: ORGANIZATIONS & MEMBERSHIP
--
-- Multi-tenant scaffolding. Every domain table carries an
-- organization_id FK. The application layer (src/lib/guards.ts
-- → requireAuthContext) filters every query by organization_id;
-- this is the sole isolation mechanism — no RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  api_base_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role                TEXT        NOT NULL DEFAULT 'editor'
                                  CHECK (role IN ('owner','editor','viewer')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash          TEXT        NOT NULL UNIQUE,
  created_by          TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
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
-- SECTION 3: NETWORK MAP STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

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
-- SECTION 4: CANVAS ELEMENTS
-- ============================================================

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
-- SECTION 5: PORTS & SPLICES
-- ============================================================

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
-- SECTION 6: CABLE LIBRARY
-- ============================================================

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
-- SECTION 7: HELPER VIEW
-- ============================================================

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
-- SECTION 8: RPC — Atomic org + owner provisioning
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_with_owner(
  p_name    TEXT,
  p_user_id TEXT
)
RETURNS organizations
LANGUAGE plpgsql
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


-- ============================================================
-- SECTION 9: RPC — Atomic invite consumption
-- ============================================================
-- The per-org member cap mirrors src/env.ts MAX_MEMBERS_PER_ORG.
-- If you raise the cap there for self-hosting, raise it here too.

CREATE OR REPLACE FUNCTION public.consume_invite_token(
  p_token_hash TEXT,
  p_user_id    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
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


-- ============================================================
-- SECTION 10: RPC — Bulk import (atomic ingest of a bedsheet)
-- ============================================================
-- Caller-supplied user id is verified against organization_members
-- to confirm membership in the page's organization.

CREATE OR REPLACE FUNCTION public.import_bundle(
  p_page_id UUID,
  p_payload JSONB,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id       UUID;
  v_element_ids  JSONB := '{}'::JSONB;
  v_ports        JSONB := '{}'::JSONB;
  v_splice_ids   JSONB := '[]'::JSONB;
  v_element      JSONB;
  v_element_id   UUID;
  v_key          TEXT;
  v_port_colors  TEXT[];
  v_port_count   INT;
  v_splice       JSONB;
  v_from_port_id UUID;
  v_to_port_id   UUID;
  v_splice_id    UUID;
  v_element_count INT := 0;
  v_splice_count  INT := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM pages WHERE id = p_page_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'page_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  IF p_payload IS NULL
     OR p_payload->'elements' IS NULL
     OR jsonb_typeof(p_payload->'elements') <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  FOR v_element IN SELECT * FROM jsonb_array_elements(p_payload->'elements')
  LOOP
    v_key := v_element->>'key';
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;

    INSERT INTO elements (
      organization_id, page_id, type, label,
      position_x, position_y, config_json,
      geo_lat, geo_lng, geo_path_json, geo_address, geo_updated_at
    )
    VALUES (
      v_org_id,
      p_page_id,
      v_element->>'type',
      v_element->>'label',
      (v_element->>'x')::FLOAT,
      (v_element->>'y')::FLOAT,
      v_element->'config',
      NULLIF(v_element->'geo'->>'lat', '')::DOUBLE PRECISION,
      NULLIF(v_element->'geo'->>'lng', '')::DOUBLE PRECISION,
      CASE WHEN v_element->'geo'->'path' IS NULL
           OR jsonb_typeof(v_element->'geo'->'path') = 'null'
           THEN NULL ELSE v_element->'geo'->'path' END,
      NULLIF(v_element->'geo'->>'address', ''),
      CASE WHEN v_element->'geo' IS NULL THEN NULL ELSE now() END
    )
    RETURNING id INTO v_element_id;

    v_element_count := v_element_count + 1;
    v_element_ids := v_element_ids || jsonb_build_object(v_key, v_element_id);

    SELECT array_agg(value::TEXT)
      INTO v_port_colors
      FROM jsonb_array_elements_text(v_element->'port_colors');
    v_port_count := COALESCE(array_length(v_port_colors, 1), 0);

    IF v_port_count > 0 THEN
      INSERT INTO ports (organization_id, element_id, port_index, fiber_count, colors, status)
      SELECT
        v_org_id,
        v_element_id,
        idx - 1,
        1,
        ARRAY[v_port_colors[idx]],
        'unoccupied'
      FROM generate_series(1, v_port_count) AS idx;
    END IF;

    v_ports := v_ports || jsonb_build_object(
      v_element_id::TEXT,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', p.id,
            'element_id', p.element_id,
            'port_index', p.port_index,
            'colors', p.colors,
            'status', p.status,
            'label', p.label
          ) ORDER BY p.port_index)
         FROM ports p WHERE p.element_id = v_element_id),
        '[]'::JSONB
      )
    );
  END LOOP;

  IF p_payload->'splices' IS NOT NULL
     AND jsonb_typeof(p_payload->'splices') = 'array' THEN
    FOR v_splice IN SELECT * FROM jsonb_array_elements(p_payload->'splices')
    LOOP
      SELECT p.id INTO v_from_port_id
      FROM ports p
      WHERE p.element_id = (v_element_ids->>(v_splice->>'fromKey'))::UUID
        AND p.port_index = (v_splice->>'fromPortIndex')::INT;

      SELECT p.id INTO v_to_port_id
      FROM ports p
      WHERE p.element_id = (v_element_ids->>(v_splice->>'toKey'))::UUID
        AND p.port_index = (v_splice->>'toPortIndex')::INT;

      IF v_from_port_id IS NULL OR v_to_port_id IS NULL OR v_from_port_id = v_to_port_id THEN
        RAISE EXCEPTION 'bad_splice';
      END IF;

      INSERT INTO splices (organization_id, port_from, port_to, comment)
      VALUES (
        v_org_id,
        v_from_port_id,
        v_to_port_id,
        NULLIF(v_splice->>'comment', '')
      )
      RETURNING id INTO v_splice_id;

      UPDATE ports
         SET status = 'occupied'
       WHERE id IN (v_from_port_id, v_to_port_id);

      v_splice_ids := v_splice_ids || jsonb_build_object(
        'id', v_splice_id,
        'fromKey', v_splice->>'fromKey',
        'fromPortIndex', (v_splice->>'fromPortIndex')::INT,
        'toKey', v_splice->>'toKey',
        'toPortIndex', (v_splice->>'toPortIndex')::INT
      );
      v_splice_count := v_splice_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'elementIds', v_element_ids,
    'ports', v_ports,
    'spliceIds', v_splice_ids,
    'elementCount', v_element_count,
    'spliceCount', v_splice_count
  );
END;
$$;
