"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type OnNodeDrag,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CableNode } from "@/components/nodes/CableNode";
import { SplitterNode } from "@/components/nodes/SplitterNode";
import { EquipmentNode } from "@/components/nodes/EquipmentNode";
import { ClosureNode } from "@/components/nodes/ClosureNode";
import { ContinuationNode } from "@/components/nodes/ContinuationNode";
import { SpliceEdge } from "@/components/nodes/SpliceEdge";
import { CableSplitEdge } from "@/components/nodes/CableSplitEdge";
import { Toolbar } from "./Toolbar";
import { SearchPanel } from "./SearchPanel";
import { StatusBar } from "./StatusBar";
import { ExportDialog } from "./ExportDialog";
import { ImportDialog } from "./ImportDialog";
import { BulkSpliceRangeDialog } from "./BulkSpliceRangeDialog";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getElements, updateElement, updateElementsBatch, deleteElement, createElement } from "@/lib/actions/elements";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { getPortsByElements, updatePortStatus, updatePortStatusBatch, createPorts } from "@/lib/actions/ports";
import { createSplice, createSplicesBatch, getSplicesByPortIds, deleteSplice, deleteSplicesBatch } from "@/lib/actions/splices";
import { useCanvasStore } from "@/store/canvasStore";
import type { FiberPort } from "@/types/fiber";
import { toast } from "sonner";

const nodeTypes = {
  cable: CableNode,
  splitter: SplitterNode,
  equipment: EquipmentNode,
  closure: ClosureNode,
  continuation: ContinuationNode,
};

const edgeTypes = { splice: SpliceEdge, "cable-split": CableSplitEdge };

type RawPort = {
  id: string;
  element_id: string;
  port_index: number;
  colors: string[];
  status: string;
  label: string | null;
};

type RawElement = {
  id: string;
  type: string;
  label: string | null;
  position_x: number | null;
  position_y: number | null;
  config_json: Record<string, unknown> | null;
};

type Page = { id: string; page_index: number; title: string | null };

function getPairedPortIds(portId: string, allPorts: FiberPort[], nodeType: string): string[] {
  const leftPorts = allPorts.filter(p => p.side === "left").sort((a, b) => a.portIndex - b.portIndex);
  const rightPorts = allPorts.filter(p => p.side === "right").sort((a, b) => a.portIndex - b.portIndex);
  const leftIdx = leftPorts.findIndex(p => p.id === portId);
  const rightIdx = rightPorts.findIndex(p => p.id === portId);

  if (nodeType === "splitter") {
    if (leftIdx >= 0) return rightPorts.map(p => p.id);        // input → all outputs
    if (rightIdx >= 0 && leftPorts.length > 0) return [leftPorts[0].id]; // output → input
    return [];
  }
  // closure / equipment: 1-to-1 by position
  if (leftIdx >= 0) return rightPorts[leftIdx] ? [rightPorts[leftIdx].id] : [];
  if (rightIdx >= 0) return leftPorts[rightIdx] ? [leftPorts[rightIdx].id] : [];
  return [];
}

function buildFiberPorts(rawPorts: RawPort[], inputCount: number, portsPerTray?: number): FiberPort[] {
  return rawPorts.map((p) => ({
    id: p.id,
    elementId: p.element_id,
    portIndex: p.port_index,
    colors: p.colors,
    status: p.status as "occupied" | "unoccupied",
    label: p.label ?? undefined,
    side: (portsPerTray
      ? (p.port_index % portsPerTray) < inputCount
      : p.port_index < inputCount) ? "left" : "right",
  }));
}

function buildNode(el: RawElement, rawPorts: RawPort[], pages: Page[]): Node {
  const cfg = el.config_json ?? {};
  const x = el.position_x ?? 100;
  const y = el.position_y ?? 100;
  const type = el.type as "cable" | "splitter" | "equipment" | "closure";

  if (type === "equipment" && cfg.nodeType === "continuation") {
    const targetPage = pages.find((p) => p.id === cfg.targetPageId);
    return {
      id: el.id, type: "continuation", position: { x, y },
      data: {
        label: el.label ?? "Continuation",
        targetPageId: (cfg.targetPageId as string) ?? "",
        targetPageLabel: targetPage?.title ?? `Page ${(targetPage?.page_index ?? 0) + 1}`,
        ports: buildFiberPorts(rawPorts, 1),
      },
    };
  }
  if (type === "cable") {
    const fiberCount = (cfg.fiberCount as number) ?? 12;
    const isDualSide = rawPorts.length > fiberCount;
    const inputCount = isDualSide
      ? fiberCount
      : ((cfg.portSide as string) === "left" ? rawPorts.length : 0);
    return {
      id: el.id, type, position: { x, y },
      data: {
        label: el.label ?? "Cable", fiberCount,
        colorScheme: (cfg.colorScheme as string) ?? "EIA598",
        moduleFiberCount: cfg.moduleFiberCount as number | undefined,
        collapsedModules: (cfg.collapsedModules as number[] | undefined) ?? [],
        collapsed: (cfg.collapsed as boolean | undefined) ?? false,
        ports: buildFiberPorts(rawPorts, inputCount),
      },
    };
  }
  if (type === "splitter") {
    const inputCount = (cfg.inputCount as number) ?? 1;
    const outputCount = (cfg.outputCount as number) ?? 8;
    return {
      id: el.id, type, position: { x, y },
      data: { label: el.label ?? "Splitter", ratio: (cfg.ratio as string) ?? `${inputCount}:${outputCount}`, inputCount, outputCount, collapsed: (cfg.collapsed as boolean | undefined) ?? false, ports: buildFiberPorts(rawPorts, inputCount) },
    };
  }
  if (type === "equipment") {
    const inputCount = (cfg.inputCount as number) ?? 2;
    const outputCount = (cfg.outputCount as number) ?? 2;
    return { id: el.id, type, position: { x, y }, data: { label: el.label ?? "Equipment", inputCount, outputCount, collapsed: (cfg.collapsed as boolean | undefined) ?? false, ports: buildFiberPorts(rawPorts, inputCount) } };
  }
  const inputCount = (cfg.inputCount as number) ?? 6;
  const outputCount = (cfg.outputCount as number) ?? 6;
  const trayCount = (cfg.trayCount as number | undefined) ?? 1;
  const portsPerTray = inputCount + outputCount;
  return { id: el.id, type, position: { x, y }, data: { label: el.label ?? "Closure", inputCount, outputCount, trayCount, collapsed: (cfg.collapsed as boolean | undefined) ?? false, collapsedTrays: (cfg.collapsedTrays as number[] | undefined) ?? [], trayNotes: (cfg.trayNotes as Record<number, string> | undefined) ?? {}, ports: buildFiberPorts(rawPorts, inputCount, portsPerTray) } };
}

