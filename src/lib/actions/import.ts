"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

// Pre-compute the color array per element so the RPC doesn't need to know
// about color schemes. Ports are addressed by index, so the array's
// position == the port_index it'll be inserted with.
function portColorsFor(
  el: BulkImportInput["elements"][number]
): string[] {
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

  // Annotate each element with its precomputed port colors so the RPC can
  // INSERT them in a single generate_series call.
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_bundle", {
    p_page_id: parsed.pageId,
    p_payload: payload,
  });

  if (error) {
    fail("import.bulkImport", error, "Could not import");
  }

  const result = data as RpcResult;

  revalidatePath("/canvas", "layout");

  return {
    elementIds: result.elementIds,
    ports: result.ports,
    spliceIds: result.spliceIds,
    elementCount: result.elementCount,
    spliceCount: result.spliceCount,
  };
}
