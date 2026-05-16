"use client";

import { useState, memo } from "react";
import { useTranslations } from "next-intl";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { deleteSplice } from "@/lib/actions/splices";
import { updatePortStatus, updatePortLabel } from "@/lib/actions/ports";
import { updateSpliceWithPropagation } from "@/lib/fiber/comments";
import { getFiberHex, type FiberColorScheme } from "@/lib/fiber/colors";
import type { FiberPort } from "@/types/fiber";

type Props = {
  portId: string;
  portStatus: "occupied" | "unoccupied";
  side: "left" | "right";
  tracedColor?: string;
  portLabel?: string;
  onLabelChange?: (portId: string, newLabel: string | null) => void;
};

function PortHandleBase({
  portId,
  portStatus,
  side,
  tracedColor = "#3b82f6",
  portLabel,
  onLabelChange,
}: Props) {
  const t = useTranslations("canvas.node.port");
  const traceEntries = useCanvasStore((s) => s.traceEntries);
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const removeTraceColor = useCanvasStore((s) => s.removeTraceColor);
  const commentClipboard = useCanvasStore((s) => s.commentClipboard);
  const setCommentClipboard = useCanvasStore((s) => s.setCommentClipboard);
  const setPendingContinuationPortId = useCanvasStore((s) => s.setPendingContinuationPortId);
  const bulkPortSelectMode = useCanvasStore((s) => s.bulkPortSelectMode);
  const isBulkA = useCanvasStore((s) => s.bulkPortsA.includes(portId));
  const isBulkB = useCanvasStore((s) => s.bulkPortsB.includes(portId));
  const toggleBulkPort = useCanvasStore((s) => s.toggleBulkPort);
  const { getEdges, setEdges, setNodes, getNodes } = useReactFlow();

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(portLabel ?? "");

  const posStyle = side === "left" ? { left: -8 } : { right: -8 };

  function findSpliceEdge() {
    return getEdges().find(
      (e) => e.sourceHandle === portId || e.targetHandle === portId
    );
  }

  // Walk upstream through pass-through nodes to find the originating cable
  // fiber color. For right (output) ports, crosses to the paired left (input)
  // port first; for left ports the direct splice is the upstream direction.
  // Recurses through chained closures/splitters/equipment up to 20 hops.
  function resolveTraceColor(edge: ReturnType<typeof findSpliceEdge>): string {
    if (!edge) return tracedColor;

    const allEdges = getEdges();
    const allNodes = getNodes();

    function cableHex(node: ReturnType<typeof allNodes.find>, pid: string): string {
      const port = (node!.data as { ports?: FiberPort[] }).ports?.find((p) => p.id === pid);
      if (!port) return tracedColor;
      const scheme = ((node!.data as { colorScheme?: string }).colorScheme ?? "EIA598") as FiberColorScheme;
      const fc = (node!.data as { fiberCount?: number }).fiberCount ?? 12;
      return getFiberHex(port.portIndex % fc, scheme);
    }

    // Follow the upstream direction: left ports look directly at their splice;
    // right (output) ports cross through the node to the paired input port.
    function walk(pid: string, depth: number): string | null {
      if (depth > 20) return null;
      const owner = allNodes.find((n) =>
        (n.data as { ports?: { id: string }[] }).ports?.some((p) => p.id === pid)
      );
      if (!owner) return null;
      if (owner.type === "cable") return cableHex(owner, pid);
      if (!["closure", "equipment", "splitter"].includes(owner.type ?? "")) return null;

      const ports = (owner.data as { ports?: FiberPort[] }).ports ?? [];
      const left = ports.filter((p) => p.side === "left").sort((a, b) => a.portIndex - b.portIndex);
      const right = ports.filter((p) => p.side === "right").sort((a, b) => a.portIndex - b.portIndex);
      const isLeft = left.some((p) => p.id === pid);

      let upstreamId: string | null = null;

      if (isLeft) {
        // Left (input) port — follow its direct splice upstream
        const e = allEdges.find((ex) => ex.sourceHandle === pid || ex.targetHandle === pid);
        if (e) upstreamId = (e.sourceHandle === pid ? e.targetHandle : e.sourceHandle) ?? null;
      } else {
        // Right (output) port — cross to paired input port, then follow that splice
        const idx = right.findIndex((p) => p.id === pid);
        // Splitters: all outputs pair with the single input
        const inputPort = owner.type === "splitter" ? left[0] : left[idx];
        if (inputPort) {
          const e = allEdges.find((ex) => ex.sourceHandle === inputPort.id || ex.targetHandle === inputPort.id);
          if (e) upstreamId = (e.sourceHandle === inputPort.id ? e.targetHandle : e.sourceHandle) ?? null;
        }
      }

      return upstreamId ? walk(upstreamId, depth + 1) : null;
    }

    const currentNode = allNodes.find((n) =>
      (n.data as { ports?: { id: string }[] }).ports?.some((p) => p.id === portId)
    );
    if (currentNode?.type === "cable") return tracedColor;

    return walk(portId, 0) ?? tracedColor;
  }

  function markPortUnoccupied() {
    setNodes((nds) =>
      nds.map((n) => {
        const ports = (n.data as { ports?: { id: string; status: string }[] }).ports;
        if (!ports?.some((p) => p.id === portId)) return n;
        return {
          ...n,
          data: {
            ...n.data,
            ports: ports.map((p) =>
              p.id === portId ? { ...p, status: "unoccupied" as const } : p
            ),
          },
        };
      })
    );
  }

  async function commitLabel() {
    const trimmed = labelDraft.trim() || null;
    setEditingLabel(false);
    try {
      await updatePortLabel(portId, trimmed);
      onLabelChange?.(portId, trimmed);
    } catch {
      // revert on error — re-open editor
      setEditingLabel(true);
    }
  }

  const spliceEdge = findSpliceEdge();
  const hasSplice = Boolean(spliceEdge);
  const traced = hasSplice && traceEntries.has(spliceEdge!.id);
  // Only walk the graph when this port is actually traced — avoids O(nodes×edges) on every untraced port render
  const effectiveTraceColor = traced ? resolveTraceColor(spliceEdge) : tracedColor;
  const activeTraceColor = traced ? (traceEntries.get(spliceEdge!.id) ?? effectiveTraceColor) : tracedColor;
  const currentComment = (spliceEdge?.data?.comment as string | undefined) ?? "";

  const bg = traced ? activeTraceColor : portStatus === "occupied" ? "#f97316" : "#94a3b8";
  const bulkBorder = isBulkA ? "2px solid #14b8a6" : isBulkB ? "2px solid #a855f7" : "2px solid #fff";

  const items: ContextMenuItem[] = [
    {
      label: t("traceFromHere"),
      disabled: !hasSplice || traced,
      onSelect: () => {
        if (!spliceEdge || traced) return;
        toggleTraceEntry(spliceEdge.id, resolveTraceColor(spliceEdge));
      },
    },
    {
      label: t("clearSplice"),
      disabled: !hasSplice,
      destructive: true,
      onSelect: async () => {
        const edge = findSpliceEdge();
        if (!edge) return;
        const other =
          edge.sourceHandle === portId ? edge.targetHandle : edge.sourceHandle;
        await deleteSplice(edge.id);
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        await Promise.all([
          updatePortStatus(portId, "unoccupied"),
          other ? updatePortStatus(other, "unoccupied") : Promise.resolve(),
        ]);
        markPortUnoccupied();
        if (other) {
          setNodes((nds) =>
            nds.map((n) => {
              const ports = (n.data as { ports?: { id: string; status: string }[] }).ports;
              if (!ports?.some((p) => p.id === other)) return n;
              return {
                ...n,
                data: {
                  ...n.data,
                  ports: ports.map((p) =>
                    p.id === other ? { ...p, status: "unoccupied" as const } : p
                  ),
                },
              };
            })
          );
        }
      },
      separatorBefore: true,
    },
    {
      label: currentComment ? t("copyNoteWith", { text: `${currentComment.slice(0, 18)}${currentComment.length > 18 ? "…" : ""}` }) : t("copyNote"),
      disabled: !hasSplice || !currentComment,
      onSelect: () => setCommentClipboard(currentComment),
    },
    {
      label: commentClipboard ? t("pasteNoteWith", { text: `${commentClipboard.slice(0, 18)}${commentClipboard.length > 18 ? "…" : ""}` }) : t("pasteNote"),
      disabled: !hasSplice || !commentClipboard,
      onSelect: async () => {
        const edge = findSpliceEdge();
        if (!edge || commentClipboard == null) return;
        await updateSpliceWithPropagation(edge.id, commentClipboard);
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edge.id
              ? { ...e, data: { ...e.data, comment: commentClipboard } }
              : e
          )
        );
      },
    },
  ];

  // Clear/Copy/Paste only make sense when a splice exists; with no splice
  // we expose just the trace toggle to keep the menu short.
  const finalItems = hasSplice ? items : [items[0]];

  // Port label menu item
  finalItems.push({
    label: portLabel ? t("editLabel", { text: `${portLabel.slice(0, 18)}${portLabel.length > 18 ? "…" : ""}` }) : t("setLabel"),
    separatorBefore: true,
    onSelect: () => { setLabelDraft(portLabel ?? ""); setEditingLabel(true); },
  });

  finalItems.push({
    label: t("continueToPage"),
    disabled: portStatus === "occupied",
    onSelect: () => setPendingContinuationPortId(portId),
  });

  if (finalItems.length > 0) finalItems[0] = { ...finalItems[0], separatorBefore: false };

  return (
    <ContextMenu items={finalItems}>
      {(open) => (
        <>
          <Handle
            type={side === "left" ? "target" : "source"}
            position={side === "left" ? Position.Left : Position.Right}
            id={portId}
            title={portLabel ?? undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (bulkPortSelectMode) {
                const ownerNode = getNodes().find((n) =>
                  (n.data as { ports?: { id: string }[] }).ports?.some((p) => p.id === portId)
                );
                if (ownerNode) toggleBulkPort(portId, ownerNode.id);
                return;
              }
              if (!spliceEdge) return;
              if (traced) removeTraceColor(activeTraceColor);
              else toggleTraceEntry(spliceEdge.id, resolveTraceColor(spliceEdge));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setLabelDraft(portLabel ?? "");
              setEditingLabel(true);
            }}
            onContextMenu={open}
            className="port-handle"
            style={{
              ...posStyle,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              background: bg,
              border: bulkPortSelectMode ? bulkBorder : "2px solid #fff",
              borderRadius: "50%",
              cursor: "pointer",
              boxShadow: isBulkA ? "0 0 0 2px #14b8a680" : isBulkB ? "0 0 0 2px #a855f780" : undefined,
            }}
          />
          {editingLabel && (
            <div
              className="absolute z-50"
              style={{ [side === "left" ? "left" : "right"]: 18, top: -2, width: 130 }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                className="text-[10px] border rounded px-1.5 py-0.5 bg-background outline-none focus:ring-1 focus:ring-primary w-full shadow-md"
                placeholder={t("portLabelPlaceholder")}
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel();
                  if (e.key === "Escape") setEditingLabel(false);
                }}
              />
            </div>
          )}
        </>
      )}
    </ContextMenu>
  );
}

export const PortHandle = memo(PortHandleBase);
