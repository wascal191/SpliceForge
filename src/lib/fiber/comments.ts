"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext, assertOrgOwnsRow } from "@/lib/guards";
import { Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

export async function updateSpliceWithPropagation(
  spliceId: string,
  comment: string
) {
  const cleanId = parseOrFail(Uuid, spliceId, "updateSpliceWithPropagation.id");
  const cleanComment = parseOrFail(z.string().max(2000), comment, "updateSpliceWithPropagation.comment");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("splices", cleanId, ctx.orgId);

  const supabase = await createClient();

  const { data: splice, error } = await supabase
    .from("splices")
    .update({ comment: cleanComment })
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId)
    .select("port_from, port_to")
    .single();
  if (error) fail("comments.update.primary", error, "Could not update splice");

  const { data: ports } = await supabase
    .from("ports")
    .select("id, element_id")
    .in("id", [splice.port_from, splice.port_to])
    .eq("organization_id", ctx.orgId);
  if (!ports) return;

  const elementIds = [...new Set(ports.map((p) => p.element_id))];
  const { data: elements } = await supabase
    .from("elements")
    .select("id, type")
    .in("id", elementIds)
    .eq("organization_id", ctx.orgId);
  if (!elements) return;

  for (const el of elements) {
    if (el.type !== "closure" && el.type !== "equipment") continue;

    const { data: allPorts } = await supabase
      .from("ports")
      .select("id")
      .eq("element_id", el.id)
      .eq("organization_id", ctx.orgId);
    if (!allPorts) continue;

    const otherPortIds = allPorts
      .map((p) => p.id)
      .filter((id) => id !== splice.port_from && id !== splice.port_to);
    if (otherPortIds.length === 0) continue;

    // Replace risky `.or("...in.(${list})...")` with two scoped `.in()` updates (V-13).
    await Promise.all([
      supabase
        .from("splices")
        .update({ comment: cleanComment })
        .in("port_from", otherPortIds)
        .eq("organization_id", ctx.orgId),
      supabase
        .from("splices")
        .update({ comment: cleanComment })
        .in("port_to", otherPortIds)
        .eq("organization_id", ctx.orgId),
    ]);
  }
}
