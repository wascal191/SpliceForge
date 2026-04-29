"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

export async function createSplice(
  portFrom: string,
  portTo: string,
  comment?: string,
  color?: string
) {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("splices")
    .insert({ port_from: portFrom, port_to: portTo, comment, color, organization_id: org.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSplice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("splices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSplicesBatch(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("splices").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function updateSplice(
  id: string,
  updates: { comment?: string; color?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("splices").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createSplicesBatch(
  pairs: { portFrom: string; portTo: string }[]
) {
  if (pairs.length === 0) return [];
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("splices")
    .insert(
      pairs.map((p) => ({
        port_from: p.portFrom,
        port_to: p.portTo,
        organization_id: org.id,
      }))
    )
    .select();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSplicesByPortIds(portIds: string[]) {
  if (portIds.length === 0) return [];
  const supabase = await createClient();

  const BATCH = 80;
  const seen = new Set<string>();
  const all: { id: string; port_from: string; port_to: string; comment: string | null; color: string | null }[] = [];

  for (let i = 0; i < portIds.length; i += BATCH) {
    const batch = portIds.slice(i, i + BATCH);
    const [r1, r2] = await Promise.all([
      supabase.from("splices").select("id, port_from, port_to, comment, color").in("port_from", batch),
      supabase.from("splices").select("id, port_from, port_to, comment, color").in("port_to", batch),
    ]);
    if (r1.error) throw new Error(r1.error.message);
    if (r2.error) throw new Error(r2.error.message);
    for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) {
      if (!seen.has(row.id)) { seen.add(row.id); all.push(row); }
    }
  }
  return all;
}
