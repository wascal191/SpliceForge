"use server";

import { revalidatePath } from "next/cache";
import { maybeOne, rows, query } from "@/lib/db";
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

  try {
    return await rows<LibraryCable>(
      `SELECT id, name, fiber_count, color_scheme, module_fiber_count, created_at
         FROM library_cables
        WHERE organization_id = $1
        ORDER BY created_at DESC`,
      [ctx.orgId]
    );
  } catch (e) {
    console.error("[library.getLibraryCables]", e);
    return [];
  }
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
  try {
    const data = await maybeOne<LibraryCable>(
      `INSERT INTO library_cables
         (name, fiber_count, color_scheme, module_fiber_count, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, fiber_count, color_scheme, module_fiber_count, created_at`,
      [
        parsed.name,
        parsed.fiberCount,
        parsed.colorScheme,
        parsed.moduleFiberCount ?? null,
        ctx.orgId,
      ]
    );
    if (!data) fail("library.saveToLibrary", new Error("no row"), "Could not save to library");
    revalidatePath("/canvas", "layout");
    return data!;
  } catch (e) {
    fail("library.saveToLibrary", e, "Could not save to library");
  }
}

export async function deleteLibraryCable(id: string) {
  const cleanId = parseOrFail(Uuid, id, "deleteLibraryCable.id");
  const ctx = await requireAuthContext();
  try {
    await query(
      `DELETE FROM library_cables WHERE id = $1 AND organization_id = $2`,
      [cleanId, ctx.orgId]
    );
  } catch (e) {
    fail("library.deleteLibraryCable", e, "Could not delete library cable");
  }
  revalidatePath("/canvas", "layout");
}
