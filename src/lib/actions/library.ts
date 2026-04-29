"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/actions/organizations";

export type LibraryCable = {
  id: string;
  name: string;
  fiber_count: number;
  color_scheme: string;
  module_fiber_count: number | null;
  created_at: string;
};

export async function getLibraryCables(): Promise<LibraryCable[]> {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) return [];

  const { data, error } = await supabase
    .from("library_cables")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function saveToLibrary(
  name: string,
  fiberCount: number,
  colorScheme: string,
  moduleFiberCount?: number
): Promise<LibraryCable> {
  const supabase = await createClient();
  const org = await getCurrentOrganization();
  if (!org) throw new Error("No organization found");

  const { data, error } = await supabase
    .from("library_cables")
    .insert({
      name,
      fiber_count: fiberCount,
      color_scheme: colorScheme,
      module_fiber_count: moduleFiberCount ?? null,
      organization_id: org.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLibraryCable(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("library_cables").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
