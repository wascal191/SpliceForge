"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { maybeOne, rows, query } from "@/lib/db";
import {
  requireAuthContext,
  assertCallerIsOwnerOfMember,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/guards";
import {
  InvitableRole,
  OrgName,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";

export type Organization = {
  id: string;
  name: string;
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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new UnauthorizedError("Not authenticated");

  try {
    const org = await maybeOne<Organization>(
      `SELECT * FROM create_org_with_owner($1, $2)`,
      [cleanName, session.user.id]
    );
    if (!org) fail("organizations.createOrganization", new Error("no row"), "Could not create organization");
    revalidatePath("/dashboard");
    return org!;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "").toLowerCase();
    if (msg.includes("already_member")) {
      throw new ForbiddenError("Already a member of an organization");
    }
    fail("organizations.createOrganization", e, "Could not create organization");
  }
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  try {
    return await maybeOne<Organization>(
      `SELECT o.*
         FROM organizations o
         JOIN organization_members m ON m.organization_id = o.id
        WHERE m.user_id = $1
        ORDER BY m.created_at ASC
        LIMIT 1`,
      [session.user.id]
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[organizations.getCurrentOrganization]", e);
    return null;
  }
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return [];
  }

  try {
    return await rows<OrgMember>(
      `SELECT
         m.id,
         m.user_id,
         m.role,
         m.created_at,
         u.email,
         u.name AS full_name
       FROM organization_members m
       JOIN "user" u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at ASC`,
      [ctx.orgId]
    );
  } catch (e) {
    fail("organizations.getOrgMembers", e, "Could not list members");
  }
}

export async function getCurrentUserRole(): Promise<string | null> {
  try {
    const ctx = await requireAuthContext();
    return ctx.role;
  } catch {
    return null;
  }
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<void> {
  const cleanId = parseOrFail(Uuid, memberId, "updateMemberRole.id");
  const cleanRole = parseOrFail(InvitableRole, role, "updateMemberRole.role");

  const { targetOrgId } = await assertCallerIsOwnerOfMember(cleanId);

  try {
    await query(
      `UPDATE organization_members
          SET role = $1
        WHERE id = $2 AND organization_id = $3`,
      [cleanRole, cleanId, targetOrgId]
    );
  } catch (e) {
    fail("organizations.updateMemberRole", e, "Could not update role");
  }

  revalidatePath("/dashboard");
}

export async function removeMember(memberId: string): Promise<void> {
  const cleanId = parseOrFail(Uuid, memberId, "removeMember.id");
  const { ctx, targetOrgId } = await assertCallerIsOwnerOfMember(cleanId);

  const target = await maybeOne<{ user_id: string; role: string }>(
    `SELECT user_id, role FROM organization_members WHERE id = $1`,
    [cleanId]
  );

  if (target?.role === "owner") {
    const ownerCount = await maybeOne<{ c: string }>(
      `SELECT COUNT(*)::TEXT AS c
         FROM organization_members
        WHERE organization_id = $1 AND role = 'owner'`,
      [targetOrgId]
    );
    if (Number(ownerCount?.c ?? "0") <= 1) {
      throw new ForbiddenError("Cannot remove the last owner");
    }
  }

  if (target?.user_id === ctx.userId) {
    throw new ForbiddenError("Cannot remove yourself; transfer ownership first");
  }

  try {
    await query(
      `DELETE FROM organization_members
        WHERE id = $1 AND organization_id = $2`,
      [cleanId, targetOrgId]
    );
  } catch (e) {
    fail("organizations.removeMember", e, "Could not remove member");
  }

  revalidatePath("/dashboard");
}
