import type { Template } from "./types";
import { ftthAccess } from "./ftth-access";
import { contractorSplice } from "./contractor-splice";

export const templates: Template[] = [ftthAccess, contractorSplice];

export const templatesById: Record<string, Template> = Object.fromEntries(
  templates.map((t) => [t.id, t])
);

export function getTemplate(id: string): Template | undefined {
  return templatesById[id];
}

export type { Template, TemplateElement, TemplateSplice } from "./types";
