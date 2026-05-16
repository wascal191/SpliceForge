import { ImportedBundleV1Schema, type ImportedBundle } from "./types";

// SpliceForge-native JSON bundle. The schema is versioned; only v1 is
// understood today. Round-trip parity with a future JSON exporter is
// listed in Sprint 3.5 follow-ups.
export function parseJson(text: string): ImportedBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (typeof parsed === "object" && parsed !== null && "version" in parsed) {
    const v = (parsed as { version: unknown }).version;
    if (v !== 1) {
      throw new Error(`Unsupported import bundle version: ${String(v)} (only v1 supported)`);
    }
  }

  const result = ImportedBundleV1Schema.safeParse(parsed);
  if (!result.success) {
    const flat = result.error.flatten();
    const first =
      Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "Invalid JSON bundle";
    throw new Error(first);
  }

  return {
    elements: result.data.elements,
    splices: result.data.splices,
    warnings: [],
  };
}
