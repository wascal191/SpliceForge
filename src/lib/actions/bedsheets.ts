"use server";

import { revalidatePath } from "next/cache";
import { maybeOne, rows, query } from "@/lib/db";
import { requireAuthContext, assertOrgOwnsRow } from "@/lib/guards";
import { BedsheetName, Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

export type Bedsheet = {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  map_center_lat: number | null;
  map_center_lng: number | null;
  map_zoom: number | null;
  created_at: string;
};

export async function createBedsheet(projectId: string, name: string) {
  const cleanProjectId = parseOrFail(Uuid, projectId, "createBedsheet.projectId");
  const cleanName = parseOrFail(BedsheetName, name, "createBedsheet.name");

  const ctx = await requireAuthContext();
  await assertOrgOwnsRow("projects", cleanProjectId, ctx.orgId);

  try {
    const data = await maybeOne<Bedsheet>(
      `INSERT INTO bedsheets (project_id, name, organization_id)
         VALUES ($1, $2, $3)
       RETURNING *`,
      [cleanProjectId, cleanName, ctx.orgId]
    );
    if (!data) fail("bedsheets.createBedsheet", new Error("no row"), "Could not create bedsheet");
    revalidatePath("/dashboard");
    return data!;
  } catch (e) {
    fail("bedsheets.createBedsheet", e, "Could not create bedsheet");
  }
}

export async function getBedsheets(projectId: string) {
  const cleanProjectId = parseOrFail(Uuid, projectId, "getBedsheets.projectId");
  const ctx = await requireAuthContext();
  try {
    return await rows<Bedsheet>(
      `SELECT * FROM bedsheets
        WHERE project_id = $1 AND organization_id = $2
        ORDER BY created_at ASC`,
      [cleanProjectId, ctx.orgId]
    );
  } catch (e) {
    fail("bedsheets.getBedsheets", e, "Could not load bedsheets");
  }
}

export async function getBedsheet(id: string) {
  const cleanId = parseOrFail(Uuid, id, "getBedsheet.id");
  const ctx = await requireAuthContext();
  try {
    const data = await maybeOne<Bedsheet>(
      `SELECT * FROM bedsheets WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
    if (!data) fail("bedsheets.getBedsheet", new Error("not found"), "Could not load bedsheet");
    return data!;
  } catch (e) {
    fail("bedsheets.getBedsheet", e, "Could not load bedsheet");
  }
}

export async function renameBedsheet(id: string, name: string) {
  const cleanId = parseOrFail(Uuid, id, "renameBedsheet.id");
  const cleanName = parseOrFail(BedsheetName, name, "renameBedsheet.name");
  const ctx = await requireAuthContext();
  try {
    await query(
      `UPDATE bedsheets SET name = $1
        WHERE id = $2 AND organization_id = $3`,
      [cleanName, cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("bedsheets.renameBedsheet", e, "Could not rename bedsheet");
  }
  revalidatePath("/dashboard");
  revalidatePath(`/canvas/${cleanId}`);
}

export async function deleteBedsheet(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteBedsheet.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM bedsheets WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("bedsheets.deleteBedsheet", e, "Could not delete bedsheet");
  }
  revalidatePath("/dashboard");
}
