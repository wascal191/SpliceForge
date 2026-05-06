"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/guards";
import {
  ProjectName,
  ProjectDescription,
  ProjectUpdate,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";

export async function createProject(name: string, description?: string) {
  const cleanName = parseOrFail(ProjectName, name, "createProject.name");
  const cleanDesc =
    description !== undefined && description !== ""
      ? parseOrFail(ProjectDescription, description, "createProject.description")
      : null;

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: cleanName, description: cleanDesc, organization_id: ctx.orgId })
    .select()
    .single();
  if (error) fail("projects.createProject", error, "Could not create project");
  return data;
}

export async function getProjects() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) fail("projects.getProjects", error, "Could not load projects");
  return data;
}

export async function deleteProject(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteProject.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("projects.deleteProject", error, "Could not delete project");
}

export async function updateProject(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateProject.id");
  const parsed = parseOrFail(ProjectUpdate, updates, "updateProject.updates");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(parsed)
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("projects.updateProject", error, "Could not update project");
}

export async function getProjectStats() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return { totalFibers: 0, totalCables: 0 };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("elements")
    .select("config_json")
    .eq("type", "cable")
    .eq("organization_id", ctx.orgId);
  const cables = data ?? [];
  const totalFibers = cables.reduce((sum, el) => {
    const cfg = el.config_json as { fiberCount?: number } | null;
    return sum + (cfg?.fiberCount ?? 0);
  }, 0);
  return { totalFibers, totalCables: cables.length };
}
