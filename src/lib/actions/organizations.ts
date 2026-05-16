"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthContext,
  assertCallerIsOwnerOfMember,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/guards";
import {
  Email,
  InvitableRole,
  OrgName,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";
import { env, MAX_MEMBERS_PER_ORG } from "@/env";

export type Organization = {
  id: string;
  name: string;
  plan?: string | null;
  api_base_url?: string | null;
  created_at: string;
};

export type OrgMember = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
};

export async function createOrganization(name: string): Promise<Organization> {
  const cleanName = parseOrFail(OrgName, name, "createOrganization.name");

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new UnauthorizedError("Not authenticated");

  const admin = createAdminClient();

  // Atomic: org insert + owner-member insert run inside the RPC. If either
  // fails, neither row persists. See docs/migrations/2026-05-12-org-rpc.sql.
  const { data: org, error } = await admin.rpc("create_org_with_owner", {
    p_name: cleanName,
    p_user_id: user.id,
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("already_member")) {
      throw new ForbiddenError("Already a member of an organization");
    }
    fail("organizations.createOrganization", error, "Could not create organization");
  }

  revalidatePath("/dashboard");
  return org as Organization;
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Use admin client here to avoid the recursive RLS issue on organization_members
  // (the select policy queries organization_members itself). This is safe because
  // we filter strictly by the authenticated user's id from auth.getUser().
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    const e = error as unknown as Record<string, unknown>;
    // eslint-disable-next-line no-console
    console.error("[organizations.getCurrentOrganization]", { message: e.message, code: e.code, details: e.details, hint: e.hint });
    return null;
  }

  const first = Array.isArray(data) ? data[0] : data;
  return (first?.organizations as unknown as Organization) ?? null;
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: true });
  if (error) fail("organizations.getOrgMembers", error, "Could not list members");
  if (!data || data.length === 0) return [];

  // Single auth lookup instead of N getUserById() round-trips. The org cap
  // makes 1000 a safe upper bound today; if multi-org listing is added later,
  // paginate this call.
  const { data: usersRes, error: usersErr } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersErr) {
    fail(
      "organizations.getOrgMembers.listUsers",
      usersErr,
      "Could not list members"
    );
  }

  const byId = new Map<string, { email: string | null; full_name: string | null }>();
  for (const u of usersRes?.users ?? []) {
    const meta = (u.user_metadata ?? {}) as { full_name?: unknown };
    byId.set(u.id, {
      email: u.email ?? null,
      full_name:
        typeof meta.full_name === "string" ? meta.full_name : null,
    });
  }

  return data.map((m) => {
    const u = byId.get(m.user_id);
    return {
      ...m,
      email: u?.email ?? null,
      full_name: u?.full_name ?? null,
    };
  });
}

export async function getCurrentUserRole(): Promise<string | null> {
  try {
    const ctx = await requireAuthContext();
    return ctx.role;
  } catch {
    return null;
  }
}

export async function inviteMember(
  email: string,
  role: string = "editor"
): Promise<void> {
  const cleanEmail = parseOrFail(Email, email, "inviteMember.email");
  const cleanRole = parseOrFail(InvitableRole, role, "inviteMember.role");

  const ctx = await requireAuthContext();
  if (ctx.role !== "owner") throw new ForbiddenError("Only owners can invite members");

  const admin = createAdminClient();

  // Enforce the org member cap server-side (UI tampering cannot bypass).
  const { count } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);

  if ((count ?? 0) >= MAX_MEMBERS_PER_ORG) {
    throw new Error(
      `Maximum ${MAX_MEMBERS_PER_ORG} users per organization on this plan`
    );
  }

  // CRITICAL: do NOT pass `data` (=> user_metadata, attacker-controllable
  // post-confirmation). Org/role attachment is performed via server-side
  // app_metadata which only the service role can write.
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    cleanEmail,
    { redirectTo: `${siteUrl}/auth/callback` }
  );
  if (error) fail("organizations.inviteMember.invite", error, "Could not send invite");

  if (invited?.user) {
    const { error: updErr } = await admin.auth.admin.updateUserById(
      invited.user.id,
      {
        app_metadata: {
          invited_org_id: ctx.orgId,
          invited_role: cleanRole,
        },
      }
    );
    if (updErr) fail("organizations.inviteMember.appMeta", updErr, "Could not send invite");
  }

  revalidatePath("/dashboard");
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<void> {
  const cleanId = parseOrFail(Uuid, memberId, "updateMemberRole.id");
  // Owners are managed via a separate flow; here we only allow demoting/
  // promoting between editor and viewer.
  const cleanRole = parseOrFail(InvitableRole, role, "updateMemberRole.role");

  const { targetOrgId } = await assertCallerIsOwnerOfMember(cleanId);

  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_members")
    .update({ role: cleanRole })
    .eq("id", cleanId)
    .eq("organization_id", targetOrgId); // defense in depth
  if (error) fail("organizations.updateMemberRole", error, "Could not update role");

  revalidatePath("/dashboard");
}

export async function removeMember(memberId: string): Promise<void> {
  const cleanId = parseOrFail(Uuid, memberId, "removeMember.id");
  const { ctx, targetOrgId } = await assertCallerIsOwnerOfMember(cleanId);

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("id", cleanId)
    .maybeSingle();

  if (target?.role === "owner") {
    const { count: ownerCount } = await admin
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", targetOrgId)
      .eq("role", "owner");
    if ((ownerCount ?? 0) <= 1) {
      throw new ForbiddenError("Cannot remove the last owner");
    }
  }

  if (target?.user_id === ctx.userId) {
    throw new ForbiddenError("Cannot remove yourself; transfer ownership first");
  }

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", targetOrgId);
  if (error) fail("organizations.removeMember", error, "Could not remove member");

  // Best-effort: also clear app_metadata so the user doesn't auto-rejoin
  // through a stale invite payload.
  if (target?.user_id) {
    try {
      await admin.auth.admin.updateUserById(target.user_id, {
        app_metadata: {},
      });
    } catch {
      /* non-fatal */
    }
  }

  revalidatePath("/dashboard");
}
