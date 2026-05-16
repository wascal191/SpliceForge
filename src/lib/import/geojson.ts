import type { ImportedBundle, ImportedElement, ImportWarning } from "./types";

type Feature = {
  type?: string;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown } | null;
};

type FeatureCollection = {
  type?: string;
  features?: Feature[];
};

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceElementType(raw: unknown): ImportedElement["type"] | null {
  if (typeof raw !== "string") return null;
  const t = raw.toLowerCase();
  if (t === "cable" || t === "closure" || t === "splitter" || t === "equipment") return t;
  return null;
}

// Reverses src/lib/geo/geojson.ts. Cables come back as LineStrings with a
// path; everything else is a Point. Element type is read from
// properties.nodeType when present (we emit it on export); LineString
// geometry overrides to "cable".
export function parseGeoJson(text: string): ImportedBundle {
  const warnings: ImportWarning[] = [];
  let parsed: FeatureCollection;
  try {
    parsed = JSON.parse(text) as FeatureCollection;
  } catch {
    throw new Error("Invalid JSON in GeoJSON file");
  }

  if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error("Not a GeoJSON FeatureCollection");
  }

  const elements: ImportedElement[] = [];
  const labelCount = new Map<string, number>();

  for (let i = 0; i < parsed.features.length; i++) {
    const f = parsed.features[i];
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const geom = f.geometry;
    if (!geom || !geom.type) {
      warnings.push({ row: i, severity: "warning", message: "Feature has no geometry; skipped" });
      continue;
    }

    const rawLabel = String(props.label ?? props.name ?? `Element ${i + 1}`).trim() || `Element ${i + 1}`;
    const count = (labelCount.get(rawLabel) ?? 0) + 1;
    labelCount.set(rawLabel, count);
    const label = count > 1 ? `${rawLabel} (${count})` : rawLabel;
    const key = `gj-${i}`;

    const inferred =
      geom.type === "LineString" ? "cable" : coerceElementType(props.nodeType);

    if (geom.type === "LineString") {
      const coords = geom.coordinates as [number, number][] | undefined;
      if (!Array.isArray(coords) || coords.length < 2) {
        warnings.push({ row: i, severity: "warning", message: `"${rawLabel}": LineString needs ≥2 points; skipped` });
        continue;
      }
      const path = coords
        .map(([lng, lat]) => ({ lng: Number(lng), lat: Number(lat) }))
        .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
      const fiberCount = Math.max(1, Math.round(asNumber(props.fiberCount) ?? 12));
      const colorScheme = typeof props.colorScheme === "string" && props.colorScheme.length > 0
        ? props.colorScheme
        : "EIA598";
      elements.push({
        key,
        type: "cable",
        label,
        x: 100 + i * 40,
        y: 100,
        config: { fiberCount, colorScheme },
        geo: {
          path,
          address: typeof props.address === "string" ? props.address : undefined,
        },
      });
      continue;
    }

    if (geom.type !== "Point") {
      warnings.push({ row: i, severity: "warning", message: `Unsupported geometry "${geom.type}"; skipped` });
      continue;
    }

    const coords = geom.coordinates as [number, number] | undefined;
    if (!Array.isArray(coords) || coords.length < 2) {
      warnings.push({ row: i, severity: "warning", message: `"${rawLabel}": Point missing coordinates; skipped` });
      continue;
    }
    const lng = asNumber(coords[0]);
    const lat = asNumber(coords[1]);
    if (lat === undefined || lng === undefined) {
      warnings.push({ row: i, severity: "warning", message: `"${rawLabel}": invalid lat/lng; skipped` });
      continue;
    }

    const type = inferred ?? "closure";
    if (inferred == null) {
      warnings.push({
        row: i,
        severity: "warning",
        key,
        message: `"${rawLabel}": type missing — defaulted to closure`,
      });
    }

    const address = typeof props.address === "string" ? props.address : undefined;
    if (type === "splitter") {
      const ratio = typeof props.ratio === "string" ? props.ratio : "1:8";
      const [a, b] = ratio.split(":").map((n) => Math.max(1, Math.round(asNumber(n) ?? 1)));
      elements.push({
        key,
        type: "splitter",
        label,
        x: 200 + i * 40,
        y: 300,
        config: { ratio, inputCount: a, outputCount: b ?? 8 },
        geo: { lat, lng, address },
      });
    } else if (type === "equipment") {
      const inputCount = Math.max(1, Math.round(asNumber(props.inputCount) ?? 2));
      const outputCount = Math.max(1, Math.round(asNumber(props.outputCount) ?? 2));
      elements.push({
        key,
        type: "equipment",
        label,
        x: 200 + i * 40,
        y: 500,
        config: { inputCount, outputCount },
        geo: { lat, lng, address },
      });
    } else {
      const inputCount = Math.max(1, Math.round(asNumber(props.inputCount) ?? 12));
      const outputCount = Math.max(1, Math.round(asNumber(props.outputCount) ?? 12));
      const trayCount = Math.max(1, Math.round(asNumber(props.trayCount) ?? 1));
      elements.push({
        key,
        type: "closure",
        label,
        x: 200 + i * 40,
        y: 400,
        config: { inputCount, outputCount, trayCount },
        geo: { lat, lng, address },
      });
    }
  }

  return { elements, splices: [], warnings };
}
