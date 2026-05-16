"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({ name: cleanName, description: cleanDesc, organization_id: ctx.orgId })
    .select("id")
    .single();
  if (projErr || !project) fail("templates.createProjectFromTemplate", projErr, "Could not create project");

  let applied;
  try {
    applied = await applyTemplate(supabase, ctx.orgId, project.id as string, template);
  } catch (err) {
    // Roll back the project if seeding failed so the user doesn't end up with
    // a half-built shell that violates their expectations of "from template".
    await supabase.from("projects").delete().eq("id", project.id).eq("organization_id", ctx.orgId);
    throw err;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/canvas/${applied.bedsheetId}`);
  return {
    projectId: project.id as string,
    bedsheetId: applied.bedsheetId,
    pageId: applied.pageId,
  };
}
