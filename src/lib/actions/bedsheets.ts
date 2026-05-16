"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRow } from "@/lib/guards";
import { BedsheetName, Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

export async function createBedsheet(projectId: string, name: string) {
  const cleanProjectId = parseOrFail(Uuid, projectId, "createBedsheet.projectId");
  const cleanName = parseOrFail(BedsheetName, name, "createBedsheet.name");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("projects", cleanProjectId, ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bedsheets")
    .insert({
      project_id: cleanProjectId,
      name: cleanName,
      organization_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) fail("bedsheets.createBedsheet", error, "Could not create bedsheet");
  revalidatePath("/dashboard");
  return data;
}

export async function getBedsheets(projectId: string) {
  const cleanProjectId = parseOrFail(Uuid, projectId, "getBedsheets.projectId");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bedsheets")
    .select("*")
    .eq("project_id", cleanProjectId)
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: true });
  if (error) fail("bedsheets.getBedsheets", error, "Could not load bedsheets");
  return data;
}

export async function getBedsheet(id: string) {
  const cleanId = parseOrFail(Uuid, id, "getBedsheet.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bedsheets")
    .select("*")
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId)
    .single();
  if (error) fail("bedsheets.getBedsheet", error, "Could not load bedsheet");
  return data;
}

export async function renameBedsheet(id: string, name: string) {
  const cleanId = parseOrFail(Uuid, id, "renameBedsheet.id");
  const cleanName = parseOrFail(BedsheetName, name, "renameBedsheet.name");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bedsheets")
    .update({ name: cleanName })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("bedsheets.renameBedsheet", error, "Could not rename bedsheet");
  revalidatePath("/dashboard");
  revalidatePath(`/canvas/${cleanId}`);
}

export async function deleteBedsheet(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteBedsheet.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bedsheets")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("bedsheets.deleteBedsheet", error, "Could not delete bedsheet");
  revalidatePath("/dashboard");
}
