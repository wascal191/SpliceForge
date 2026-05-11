import type { Node, Edge } from "@xyflow/react";

export type ElementType = "cable" | "splitter" | "equipment" | "closure";

// ── Geographic types ────────────────────────────────────────────────────────

/** WGS-84 coordinate pair. Note: stored as {lat,lng} but KMZ/GeoJSON use lng,lat order. */
export type GeoPoint = { lat: number; lng: number };

/** Ordered cable route waypoints from upstream to downstream end. */
export type GeoPath = GeoPoint[];

/** Optional geo block on every element — undefined means "not localized yet". */
export type ElementGeo = {
  lat?: number | null;
  lng?: number | null;
  path?: GeoPath | null;
  address?: string | null;
  updatedAt?: string | null;
};

/** Runtime-derived geographic feature — never persisted directly. */
export type GeoFeature =
  | {
      kind: "point";
      elementId: string;
      nodeType: ElementType | "continuation";
      lat: number;
      lng: number;
      label: string;
    }
  | {
      kind: "line";
      elementId: string;
      nodeType: "cable";
      path: GeoPath;
      label: string;
    };

export type FiberPort = {
  id: string;
  elementId: string;
  portIndex: number;
  colors: string[];
  status: "unoccupied" | "occupied";
  side: "left" | "right";
  label?: string;
};

export type CableNodeData = {
  label: string;
  fiberCount: number;
  colorScheme?: string;
  moduleFiberCount?: number;
  collapsedModules?: number[];
  collapsed?: boolean;
  ports: FiberPort[];
  geo?: ElementGeo;
  [key: string]: unknown;
};

export type SplitterNodeData = {
  label: string;
  ratio: string;
  inputCount: number;
  outputCount: number;
  collapsed?: boolean;
  ports: FiberPort[];
  geo?: ElementGeo;
  [key: string]: unknown;
};

export type EquipmentNodeData = {
  label: string;
  inputCount: number;
  outputCount: number;
  collapsed?: boolean;
  ports: FiberPort[];
  geo?: ElementGeo;
  [key: string]: unknown;
};

export type ClosureNodeData = {
  label: string;
  inputCount: number;
  outputCount: number;
  trayCount?: number;
  collapsed?: boolean;
  collapsedTrays?: number[];
  trayNotes?: Record<number, string>;
  ports: FiberPort[];
  geo?: ElementGeo;
  [key: string]: unknown;
};

export type ContinuationNodeData = {
  label: string;
  targetPageId: string;
  targetPageLabel: string;
  ports: FiberPort[];
  geo?: ElementGeo;
  [key: string]: unknown;
};

export type CableFiberNode = Node<CableNodeData, "cable">;
export type SplitterFiberNode = Node<SplitterNodeData, "splitter">;
export type EquipmentFiberNode = Node<EquipmentNodeData, "equipment">;
export type ClosureFiberNode = Node<ClosureNodeData, "closure">;
export type ContinuationFiberNode = Node<ContinuationNodeData, "continuation">;
export type FiberNode =
  | CableFiberNode
  | SplitterFiberNode
  | EquipmentFiberNode
  | ClosureFiberNode
  | ContinuationFiberNode;
export type FiberEdge = Edge;
