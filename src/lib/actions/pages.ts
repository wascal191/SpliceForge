"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import {
  PageDataJson,
  PageTitle,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";

export async function createPage(bedsheetId: string, pageIndex: number, title?: string) {
  const cleanId = parseOrFail(Uuid, bedsheetId, "createPage.bedsheetId");
  const cleanIndex = parseOrFail(z.number().int().min(0).max(10_000), pageIndex, "createPage.index");
  const cleanTitle = title === undefined ? null : parseOrFail(PageTitle, title, "createPage.title");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("bedsheets", cleanId, ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .insert({
      bedsheet_id: cleanId,
      page_index: cleanIndex,
      title: cleanTitle,
      organization_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) fail("pages.createPage", error, "Could not create page");
  revalidatePath("/canvas", "layout");
  return data;
}

export async function getPages(bedsheetId: string) {
  const cleanId = parseOrFail(Uuid, bedsheetId, "getPages.bedsheetId");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("bedsheet_id", cleanId)
    .eq("organization_id", ctx.orgId)
    .order("page_index", { ascending: true });
  if (error) fail("pages.getPages", error, "Could not load pages");
  return data;
}

export async function renamePage(pageId: string, title: string) {
  const cleanId = parseOrFail(Uuid, pageId, "renamePage.id");
  const cleanTitle = parseOrFail(PageTitle, title, "renamePage.title");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ title: cleanTitle })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("pages.renamePage", error, "Could not rename page");
  revalidatePath("/canvas", "layout");
}

export async function deletePage(pageId: string) {
  const cleanId = parseOrFail(Uuid, pageId, "deletePage.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("pages.deletePage", error, "Could not delete page");
  revalidatePath("/canvas", "layout");
}

export async function updatePageData(pageId: string, dataJson: unknown) {
  const cleanId = parseOrFail(Uuid, pageId, "updatePageData.id");
  const parsed = parseOrFail(PageDataJson, dataJson, "updatePageData.dataJson");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ data_json: parsed })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("pages.updatePageData", error, "Could not save page");
  revalidatePath("/canvas", "layout");
}

const ReorderSchema = z.array(
  z.object({ id: Uuid, page_index: z.number().int().min(0).max(10_000) }).strict()
);

export async function reorderPages(updates: unknown) {
  const parsed = parseOrFail(ReorderSchema, updates, "reorderPages");
  if (parsed.length === 0) return;
  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("pages", parsed.map((p) => p.id), ctx.orgId);

  const supabase = await createClient();
  await Promise.all(
    parsed.map(({ id, page_index }) =>
      supabase
        .from("pages")
        .update({ page_index })
        .eq("id", id)
        .eq("organization_id", ctx.orgId)
    )
  );
  revalidatePath("/canvas", "layout");
}

export async function duplicatePage(sourcePageId: string, bedsheetId: string) {
  const cleanSource = parseOrFail(Uuid, sourcePageId, "duplicatePage.source");
  const cleanBedsheet = parseOrFail(Uuid, bedsheetId, "duplicatePage.bedsheet");

  const ctx = await requireAuthContext();
  // Both source page and target bedsheet must belong to the caller's org.
  await assertOrgOwnsRow("pages", cleanSource, ctx.orgId);
  await assertOrgOwnsRow("bedsheets", cleanBedsheet, ctx.orgId);

  const supabase = await createClient();
  const orgId = ctx.orgId;

  const [{ data: srcPage }, { count }] = await Promise.all([
    supabase
      .from("pages")
      .select("*")
      .eq("id", cleanSource)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("bedsheet_id", cleanBedsheet)
      .eq("organization_id", orgId),
  ]);
  if (!srcPage) throw new Error("Source page not found");

  const newIndex = count ?? 0;
  const srcTitle = srcPage.title ?? `Page ${srcPage.page_index + 1}`;

  const { data: newPage, error: pageErr } = await supabase
    .from("pages")
    .insert({
      bedsheet_id: cleanBedsheet,
      page_index: newIndex,
      title: `${srcTitle} (copy)`,
      data_json: srcPage.data_json,
      organization_id: orgId,
    })
    .select()
    .single();
  if (pageErr || !newPage) fail("pages.duplicatePage.insert", pageErr, "Could not duplicate page");

  const { data: elements } = await supabase
    .from("elements")
    .select("*")
    .eq("page_id", cleanSource)
    .eq("organization_id", orgId);
  if (!elements || elements.length === 0) return newPage;

  const elementIdMap: Record<string, string> = {};
  for (const el of elements) {
    const { data: newEl } = await supabase
      .from("elements")
      .insert({
        page_id: newPage.id,
        type: el.type,
        label: el.label,
        position_x: el.position_x,
        position_y: el.position_y,
        config_json: el.config_json,
        organization_id: orgId,
      })
      .select("id")
      .single();
    if (newEl) elementIdMap[el.id] = newEl.id;
  }

  const elementIds = elements.map((e) => e.id);
  const { data: ports } = await supabase
    .from("ports")
    .select("*")
    .in("element_id", elementIds)
    .eq("organization_id", orgId)
    .order("port_index", { ascending: true });
  if (!ports || ports.length === 0) return newPage;

  const portIdMap: Record<string, string> = {};
  for (const port of ports) {
    const newElId = elementIdMap[port.element_id];
    if (!newElId) continue;
    const { data: newPort } = await supabase
      .from("ports")
      .insert({
        element_id: newElId,
        port_index: port.port_index,
        fiber_count: port.fiber_count,
        colors: port.colors,
        status: "unoccupied",
        organization_id: orgId,
      })
      .select("id")
      .single();
    if (newPort) portIdMap[port.id] = newPort.id;
  }

  const portIds = ports.map((p) => p.id);
  if (portIds.length === 0) return newPage;

  // Replace risky `.or("port_from.in.(${list})...")` interpolation with
  // typed paired `.in()` queries unioned in memory (V-13).
  const [r1, r2] = await Promise.all([
    supabase
      .from("splices")
      .select("*")
      .in("port_from", portIds)
      .eq("organization_id", orgId),
    supabase
      .from("splices")
      .select("*")
      .in("port_to", portIds)
      .eq("organization_id", orgId),
  ]);
  const seen = new Set<string>();
  const splices: Array<{
    id: string;
    port_from: string;
    port_to: string;
    comment: string | null;
    color: string | null;
  }> = [];
  for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      splices.push(row);
    }
  }

  if (splices.length > 0) {
    for (const splice of splices) {
      const newFrom = portIdMap[splice.port_from];
      const newTo = portIdMap[splice.port_to];
      if (!newFrom || !newTo) continue;
      await supabase.from("splices").insert({
        port_from: newFrom,
        port_to: newTo,
        comment: splice.comment,
        color: splice.color,
        organization_id: orgId,
      });
      await supabase
        .from("ports")
        .update({ status: "occupied" })
        .in("id", [newFrom, newTo])
        .eq("organization_id", orgId);
    }
  }

  revalidatePath("/canvas", "layout");
  return newPage;
}
