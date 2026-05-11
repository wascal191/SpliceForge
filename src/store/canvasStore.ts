import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

type CanvasStore = {
  pageId: string | null;
  nodes: Node[];
  edges: Edge[];
  // trace — multi-select model: each traced edge has its own color
  tracedPortId: string | null;   // kept for legacy compat, no longer drives BFS
  traceColor: string;            // kept for legacy compat
  traceEntries: Map<string, string>;    // edgeId → hex color (source of truth)
  tracedNodeIds: Set<string>;
  tracedEdgeIds: Set<string>;
  tracedNodeColors: Record<string, string>; // nodeId → hex color
  // ui toggles
  bwMode: boolean;
  darkMode: boolean;
  searchOpen: boolean;
  searchQuery: string;
  // undo/redo capability flags (managed by FiberCanvas)
  canUndo: boolean;
  canRedo: boolean;
  // clipboard for copy/paste
  clipboard: Node[];
  // clipboard for fiber comment paste
  commentClipboard: string | null;
  // B2: Ctrl+P palette
  paletteOpen: boolean;
  // B3: port "Continue to page…" flow
  pendingContinuationPortId: string | null;
  // A5: snap-to-grid + keymap modal
  snapGrid: boolean;
  keymapOpen: boolean;
  exportOpen: boolean;
  importOpen: boolean;
  // B4: per-page viewport
  viewports: Record<string, { x: number; y: number; zoom: number }>;

  // Bulk port connect mode
  bulkPortSelectMode: boolean;
  bulkPortsA: string[];
  bulkPortsB: string[];
  bulkPortsANodeId: string | null;

  // Bulk splice by range modal
  bulkSpliceRangeOpen: boolean;
  bulkSpliceRangeNodeIds: [string, string] | null;

  // Cable split (visual organization)
  pendingCableSplit: { nodeId: string; moduleIndex: number } | null;

  // Cursor position in flow coordinates (for status bar)
  cursorPos: { x: number; y: number };
  setCursorPos: (pos: { x: number; y: number }) => void;

  // ── Geo / Map view ──────────────────────────────────────────────────────
  view: "schematic" | "map";
  setView: (v: "schematic" | "map") => void;
  mapViewport: { lng: number; lat: number; zoom: number } | null;
  setMapViewport: (v: { lng: number; lat: number; zoom: number }) => void;
  /** Element currently being placed on the map via the Localize workflow. */
  geoLocalizingId: string | null;
  setGeoLocalizingId: (id: string | null) => void;
  /** Incremented after a geo save so FiberCanvas knows to reload from DB. */
  geoVersion: number;
  bumpGeoVersion: () => void;

  // Organization context (hydrated after login)
  currentOrganizationId: string | null;
  currentOrganization: { id: string; name: string; plan: string } | null;
  setCurrentOrganization: (org: { id: string; name: string; plan: string } | null) => void;

  // Page navigation — registered by FiberCanvas, called by ContinuationNode
  pageNavigator: ((pageId: string) => void) | null;
  setPageNavigator: (fn: ((pageId: string) => void) | null) => void;

  setPageId: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;

  setTracedPortId: (portId: string | null) => void;
  setTraceColor: (color: string) => void;
  setTracedIds: (nodeIds: Set<string>, edgeIds: Set<string>) => void;
  toggleTraceEntry: (edgeId: string, color: string) => void;
  batchAddTraceEntries: (entries: [string, string][]) => void;
  removeTraceColor: (color: string) => void;
  setTracedNodeColors: (colors: Record<string, string>) => void;
  clearTrace: () => void;
  toggleBwMode: () => void;
  toggleDarkMode: () => void;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;
  setUndoRedo: (canUndo: boolean, canRedo: boolean) => void;
  setClipboard: (nodes: Node[]) => void;
  setCommentClipboard: (comment: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setPendingContinuationPortId: (portId: string | null) => void;
  toggleSnapGrid: () => void;
  setKeymapOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setImportOpen: (open: boolean) => void;
  saveViewport: (pageId: string, vp: { x: number; y: number; zoom: number }) => void;

  setBulkPortSelectMode: (on: boolean) => void;
  toggleBulkPort: (portId: string, nodeId: string) => void;
  clearBulkPorts: () => void;

  setBulkSpliceRangeOpen: (open: boolean, nodeIds?: [string, string]) => void;

  setPendingCableSplit: (split: { nodeId: string; moduleIndex: number } | null) => void;
};

export const useCanvasStore = create<CanvasStore>((set) => ({
  pageId: null,
  nodes: [],
  edges: [],
  tracedPortId: null,
  traceColor: "#3b82f6",
  traceEntries: new Map(),
  tracedNodeIds: new Set(),
  tracedEdgeIds: new Set(),
  tracedNodeColors: {},
  bwMode: false,
  darkMode: true,
  searchOpen: false,
  searchQuery: "",
  canUndo: false,
  canRedo: false,
  clipboard: [],
  commentClipboard: null,
  paletteOpen: false,
  pendingContinuationPortId: null,
  snapGrid: false,
  keymapOpen: false,
  exportOpen: false,
  importOpen: false,
  viewports: {},

  bulkPortSelectMode: false,
  bulkPortsA: [],
  bulkPortsB: [],
  bulkPortsANodeId: null,

  bulkSpliceRangeOpen: false,
  bulkSpliceRangeNodeIds: null,

  setPageId: (pageId) => set({ pageId }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  updateNodePosition: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      ),
    })),

  setTracedPortId: (tracedPortId) => set({ tracedPortId }),
  setTraceColor: (traceColor) => set({ traceColor }),
  setTracedIds: (tracedNodeIds, tracedEdgeIds) =>
    set({ tracedNodeIds, tracedEdgeIds }),
  toggleTraceEntry: (edgeId, color) =>
    set((s) => {
      const m = new Map(s.traceEntries);
      if (m.has(edgeId)) m.delete(edgeId); else m.set(edgeId, color);
      return { traceEntries: m };
    }),
  batchAddTraceEntries: (entries) =>
    set((s) => {
      const m = new Map(s.traceEntries);
      for (const [id, color] of entries) if (!m.has(id)) m.set(id, color);
      return { traceEntries: m };
    }),
  removeTraceColor: (color) =>
    set((s) => {
      const m = new Map(s.traceEntries);
      for (const [id, c] of m) if (c === color) m.delete(id);
      return { traceEntries: m };
    }),
  setTracedNodeColors: (tracedNodeColors) => set({ tracedNodeColors }),
  clearTrace: () =>
    set({
      tracedPortId: null,
      traceEntries: new Map(),
      tracedNodeIds: new Set(),
      tracedEdgeIds: new Set(),
      tracedNodeColors: {},
    }),
  toggleBwMode: () => set((s) => ({ bwMode: !s.bwMode })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setUndoRedo: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setClipboard: (clipboard) => set({ clipboard }),
  setCommentClipboard: (commentClipboard) => set({ commentClipboard }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setPendingContinuationPortId: (pendingContinuationPortId) => set({ pendingContinuationPortId }),
  toggleSnapGrid: () => set((s) => ({ snapGrid: !s.snapGrid })),
  setKeymapOpen: (keymapOpen) => set({ keymapOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  saveViewport: (pageId, vp) => set((s) => ({ viewports: { ...s.viewports, [pageId]: vp } })),

  setBulkPortSelectMode: (on) => set({ bulkPortSelectMode: on }),
  toggleBulkPort: (portId, nodeId) =>
    set((s) => {
      const isA = s.bulkPortsANodeId === null || s.bulkPortsANodeId === nodeId;
      if (isA) {
        const already = s.bulkPortsA.includes(portId);
        return {
          bulkPortsANodeId: s.bulkPortsANodeId ?? nodeId,
          bulkPortsA: already ? s.bulkPortsA.filter((id) => id !== portId) : [...s.bulkPortsA, portId],
        };
      }
      const already = s.bulkPortsB.includes(portId);
      return {
        bulkPortsB: already ? s.bulkPortsB.filter((id) => id !== portId) : [...s.bulkPortsB, portId],
      };
    }),
  clearBulkPorts: () => set({ bulkPortsA: [], bulkPortsB: [], bulkPortsANodeId: null }),

  setBulkSpliceRangeOpen: (open, nodeIds) =>
    set({ bulkSpliceRangeOpen: open, bulkSpliceRangeNodeIds: nodeIds ?? null }),

  pendingCableSplit: null,
  setPendingCableSplit: (pendingCableSplit) => set({ pendingCableSplit }),

  cursorPos: { x: 0, y: 0 },
  setCursorPos: (cursorPos) => set({ cursorPos }),

  view: "schematic",
  setView: (view) => set({ view }),
  mapViewport: null,
  setMapViewport: (mapViewport) => set({ mapViewport }),
  geoLocalizingId: null,
  setGeoLocalizingId: (geoLocalizingId) => set({ geoLocalizingId }),
  geoVersion: 0,
  bumpGeoVersion: () => set((s) => ({ geoVersion: s.geoVersion + 1 })),

  currentOrganizationId: null,
  currentOrganization: null,
  setCurrentOrganization: (org) =>
    set({ currentOrganization: org, currentOrganizationId: org?.id ?? null }),

  pageNavigator: null,
  setPageNavigator: (fn) => set({ pageNavigator: fn }),
}));
