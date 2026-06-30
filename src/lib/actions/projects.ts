"use server";

import { revalidatePath } from "next/cache";
import { maybeOne, rows, query } from "@/lib/db";
import { requireAuthContext } from "@/lib/guards";
import {
  ProjectName,
  ProjectDescription,
  ProjectUpdate,
  Uuid,
  parseOrFail,
} from "@/lib/validation";
import { fail } from "@/lib/errors";

export type Project = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export async function createProject(name: string, description?: string) {
  const cleanName = parseOrFail(ProjectName, name, "createProject.name");
  const cleanDesc =
    description !== undefined && description !== ""
      ? parseOrFail(ProjectDescription, description, "createProject.description")
      : null;

  const ctx = await requireAuthContext();
  try {
    const data = await maybeOne<Project>(
      `INSERT INTO projects (name, description, organization_id)
         VALUES ($1, $2, $3)
       RETURNING *`,
      [cleanName, cleanDesc, ctx.orgId]
    );
    if (!data) fail("projects.createProject", new Error("no row"), "Could not create project");
    revalidatePath("/dashboard");
    return data!;
  } catch (e) {
    fail("projects.createProject", e, "Could not create project");
  }
}

export async function getProjects() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return [];
  }
  try {
    return await rows<Project>(
      `SELECT * FROM projects
        WHERE organization_id = $1
        ORDER BY created_at DESC`,
      [ctx.orgId]
    );
  } catch (e) {
    fail("projects.getProjects", e, "Could not load projects");
  }
}

export async function deleteProject(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteProject.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM projects WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("projects.deleteProject", e, "Could not delete project");
  }
  revalidatePath("/dashboard");
}

export async function updateProject(id: string, updates: unknown) {
  const cleanId = parseOrFail(Uuid, id, "updateProject.id");
  const parsed = parseOrFail(ProjectUpdate, updates, "updateProject.updates") as Record<string, unknown>;
  const ctx = await requireAuthContext();

  const allowedKeys = ["name", "description"] as const;
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
      `UPDATE projects SET ${sets.join(", ")}
        WHERE id = $${values.length - 1} AND organization_id = $${values.length}`,
      values
    );
  } catch (e) {
    fail("projects.updateProject", e, "Could not update project");
  }
  revalidatePath("/dashboard");
}

export async function getProjectStats() {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return { totalFibers: 0, totalCables: 0 };
  }

  const cables = await rows<{ config_json: { fiberCount?: number } | null }>(
    `SELECT config_json
       FROM elements
      WHERE type = 'cable' AND organization_id = $1`,
    [ctx.orgId]
  );
  const totalFibers = cables.reduce(
    (sum, el) => sum + (el.config_json?.fiberCount ?? 0),
    0
  );
  return { totalFibers, totalCables: cables.length };
}
