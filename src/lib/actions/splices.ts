"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { maybeOne, rows, query } from "@/lib/db";
import { requireAuthContext, assertOrgOwnsRows } from "@/lib/guards";
import { ColorString, SpliceUpdate, Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

type SpliceRow = {
  id: string;
  organization_id: string;
  port_from: string;
  port_to: string;
  comment: string | null;
  color: string | null;
  created_at: string;
};

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

  try {
    const data = await maybeOne<SpliceRow>(
      `INSERT INTO splices (port_from, port_to, comment, color, organization_id)
         VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cleanFrom, cleanTo, cleanComment, cleanColor, ctx.orgId]
    );
    if (!data) fail("splices.createSplice", new Error("no row"), "Could not create splice");
    revalidatePath("/canvas", "layout");
    return data!;
  } catch (e) {
    fail("splices.createSplice", e, "Could not create splice");
  }
}

export async function deleteSplice(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteSplice.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM splices WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("splices.deleteSplice", e, "Could not delete splice");
  }
  revalidatePath("/canvas", "layout");
}

export async function deleteSplicesBatch(ids: string[]) {
  const cleanIds = parseOrFail(z.array(Uuid).max(5000), ids, "deleteSplicesBatch");
  if (cleanIds.length === 0) return;

  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM splices
        WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
      [cleanIds, ctx.orgId]
    );
  } catch (e) {
    fail("splices.deleteSplicesBatch", e, "Could not delete splices");
  }
  revalidatePath("/canvas", "layout");
}

export async function updateSplice(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateSplice.id");
  const parsed = parseOrFail(SpliceUpdate, updates, "updateSplice.updates") as Record<string, unknown>;
  const ctx = await requireAuthContext();

  const allowedKeys = ["comment", "color"] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of allowedKeys) {
    if (k in parsed) {
      values.push(parsed[k]);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (sets.length === 0) return;
  values.push(cleanId, ctx.orgId);
  try {
    await query(
      `UPDATE splices SET ${sets.join(", ")}
        WHERE id = $${values.length - 1} AND organization_id = $${values.length}`,
      values
    );
  } catch (e) {
    fail("splices.updateSplice", e, "Could not update splice");
  }
  revalidatePath("/canvas", "layout");
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

  // Build a multi-row VALUES insert.
  const fromArr = parsed.map((p) => p.portFrom);
  const toArr = parsed.map((p) => p.portTo);
  try {
    return await rows<SpliceRow>(
      `INSERT INTO splices (port_from, port_to, organization_id)
       SELECT unnest($1::uuid[]) AS port_from,
              unnest($2::uuid[]) AS port_to,
              $3::uuid AS organization_id
       RETURNING *`,
      [fromArr, toArr, ctx.orgId]
    );
  } catch (e) {
    fail("splices.createSplicesBatch", e, "Could not create splices");
  } finally {
    revalidatePath("/canvas", "layout");
  }
}

export async function getSplicesByPortIds(portIds: string[]) {
  const cleanIds = parseOrFail(z.array(Uuid).max(10_000), portIds, "getSplicesByPortIds");
  if (cleanIds.length === 0) return [];
  const ctx = await requireAuthContext();
  try {
    return await rows<Pick<SpliceRow, "id" | "port_from" | "port_to" | "comment" | "color">>(
      `SELECT DISTINCT id, port_from, port_to, comment, color
         FROM splices
        WHERE (port_from = ANY($1::uuid[]) OR port_to = ANY($1::uuid[]))
          AND organization_id = $2`,
      [cleanIds, ctx.orgId]
    );
  } catch (e) {
    fail("splices.getSplicesByPortIds", e, "Could not load splices");
  }
}