type Props = { pageId: string; bedsheetId: string; pages: Page[]; onPageChange?: (pageId: string) => void };

function FiberCanvasInner({ pageId, bedsheetId, pages, onPageChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Sync DB after undo/redo: delete items that existed in "before" but not in "target"
  // and update port statuses for removed splice edges.
  const historyDbSync = useCallback(async (
    target: { nodes: import("@xyflow/react").Node[]; edges: import("@xyflow/react").Edge[] },
    before: { nodes: import("@xyflow/react").Node[]; edges: import("@xyflow/react").Edge[] },
  ) => {
    const targetEdgeIds = new Set(target.edges.map((e) => e.id));
    const targetNodeIds = new Set(target.nodes.map((n) => n.id));

    const edgesToRemove = before.edges.filter(
      (e) => e.type === "splice" && !targetEdgeIds.has(e.id)
    );
    const nodesToRemove = before.nodes.filter(
      (n) => n.type !== "continuation" && !targetNodeIds.has(n.id)
    );

    const portHandles = edgesToRemove.flatMap((e) =>
      [e.sourceHandle, e.targetHandle].filter((h): h is string => Boolean(h))
    );

    await Promise.all([
      ...edgesToRemove.map((e) => deleteSplice(e.id)),
      ...nodesToRemove.map((n) => deleteElement(n.id)),
      ...(portHandles.length > 0 ? [updatePortStatusBatch(portHandles, "unoccupied")] : []),
    ]);
  }, []);

  const { pushHistory, seedHistory, resetHistory, undo, redo } = useCanvasHistory(nodesRef, edgesRef, setNodes, setEdges, historyDbSync);

  const traceEntries = useCanvasStore((s) => s.traceEntries);
  const setTracedIds = useCanvasStore((s) => s.setTracedIds);
  const setTracedNodeColors = useCanvasStore((s) => s.setTracedNodeColors);
  const batchAddTraceEntries = useCanvasStore((s) => s.batchAddTraceEntries);
  const clearTrace = useCanvasStore((s) => s.clearTrace);
  const bwMode = useCanvasStore((s) => s.bwMode);
  const darkMode = useCanvasStore((s) => s.darkMode);
  const clipboard = useCanvasStore((s) => s.clipboard);
  const pendingContinuationPortId = useCanvasStore((s) => s.pendingContinuationPortId);
  const setPendingContinuationPortId = useCanvasStore((s) => s.setPendingContinuationPortId);
  const snapGrid = useCanvasStore((s) => s.snapGrid);
  const viewports = useCanvasStore((s) => s.viewports);
  const saveViewport = useCanvasStore((s) => s.saveViewport);
  const bulkPortsA = useCanvasStore((s) => s.bulkPortsA);
  const bulkPortsB = useCanvasStore((s) => s.bulkPortsB);
  const setBulkPortSelectMode = useCanvasStore((s) => s.setBulkPortSelectMode);
  const clearBulkPorts = useCanvasStore((s) => s.clearBulkPorts);
  const bulkSpliceRangeOpen = useCanvasStore((s) => s.bulkSpliceRangeOpen);
  const bulkSpliceRangeNodeIds = useCanvasStore((s) => s.bulkSpliceRangeNodeIds);
  const setBulkSpliceRangeOpen = useCanvasStore((s) => s.setBulkSpliceRangeOpen);
  const pendingCableSplit = useCanvasStore((s) => s.pendingCableSplit);
  const setPendingCableSplit = useCanvasStore((s) => s.setPendingCableSplit);
  const setCursorPos = useCanvasStore((s) => s.setCursorPos);
  const setPageNavigator = useCanvasStore((s) => s.setPageNavigator);

  // Register page navigation callback so ContinuationNode can trigger it
  useEffect(() => {
    setPageNavigator(onPageChange ?? null);
    return () => setPageNavigator(null);
  }, [onPageChange, setPageNavigator]);

  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);

  const { fitView, getNodes, setViewport, screenToFlowPosition } = useReactFlow();

  const edgeReconnectSuccessful = useRef(true);

  function buildCollapsedConfig(type: string, d: Record<string, unknown>, collapsed: boolean) {
    if (type === "cable") {
      return {
        fiberCount: d.fiberCount,
        colorScheme: d.colorScheme,
        ...(d.moduleFiberCount ? { moduleFiberCount: d.moduleFiberCount } : {}),
        collapsedModules: d.collapsedModules,
        collapsed,
      };
    }
    if (type === "splitter") return { ratio: d.ratio, inputCount: d.inputCount, outputCount: d.outputCount, collapsed };
    return { inputCount: d.inputCount, outputCount: d.outputCount, collapsed };
  }

  function collapseAll() {
    setNodes((nds) => nds.map((n) => n.type === "continuation" ? n : { ...n, data: { ...n.data, collapsed: true } }));
    updateElementsBatch(
      nodesRef.current
        .filter((n) => n.type !== "continuation")
        .map((n) => ({ id: n.id, config_json: buildCollapsedConfig(n.type ?? "", n.data as Record<string, unknown>, true) }))
    );
  }

  function expandAll() {
    setNodes((nds) => nds.map((n) => n.type === "continuation" ? n : { ...n, data: { ...n.data, collapsed: false } }));
    updateElementsBatch(
      nodesRef.current
        .filter((n) => n.type !== "continuation")
        .map((n) => ({ id: n.id, config_json: buildCollapsedConfig(n.type ?? "", n.data as Record<string, unknown>, false) }))
    );
  }

  // Load page
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    clearTrace();
    resetHistory();

    async function load() {
      try {
        const elements = await getElements(pageId);
        if (elements.length === 0) return;

        const elementIds = elements.map((e) => e.id);
        const rawPorts = await getPortsByElements(elementIds);
        const splices = await getSplicesByPortIds(rawPorts.map((p) => p.id));

        const portToElement: Record<string, string> = {};
        for (const p of rawPorts) portToElement[p.id] = p.element_id;

        const portsByElement: Record<string, RawPort[]> = {};
        for (const p of rawPorts) (portsByElement[p.element_id] ??= []).push(p);

        const loadedNodes = elements.map((el) => buildNode(el as RawElement, portsByElement[el.id] ?? [], pages));
        const spliceEdges = splices.map((s) => ({
          id: s.id, type: "splice",
          source: portToElement[s.port_from],
          target: portToElement[s.port_to],
          sourceHandle: s.port_from,
          targetHandle: s.port_to,
          data: { comment: s.comment ?? "" },
        }));

        // Restore cable-split visual edges from splitFromId config
        const splitEdges: Edge[] = [];
        for (const el of elements) {
          const splitFromId = (el.config_json as Record<string, unknown> | null)?.splitFromId as string | undefined;
          if (splitFromId) {
            splitEdges.push({
              id: `split-${splitFromId}-${el.id}`,
              type: "cable-split",
              source: splitFromId,
              target: el.id,
              data: {},
            });
          }
        }
        const loadedEdges = [...spliceEdges, ...splitEdges];
        setNodes(loadedNodes);
        setEdges(loadedEdges);

        seedHistory(loadedNodes, loadedEdges);

        // Restore saved viewport or fit view after nodes render
        const savedVp = viewports[pageId];
        setTimeout(() => {
          if (savedVp) setViewport(savedVp, { duration: 200 });
          else fitView({ duration: 400 });
        }, 50);
      } catch (err) {
        toast.error("Failed to load page", {
          description: err instanceof Error ? err.message : "Could not fetch data from the server.",
        });
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Multi-trace: derive tracedEdgeIds/tracedNodeIds/colors from traceEntries
  useEffect(() => {
    if (traceEntries.size === 0) {
      setTracedIds(new Set(), new Set());
      setTracedNodeColors(new Map());
      return;
    }
    const tracedEdgeIds = new Set(traceEntries.keys());
    const tracedNodeIds = new Set<string>();
    const nodeColors = new Map<string, string>();
    for (const edge of edgesRef.current) {
      if (tracedEdgeIds.has(edge.id)) {
        const color = traceEntries.get(edge.id) ?? "#3b82f6";
        if (edge.source) { tracedNodeIds.add(edge.source); if (!nodeColors.has(edge.source)) nodeColors.set(edge.source, color); }
        if (edge.target) { tracedNodeIds.add(edge.target); if (!nodeColors.has(edge.target)) nodeColors.set(edge.target, color); }
      }
    }
    setTracedIds(tracedNodeIds, tracedEdgeIds);
    setTracedNodeColors(nodeColors);

    // Auto-expand any collapsed node that is part of the active trace
    setNodes((nds) => {
      const needsUpdate = nds.some(
        (n) => tracedNodeIds.has(n.id) && (n.data as { collapsed?: boolean }).collapsed
      );
      if (!needsUpdate) return nds;
      return nds.map((n) =>
        tracedNodeIds.has(n.id) && (n.data as { collapsed?: boolean }).collapsed
          ? { ...n, data: { ...n.data, collapsed: false } }
          : n
      );
    });
  }, [traceEntries, setTracedIds, setTracedNodeColors]);

  // Propagate trace colors through pass-through nodes (closure, equipment, splitter)
  useEffect(() => {
    if (traceEntries.size === 0) return;

    // Build O(1) lookup maps once per effect run
    const edgeById = new Map(edgesRef.current.map((e) => [e.id, e]));
    const portToEdgeId = new Map<string, string>();
    for (const e of edgesRef.current) {
      if (e.sourceHandle) portToEdgeId.set(e.sourceHandle, e.id);
      if (e.targetHandle) portToEdgeId.set(e.targetHandle, e.id);
    }
    const portToNode = new Map<string, Node>();
    for (const n of nodesRef.current) {
      for (const p of (n.data as { ports?: FiberPort[] }).ports ?? []) {
        portToNode.set(p.id, n);
      }
    }

    const additions: [string, string][] = [];

    for (const [edgeId, color] of traceEntries) {
      const edge = edgeById.get(edgeId);
      if (!edge) continue;
      for (const portId of [edge.sourceHandle, edge.targetHandle]) {
        if (!portId) continue;
        const node = portToNode.get(portId);
        if (!node || !["closure", "equipment", "splitter"].includes(node.type ?? "")) continue;
        const allPorts = (node.data as { ports?: FiberPort[] }).ports ?? [];
        const pairedIds = getPairedPortIds(portId, allPorts, node.type ?? "");
        for (const pairedPortId of pairedIds) {
          const exitEdgeId = portToEdgeId.get(pairedPortId);
          if (exitEdgeId && !traceEntries.has(exitEdgeId)) {
            additions.push([exitEdgeId, color]);
          }
        }
      }
    }

    if (additions.length > 0) batchAddTraceEntries(additions);
  }, [traceEntries, batchAddTraceEntries]);

  useCanvasKeyboard({
    nodesRef, setNodes, setEdges,
    undo, redo, pushHistory,
    clipboard, fitView, getNodes,
    onPaste: handlePaste,
    onBulkSplice: handleBulkSplice,
  });

  async function handlePaste() {
    if (clipboard.length === 0) return;
    pushHistory();
    const newNodes: Node[] = [];
    try {
      for (const src of clipboard) {
        const type = src.type as string;
        if (type === "continuation") continue;
        const d = src.data as Record<string, unknown>;
        const x = (src.position.x as number) + 60;
        const y = (src.position.y as number) + 60;

        if (type === "cable") {
          const fiberCount = (d.fiberCount as number) ?? 12;
          const el = await createElement(pageId, "cable", (d.label as string) ?? "Cable", x, y, {
            fiberCount, colorScheme: d.colorScheme ?? "EIA598", moduleFiberCount: d.moduleFiberCount,
          });
          const raw = await createPorts(el.id, fiberCount);
          newNodes.push({
            id: el.id, type: "cable", position: { x, y },
            data: { label: d.label, fiberCount, colorScheme: d.colorScheme, moduleFiberCount: d.moduleFiberCount, ports: buildFiberPorts(raw, 0) },
          });
        } else if (type === "splitter") {
          const iC = (d.inputCount as number) ?? 1; const oC = (d.outputCount as number) ?? 8;
          const el = await createElement(pageId, "splitter", (d.label as string) ?? "Splitter", x, y, { ratio: d.ratio, inputCount: iC, outputCount: oC });
          const raw = await createPorts(el.id, iC + 1);
          newNodes.push({ id: el.id, type: "splitter", position: { x, y }, data: { label: d.label, ratio: d.ratio, inputCount: iC, outputCount: oC, ports: buildFiberPorts(raw, iC) } });
        } else if (type === "equipment") {
          const iC = (d.inputCount as number) ?? 2; const oC = (d.outputCount as number) ?? 2;
          const el = await createElement(pageId, "equipment", (d.label as string) ?? "Equipment", x, y, { inputCount: iC, outputCount: oC });
          const raw = await createPorts(el.id, iC + oC);
          newNodes.push({ id: el.id, type: "equipment", position: { x, y }, data: { label: d.label, inputCount: iC, outputCount: oC, ports: buildFiberPorts(raw, iC) } });
        } else if (type === "closure") {
          const iC = (d.inputCount as number) ?? 6; const oC = (d.outputCount as number) ?? 6;
          const tC = (d.trayCount as number | undefined) ?? 1;
          const el = await createElement(pageId, "closure", (d.label as string) ?? "Closure", x, y, { inputCount: iC, outputCount: oC, trayCount: tC });
          const raw = await createPorts(el.id, tC * (iC + oC));
          newNodes.push({ id: el.id, type: "closure", position: { x, y }, data: { label: d.label, inputCount: iC, outputCount: oC, trayCount: tC, ports: buildFiberPorts(raw, iC, iC + oC) } });
        }
      }
    } catch (err) {
      toast.error("Paste failed", {
        description: err instanceof Error ? err.message : "Could not save pasted elements.",
      });
    }
    if (newNodes.length > 0) {
      setNodes((nds) => [...nds, ...newNodes]);
    }
  }

  async function handleBulkSplice() {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length !== 2) return;
    const [nodeA, nodeB] = selected;
    const portsA = ((nodeA.data as { ports?: FiberPort[] }).ports ?? [])
      .filter((p) => p.status === "unoccupied")
      .sort((a, b) => a.portIndex - b.portIndex);
    const portsB = ((nodeB.data as { ports?: FiberPort[] }).ports ?? [])
      .filter((p) => p.status === "unoccupied")
      .sort((a, b) => a.portIndex - b.portIndex);
    const count = Math.min(portsA.length, portsB.length);
    if (count === 0) return;
    const pairs = Array.from({ length: count }, (_, i) => ({
      portFrom: portsA[i].id,
      portTo: portsB[i].id,
    }));
    pushHistory();
    try {
      const splices = await createSplicesBatch(pairs);
      const allPortIds = pairs.flatMap((p) => [p.portFrom, p.portTo]);
      await updatePortStatusBatch(allPortIds, "occupied");
      const occupiedSet = new Set(allPortIds);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeA.id && n.id !== nodeB.id) return n;
          const ports = (n.data as { ports?: FiberPort[] }).ports;
          if (!ports) return n;
          return {
            ...n,
            data: {
              ...n.data,
              ports: ports.map((p) =>
                occupiedSet.has(p.id) ? { ...p, status: "occupied" as const } : p
              ),
            },
          };
        })
      );
      setEdges((eds) => [
        ...eds,
        ...splices.map((s, i) => ({
          id: s.id,
          type: "splice",
          reconnectable: true,
          source: nodeA.id,
          target: nodeB.id,
          sourceHandle: pairs[i].portFrom,
          targetHandle: pairs[i].portTo,
          data: { comment: "" },
        })),
      ]);
    } catch (err) {
      toast.error("Bulk splice failed", {
        description: err instanceof Error ? err.message : "Could not create splices.",
      });
    }
  }

  async function handleBulkPortConnect() {
    const count = Math.min(bulkPortsA.length, bulkPortsB.length);
    if (count === 0) return;
    const allNodes = getNodes();
    const pairs = Array.from({ length: count }, (_, i) => ({
      portFrom: bulkPortsA[i],
      portTo: bulkPortsB[i],
    }));
    pushHistory();
    try {
      const splices = await createSplicesBatch(pairs);
      const allPortIds = pairs.flatMap((p) => [p.portFrom, p.portTo]);
      await updatePortStatusBatch(allPortIds, "occupied");
      const occupiedSet = new Set(allPortIds);
      setNodes((nds) =>
        nds.map((n) => {
          const ports = (n.data as { ports?: FiberPort[] }).ports;
          if (!ports?.some((p) => occupiedSet.has(p.id))) return n;
          return { ...n, data: { ...n.data, ports: ports.map((p) => occupiedSet.has(p.id) ? { ...p, status: "occupied" as const } : p) } };
        })
      );
      setEdges((eds) => [
        ...eds,
        ...splices.map((s, i) => {
          const srcNode = allNodes.find((n) => (n.data as { ports?: FiberPort[] }).ports?.some((p) => p.id === pairs[i].portFrom));
          const tgtNode = allNodes.find((n) => (n.data as { ports?: FiberPort[] }).ports?.some((p) => p.id === pairs[i].portTo));
          return {
            id: s.id,
            type: "splice",
            reconnectable: true,
            source: srcNode?.id ?? "",
            target: tgtNode?.id ?? "",
            sourceHandle: pairs[i].portFrom,
            targetHandle: pairs[i].portTo,
            data: { comment: "" },
          };
        }),
      ]);
      clearBulkPorts();
      setBulkPortSelectMode(false);
    } catch (err) {
      toast.error("Bulk connect failed", {
        description: err instanceof Error ? err.message : "Could not create splices.",
      });
    }
  }

  async function handleBulkSpliceRange(pairs: { portFrom: string; portTo: string }[]) {
    if (pairs.length === 0) return;
    pushHistory();
    try {
      const splices = await createSplicesBatch(pairs);
      const allPortIds = pairs.flatMap((p) => [p.portFrom, p.portTo]);
      await updatePortStatusBatch(allPortIds, "occupied");
      const occupiedSet = new Set(allPortIds);
      setNodes((nds) =>
        nds.map((n) => {
          const ports = (n.data as { ports?: FiberPort[] }).ports;
          if (!ports?.some((p) => occupiedSet.has(p.id))) return n;
          return { ...n, data: { ...n.data, ports: ports.map((p) => occupiedSet.has(p.id) ? { ...p, status: "occupied" as const } : p) } };
        })
      );
      const allNodes = getNodes();
      setEdges((eds) => [
        ...eds,
        ...splices.map((s, i) => {
          const srcNode = allNodes.find((n) => (n.data as { ports?: FiberPort[] }).ports?.some((p) => p.id === pairs[i].portFrom));
          const tgtNode = allNodes.find((n) => (n.data as { ports?: FiberPort[] }).ports?.some((p) => p.id === pairs[i].portTo));
          return { id: s.id, type: "splice", reconnectable: true, source: srcNode?.id ?? "", target: tgtNode?.id ?? "", sourceHandle: pairs[i].portFrom, targetHandle: pairs[i].portTo, data: { comment: "" } };
        }),
      ]);
    } catch (err) {
      toast.error("Range splice failed", {
        description: err instanceof Error ? err.message : "Could not create splices.",
      });
    }
  }

  function handleOpenRangeSplice() {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length !== 2) return;
    setBulkSpliceRangeOpen(true, [selected[0].id, selected[1].id]);
  }

  // Watch pendingCableSplit set by CableNode module context menu
  useEffect(() => {
    if (!pendingCableSplit) return;
    handleCableSplit(pendingCableSplit.nodeId, pendingCableSplit.moduleIndex);
    setPendingCableSplit(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCableSplit]);

  async function handleCableSplit(nodeId: string, splitModuleIndex: number) {
    const node = getNodes().find((n) => n.id === nodeId);
    if (!node || node.type !== "cable") return;
    const d = node.data as Record<string, unknown>;
    const fiberCount = (d.fiberCount as number) ?? 12;
    const colorScheme = (d.colorScheme as string) ?? "EIA598";
    const modSize = ((d.moduleFiberCount as number) || 0) > 0 ? (d.moduleFiberCount as number) : fiberCount;
    const moduleCount = Math.ceil(fiberCount / modSize);
    if (splitModuleIndex <= 0 || splitModuleIndex >= moduleCount) return;

    const splitFiberCount = (moduleCount - splitModuleIndex) * modSize;
    const newX = node.position.x + 320;
    const newY = node.position.y + splitModuleIndex * modSize * 20 + 40;

    pushHistory();

    try {
      // Collapse the modules from splitModuleIndex onward in the original
      const nextCollapsed = new Set((d.collapsedModules as number[] | undefined) ?? []);
      for (let mi = splitModuleIndex; mi < moduleCount; mi++) nextCollapsed.add(mi);
      setNodes((nds) => nds.map((n) => n.id !== nodeId ? n : {
        ...n, data: { ...n.data, collapsedModules: Array.from(nextCollapsed) },
      }));
      await updateElement(nodeId, {
        config_json: {
          fiberCount, colorScheme,
          ...(modSize !== fiberCount ? { moduleFiberCount: modSize } : {}),
          collapsedModules: Array.from(nextCollapsed),
          collapsed: (d.collapsed as boolean) ?? false,
        },
      });

      // Create new cable element in DB with the remaining fibers
      const newEl = await createElement(pageId, "cable", (d.label as string) ?? "Cable", newX, newY, {
        fiberCount: splitFiberCount,
        colorScheme,
        ...(modSize !== fiberCount ? { moduleFiberCount: modSize } : {}),
        splitFromId: nodeId,
      });

      // Create dual-side ports for the new cable
      const rawLeft = await createPorts(newEl.id, splitFiberCount, 0);
      const rawRight = await createPorts(newEl.id, splitFiberCount, splitFiberCount);
      const allRaw = [...rawLeft, ...rawRight];
      const newPorts: FiberPort[] = allRaw.map((p, i) => ({
        id: p.id,
        elementId: newEl.id,
        portIndex: p.port_index,
        colors: p.colors,
        status: "unoccupied" as const,
        side: i < splitFiberCount ? "left" : "right",
      }));

      const newNode: Node = {
        id: newEl.id,
        type: "cable",
        position: { x: newX, y: newY },
        data: {
          label: d.label,
          fiberCount: splitFiberCount,
          colorScheme,
          moduleFiberCount: modSize !== fiberCount ? modSize : undefined,
          collapsedModules: [],
          collapsed: false,
          ports: newPorts,
        },
      };

      const splitEdgeId = `split-${nodeId}-${newEl.id}`;
      const splitEdge: Edge = {
        id: splitEdgeId,
        type: "cable-split",
        source: nodeId,
        target: newEl.id,
        data: {},
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, splitEdge]);
    } catch (err) {
      toast.error("Cable split failed", {
        description: err instanceof Error ? err.message : "Could not split the cable.",
      });
    }
  }

  async function handleCreateContinuation(targetPageId: string, targetPageLabel: string) {
    if (!pendingContinuationPortId) return;
    const parentNode = getNodes().find((n) => {
      const ports = (n.data as { ports?: FiberPort[] }).ports;
      return ports?.some((p) => p.id === pendingContinuationPortId);
    });
    const x = (parentNode?.position.x ?? 200) + 200;
    const y = parentNode?.position.y ?? 200;
    pushHistory();
    try {
      const el = await createElement(pageId, "equipment", "Cont.", x, y, {
        nodeType: "continuation", targetPageId, targetPageLabel, inputCount: 1, outputCount: 1,
      });
      const rawPorts = await createPorts(el.id, 2);
      const contNode: Node = {
        id: el.id, type: "continuation", position: { x, y },
        data: { label: "Cont.", targetPageId, targetPageLabel, ports: buildFiberPorts(rawPorts, 1) },
      };
      const inputPort = rawPorts[0];
      const splice = await createSplice(pendingContinuationPortId, inputPort.id);
      await Promise.all([
        updatePortStatus(pendingContinuationPortId, "occupied"),
        updatePortStatus(inputPort.id, "occupied"),
      ]);
      const parentNodeId = parentNode?.id ?? "";
      const srcPortId = pendingContinuationPortId;
      setNodes((nds) => [
        ...nds.map((n) => {
          if (n.id !== parentNodeId) return n;
          const ports = (n.data as { ports?: FiberPort[] }).ports;
          if (!ports) return n;
          return { ...n, data: { ...n.data, ports: ports.map((p) => p.id === srcPortId ? { ...p, status: "occupied" as const } : p) } };
        }),
        contNode,
      ]);
      setEdges((eds) => [...eds, {
        id: splice.id, type: "splice",
        source: parentNodeId, target: el.id,
        sourceHandle: srcPortId, targetHandle: inputPort.id,
        data: { comment: "" },
      }]);
      setPendingContinuationPortId(null);
    } catch (err) {
      toast.error("Continuation failed", {
        description: err instanceof Error ? err.message : "Could not create the continuation node.",
      });
    }
  }

  const onConnect = useCallback(async (connection: Connection) => {
    const { sourceHandle, targetHandle } = connection;
    if (!sourceHandle || !targetHandle) return;
    for (const handleId of [sourceHandle, targetHandle]) {
      const ownerNode = nodesRef.current.find(n =>
        (n.data as { ports?: FiberPort[] }).ports?.some(p => p.id === handleId)
      );
      if (ownerNode?.type === "splitter") {
        const nodePorts = (ownerNode.data as { ports?: FiberPort[] }).ports ?? [];
        const outputPorts = nodePorts.filter(p => p.side === "right");
        if (outputPorts.length === 1 && outputPorts[0].id === handleId) {
          const outputCount = (ownerNode.data as { outputCount?: number }).outputCount ?? 8;
          const currentCount = edgesRef.current.filter(
            e => e.sourceHandle === handleId || e.targetHandle === handleId
          ).length;
          if (currentCount >= outputCount) return;
        }
      }
    }
    pushHistory();
    try {
      const splice = await createSplice(sourceHandle, targetHandle);
      await Promise.all([
        updatePortStatus(sourceHandle, "occupied"),
        updatePortStatus(targetHandle, "occupied"),
      ]);
      setNodes((nds) => nds.map((n) => {
        const ports = (n.data as { ports?: FiberPort[] }).ports;
        if (!ports?.some((p) => p.id === sourceHandle || p.id === targetHandle)) return n;
        return { ...n, data: { ...n.data, ports: ports.map((p) => p.id === sourceHandle || p.id === targetHandle ? { ...p, status: "occupied" as const } : p) } };
      }));
      setEdges((eds) => addEdge({ id: splice.id, type: "splice", reconnectable: true, source: connection.source, target: connection.target, sourceHandle, targetHandle, data: { comment: splice.comment ?? "", justCreated: true } }, eds));
    } catch (err) {
      toast.error("Splice failed", {
        description: err instanceof Error ? err.message : "Could not save the connection.",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, setNodes]);

  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    try {
      await Promise.all(deleted.map((n) => deleteElement(n.id)));
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : "Could not delete element(s) from the database.",
      });
    }
  }, []);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    const spliceEdges = deleted.filter((e) => e.type !== "cable-split");
    if (spliceEdges.length === 0) return;
    try {
      await deleteSplicesBatch(spliceEdges.map((e) => e.id));

      // Free ports on surviving nodes
      const portIds = spliceEdges.flatMap((e) =>
        [e.sourceHandle, e.targetHandle].filter((h): h is string => Boolean(h))
      );
      if (portIds.length > 0) {
        await updatePortStatusBatch(portIds, "unoccupied");
        setNodes((nds) =>
          nds.map((n) => {
            const ports = (n.data as { ports?: { id: string; status: string }[] }).ports;
            if (!ports?.some((p) => portIds.includes(p.id))) return n;
            return {
              ...n,
              data: {
                ...n.data,
                ports: ports.map((p) =>
                  portIds.includes(p.id) ? { ...p, status: "unoccupied" as const } : p
                ),
              },
            };
          })
        );
      }
    } catch (err) {
      toast.error("Delete splice failed", {
        description: err instanceof Error ? err.message : "Could not remove connection(s) from the database.",
      });
    }
  }, [setNodes]);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(async (oldEdge: Edge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;
    const { sourceHandle, targetHandle } = newConnection;
    if (!sourceHandle || !targetHandle) return;
    pushHistory();
    try {
      await deleteSplice(oldEdge.id);
      await Promise.all([
        updatePortStatus(oldEdge.sourceHandle!, "unoccupied"),
        updatePortStatus(oldEdge.targetHandle!, "unoccupied"),
      ]);
      const splice = await createSplice(sourceHandle, targetHandle);
      await Promise.all([
        updatePortStatus(sourceHandle, "occupied"),
        updatePortStatus(targetHandle, "occupied"),
      ]);
      const oldSrcHandle = oldEdge.sourceHandle!;
      const oldTgtHandle = oldEdge.targetHandle!;
      setNodes((nds) => nds.map((n) => {
        const ports = (n.data as { ports?: FiberPort[] }).ports;
        if (!ports) return n;
        const affected = ports.some((p) => [oldSrcHandle, oldTgtHandle, sourceHandle, targetHandle].includes(p.id));
        if (!affected) return n;
        return {
          ...n,
          data: {
            ...n.data,
            ports: ports.map((p) => {
              if (p.id === oldSrcHandle || p.id === oldTgtHandle) return { ...p, status: "unoccupied" as const };
              if (p.id === sourceHandle || p.id === targetHandle) return { ...p, status: "occupied" as const };
              return p;
            }),
          },
        };
      }));
      setEdges((eds) => eds.map((e) =>
        e.id === oldEdge.id
          ? { ...e, id: splice.id, source: newConnection.source!, target: newConnection.target!, sourceHandle, targetHandle, reconnectable: true }
          : e
      ));
    } catch (err) {
      toast.error("Reconnect failed", {
        description: err instanceof Error ? err.message : "Could not move the splice connection.",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, setNodes]);

  const onReconnectEnd = useCallback((_event: unknown, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      setEdges((eds) => [...eds, edge]);
    }
  }, [setEdges]);

  const onNodeDragStop: OnNodeDrag = useCallback(async (_event: React.MouseEvent, _node: Node, nodes: Node[]) => {
    try {
      await Promise.all(nodes.map((n) => updateElement(n.id, { position_x: n.position.x, position_y: n.position.y })));
    } catch (err) {
      toast.error("Position not saved", {
        description: err instanceof Error ? err.message : "Could not persist node position.",
      });
    }
  }, []);

  const handleNodeAdded = useCallback((node: Node) => {
    pushHistory(); // capture pre-add state so undo removes it
    setNodes((nds) => [...nds, node]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes]);

  return (
    <div className="w-full h-full relative">
      <Toolbar
        pageId={pageId}
        bedsheetId={bedsheetId}
        pages={pages}
        onNodeAdded={handleNodeAdded}
        onUndo={undo}
        onRedo={redo}
        onPageChange={onPageChange ?? (() => {})}
        onRangeSplice={handleOpenRangeSplice}
      />
      <ExportDialog />
      <ImportDialog pageId={pageId} setNodes={setNodes} setEdges={setEdges} />
      <BulkSpliceRangeDialog
        open={bulkSpliceRangeOpen}
        nodeA={bulkSpliceRangeNodeIds ? getNodes().find((n) => n.id === bulkSpliceRangeNodeIds[0]) ?? null : null}
        nodeB={bulkSpliceRangeNodeIds ? getNodes().find((n) => n.id === bulkSpliceRangeNodeIds[1]) ?? null : null}
        onClose={() => setBulkSpliceRangeOpen(false)}
        onConfirm={async (pairs) => { await handleBulkSpliceRange(pairs); setBulkSpliceRangeOpen(false); }}
      />
      {pendingContinuationPortId && (
        <Dialog open onOpenChange={(open) => { if (!open) setPendingContinuationPortId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Continue to page&hellip;</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              Creates a continuation node on this page and splices the fiber to it.
            </p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {pages.filter((p) => p.id !== pageId).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No other pages. Add more pages first.
                </p>
              ) : pages.filter((p) => p.id !== pageId).map((p) => (
                <button
                  key={p.id}
                  className="text-left rounded border px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => handleCreateContinuation(p.id, p.title ?? `Page ${p.page_index + 1}`)}
                >
                  {p.title ?? `Page ${p.page_index + 1}`}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {paneMenu && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setPaneMenu(null)} onContextMenu={(e) => { e.preventDefault(); setPaneMenu(null); }} />
            <div
              className="fixed z-[9999] min-w-[170px] rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-xs"
              style={{ left: paneMenu.x, top: paneMenu.y }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {bulkPortsA.length > 0 && bulkPortsB.length > 0 && (
                <>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-accent cursor-pointer outline-none font-medium text-teal-600 dark:text-teal-400"
                    onClick={() => { setPaneMenu(null); handleBulkPortConnect(); }}
                  >
                    Connect A→B in order ({Math.min(bulkPortsA.length, bulkPortsB.length)} pairs)
                  </button>
                  <div className="border-t my-1" />
                </>
              )}
              {getNodes().filter((n) => n.selected).length === 2 && (
                <>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-accent cursor-pointer outline-none font-medium text-blue-600 dark:text-blue-400"
                    onClick={() => { setPaneMenu(null); handleOpenRangeSplice(); }}
                  >
                    Range Splice (2 nodes selected)
                  </button>
                  <div className="border-t my-1" />
                </>
              )}
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent cursor-pointer outline-none"
                onClick={() => { setPaneMenu(null); collapseAll(); }}
              >
                Collapse All
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent cursor-pointer outline-none"
                onClick={() => { setPaneMenu(null); expandAll(); }}
              >
                Expand All
              </button>
            </div>
          </>,
          document.body
        )
      }
      <div
        className="w-full h-full"
        style={{ filter: bwMode ? "grayscale(1)" : undefined, position: "relative" }}
        onMouseMove={(e) => {
          const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCursorPos({ x: Math.round(pos.x), y: Math.round(pos.y) });
        }}
      >
        {/* ── Canvas background ── */}
        <div style={{ position: "absolute", inset: 0, background: darkMode ? "#05070C" : "#F8FAFC", pointerEvents: "none", zIndex: 0 }}>
          {/* Ambient radial glows (dark only) */}
          {darkMode && <div style={{
            position: "absolute", inset: 0,
            background: `
              radial-gradient(900px 500px at 12% 18%, rgba(0,229,255,0.07), transparent 60%),
              radial-gradient(700px 500px at 85% 82%, rgba(79,70,229,0.09), transparent 60%),
              radial-gradient(500px 400px at 60% 30%, rgba(61,245,163,0.04), transparent 60%)
            `,
          }} />}
          {/* Fine dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(rgba(148,184,255,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148,184,255,0.035) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }} />
          {/* Coarse grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(rgba(148,184,255,0.065) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148,184,255,0.065) 1px, transparent 1px)
            `,
            backgroundSize: "120px 120px",
          }} />
          {/* Crosshairs */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "linear-gradient(180deg, transparent, rgba(0,229,255,0.06) 40%, rgba(0,229,255,0.06) 60%, transparent)" }} />
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.06) 40%, rgba(0,229,255,0.06) 60%, transparent)" }} />
          {/* Edge vignette */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)" }} />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnectStart={onReconnectStart}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onPaneClick={() => { clearTrace(); setPaneMenu(null); }}
          onPaneContextMenu={(e) => { e.preventDefault(); setPaneMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }); }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={["Backspace", "Delete"]}
          snapToGrid={snapGrid}
          snapGrid={[10, 10]}
          onMoveEnd={(_, vp) => saveViewport(pageId, vp)}
        >
          <Background color="transparent" />
          <MiniMap />
          <SearchPanel />
          <StatusBar onFitView={() => fitView({ duration: 400 })} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function FiberCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FiberCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
