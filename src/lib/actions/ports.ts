"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import { PortLabel, PortStatus, Uuid, parseOrFail } from "@/lib/validation";
import { getFiberName } from "@/lib/fiber/colors";
import { fail } from "@/lib/errors";

export async function createPorts(
  elementId: string,
  count: number,
  startIndex = 0
) {
  const cleanElement = parseOrFail(Uuid, elementId, "createPorts.elementId");
  const cleanCount = parseOrFail(z.number().int().min(1).max(2048), count, "createPorts.count");
  const cleanStart = parseOrFail(z.number().int().min(0).max(10_000), startIndex, "createPorts.startIndex");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("elements", cleanElement, ctx.orgId);

  const supabase = await createClient();
  const rows = Array.from({ length: cleanCount }, (_, i) => ({
    element_id: cleanElement,
    port_index: cleanStart + i,
    fiber_count: 1,
    colors: [getFiberName(cleanStart + i)],
    status: "unoccupied",
    organization_id: ctx.orgId,
  }));
  const { data, error } = await supabase
    .from("ports")
    .insert(rows)
    .select()
    .order("port_index", { ascending: true });
  if (error) fail("ports.createPorts", error, "Could not create ports");
  revalidatePath("/canvas", "layout");
  return data;
}

type PortRow = {
  id: string;
  element_id: string;
  port_index: number;
  colors: string[];
  status: string;
  label: string | null;
  [key: string]: unknown;
};

export async function getPortsByElements(elementIds: string[]): Promise<PortRow[]> {
  const cleanIds = parseOrFail(z.array(Uuid).max(2048), elementIds, "getPortsByElements");
  if (cleanIds.length === 0) return [];

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const PAGE_SIZE = 1000;
  const all: PortRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ports")
      .select("*")
      .in("element_id", cleanIds)
      .eq("organization_id", ctx.orgId)
      .order("port_index", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) fail("ports.getPortsByElements", error, "Could not load ports");
    if (!data || data.length === 0) break;
    all.push(...(data as PortRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function updatePortStatusBatch(
  portIds: string[],
  status: "occupied" | "unoccupied"
) {
  const cleanIds = parseOrFail(z.array(Uuid).max(5000), portIds, "updatePortStatusBatch.ids");
  const cleanStatus = parseOrFail(PortStatus, status, "updatePortStatusBatch.status");
  if (cleanIds.length === 0) return;

  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("ports", cleanIds, ctx.orgId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ status: cleanStatus })
    .in("id", cleanIds)
    .eq("organization_id", ctx.orgId);
  if (error) fail("ports.updatePortStatusBatch", error, "Could not update ports");
  revalidatePath("/canvas", "layout");
}

export async function updatePortStatus(
  portId: string,
  status: "occupied" | "unoccupied"
) {
  const cleanId = parseOrFail(Uuid, portId, "updatePortStatus.id");
  const cleanStatus = parseOrFail(PortStatus, status, "updatePortStatus.status");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ status: cleanStatus })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("ports.updatePortStatus", error, "Could not update port");
  revalidatePath("/canvas", "layout");
}

export async function updatePortLabel(
  portId: string,
  label: string | null
): Promise<void> {
  const cleanId = parseOrFail(Uuid, portId, "updatePortLabel.id");
  const cleanLabel = parseOrFail(PortLabel, label, "updatePortLabel.label");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ label: cleanLabel })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("ports.updatePortLabel", error, "Could not update port label");
  revalidatePath("/canvas", "layout");
}
