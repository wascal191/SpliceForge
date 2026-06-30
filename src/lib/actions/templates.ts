"use server";

import { revalidatePath } from "next/cache";
import { withTransaction, query } from "@/lib/db";
import { requireAuthContext, requireRole } from "@/lib/guards";
import { ProjectName, parseOrFail } from "@/lib/validation";
import { z } from "zod";
import { fail } from "@/lib/errors";
import { applyTemplate } from "@/lib/templates/apply";
import { getTemplate, templates } from "@/lib/templates";

const TemplateId = z.enum(["ftth-access", "contractor-splice"]);

export async function listTemplates() {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    elementCount: t.elements.length,
    spliceCount: t.splices.length,
  }));
}

export async function createProjectFromTemplate(
  name: string,
  templateId: string,
  description?: string
) {
  const cleanName = parseOrFail(ProjectName, name, "createProjectFromTemplate.name");
  const cleanTemplateId = parseOrFail(TemplateId, templateId, "createProjectFromTemplate.templateId");
  const cleanDesc =
    description !== undefined && description !== ""
      ? parseOrFail(z.string().trim().max(2000), description, "createProjectFromTemplate.description")
      : null;

  const ctx = await requireAuthContext();
  requireRole(ctx, ["owner", "editor"]);
  const template = getTemplate(cleanTemplateId);
  if (!template) throw new Error("Unknown template");

  let projectId: string;
  try {
    const projectRow = await query<{ id: string }>(
      `INSERT INTO projects (name, description, organization_id)
         VALUES ($1, $2, $3)
       RETURNING id`,
      [cleanName, cleanDesc, ctx.orgId]
    );
    projectId = projectRow.rows[0]?.id;
    if (!projectId) fail("templates.createProjectFromTemplate", new Error("no row"), "Could not create project");
  } catch (e) {
    fail("templates.createProjectFromTemplate", e, "Could not create project");
  }

  let applied;
  try {
    applied = await withTransaction((tx) =>
      applyTemplate(tx, ctx.orgId, projectId, template)
    );
  } catch (err) {
    // Roll back the project if seeding failed so the user doesn't end up with
    // a half-built shell.
    await query(
      `DELETE FROM projects WHERE id = $1 AND organization_id = $2`,
      [projectId, ctx.orgId]
    );
    throw err;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/canvas/${applied.bedsheetId}`);
  return {
    projectId,
    bedsheetId: applied.bedsheetId,
    pageId: applied.pageId,
  };
}
