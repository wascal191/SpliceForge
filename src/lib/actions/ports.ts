"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rows, query, withTransaction } from "@/lib/db";
import { requireAuthContext, assertOrgOwnsRow, assertOrgOwnsRows } from "@/lib/guards";
import { PortLabel, PortStatus, Uuid, parseOrFail } from "@/lib/validation";
import { getFiberName } from "@/lib/fiber/colors";
import { fail } from "@/lib/errors";

type PortRow = {
  id: string;
  element_id: string;
  port_index: number;
  fiber_count: number;
  colors: string[];
  status: string;
  label: string | null;
  organization_id: string;
  created_at: string;
};

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

  try {
    return await withTransaction(async (tx) => {
      const out: PortRow[] = [];
      for (let i = 0; i < cleanCount; i++) {
        const r = await tx.query<PortRow>(
          `INSERT INTO ports
             (element_id, port_index, fiber_count, colors, status, organization_id)
           VALUES ($1, $2, 1, $3, 'unoccupied', $4)
           RETURNING *`,
          [
            cleanElement,
            cleanStart + i,
            [getFiberName(cleanStart + i)],
            ctx.orgId,
          ]
        );
        if (r.rows[0]) out.push(r.rows[0]);
      }
      revalidatePath("/canvas", "layout");
      return out.sort((a, b) => a.port_index - b.port_index);
    });
  } catch (e) {
    fail("ports.createPorts", e, "Could not create ports");
  }
}

export async function getPortsByElements(elementIds: string[]): Promise<PortRow[]> {
  const cleanIds = parseOrFail(z.array(Uuid).max(2048), elementIds, "getPortsByElements");
  if (cleanIds.length === 0) return [];
  const ctx = await requireAuthContext();
  try {
    return await rows<PortRow>(
      `SELECT * FROM ports
        WHERE element_id = ANY($1::uuid[]) AND organization_id = $2
        ORDER BY port_index ASC`,
      [cleanIds, ctx.orgId]
    );
  } catch (e) {
    fail("ports.getPortsByElements", e, "Could not load ports");
  }
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

  try {
    await query(
      `UPDATE ports SET status = $1
        WHERE id = ANY($2::uuid[]) AND organization_id = $3`,
      [cleanStatus, cleanIds, ctx.orgId]
    );
  } catch (e) {
    fail("ports.updatePortStatusBatch", e, "Could not update ports");
  }
  revalidatePath("/canvas", "layout");
}

export async function updatePortStatus(
  portId: string,
  status: "occupied" | "unoccupied"
) {
  const cleanId = parseOrFail(Uuid, portId, "updatePortStatus.id");
  const cleanStatus = parseOrFail(PortStatus, status, "updatePortStatus.status");
  const ctx = await requireAuthContext();
  try {
    await query(
      `UPDATE ports SET status = $1
        WHERE id = $2 AND organization_id = $3`,
      [cleanStatus, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("ports.updatePortStatus", e, "Could not update port");
  }
  revalidatePath("/canvas", "layout");
}

export async function updatePortLabel(
  portId: string,
  label: string | null
): Promise<void> {
  const cleanId = parseOrFail(Uuid, portId, "updatePortLabel.id");
  const cleanLabel = parseOrFail(PortLabel, label, "updatePortLabel.label");
  const ctx = await requireAuthContext();
  try {
    await query(
      `UPDATE ports SET label = $1
        WHERE id = $2 AND organization_id = $3`,
      [cleanLabel, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("ports.updatePortLabel", e, "Could not update port label");
  }
  revalidatePath("/canvas", "layout");
}
