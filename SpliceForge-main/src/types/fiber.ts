import type { Node, Edge } from "@xyflow/react";

export type ElementType = "cable" | "splitter" | "equipment" | "closure";

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
  [key: string]: unknown;
};

export type SplitterNodeData = {
  label: string;
  ratio: string;
  inputCount: number;
  outputCount: number;
  collapsed?: boolean;
  ports: FiberPort[];
  [key: string]: unknown;
};

export type EquipmentNodeData = {
  label: string;
  inputCount: number;
  outputCount: number;
  collapsed?: boolean;
  ports: FiberPort[];
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
  [key: string]: unknown;
};

export type ContinuationNodeData = {
  label: string;
  targetPageId: string;
  targetPageLabel: string;
  ports: FiberPort[];
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
