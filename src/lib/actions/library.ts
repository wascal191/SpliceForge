"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/guards";
import { LibraryCableInput, Uuid, parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";

export type LibraryCable = {
  id: string;
  name: string;
  fiber_count: number;
  color_scheme: string;
  module_fiber_count: number | null;
  created_at: string;
};

export async function getLibraryCables(): Promise<LibraryCable[]> {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_cables")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[library.getLibraryCables]", error);
    return [];
  }
  return data;
}

export async function saveToLibrary(
  name: string,
  fiberCount: number,
  colorScheme: string,
  moduleFiberCount?: number
): Promise<LibraryCable> {
  const parsed = parseOrFail(
    LibraryCableInput,
    { name, fiberCount, colorScheme, moduleFiberCount },
    "saveToLibrary"
  );

  const ctx = await requireAuthContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_cables")
    .insert({
      name: parsed.name,
      fiber_count: parsed.fiberCount,
      color_scheme: parsed.colorScheme,
      module_fiber_count: parsed.moduleFiberCount ?? null,
      organization_id: ctx.orgId,
    })
    .select()
    .single();
  if (error) fail("library.saveToLibrary", error, "Could not save to library");
  revalidatePath("/canvas", "layout");
  return data;
}

export async function deleteLibraryCable(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteLibraryCable.id");
  const ctx = await requireAuthContext();

  const supabase = await createClient();
  const { error } = await supabase
    .from("library_cables")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", ctx.orgId);
  if (error) fail("library.deleteLibraryCable", error, "Could not delete library cable");
  revalidatePath("/canvas", "layout");
}
