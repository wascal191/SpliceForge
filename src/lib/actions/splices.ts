"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRows } from "@/lib/guards";
import { ColorString, SpliceUpdate, Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

export async function createSplice(
  portFrom: string,
  portTo: string,
  comment?: string,
  color?: string
) {
  const cleanFrom = parseOrFail(Uuid, portFrom, "createSplice.from");
  const cleanTo = parseOrFail(Uuid, portTo, "createSplice.to");
  const cleanComment = comment !== undefined ? parseOrFail(z.string().max(2000), comment, "createSplice.comment") : null;
  const cleanColor = color !== undefined ? parseOrFail(ColorString, color, "createSplice.color") : null;

  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("ports", [cleanFrom, cleanTo], ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("splices")
    .insert({
      port_from: cleanFrom,
      port_to: cleanTo,
      comment: cleanComment,
      color: cleanColor,
      organization_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) fail("splices.createSplice", error, "Could not create splice");
  return data;
}

export async function deleteSplice(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteSplice.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("splices")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("splices.deleteSplice", error, "Could not delete splice");
}

export async function deleteSplicesBatch(ids: string[]) {
  const cleanIds = parseOrFail(z.array(Uuid).max(5000), ids, "deleteSplicesBatch");
  if (cleanIds.length === 0) return;

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("splices")
    .delete()
    .in("id", cleanIds)
    .eq("organization_id", ctx.orgId);
  if (error) fail("splices.deleteSplicesBatch", error, "Could not delete splices");
}

export async function updateSplice(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateSplice.id");
  const parsed = parseOrFail(SpliceUpdate, updates, "updateSplice.updates");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("splices")
    .update(parsed)
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("splices.updateSplice", error, "Could not update splice");
}

const PairsSchema = z
  .array(z.object({ portFrom: Uuid, portTo: Uuid }).strict())
  .max(5000);

export async function createSplicesBatch(pairs: unknown) {
  const parsed = parseOrFail(PairsSchema, pairs, "createSplicesBatch");
  if (parsed.length === 0) return [];

  const ctx = await requireAuthContext();
  const portIds = Array.from(new Set(parsed.flatMap((p) => [p.portFrom, p.portTo])));
  await assertOrgOwnsRows("ports", portIds, ctx.orgId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("splices")
    .insert(
      parsed.map((p) => ({
        port_from: p.portFrom,
        port_to: p.portTo,
        organization_id: ctx.orgId,
      }))
    )
    .select();
  if (error) fail("splices.createSplicesBatch", error, "Could not create splices");
  return data;
}

export async function getSplicesByPortIds(portIds: string[]) {
  const cleanIds = parseOrFail(z.array(Uuid).max(10_000), portIds, "getSplicesByPortIds");
  if (cleanIds.length === 0) return [];

  const ctx = await requireAuthContext();
  const supabase = await createClient();

  const BATCH = 80;
  const seen = new Set<string>();
  const all: { id: string; port_from: string; port_to: string; comment: string | null; color: string | null }[] = [];

  for (let i = 0; i < cleanIds.length; i += BATCH) {
    const batch = cleanIds.slice(i, i + BATCH);
    const [r1, r2] = await Promise.all([
      supabase
        .from("splices")
        .select("id, port_from, port_to, comment, color")
        .in("port_from", batch)
        .eq("organization_id", ctx.orgId),
      supabase
        .from("splices")
        .select("id, port_from, port_to, comment, color")
        .in("port_to", batch)
        .eq("organization_id", ctx.orgId),
    ]);
    if (r1.error) fail("splices.getSplicesByPortIds.r1", r1.error, "Could not load splices");
    if (r2.error) fail("splices.getSplicesByPortIds.r2", r2.error, "Could not load splices");
    for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        all.push(row);
      }
    }
  }
  return all;
}
