"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

type ElementType = "cable" | "splitter" | "equipment" | "closure";

export async function createElement(
  pageId: string,
  type: ElementType,
  label: string,
  positionX: number,
  positionY: number,
  configJson: object = {}
) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("elements")
    .insert({
      page_id: pageId,
      type,
      label,
      position_x: positionX,
      position_y: positionY,
      config_json: configJson,
      organization_id: org.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateElement(
  id: string,
  updates: Partial<{
    label: string;
    position_x: number;
    position_y: number;
    config_json: object;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("elements").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateElementsBatch(
  rows: { id: string; config_json: object }[]
) {
  if (rows.length === 0) return;
  const supabase = await createClient();
  await Promise.all(
    rows.map((r) =>
      supabase.from("elements").update({ config_json: r.config_json }).eq("id", r.id)
    )
  );
}

export async function deleteElement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("elements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getElements(pageId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elements")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}
