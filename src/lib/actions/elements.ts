"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import {
  ElementType,
  ElementUpdate,
  ElementLabel,
  Uuid,
  limitedJson,
  parseOrFail,
} from "@/lib/validation";
import { z } from "zod";
import { fail } from "@/lib/errors";

const CreateElementSchema = z.object({
  pageId: Uuid,
  type: ElementType,
  label: ElementLabel,
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  configJson: limitedJson.optional(),
});

export async function createElement(
  pageId: string,
  type: string,
  label: string,
  positionX: number,
  positionY: number,
  configJson: object = {}
) {
  const parsed = parseOrFail(
    CreateElementSchema,
    { pageId, type, label, positionX, positionY, configJson },
    "createElement"
  );

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("pages", parsed.pageId, ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elements")
    .insert({
      page_id: parsed.pageId,
      type: parsed.type,
      label: parsed.label,
      position_x: parsed.positionX,
      position_y: parsed.positionY,
      config_json: parsed.configJson ?? {},
      organization_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) fail("elements.createElement", error, "Could not create element");
  revalidatePath("/canvas", "layout");
  return data;
}

export async function updateElement(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateElement.id");
  const parsed = parseOrFail(ElementUpdate, updates, "updateElement.updates");

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("elements")
    .update(parsed)
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("elements.updateElement", error, "Could not update element");
  revalidatePath("/canvas", "layout");
}

const ElementBatchSchema = z.array(
  z.object({ id: Uuid, config_json: limitedJson }).strict()
);

export async function updateElementsBatch(rows: unknown) {
  const parsed = parseOrFail(ElementBatchSchema, rows, "updateElementsBatch");
  if (parsed.length === 0) return;

  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("elements", parsed.map((r) => r.id), ctx.orgId);

  const supabase = await createClient();
  await Promise.all(
    parsed.map((r) =>
      supabase
        .from("elements")
        .update({ config_json: r.config_json })
        .eq("id", r.id)
        .eq("organization_id", ctx.orgId)
    )
  );
  revalidatePath("/canvas", "layout");
}

export async function deleteElement(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteElement.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("elements")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("elements.deleteElement", error, "Could not delete element");
  revalidatePath("/canvas", "layout");
}

export async function getElements(pageId: string) {
  const cleanPageId = parseOrFail(Uuid, pageId, "getElements.pageId");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elements")
    .select("*")
    .eq("page_id", cleanPageId)
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: true });
  if (error) fail("elements.getElements", error, "Could not load elements");
  return data;
}

const UpdateGeoSchema = z.object({
  elementId: Uuid,
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  path: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

export async function updateElementGeo(input: z.infer<typeof UpdateGeoSchema>) {
  const parsed = parseOrFail(UpdateGeoSchema, input, "updateElementGeo");
  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("elements", parsed.elementId, ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elements")
    .update({
      geo_lat: parsed.lat ?? null,
      geo_lng: parsed.lng ?? null,
      geo_path_json: parsed.path ?? null,
      geo_address: parsed.address ?? null,
      geo_updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.elementId)
    .select()
    .single();
  if (error) fail("elements.updateElementGeo", error, "Could not update element geometry");
  revalidatePath("/canvas", "layout");
  return data;
}
