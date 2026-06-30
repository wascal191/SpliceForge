"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { maybeOne, query } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthContext,
} from "@/lib/guards";
import { fail } from "@/lib/errors";
import { rateLimitOrThrow } from "@/lib/ratelimit";
import { maxMembersPerOrg } from "@/env";

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

  // One active token per org — revoke existing before creating a new one.
  await query(
    `DELETE FROM organization_invites WHERE organization_id = $1`,
    [ctx.orgId]
  );

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  try {
    const data = await maybeOne<Omit<OrgInvite, "token">>(
      `INSERT INTO organization_invites
         (organization_id, token_hash, created_by, expires_at, max_uses, uses)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING id, organization_id, created_by, created_at, expires_at`,
      [ctx.orgId, tokenHash, ctx.userId, expiresAt, maxMembersPerOrg()]
    );
    if (!data) fail("invites.createInviteToken", new Error("no row"), "Could not create invite");

    revalidatePath("/dashboard");
    return { ...data!, token };
  } catch (e) {
    fail("invites.createInviteToken", e, "Could not create invite");
  }
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

  return await maybeOne(
    `SELECT id, organization_id, created_by, created_at, expires_at
       FROM organization_invites
      WHERE organization_id = $1
        AND expires_at > now()
      LIMIT 1`,
    [ctx.orgId]
  );
}

export async function revokeInviteToken(): Promise<void> {
  const ctx = await requireAuthContext();
  if (ctx.role !== "owner") throw new ForbiddenError();

  await query(
    `DELETE FROM organization_invites WHERE organization_id = $1`,
    [ctx.orgId]
  );
  revalidatePath("/dashboard");
}

/**
 * Public — no auth required. Returns minimal information so the join UI can
 * show "you're invited to join {orgName}". Rate-limited per IP to slow down
 * token enumeration attempts.
 */
export async function validateInviteToken(
  token: string
): Promise<{ orgId: string; orgName: string } | null> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;

  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "anon";
    await rateLimitOrThrow(`invite-validate:${ip}`, 30, 60_000);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Too many")) return null;
  }

  const tokenHash = hashToken(token);
  const data = await maybeOne<{
    organization_id: string;
    expires_at: string | null;
    uses: number;
    max_uses: number;
    token_hash: string;
    org_name: string;
  }>(
    `SELECT i.organization_id, i.expires_at, i.uses, i.max_uses, i.token_hash,
            o.name AS org_name
       FROM organization_invites i
       JOIN organizations o ON o.id = i.organization_id
      WHERE i.token_hash = $1
      LIMIT 1`,
    [tokenHash]
  );
  if (!data) return null;
  if (!timingSafeEqualHex(data.token_hash ?? "", tokenHash)) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  if (typeof data.uses === "number" && typeof data.max_uses === "number" && data.uses >= data.max_uses) return null;

  return { orgId: data.organization_id, orgName: data.org_name };
}

/**
 * Atomic invite consumption via the `consume_invite_token` RPC. The cap-check,
 * member insert, and use-count increment all run inside a single transaction
 * with a row lock on the invite, so concurrent joiners can't both squeeze past
 * the cap.
 */
export async function joinOrganizationByToken(token: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new UnauthorizedError("Not authenticated");

  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("Invalid or expired invite link");
  }

  try {
    await query(
      `SELECT consume_invite_token($1, $2)`,
      [hashToken(token), session.user.id]
    );
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "").toLowerCase();
    if (msg.includes("token_not_found") || msg.includes("token_expired") || msg.includes("token_exhausted")) {
      throw new Error("Invalid or expired invite link");
    }
    if (msg.includes("cap_exceeded")) {
      throw new Error("This organization is full");
    }
    if (msg.includes("already_member")) {
      revalidatePath("/dashboard");
      return;
    }
    fail("invites.joinOrganizationByToken", e, "Could not join organization");
  }

  revalidatePath("/dashboard");
}
