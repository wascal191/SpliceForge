"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

export async function createProject(name: string, description?: string) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, organization_id: org.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getProjects() {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateProject(id: string, updates: { name?: string; description?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getProjectStats() {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) return { totalFibers: 0, totalCables: 0 };

  const { data } = await supabase
    .from("elements")
    .select("config_json")
    .eq("type", "cable")
    .eq("organization_id", org.id);
  const cables = data ?? [];
  const totalFibers = cables.reduce((sum, el) => {
    const cfg = el.config_json as { fiberCount?: number } | null;
    return sum + (cfg?.fiberCount ?? 0);
  }, 0);
  return { totalFibers, totalCables: cables.length };
}
