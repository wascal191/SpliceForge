-- ============================================================
-- 2026-05-12 — create_org_with_owner RPC
--
-- Wraps the org-insert + owner-member-insert pair in a single
-- transaction so we never end up with an orphaned organization
-- if the member insert fails (or vice versa).
--
-- Replaces the non-atomic flow at:
--   src/lib/actions/organizations.ts (createOrganization)
--   src/app/auth/callback/route.ts   (regular signup branch)
--
-- Apply: Supabase Studio → SQL editor → paste & run.
-- Safe to re-apply (CREATE OR REPLACE).
-- ============================================================

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

  -- Refuse if the user is already in an organization. Cheap guard against
  -- accidental double-provisioning if the auth callback retries.
  IF EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = p_user_id
  ) THEN
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

-- Only the service-role key may invoke this. Authenticated users would
-- otherwise be able to call it with arbitrary user_ids.
REVOKE ALL ON FUNCTION public.create_org_with_owner(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_org_with_owner(TEXT, UUID) FROM anon, authenticated;
