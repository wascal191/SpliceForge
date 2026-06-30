"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireAuthContext, requireRole, assertOrgOwnsRow } from "@/lib/guards";
import { parseOrFail } from "@/lib/validation";
import { fail } from "@/lib/errors";
import { getFiberName, type FiberColorScheme } from "@/lib/fiber/colors";
import {
  BulkImportInputSchema,
  portCountForElement,
  type BulkImportInput,
  type BulkImportResult,
} from "@/lib/import/types";

function portColorsFor(el: BulkImportInput["elements"][number]): string[] {
  const scheme: FiberColorScheme =
    el.type === "cable" ? (el.config.colorScheme as FiberColorScheme) : "EIA598";
  const count = portCountForElement(el);
  return Array.from({ length: count }, (_, i) => getFiberName(i, scheme));
}

type RpcResult = {
  elementIds: Record<string, string>;
  ports: Record<string, BulkImportResult["ports"][string]>;
  spliceIds: BulkImportResult["spliceIds"];
  elementCount: number;
  spliceCount: number;
};

export async function bulkImport(input: BulkImportInput): Promise<BulkImportResult> {
  const parsed = parseOrFail(BulkImportInputSchema, input, "bulkImport");

  const ctx = await requireAuthContext();
  requireRole(ctx, ["owner", "editor"]);
  await assertOrgOwnsRow("pages", parsed.pageId, ctx.orgId);

  const elementsForRpc = parsed.elements.map((el) => ({
    key: el.key,
    type: el.type,
    label: el.label,
    x: el.x,
    y: el.y,
    config: el.config,
    geo: el.geo ?? null,
    port_colors: portColorsFor(el),
  }));

  const payload = {
    elements: elementsForRpc,
    splices: parsed.splices,
  };

  try {
    const res = await query<{ import_bundle: RpcResult }>(
      `SELECT import_bundle($1, $2::jsonb, $3) AS import_bundle`,
      [parsed.pageId, JSON.stringify(payload), ctx.userId]
    );
    const data = res.rows[0]?.import_bundle;
    if (!data) fail("import.bulkImport", new Error("no result"), "Could not import");

    revalidatePath("/canvas", "layout");

    return {
      elementIds: data.elementIds,
      ports: data.ports,
      spliceIds: data.spliceIds,
      elementCount: data.elementCount,
      spliceCount: data.spliceCount,
    };
  } catch (e) {
    fail("import.bulkImport", e, "Could not import");
  }
}
