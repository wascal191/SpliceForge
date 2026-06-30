"use server";

import { revalidatePath } from "next/cache";
import { maybeOne, rows, query, withTransaction } from "@/lib/db";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import {
  ElementType,
  ElementUpdate,
  ElementLabel,
  Uuid,
  limitedJson,
  parseOrFail,
} from "@/lib/validation";
import { z } from "zod";
import { fail } from "@/lib/errors";

export type ElementRow = {
  id: string;
  organization_id: string;
  page_id: string;
  type: string;
  label: string;
  position_x: number;
  position_y: number;
  config_json: Record<string, unknown> | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_path_json: unknown;
  geo_address: string | null;
  geo_updated_at: string | null;
  created_at: string;
};

const CreateElementSchema = z.object({
  pageId: Uuid,
  type: ElementType,
  label: ElementLabel,
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  configJson: limitedJson.optional(),
});

export async function createElement(
  pageId: string,
  type: string,
  label: string,
  positionX: number,
  positionY: number,
  configJson: object = {}
) {
  const parsed = parseOrFail(
    CreateElementSchema,
    { pageId, type, label, positionX, positionY, configJson },
    "createElement"
  );

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("pages", parsed.pageId, ctx.orgId);

  try {
    const data = await maybeOne<ElementRow>(
      `INSERT INTO elements
         (page_id, type, label, position_x, position_y, config_json, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parsed.pageId,
        parsed.type,
        parsed.label,
        parsed.positionX,
        parsed.positionY,
        parsed.configJson ?? {},
        ctx.orgId,
      ]
    );
    if (!data) fail("elements.createElement", new Error("no row"), "Could not create element");
    revalidatePath("/canvas", "layout");
    return data!;
  } catch (e) {
    fail("elements.createElement", e, "Could not create element");
  }
}

export async function updateElement(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateElement.id");
  const parsed = parseOrFail(ElementUpdate, updates, "updateElement.updates") as Record<string, unknown>;
  const ctx = await requireAuthContext();

  const allowedKeys = ["label", "position_x", "position_y", "config_json"] as const;
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
      `UPDATE elements SET ${sets.join(", ")}
        WHERE id = $${values.length - 1} AND organization_id = $${values.length}`,
      values
    );
  } catch (e) {
    fail("elements.updateElement", e, "Could not update element");
  }
  revalidatePath("/canvas", "layout");
}

const ElementBatchSchema = z.array(
  z.object({ id: Uuid, config_json: limitedJson }).strict()
);

export async function updateElementsBatch(input: unknown) {
  const parsed = parseOrFail(ElementBatchSchema, input, "updateElementsBatch");
  if (parsed.length === 0) return;

  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("elements", parsed.map((r) => r.id), ctx.orgId);

  await withTransaction(async (tx) => {
    for (const r of parsed) {
      await tx.query(
        `UPDATE elements SET config_json = $1
          WHERE id = $2 AND organization_id = $3`,
        [r.config_json, r.id, ctx.orgId]
      );
    }
  });
  revalidatePath("/canvas", "layout");
}

export async function deleteElement(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteElement.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM elements WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("elements.deleteElement", e, "Could not delete element");
  }
  revalidatePath("/canvas", "layout");
}

export async function getElements(pageId: string) {
  const cleanPageId = parseOrFail(Uuid, pageId, "getElements.pageId");
  const ctx = await requireAuthContext();
  try {
    return await rows<ElementRow>(
      `SELECT * FROM elements
        WHERE page_id = $1 AND organization_id = $2
        ORDER BY created_at ASC`,
      [cleanPageId, ctx.orgId]
    );
  } catch (e) {
    fail("elements.getElements", e, "Could not load elements");
  }
}

const UpdateGeoSchema = z.object({
  elementId: Uuid,
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  path: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

export async function updateElementGeo(input: z.infer<typeof UpdateGeoSchema>) {
  const parsed = parseOrFail(UpdateGeoSchema, input, "updateElementGeo");
  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("elements", parsed.elementId, ctx.orgId);

  try {
    const data = await maybeOne<ElementRow>(
      `UPDATE elements SET
          geo_lat = $1,
          geo_lng = $2,
          geo_path_json = $3,
          geo_address = $4,
          geo_updated_at = $5
        WHERE id = $6 AND organization_id = $7
        RETURNING *`,
      [
        parsed.lat ?? null,
        parsed.lng ?? null,
        parsed.path ? JSON.stringify(parsed.path) : null,
        parsed.address ?? null,
        new Date().toISOString(),
        parsed.elementId,
        ctx.orgId,
      ]
    );
    revalidatePath("/canvas", "layout");
    return data;
  } catch (e) {
    fail("elements.updateElementGeo", e, "Could not update element geometry");
  }
}
