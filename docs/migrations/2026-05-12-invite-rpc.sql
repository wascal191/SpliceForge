-- ============================================================
-- 2026-05-12 — consume_invite_token RPC
--
-- Atomically:
--   1) locks the invite row by token_hash,
--   2) validates expiry + remaining uses + per-org member cap,
--   3) inserts the membership row,
--   4) increments uses (or deletes the row if cap reached).
--
-- Fixes a race in src/lib/actions/invites.ts::joinOrganizationByToken
-- where two concurrent joins could both succeed past the 5-user cap.
--
-- The function raises specific error codes the application maps to
-- user-visible messages:
--   - 'token_not_found'   — bad/expired token
--   - 'token_expired'     — past expires_at
--   - 'token_exhausted'   — uses >= max_uses
--   - 'cap_exceeded'      — org already at MAX_MEMBERS_PER_ORG
--   - 'already_member'    — user already in this org
--
-- The 5-user cap is intentionally hard-coded here. The canonical
-- value lives in src/env.ts (MAX_MEMBERS_PER_ORG) — update both
-- together if the tier model changes.
--
-- Apply: Supabase Studio → SQL editor → paste & run.
-- Safe to re-apply (CREATE OR REPLACE).
-- ============================================================

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
  v_invite organization_invites%ROWTYPE;
  v_member_count INTEGER;
  v_already_member BOOLEAN;
  v_max_members CONSTANT INTEGER := 5;
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  -- Take a row-level lock so concurrent joins serialize on the same token.
  SELECT * INTO v_invite
  FROM organization_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  IF v_invite.expires_at IS NOT NULL
     AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  IF v_invite.uses IS NOT NULL
     AND v_invite.max_uses IS NOT NULL
     AND v_invite.uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'token_exhausted';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_invite.organization_id
      AND user_id = p_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    -- Surface a distinct error so the client can show "you're already in".
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
    -- Burn the token entirely once exhausted.
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
