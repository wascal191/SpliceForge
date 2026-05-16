import { z } from "zod";
import { ElementLabel, Uuid } from "@/lib/validation";

// ────────────────────────────────────────────────────────────────────────────
// Domain types — shared by every import adapter (csv/xlsx/kmz/geojson/json).
// `key` is a local-only id used to address ports during the splice phase.
// Config shapes mirror src/lib/templates/types.ts so a future "save as
// template" path can use the same payload.
// ────────────────────────────────────────────────────────────────────────────

export type ImportSource = "csv" | "xlsx" | "kmz" | "geojson" | "json";
export type ImportedElementType = "cable" | "splitter" | "equipment" | "closure";

export type CableConfig = { fiberCount: number; colorScheme: string; moduleFiberCount?: number };
export type SplitterConfig = { ratio: string; inputCount: number; outputCount: number };
export type EquipmentConfig = { inputCount: number; outputCount: number };
export type ClosureConfig = { inputCount: number; outputCount: number; trayCount: number };

export type GeoData = {
  lat?: number | null;
  lng?: number | null;
  path?: { lat: number; lng: number }[] | null;
  address?: string | null;
};

export type ImportedElement =
  | { key: string; type: "cable"; label: string; x: number; y: number; config: CableConfig; geo?: GeoData }
  | { key: string; type: "splitter"; label: string; x: number; y: number; config: SplitterConfig; geo?: GeoData }
  | { key: string; type: "equipment"; label: string; x: number; y: number; config: EquipmentConfig; geo?: GeoData }
  | { key: string; type: "closure"; label: string; x: number; y: number; config: ClosureConfig; geo?: GeoData };

export type ImportedSplice = {
  fromKey: string;
  fromPortIndex: number;
  toKey: string;
  toPortIndex: number;
  comment?: string;
};

export type ImportSeverity = "warning" | "error";

export type ImportWarning = {
  row?: number;
  field?: string;
  key?: string;
  message: string;
  severity: ImportSeverity;
};

export type ImportedBundle = {
  elements: ImportedElement[];
  splices: ImportedSplice[];
  warnings: ImportWarning[];
};

export function portCountForElement(el: ImportedElement): number {
  switch (el.type) {
    case "cable":
      return el.config.fiberCount * 2;
    case "splitter":
      return el.config.inputCount + 1;
    case "equipment":
      return el.config.inputCount + el.config.outputCount;
    case "closure":
      return el.config.trayCount * (el.config.inputCount + el.config.outputCount);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Zod schemas for the bulkImport server-action payload + the JSON file
// importer. Caps match the RPC's safe ceiling (2000 elements, 5000 splices).
// ────────────────────────────────────────────────────────────────────────────

const MAX_ELEMENTS = 2000;
const MAX_SPLICES = 5000;

const CableConfigSchema = z.object({
  fiberCount: z.number().int().min(1).max(2048),
  colorScheme: z.string().trim().min(1).max(64),
  moduleFiberCount: z.number().int().min(1).max(2048).optional(),
}).strict();

const SplitterConfigSchema = z.object({
  ratio: z.string().trim().min(1).max(32),
  inputCount: z.number().int().min(1).max(64),
  outputCount: z.number().int().min(1).max(128),
}).strict();

const EquipmentConfigSchema = z.object({
  inputCount: z.number().int().min(1).max(256),
  outputCount: z.number().int().min(1).max(256),
}).strict();

const ClosureConfigSchema = z.object({
  inputCount: z.number().int().min(1).max(256),
  outputCount: z.number().int().min(1).max(256),
  trayCount: z.number().int().min(1).max(64),
}).strict();

const GeoSchema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  path: z
    .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict())
    .max(2000)
    .nullable()
    .optional(),
  address: z.string().max(500).nullable().optional(),
}).strict();

const ElementKey = z.string().trim().min(1).max(64);

const BaseElement = z.object({
  key: ElementKey,
  label: ElementLabel,
  x: z.number().finite(),
  y: z.number().finite(),
  geo: GeoSchema.optional(),
});

const ImportedElementSchema = z.discriminatedUnion("type", [
  BaseElement.extend({ type: z.literal("cable"), config: CableConfigSchema }).strict(),
  BaseElement.extend({ type: z.literal("splitter"), config: SplitterConfigSchema }).strict(),
  BaseElement.extend({ type: z.literal("equipment"), config: EquipmentConfigSchema }).strict(),
  BaseElement.extend({ type: z.literal("closure"), config: ClosureConfigSchema }).strict(),
]);

const ImportedSpliceSchema = z.object({
  fromKey: ElementKey,
  fromPortIndex: z.number().int().min(0).max(10_000),
  toKey: ElementKey,
  toPortIndex: z.number().int().min(0).max(10_000),
  comment: z.string().trim().max(2000).optional(),
}).strict();

export const BulkImportInputSchema = z.object({
  pageId: Uuid,
  source: z.enum(["csv", "xlsx", "kmz", "geojson", "json"]),
  elements: z.array(ImportedElementSchema).min(1).max(MAX_ELEMENTS),
  splices: z.array(ImportedSpliceSchema).max(MAX_SPLICES),
}).strict();

export type BulkImportInput = z.infer<typeof BulkImportInputSchema>;

// ────────────────────────────────────────────────────────────────────────────
// SpliceForge-native JSON import format (versioned).
// ────────────────────────────────────────────────────────────────────────────

export const ImportedBundleV1Schema = z.object({
  version: z.literal(1),
  elements: z.array(ImportedElementSchema).min(1).max(MAX_ELEMENTS),
  splices: z.array(ImportedSpliceSchema).max(MAX_SPLICES),
}).strict();

export type ImportedBundleV1 = z.infer<typeof ImportedBundleV1Schema>;

// ────────────────────────────────────────────────────────────────────────────
// Result returned by the bulkImport server action — enough info for the
// client to update React Flow state without a full re-fetch.
// ────────────────────────────────────────────────────────────────────────────

export type RawPort = {
  id: string;
  element_id: string;
  port_index: number;
  colors: string[];
  status: "occupied" | "unoccupied";
  label: string | null;
};

export type BulkImportResult = {
  elementIds: Record<string, string>; // key -> element row id
  ports: Record<string, RawPort[]>;   // elementId -> raw ports
  spliceIds: Array<{
    id: string;
    fromKey: string;
    fromPortIndex: number;
    toKey: string;
    toPortIndex: number;
  }>;
  elementCount: number;
  spliceCount: number;
};
