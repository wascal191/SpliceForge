"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { maybeOne, rows, query } from "@/lib/db";
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

  let splice: { port_from: string; port_to: string } | null;
  try {
    splice = await maybeOne<{ port_from: string; port_to: string }>(
      `UPDATE splices SET comment = $1
        WHERE id = $2 AND organization_id = $3
       RETURNING port_from, port_to`,
      [cleanComment, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("comments.update.primary", e, "Could not update splice");
  }
  if (!splice) return;

  const ports = await rows<{ id: string; element_id: string }>(
    `SELECT id, element_id FROM ports
      WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
    [[splice.port_from, splice.port_to], ctx.orgId]
  );
  if (ports.length === 0) return;

  const elementIds = [...new Set(ports.map((p) => p.element_id))];
  const elements = await rows<{ id: string; type: string }>(
    `SELECT id, type FROM elements
      WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
    [elementIds, ctx.orgId]
  );

  for (const el of elements) {
    if (el.type !== "closure" && el.type !== "equipment") continue;

    const allPorts = await rows<{ id: string }>(
      `SELECT id FROM ports
        WHERE element_id = $1 AND organization_id = $2`,
      [el.id, ctx.orgId]
    );
    const otherPortIds = allPorts
      .map((p) => p.id)
      .filter((id) => id !== splice!.port_from && id !== splice!.port_to);
    if (otherPortIds.length === 0) continue;

    await query(
      `UPDATE splices SET comment = $1
        WHERE (port_from = ANY($2::uuid[]) OR port_to = ANY($2::uuid[]))
          AND organization_id = $3`,
      [cleanComment, otherPortIds, ctx.orgId]
    );
  }

  revalidatePath("/canvas", "layout");
}
