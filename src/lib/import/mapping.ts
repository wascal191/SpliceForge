import type {
  ImportedBundle,
  ImportedElement,
  ImportedSplice,
  ImportWarning,
} from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Column-mapping engine shared by the CSV importer and the (improved)
// XLSX importer. Two-pass: autoDetectMapping() guesses field-to-column
// matches the user can override, applyMapping() then projects rows into
// ImportedElement[] / ImportedSplice[].
// ────────────────────────────────────────────────────────────────────────────

export type ElementField =
  | "label"
  | "type"
  | "fiberCount"
  | "colorScheme"
  | "moduleSize"
  | "inputCount"
  | "outputCount"
  | "ratio"
  | "trayCount"
  | "lat"
  | "lng";

export type ConnectionField =
  | "fromLabel"
  | "fromPortIndex"
  | "toLabel"
  | "toPortIndex"
  | "comment";

export type ColumnMap = {
  elements: Partial<Record<ElementField, string>>;
  connections?: Partial<Record<ConnectionField, string>>;
};

const ELEMENT_HEURISTICS: Array<{ field: ElementField; pattern: RegExp }> = [
  { field: "label", pattern: /^(label|name|node|element)$/i },
  { field: "type", pattern: /^(type|kind|category)$/i },
  { field: "fiberCount", pattern: /fiber.?count|fibers?$/i },
  { field: "colorScheme", pattern: /color.?scheme|color.?code/i },
  { field: "moduleSize", pattern: /module.?(size|fiber)/i },
  { field: "inputCount", pattern: /^inputs?$|input.?count/i },
  { field: "outputCount", pattern: /^outputs?$|output.?count/i },
  { field: "ratio", pattern: /^ratio$|split.?ratio/i },
  { field: "trayCount", pattern: /tray.?count|trays/i },
  { field: "lat", pattern: /^lat(itude)?$/i },
  { field: "lng", pattern: /^(lng|lon|longitude)$/i },
];

const CONNECTION_HEURISTICS: Array<{ field: ConnectionField; pattern: RegExp }> = [
  { field: "fromLabel", pattern: /from.?(element|label|name)/i },
  { field: "fromPortIndex", pattern: /from.?port/i },
  { field: "toLabel", pattern: /to.?(element|label|name)/i },
  { field: "toPortIndex", pattern: /to.?port/i },
  { field: "comment", pattern: /^(comment|note|notes|description)$/i },
];

export function autoDetectMapping(columns: string[]): ColumnMap {
  const elements: Partial<Record<ElementField, string>> = {};
  const connections: Partial<Record<ConnectionField, string>> = {};

  const trimmed = columns.map((c) => c.trim());

  for (const c of trimmed) {
    for (const { field, pattern } of ELEMENT_HEURISTICS) {
      if (!elements[field] && pattern.test(c)) {
        elements[field] = c;
        break;
      }
    }
    for (const { field, pattern } of CONNECTION_HEURISTICS) {
      if (!connections[field] && pattern.test(c)) {
        connections[field] = c;
        break;
      }
    }
  }

  return { elements, connections };
}

function readNumber(row: Record<string, unknown>, col: string | undefined): number | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readString(row: Record<string, unknown>, col: string | undefined): string | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function coerceType(raw: string | undefined): ImportedElement["type"] | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  if (t === "cable" || t === "closure" || t === "splitter" || t === "equipment") return t;
  return null;
}

// Y/X grid positioning copied from the old ImportDialog so users land on a
// readable canvas even when their CSV has no layout hints.
const Y_BY_TYPE: Record<ImportedElement["type"], number> = {
  cable: 100,
  closure: 400,
  splitter: 700,
  equipment: 1000,
};

export type ApplyMappingResult = ImportedBundle;

