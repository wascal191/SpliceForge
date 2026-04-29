"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

export async function createPage(bedsheetId: string, pageIndex: number, title?: string) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("pages")
    .insert({ bedsheet_id: bedsheetId, page_index: pageIndex, title, organization_id: org.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPages(bedsheetId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("bedsheet_id", bedsheetId)
    .order("page_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function renamePage(pageId: string, title: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ title })
    .eq("id", pageId);
  if (error) throw new Error(error.message);
}

export async function deletePage(pageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pages").delete().eq("id", pageId);
  if (error) throw new Error(error.message);
}

export async function updatePageData(pageId: string, dataJson: object) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({ data_json: dataJson })
    .eq("id", pageId);
  if (error) throw new Error(error.message);
}

export async function reorderPages(updates: { id: string; page_index: number }[]) {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, page_index }) =>
      supabase.from("pages").update({ page_index }).eq("id", id)
    )
  );
}

export async function duplicatePage(sourcePageId: string, bedsheetId: string) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const orgId = org.id;

  const [{ data: srcPage }, { count }] = await Promise.all([
    supabase.from("pages").select("*").eq("id", sourcePageId).single(),
    supabase.from("pages").select("*", { count: "exact", head: true }).eq("bedsheet_id", bedsheetId),
  ]);
  if (!srcPage) throw new Error("Source page not found");

  const newIndex = count ?? 0;
  const srcTitle = srcPage.title ?? `Page ${srcPage.page_index + 1}`;

  const { data: newPage, error: pageErr } = await supabase
    .from("pages")
    .insert({
      bedsheet_id: bedsheetId,
      page_index: newIndex,
      title: `${srcTitle} (copy)`,
      data_json: srcPage.data_json,
      organization_id: orgId,
    })
    .select()
    .single();
  if (pageErr || !newPage) throw new Error(pageErr?.message ?? "Failed to create page copy");

  const { data: elements } = await supabase
    .from("elements")
    .select("*")
    .eq("page_id", sourcePageId);
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

  const { data: ports } = await supabase
    .from("ports")
    .select("*")
    .in("element_id", elements.map((e) => e.id))
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
  const list = portIds.join(",");
  const { data: splices } = await supabase
    .from("splices")
    .select("*")
    .or(`port_from.in.(${list}),port_to.in.(${list})`);

  if (splices && splices.length > 0) {
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
      await supabase.from("ports").update({ status: "occupied" }).in("id", [newFrom, newTo]);
    }
  }

  return newPage;
}
