"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthContext,
} from "@/lib/guards";
import { fail } from "@/lib/errors";
import { rateLimitOrThrow } from "@/lib/ratelimit";

// Public-facing invite metadata returned to the UI; never includes the
// hashed token or any DB internals.
export type OrgInvite = {
  id: string;
  organization_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string;
};

const TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 7;
const MAX_USES = 5;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export async function createInviteToken(): Promise<OrgInvite> {
  const ctx = await requireAuthContext();
  if (ctx.role !== "owner") throw new ForbiddenError("Only owners can create invites");

  const admin = createAdminClient();
  // One active token per org — revoke existing before creating a new one.
  await admin.from("organization_invites").delete().eq("organization_id", ctx.orgId);

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("organization_invites")
    .insert({
      organization_id: ctx.orgId,
      token_hash: tokenHash,
      created_by: ctx.userId,
      expires_at: expiresAt,
      max_uses: MAX_USES,
      uses: 0,
    })
    .select("id, organization_id, created_by, created_at, expires_at")
    .single();
  if (error || !data) fail("invites.createInviteToken", error, "Could not create invite");

  // Token is returned exactly once to the caller (the owner who just made it).
  return { ...(data as Omit<OrgInvite, "token">), token };
}

export async function getInviteToken(): Promise<{
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
} | null> {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return null;
  }
  if (ctx.role !== "owner") return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_invites")
    .select("id, organization_id, created_by, created_at, expires_at")
    .eq("organization_id", ctx.orgId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  // Note: we deliberately do NOT return the raw token. UI builds the share
  // link once at creation time; rotated thereafter.
  return data ?? null;
}

export async function revokeInviteToken(): Promise<void> {
  const ctx = await requireAuthContext();
  if (ctx.role !== "owner") throw new ForbiddenError();

  const admin = createAdminClient();
  await admin.from("organization_invites").delete().eq("organization_id", ctx.orgId);
}

/**
 * Public — no auth required. Returns minimal information so the join UI can
 * show "you're invited to join {orgName}". Rate-limited per IP to slow down
 * token enumeration attempts (V-15, V-16).
 */
export async function validateInviteToken(
  token: string
): Promise<{ orgId: string; orgName: string } | null> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;

  // Per-IP rate limit (best-effort — middleware-level recommended for prod).
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "anon";
    rateLimitOrThrow(`invite-validate:${ip}`, 30, 60_000);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Too many")) return null;
  }

  const tokenHash = hashToken(token);
  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_invites")
    .select("organization_id, expires_at, uses, max_uses, token_hash, organizations(id, name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  // Constant-time comparison even though we already filtered.
  if (!timingSafeEqualHex((data.token_hash as string) ?? "", tokenHash)) return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
  if (typeof data.uses === "number" && typeof data.max_uses === "number" && data.uses >= data.max_uses) return null;

  const org = data.organizations as unknown as { id: string; name: string };
  return { orgId: org.id, orgName: org.name };
}

export async function joinOrganizationByToken(token: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError("Not authenticated");

  const result = await validateInviteToken(token);
  if (!result) throw new Error("Invalid or expired invite link");

  const admin = createAdminClient();

  // Enforce the org's 5-user cap on the join path too (V-07).
  const { count } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", result.orgId);
  if ((count ?? 0) >= 5) throw new Error("This organization is full");

  // Already a member?
  const { data: existing } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", result.orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin
      .from("organization_members")
      .insert({ organization_id: result.orgId, user_id: user.id, role: "editor" });
    if (error) fail("invites.joinOrganizationByToken.insert", error, "Could not join organization");
  }

  // Atomically increment uses; expire the token if the cap is reached.
  const tokenHash = hashToken(token);
  const { data: row } = await admin
    .from("organization_invites")
    .select("uses, max_uses")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (row) {
    const newUses = (row.uses as number ?? 0) + 1;
    const cap = row.max_uses as number ?? MAX_USES;
    if (newUses >= cap) {
      // Burn the token: revoke entirely so it can never be reused.
      await admin.from("organization_invites").delete().eq("token_hash", tokenHash);
    } else {
      await admin
        .from("organization_invites")
        .update({ uses: newUses })
        .eq("token_hash", tokenHash);
    }
  }
}
