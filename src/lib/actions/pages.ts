"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { maybeOne, rows, query, withTransaction } from "@/lib/db";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import {
  PageDataJson,
  PageTitle,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";

export type Page = {
  id: string;
  organization_id: string;
  bedsheet_id: string;
  page_index: number;
  title: string | null;
  data_json: Record<string, unknown> | null;
  created_at: string;
};

export async function createPage(bedsheetId: string, pageIndex: number, title?: string) {
  const cleanId = parseOrFail(Uuid, bedsheetId, "createPage.bedsheetId");
  const cleanIndex = parseOrFail(z.number().int().min(0).max(10_000), pageIndex, "createPage.index");
  const cleanTitle = title === undefined ? null : parseOrFail(PageTitle, title, "createPage.title");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("bedsheets", cleanId, ctx.orgId);

  try {
    const data = await maybeOne<Page>(
      `INSERT INTO pages (bedsheet_id, page_index, title, organization_id)
         VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cleanId, cleanIndex, cleanTitle, ctx.orgId]
    );
    if (!data) fail("pages.createPage", new Error("no row"), "Could not create page");
    revalidatePath("/canvas", "layout");
    return data!;
  } catch (e) {
    fail("pages.createPage", e, "Could not create page");
  }
}

export async function getPages(bedsheetId: string) {
  const cleanId = parseOrFail(Uuid, bedsheetId, "getPages.bedsheetId");
  const ctx = await requireAuthContext();
  try {
    return await rows<Page>(
      `SELECT * FROM pages
        WHERE bedsheet_id = $1 AND organization_id = $2
        ORDER BY page_index ASC`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("pages.getPages", e, "Could not load pages");
  }
}

export async function renamePage(pageId: string, title: string) {
  const cleanId = parseOrFail(Uuid, pageId, "renamePage.id");
  const cleanTitle = parseOrFail(PageTitle, title, "renamePage.title");
  const ctx = await requireAuthContext();
  try {
    await query(
      `UPDATE pages SET title = $1
        WHERE id = $2 AND organization_id = $3`,
      [cleanTitle, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("pages.renamePage", e, "Could not rename page");
  }
  revalidatePath("/canvas", "layout");
}

export async function deletePage(pageId: string) {
  const cleanId = parseOrFail(Uuid, pageId, "deletePage.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM pages WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("pages.deletePage", e, "Could not delete page");
  }
  revalidatePath("/canvas", "layout");
}

export async function updatePageData(pageId: string, dataJson: unknown) {
  const cleanId = parseOrFail(Uuid, pageId, "updatePageData.id");
  const parsed = parseOrFail(PageDataJson, dataJson, "updatePageData.dataJson");
  const ctx = await requireAuthContext();
  try {
    await query(
      `UPDATE pages SET data_json = $1
        WHERE id = $2 AND organization_id = $3`,
      [parsed, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("pages.updatePageData", e, "Could not save page");
  }
  revalidatePath("/canvas", "layout");
}

const ReorderSchema = z.array(
  z.object({ id: Uuid, page_index: z.number().int().min(0).max(10_000) }).strict()
);

export async function reorderPages(updates: unknown) {
  const parsed = parseOrFail(ReorderSchema, updates, "reorderPages");
  if (parsed.length === 0) return;
  const ctx = await requireAuthContext();
  await assertOrgOwnsRows("pages", parsed.map((p) => p.id), ctx.orgId);

  await withTransaction(async (tx) => {
    for (const { id, page_index } of parsed) {
      await tx.query(
        `UPDATE pages SET page_index = $1
          WHERE id = $2 AND organization_id = $3`,
        [page_index, id, ctx.orgId]
      );
    }
  });
  revalidatePath("/canvas", "layout");
}

export async function duplicatePage(sourcePageId: string, bedsheetId: string) {
  const cleanSource = parseOrFail(Uuid, sourcePageId, "duplicatePage.source");
  const cleanBedsheet = parseOrFail(Uuid, bedsheetId, "duplicatePage.bedsheet");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("pages", cleanSource, ctx.orgId);
  await assertOrgOwnsRow("bedsheets", cleanBedsheet, ctx.orgId);

  const orgId = ctx.orgId;

  return await withTransaction(async (tx) => {
    const srcPageRes = await tx.query<Page>(
      `SELECT * FROM pages WHERE id = $1 AND organization_id = $2`,
      [cleanSource, orgId]
    );
    const srcPage = srcPageRes.rows[0];
    if (!srcPage) throw new Error("Source page not found");

    const countRes = await tx.query<{ c: string }>(
      `SELECT COUNT(*)::TEXT AS c FROM pages
        WHERE bedsheet_id = $1 AND organization_id = $2`,
      [cleanBedsheet, orgId]
    );
    const newIndex = Number(countRes.rows[0]?.c ?? "0");
    const srcTitle = srcPage.title ?? `Page ${srcPage.page_index + 1}`;

    const newPageRes = await tx.query<Page>(
      `INSERT INTO pages
         (bedsheet_id, page_index, title, data_json, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cleanBedsheet, newIndex, `${srcTitle} (copy)`, srcPage.data_json, orgId]
    );
    const newPage = newPageRes.rows[0];
    if (!newPage) throw new Error("Failed to create duplicate page");

    const elementsRes = await tx.query<{
      id: string; type: string; label: string;
      position_x: number; position_y: number;
      config_json: Record<string, unknown> | null;
    }>(
      `SELECT id, type, label, position_x, position_y, config_json
         FROM elements
        WHERE page_id = $1 AND organization_id = $2`,
      [cleanSource, orgId]
    );
    if (elementsRes.rows.length === 0) return newPage;

    const elementIdMap: Record<string, string> = {};
    for (const el of elementsRes.rows) {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO elements
           (page_id, type, label, position_x, position_y, config_json, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [newPage.id, el.type, el.label, el.position_x, el.position_y, el.config_json, orgId]
      );
      const newEl = r.rows[0];
      if (newEl) elementIdMap[el.id] = newEl.id;
    }

    const elementIds = elementsRes.rows.map((e) => e.id);
    const portsRes = await tx.query<{
      id: string; element_id: string; port_index: number;
      fiber_count: number; colors: string[];
    }>(
      `SELECT id, element_id, port_index, fiber_count, colors
         FROM ports
        WHERE element_id = ANY($1::uuid[]) AND organization_id = $2
        ORDER BY port_index ASC`,
      [elementIds, orgId]
    );
    if (portsRes.rows.length === 0) return newPage;

    const portIdMap: Record<string, string> = {};
    for (const port of portsRes.rows) {
      const newElId = elementIdMap[port.element_id];
      if (!newElId) continue;
      const r = await tx.query<{ id: string }>(
        `INSERT INTO ports
           (element_id, port_index, fiber_count, colors, status, organization_id)
         VALUES ($1, $2, $3, $4, 'unoccupied', $5)
         RETURNING id`,
        [newElId, port.port_index, port.fiber_count, port.colors, orgId]
      );
      const newPort = r.rows[0];
      if (newPort) portIdMap[port.id] = newPort.id;
    }

    const portIds = portsRes.rows.map((p) => p.id);
    const splicesRes = await tx.query<{
      id: string; port_from: string; port_to: string;
      comment: string | null; color: string | null;
    }>(
      `SELECT DISTINCT id, port_from, port_to, comment, color
         FROM splices
        WHERE (port_from = ANY($1::uuid[]) OR port_to = ANY($1::uuid[]))
          AND organization_id = $2`,
      [portIds, orgId]
    );

    for (const splice of splicesRes.rows) {
      const newFrom = portIdMap[splice.port_from];
      const newTo = portIdMap[splice.port_to];
      if (!newFrom || !newTo) continue;
      await tx.query(
        `INSERT INTO splices (port_from, port_to, comment, color, organization_id)
           VALUES ($1, $2, $3, $4, $5)`,
        [newFrom, newTo, splice.comment, splice.color, orgId]
      );
      await tx.query(
        `UPDATE ports SET status = 'occupied'
          WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
        [[newFrom, newTo], orgId]
      );
    }

    revalidatePath("/canvas", "layout");
    return newPage;
  });
}
