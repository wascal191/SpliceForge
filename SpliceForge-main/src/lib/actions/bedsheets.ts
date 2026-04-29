"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

export async function createBedsheet(projectId: string, name: string) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("bedsheets")
    .insert({ project_id: projectId, name, organization_id: org.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBedsheets(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bedsheets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBedsheet(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bedsheets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameBedsheet(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bedsheets").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBedsheet(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bedsheets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
