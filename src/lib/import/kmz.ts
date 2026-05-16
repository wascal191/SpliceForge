import JSZip from "jszip";
import type { ImportedBundle, ImportedElement, ImportWarning } from "./types";

const PARENT_FOLDER_TO_TYPE: Record<string, ImportedElement["type"]> = {
  cables: "cable",
  cable: "cable",
  closures: "closure",
  closure: "closure",
  splitters: "splitter",
  splitter: "splitter",
  equipments: "equipment",
  equipment: "equipment",
};

const STYLE_URL_TO_TYPE: Array<{ pattern: RegExp; type: ImportedElement["type"] }> = [
  { pattern: /cable/i, type: "cable" },
  { pattern: /closure/i, type: "closure" },
  { pattern: /splitter/i, type: "splitter" },
  { pattern: /equipment/i, type: "equipment" },
];

function parseCoords(text: string): { lng: number; lat: number }[] {
  return text
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(",").map(Number))
    .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map(([lng, lat]) => ({ lng, lat }));
}

function inferType(folderName: string, styleUrl: string | null): {
  type: ImportedElement["type"];
  guessed: boolean;
} {
  const folder = folderName.toLowerCase().trim();
  if (folder in PARENT_FOLDER_TO_TYPE) return { type: PARENT_FOLDER_TO_TYPE[folder], guessed: false };

  if (styleUrl) {
    for (const { pattern, type } of STYLE_URL_TO_TYPE) {
      if (pattern.test(styleUrl)) return { type, guessed: false };
    }
  }
  return { type: "closure", guessed: true };
}

// Reverses src/lib/geo/kmz.ts. Type is inferred from the parent
// <Folder><name> first, then <styleUrl>; if nothing matches we default
// to "closure" and flag a warning so the user can fix it in preview.
export async function parseKmz(file: File): Promise<ImportedBundle> {
  const warnings: ImportWarning[] = [];
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // KMZ always contains doc.kml at the root.
  let kmlText: string | null = null;
  const candidates = Object.keys(zip.files);
  for (const name of candidates) {
    if (/(^|\/)doc\.kml$/i.test(name) || name.toLowerCase().endsWith(".kml")) {
      kmlText = await zip.files[name].async("text");
      break;
    }
  }
  if (!kmlText) throw new Error("KMZ file does not contain a .kml document");

  const doc = new DOMParser().parseFromString(kmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("KML document is malformed");

  const elements: ImportedElement[] = [];
  const labelCount = new Map<string, number>();
  let index = 0;

  const folders = Array.from(doc.querySelectorAll("Folder"));
  // If a KML has no Folders (some exporters skip them), fall back to the
  // document-level Placemarks.
  const fallbackPlacemarks = folders.length === 0
    ? [{ folderName: "", placemarks: Array.from(doc.querySelectorAll("Placemark")) }]
    : null;

  const groups: Array<{ folderName: string; placemarks: Element[] }> = fallbackPlacemarks
    ?? folders.map((f) => ({
        folderName: f.querySelector(":scope > name")?.textContent?.trim() ?? "",
        placemarks: Array.from(f.querySelectorAll(":scope > Placemark")),
      }));

  for (const { folderName, placemarks } of groups) {
    for (const pm of placemarks) {
      const rawLabel = pm.querySelector(":scope > name")?.textContent?.trim() || `Element ${index + 1}`;
      const count = (labelCount.get(rawLabel) ?? 0) + 1;
      labelCount.set(rawLabel, count);
      const label = count > 1 ? `${rawLabel} (${count})` : rawLabel;
      const key = `kmz-${index}`;
      index += 1;

      const styleUrl = pm.querySelector(":scope > styleUrl")?.textContent?.trim() ?? null;
      const { type, guessed } = inferType(folderName, styleUrl);

      const line = pm.querySelector("LineString > coordinates")?.textContent ?? null;
      const point = pm.querySelector("Point > coordinates")?.textContent ?? null;

      if (line) {
        const path = parseCoords(line);
        if (path.length < 2) {
          warnings.push({ row: index, key, severity: "warning", message: `"${rawLabel}": LineString needs ≥2 points; skipped` });
          continue;
        }
        elements.push({
          key,
          type: "cable",
          label,
          x: 100 + index * 40,
          y: 100,
          config: { fiberCount: 12, colorScheme: "EIA598" },
          geo: { path },
        });
        continue;
      }

      if (point) {
        const parts = point.trim().split(",").map(Number);
        const [lng, lat] = parts;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          warnings.push({ row: index, key, severity: "warning", message: `"${rawLabel}": invalid Point coordinates; skipped` });
          continue;
        }

        if (guessed) {
          warnings.push({
            row: index,
            key,
            severity: "warning",
            message: `"${rawLabel}": type could not be inferred — defaulted to closure`,
          });
        }

        const ix = 200 + index * 40;
        if (type === "splitter") {
          elements.push({
            key, type: "splitter", label, x: ix, y: 300,
            config: { ratio: "1:8", inputCount: 1, outputCount: 8 },
            geo: { lat, lng },
          });
        } else if (type === "equipment") {
          elements.push({
            key, type: "equipment", label, x: ix, y: 500,
            config: { inputCount: 2, outputCount: 2 },
            geo: { lat, lng },
          });
        } else if (type === "cable") {
          // Cable as a Point is unusual but harmless — treat as a stub
          // with no path so the user can drag it on the map.
          elements.push({
            key, type: "cable", label, x: ix, y: 100,
            config: { fiberCount: 12, colorScheme: "EIA598" },
            geo: { lat, lng },
          });
        } else {
          elements.push({
            key, type: "closure", label, x: ix, y: 400,
            config: { inputCount: 12, outputCount: 12, trayCount: 1 },
            geo: { lat, lng },
          });
        }
        continue;
      }

      warnings.push({ row: index, key, severity: "warning", message: `"${rawLabel}": unsupported geometry; skipped` });
    }
  }

  return { elements, splices: [], warnings };
}
