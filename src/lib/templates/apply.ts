import { getFiberName } from "@/lib/fiber/colors";
import { getTemplate, type Template } from "./index";
import { portsForElement } from "./types";
import { pool } from "@/lib/db";

export type AppliedTemplate = {
  bedsheetId: string;
  pageId: string;
  elementCount: number;
  spliceCount: number;
};

/**
 * The shape accepted by applyTemplate is a tiny subset of pg's PoolClient
 * (just `query`) so callers can pass either a transactional client (preferred)
 * or the pool directly. Both pg.Pool and pg.PoolClient satisfy this shape at
 * runtime; the explicit interface avoids overload-inference issues in TS.
 */
export interface PgRunner {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: R[] }>;
}

/**
 * Seeds a bedsheet + first page + elements + ports + splices for the given
 * template into an existing project. Caller is responsible for auth + org
 * ownership. Skips revalidatePath; callers should refresh the routes they
 * care about.
 */
export async function applyTemplate(
  runner: PgRunner,
  orgId: string,
  projectId: string,
  templateOrId: string | Template,
  bedsheetName?: string
): Promise<AppliedTemplate> {
  const template =
    typeof templateOrId === "string" ? getTemplate(templateOrId) : templateOrId;
  if (!template) throw new Error(`Unknown template: ${templateOrId}`);

  const bsRes = await runner.query<{ id: string }>(
    `INSERT INTO bedsheets (project_id, organization_id, name)
       VALUES ($1, $2, $3)
     RETURNING id`,
    [projectId, orgId, bedsheetName ?? template.defaultBedsheetName]
  );
  const bsId = bsRes.rows[0]?.id;
  if (!bsId) throw new Error("applyTemplate.bedsheet: insert failed");

  const pageRes = await runner.query<{ id: string }>(
    `INSERT INTO pages (bedsheet_id, organization_id, page_index, title)
       VALUES ($1, $2, 0, 'Page 1')
     RETURNING id`,
    [bsId, orgId]
  );
  const pageId = pageRes.rows[0]?.id;
  if (!pageId) throw new Error("applyTemplate.page: insert failed");

  const keyToElementId: Record<string, string> = {};
  const portIdByKey: Record<string, Record<number, string>> = {};

  for (const el of template.elements) {
    const elRes = await runner.query<{ id: string }>(
      `INSERT INTO elements
         (page_id, organization_id, type, label, position_x, position_y, config_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [pageId, orgId, el.type, el.label, el.positionX, el.positionY, el.config]
    );
    const elementId = elRes.rows[0]?.id;
    if (!elementId) throw new Error(`applyTemplate.element[${el.key}]: insert failed`);
    keyToElementId[el.key] = elementId;

    const portCount = portsForElement(el);
    const colorScheme =
      el.type === "cable" ? (el.config.colorScheme as "EIA598") : "EIA598";

    const portMap: Record<number, string> = {};
    for (let i = 0; i < portCount; i++) {
      const r = await runner.query<{ id: string }>(
        `INSERT INTO ports
           (element_id, organization_id, port_index, fiber_count, colors, status)
         VALUES ($1, $2, $3, 1, $4, 'unoccupied')
         RETURNING id`,
        [elementId, orgId, i, [getFiberName(i, colorScheme)]]
      );
      const portId = r.rows[0]?.id;
      if (portId) portMap[i] = portId;
    }
    portIdByKey[el.key] = portMap;
  }

  const occupiedPortIds: string[] = [];
  for (const s of template.splices) {
    const fromId = portIdByKey[s.fromKey]?.[s.fromPortIndex];
    const toId = portIdByKey[s.toKey]?.[s.toPortIndex];
    if (!fromId || !toId) {
      throw new Error(
        `applyTemplate.splice: missing port ${s.fromKey}#${s.fromPortIndex} or ${s.toKey}#${s.toPortIndex}`
      );
    }
    await runner.query(
      `INSERT INTO splices (port_from, port_to, organization_id, comment)
         VALUES ($1, $2, $3, $4)`,
      [fromId, toId, orgId, s.comment ?? null]
    );
    occupiedPortIds.push(fromId, toId);
  }

  if (occupiedPortIds.length > 0) {
    await runner.query(
      `UPDATE ports SET status = 'occupied'
        WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
      [occupiedPortIds, orgId]
    );
  }

  return {
    bedsheetId: bsId,
    pageId,
    elementCount: template.elements.length,
    spliceCount: template.splices.length,
  };
}

/** Convenience: applyTemplate using the shared pool (no explicit transaction). */
export async function applyTemplateWithPool(
  orgId: string,
  projectId: string,
  templateOrId: string | Template,
  bedsheetName?: string
): Promise<AppliedTemplate> {
  return applyTemplate(pool as unknown as PgRunner, orgId, projectId, templateOrId, bedsheetName);
}
