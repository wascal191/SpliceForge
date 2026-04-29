"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Prefer admin client (bypasses RLS); fall back to authenticated server client
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = createAdminClient() as unknown as Awaited<ReturnType<typeof createClient>>;
  } catch {
    db = supabase;
  }

  const { data: org, error } = await db
    .from("organizations")
    .insert({ name })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: memberError } = await db
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  return org;
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Use admin client so RLS doesn't block the read; filter by user_id explicitly
  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = createAdminClient() as unknown as Awaited<ReturnType<typeof createClient>>;
  } catch {
    db = supabase;
  }

  const { data } = await db
    .from("organization_members")
    .select("organizations(*)")
    .eq("user_id", user.id)
    .limit(1);

  const first = Array.isArray(data) ? data[0] : data;
  return (first?.organizations as unknown as Organization) ?? null;
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data) return [];

  const members = await Promise.all(
    data.map(async (m) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(m.user_id);
        return {
          ...m,
          email: user?.email ?? null,
          full_name: (user?.user_metadata?.full_name as string | undefined) ?? null,
        };
      } catch {
        return { ...m, email: null, full_name: null };
      }
    })
  );
  return members;
}

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const org = await getCurrentOrganization();
  if (!org) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role ?? null;
}

export async function inviteMember(
  email: string,
  role: string = "editor"
): Promise<void> {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  // Enforce 5-user cap
  const { count } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", org.id);

  if ((count ?? 0) >= 5) {
    throw new Error("Maximum 5 users per company in test mode");
  }

  // Send invite via Supabase Admin (requires SUPABASE_SERVICE_ROLE_KEY)
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { organization_id: org.id, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  });
  if (error) throw new Error(error.message);
}

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_members")
    .update({ role })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function removeMember(memberId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}