export function applyMapping(
  elementRows: Record<string, unknown>[],
  connectionRows: Record<string, unknown>[] | undefined,
  mapping: ColumnMap
): ApplyMappingResult {
  const warnings: ImportWarning[] = [];
  const elements: ImportedElement[] = [];
  const splices: ImportedSplice[] = [];

  const labelCounts = new Map<string, number>();
  for (const r of elementRows) {
    const raw = readString(r, mapping.elements.label) ?? "";
    if (raw) labelCounts.set(raw, (labelCounts.get(raw) ?? 0) + 1);
  }
  const labelSeen = new Map<string, number>();
  const labelToKey = new Map<string, string>();

  const xCounters: Record<ImportedElement["type"], number> = {
    cable: 0,
    closure: 0,
    splitter: 0,
    equipment: 0,
  };

  for (let i = 0; i < elementRows.length; i++) {
    const row = elementRows[i];
    const sheetRow = i + 2;
    const rawLabel = readString(row, mapping.elements.label);
    if (!rawLabel) {
      warnings.push({ row: sheetRow, severity: "error", field: "label", message: "Missing Label" });
      continue;
    }
    const type = coerceType(readString(row, mapping.elements.type));
    if (!type) {
      warnings.push({
        row: sheetRow,
        severity: "error",
        field: "type",
        message: `Unknown or missing Type for "${rawLabel}"`,
      });
      continue;
    }

    const total = labelCounts.get(rawLabel) ?? 1;
    const seen = labelSeen.get(rawLabel) ?? 0;
    labelSeen.set(rawLabel, seen + 1);
    const label = total > 1 ? `${rawLabel} (${seen + 1})` : rawLabel;
    const key = total > 1 ? `${rawLabel}#${seen}` : rawLabel;
    labelToKey.set(rawLabel, total > 1 ? `${rawLabel}#0` : rawLabel);

    const col = xCounters[type]++;
    const x = col * 220;
    const y = Y_BY_TYPE[type];

    const lat = readNumber(row, mapping.elements.lat);
    const lng = readNumber(row, mapping.elements.lng);
    const geo = lat != null && lng != null ? { lat, lng } : undefined;

    if (type === "cable") {
      const fiberCount = Math.max(1, Math.round(readNumber(row, mapping.elements.fiberCount) ?? 12));
      const colorScheme = readString(row, mapping.elements.colorScheme) ?? "EIA598";
      const moduleSize = readNumber(row, mapping.elements.moduleSize);
      elements.push({
        key, type: "cable", label, x, y,
        config: {
          fiberCount,
          colorScheme,
          ...(moduleSize ? { moduleFiberCount: Math.round(moduleSize) } : {}),
        },
        geo,
      });
    } else if (type === "splitter") {
      const inputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.inputCount) ?? 1));
      const outputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.outputCount) ?? 8));
      const ratio = readString(row, mapping.elements.ratio) ?? `${inputCount}:${outputCount}`;
      elements.push({
        key, type: "splitter", label, x, y,
        config: { ratio, inputCount, outputCount },
        geo,
      });
    } else if (type === "equipment") {
      const inputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.inputCount) ?? 2));
      const outputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.outputCount) ?? 2));
      elements.push({
        key, type: "equipment", label, x, y,
        config: { inputCount, outputCount },
        geo,
      });
    } else {
      const inputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.inputCount) ?? 6));
      const outputCount = Math.max(1, Math.round(readNumber(row, mapping.elements.outputCount) ?? 6));
      const trayCount = Math.max(1, Math.round(readNumber(row, mapping.elements.trayCount) ?? 1));
      elements.push({
        key, type: "closure", label, x, y,
        config: { inputCount, outputCount, trayCount },
        geo,
      });
    }
  }

  if (connectionRows && mapping.connections) {
    for (let i = 0; i < connectionRows.length; i++) {
      const row = connectionRows[i];
      const sheetRow = i + 2;
      const fromLabel = readString(row, mapping.connections.fromLabel);
      const toLabel = readString(row, mapping.connections.toLabel);
      const fromPort = readNumber(row, mapping.connections.fromPortIndex);
      const toPort = readNumber(row, mapping.connections.toPortIndex);

      if (!fromLabel || !toLabel) {
        warnings.push({ row: sheetRow, severity: "error", message: "Connection missing From/To label" });
        continue;
      }
      if (fromPort == null || toPort == null) {
        warnings.push({ row: sheetRow, severity: "error", message: "Connection missing port number" });
        continue;
      }

      const fromKey = labelToKey.get(fromLabel);
      const toKey = labelToKey.get(toLabel);
      if (!fromKey || !toKey) {
        warnings.push({
          row: sheetRow,
          severity: "error",
          message: `Connection references unknown element "${!fromKey ? fromLabel : toLabel}"`,
        });
        continue;
      }

      splices.push({
        fromKey,
        fromPortIndex: Math.max(0, Math.round(fromPort) - 1),
        toKey,
        toPortIndex: Math.max(0, Math.round(toPort) - 1),
        comment: readString(row, mapping.connections.comment),
      });
    }
  }

  return { elements, splices, warnings };
}
