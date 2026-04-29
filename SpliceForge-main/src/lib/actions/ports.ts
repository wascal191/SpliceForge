"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";
import { getFiberName } from "@/lib/fiber/colors";

export async function createPorts(
  elementId: string,
  count: number,
  startIndex = 0
) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const rows = Array.from({ length: count }, (_, i) => ({
    element_id: elementId,
    port_index: startIndex + i,
    fiber_count: 1,
    colors: [getFiberName(startIndex + i)],
    status: "unoccupied",
    organization_id: org.id,
  }));
  const { data, error } = await supabase
    .from("ports")
    .insert(rows)
    .select()
    .order("port_index", { ascending: true });
  if (error) throw new Error(error.message);
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
  if (elementIds.length === 0) return [];
  const supabase = await createClient();
  const PAGE_SIZE = 1000;
  const all: PortRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ports")
      .select("*")
      .in("element_id", elementIds)
      .order("port_index", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
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
  if (portIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ status })
    .in("id", portIds);
  if (error) throw new Error(error.message);
}

export async function updatePortStatus(
  portId: string,
  status: "occupied" | "unoccupied"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ status })
    .eq("id", portId);
  if (error) throw new Error(error.message);
}

export async function updatePortLabel(
  portId: string,
  label: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ports")
    .update({ label })
    .eq("id", portId);
  if (error) throw new Error(error.message);
}
