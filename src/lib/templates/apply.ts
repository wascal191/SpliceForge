import type { SupabaseClient } from "@supabase/supabase-js";
import { getFiberName } from "@/lib/fiber/colors";
import { getTemplate, type Template } from "./index";
import { portsForElement } from "./types";

export type AppliedTemplate = {
  bedsheetId: string;
  pageId: string;
  elementCount: number;
  spliceCount: number;
};

// Seeds a bedsheet + first page + elements + ports + splices for the given
// template into an existing project. Works with either the admin client
// (used at signup) or the SSR client (used by the wizard) — caller is
// responsible for auth + org ownership. Skips revalidatePath; callers
// should refresh the routes they care about.
export async function applyTemplate(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  templateOrId: string | Template,
  bedsheetName?: string
): Promise<AppliedTemplate> {
  const template =
    typeof templateOrId === "string" ? getTemplate(templateOrId) : templateOrId;
  if (!template) throw new Error(`Unknown template: ${templateOrId}`);

  const { data: bs, error: bsErr } = await supabase
    .from("bedsheets")
    .insert({
      project_id: projectId,
      organization_id: orgId,
      name: bedsheetName ?? template.defaultBedsheetName,
    })
    .select("id")
    .single();
  if (bsErr || !bs) throw new Error(`applyTemplate.bedsheet: ${bsErr?.message ?? "insert failed"}`);

  const { data: page, error: pageErr } = await supabase
    .from("pages")
    .insert({
      bedsheet_id: bs.id,
      organization_id: orgId,
      page_index: 0,
      title: "Page 1",
    })
    .select("id")
    .single();
  if (pageErr || !page) throw new Error(`applyTemplate.page: ${pageErr?.message ?? "insert failed"}`);

  const keyToElementId: Record<string, string> = {};
  // (elementKey, portIndex) -> port row id
  const portIdByKey: Record<string, Record<number, string>> = {};

  for (const el of template.elements) {
    const { data: elementRow, error: elErr } = await supabase
      .from("elements")
      .insert({
        page_id: page.id,
        organization_id: orgId,
        type: el.type,
        label: el.label,
        position_x: el.positionX,
        position_y: el.positionY,
        config_json: el.config,
      })
      .select("id")
      .single();
    if (elErr || !elementRow) {
      throw new Error(`applyTemplate.element[${el.key}]: ${elErr?.message ?? "insert failed"}`);
    }
    keyToElementId[el.key] = elementRow.id;

    const portCount = portsForElement(el);
    const colorScheme =
      el.type === "cable" ? (el.config.colorScheme as "EIA598") : "EIA598";

    const portRows = Array.from({ length: portCount }, (_, i) => ({
      element_id: elementRow.id,
      organization_id: orgId,
      port_index: i,
      fiber_count: 1,
      colors: [getFiberName(i, colorScheme)],
      status: "unoccupied" as const,
    }));
    const { data: ports, error: portsErr } = await supabase
      .from("ports")
      .insert(portRows)
      .select("id, port_index")
      .order("port_index", { ascending: true });
    if (portsErr || !ports) {
      throw new Error(`applyTemplate.ports[${el.key}]: ${portsErr?.message ?? "insert failed"}`);
    }

    const portMap: Record<number, string> = {};
    for (const p of ports) portMap[p.port_index as number] = p.id as string;
    portIdByKey[el.key] = portMap;
  }

  const spliceRows: Array<{
    port_from: string;
    port_to: string;
    organization_id: string;
    comment: string | null;
  }> = [];
  const occupiedPortIds: string[] = [];
  for (const s of template.splices) {
    const fromId = portIdByKey[s.fromKey]?.[s.fromPortIndex];
    const toId = portIdByKey[s.toKey]?.[s.toPortIndex];
    if (!fromId || !toId) {
      throw new Error(
        `applyTemplate.splice: missing port ${s.fromKey}#${s.fromPortIndex} or ${s.toKey}#${s.toPortIndex}`
      );
    }
    spliceRows.push({
      port_from: fromId,
      port_to: toId,
      organization_id: orgId,
      comment: s.comment ?? null,
    });
    occupiedPortIds.push(fromId, toId);
  }

  if (spliceRows.length > 0) {
    const { error: spErr } = await supabase.from("splices").insert(spliceRows);
    if (spErr) throw new Error(`applyTemplate.splices: ${spErr.message}`);

    const { error: stErr } = await supabase
      .from("ports")
      .update({ status: "occupied" })
      .in("id", occupiedPortIds)
      .eq("organization_id", orgId);
    if (stErr) throw new Error(`applyTemplate.portStatus: ${stErr.message}`);
  }

  return {
    bedsheetId: bs.id as string,
    pageId: page.id as string,
    elementCount: template.elements.length,
    spliceCount: template.splices.length,
  };
}
