"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrganization } from "./organizations";

export type OrgInvite = {
  id: string;
  organization_id: string;
  token: string;
  created_by: string;
  created_at: string;
};

export async function createInviteToken(): Promise<OrgInvite> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const admin = createAdminClient();
  // One active token per org — revoke existing before creating new
  await admin.from("organization_invites").delete().eq("organization_id", org.id);

  const token = crypto.randomBytes(32).toString("hex");
  const { data, error } = await admin
    .from("organization_invites")
    .insert({ organization_id: org.id, token, created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getInviteToken(): Promise<OrgInvite | null> {
  const org = await getCurrentOrganization();
  if (!org) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_invites")
    .select("*")
    .eq("organization_id", org.id)
    .maybeSingle();
  return data ?? null;
}

export async function revokeInviteToken(): Promise<void> {
  const org = await getCurrentOrganization();
  if (!org) return;

  const admin = createAdminClient();
  await admin.from("organization_invites").delete().eq("organization_id", org.id);
}

// Public — no auth required; used by the join page to show org info
export async function validateInviteToken(
  token: string
): Promise<{ orgId: string; orgName: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_invites")
    .select("organization_id, organizations(id, name)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { id: string; name: string };
  return { orgId: org.id, orgName: org.name };
}

export async function joinOrganizationByToken(token: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const result = await validateInviteToken(token);
  if (!result) throw new Error("Invalid or expired invite link");

  const admin = createAdminClient();

  // Already a member?
  const { data: existing } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", result.orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return; // already in — silently succeed

  const { error } = await admin
    .from("organization_members")
    .insert({ organization_id: result.orgId, user_id: user.id, role: "editor" });
  if (error) throw new Error(error.message);
}
