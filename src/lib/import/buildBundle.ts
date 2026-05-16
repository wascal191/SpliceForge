import type {
  BulkImportInput,
  ImportSource,
  ImportedBundle,
  ImportedElement,
  ImportedSplice,
} from "./types";

// Final normalization pass before the bulkImport server action sees the
// payload. Ensures keys are unique, layout positions are filled in for
// any element that came in without one (e.g. JSON without `position`),
// and splice port indices reference real elements.
export function buildBulkInput(
  pageId: string,
  source: ImportSource,
  bundle: ImportedBundle
): BulkImportInput {
  const seenKeys = new Set<string>();
  const remap = new Map<string, string>(); // old key → new key (dedupe)
  const elements: ImportedElement[] = [];

  let cableX = 0;
  let closureX = 0;
  let splitterX = 0;
  let equipmentX = 0;

  for (const el of bundle.elements) {
    let key = el.key;
    if (seenKeys.has(key)) {
      let suffix = 2;
      while (seenKeys.has(`${el.key}#${suffix}`)) suffix++;
      key = `${el.key}#${suffix}`;
      remap.set(el.key, key);
    } else {
      remap.set(el.key, key);
    }
    seenKeys.add(key);

    let x = el.x;
    let y = el.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      switch (el.type) {
        case "cable":     { x = (cableX++)     * 220; y = 100;  break; }
        case "closure":   { x = (closureX++)   * 220; y = 400;  break; }
        case "splitter":  { x = (splitterX++)  * 220; y = 700;  break; }
        case "equipment": { x = (equipmentX++) * 220; y = 1000; break; }
      }
    }

    elements.push({ ...el, key, x, y });
  }

  const splices: ImportedSplice[] = [];
  for (const s of bundle.splices) {
    const fromKey = remap.get(s.fromKey) ?? s.fromKey;
    const toKey = remap.get(s.toKey) ?? s.toKey;
    if (!seenKeys.has(fromKey) || !seenKeys.has(toKey)) continue;
    splices.push({ ...s, fromKey, toKey });
  }

  return {
    pageId,
    source,
    elements,
    splices,
  };
}
