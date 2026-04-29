"use client";

import { useState, useEffect, useRef, memo } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { updateSpliceWithPropagation } from "@/lib/fiber/comments";
import { deleteSplice } from "@/lib/actions/splices";
import { updatePortStatus } from "@/lib/actions/ports";
import { useCanvasStore } from "@/store/canvasStore";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { getFiberHex, type FiberColorScheme } from "@/lib/fiber/colors";
import type { FiberPort } from "@/types/fiber";

function SpliceEdgeBase({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const traceEntries = useCanvasStore((s) => s.traceEntries);
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const setCommentClipboard = useCanvasStore((s) => s.setCommentClipboard);
  const commentClipboard = useCanvasStore((s) => s.commentClipboard);
  const isTraced = traceEntries.has(id);
  const edgeTraceColor = traceEntries.get(id) ?? "#3b82f6";
  const { setEdges, setNodes, getNodes, getViewport } = useReactFlow();

  const comment = (data?.comment as string) ?? "";
  const justCreated = Boolean(data?.justCreated);
  const labelOffsetX = (data?.labelOffsetX as number) ?? 0;
  const labelOffsetY = (data?.labelOffsetY as number) ?? 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment);
  const isDragging = useRef(false);
  const [localOffset, setLocalOffset] = useState<{ x: number; y: number } | null>(null);
  const dragFinalOffset = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!editing) setDraft(comment);
  }, [comment, editing]);

  // Close edit mode when edge is deselected
  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);

  // Clear the justCreated flag after the green-flash animation finishes
  useEffect(() => {
    if (!justCreated) return;
    const t = setTimeout(() => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const { justCreated: _drop, ...rest } = (e.data ?? {}) as Record<string, unknown>;
          return { ...e, data: rest };
        })
      );
    }, 650);
    return () => clearTimeout(t);
  }, [justCreated, id, setEdges]);

  async function performDelete() {
    await deleteSplice(id);
    setEdges((eds) => eds.filter((e) => e.id !== id));
    const portIds = [sourceHandleId, targetHandleId].filter(
      (p): p is string => Boolean(p)
    );
    await Promise.all(portIds.map((p) => updatePortStatus(p, "unoccupied")));
    if (portIds.length > 0) {
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
  }

  const menuItems: ContextMenuItem[] = [
    {
      label: "Edit note",
      onSelect: () => {
        setDraft(comment);
        setEditing(true);
      },
    },
    {
      label: isTraced ? "Remove from trace" : "Trace this connection",
      onSelect: () => {
        const srcNode = sourceHandleId ? getNodes().find((n) => {
          const ports = (n.data as { ports?: FiberPort[] }).ports;
          return ports?.some((p) => p.id === sourceHandleId);
        }) : undefined;
        const srcPort = (srcNode?.data as { ports?: FiberPort[] })?.ports?.find(
          (p) => p.id === sourceHandleId
        );
        const scheme = ((srcNode?.data as { colorScheme?: string })?.colorScheme ?? "EIA598") as FiberColorScheme;
        const color = srcPort ? getFiberHex(srcPort.portIndex, scheme) : edgeTraceColor;
        toggleTraceEntry(id, color);
      },
    },
    {
      label: comment ? `Copy note ("${comment.slice(0, 18)}${comment.length > 18 ? "…" : ""}")` : "Copy note",
      disabled: !comment,
      onSelect: () => setCommentClipboard(comment),
    },
    {
      label: commentClipboard ? `Paste note ("${commentClipboard.slice(0, 18)}${commentClipboard.length > 18 ? "…" : ""}")` : "Paste note",
      disabled: !commentClipboard,
      onSelect: async () => {
        if (commentClipboard == null) return;
        await updateSpliceWithPropagation(id, commentClipboard);
        setEdges((eds) =>
          eds.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, comment: commentClipboard } } : e
          )
        );
      },
    },
    {
      label: "Delete splice",
      destructive: true,
      separatorBefore: true,
      onSelect: performDelete,
    },
  ];

  async function commitEdit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === comment) return;
    await updateSpliceWithPropagation(id, trimmed);
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, comment: trimmed } } : e
      )
    );
  }

  const stroke = isTraced ? edgeTraceColor : selected ? "#f97316" : "hsl(var(--border))";
  const strokeWidth = isTraced || selected ? 2.5 : 1.5;

  const effLabelX = labelX + (localOffset?.x ?? labelOffsetX);
  const effLabelY = labelY + (localOffset?.y ?? labelOffsetY);

  function onLabelMouseDown(e: React.MouseEvent) {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffX = labelOffsetX;
    const startOffY = labelOffsetY;
    dragFinalOffset.current = null;
    function onMouseMove(ev: MouseEvent) {
      const { zoom } = getViewport();
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging.current = true;
      const newOff = { x: startOffX + dx, y: startOffY + dy };
      dragFinalOffset.current = newOff;
      setLocalOffset(newOff);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (isDragging.current && dragFinalOffset.current) {
        const { x, y } = dragFinalOffset.current;
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id
              ? { ...edge, data: { ...edge.data, labelOffsetX: x, labelOffsetY: y } }
              : edge
          )
        );
      }
      setLocalOffset(null);
      isDragging.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <ContextMenu items={menuItems}>
      {(openMenu) => (
        <>
          <BaseEdge
            id={id}
            path={edgePath}
            markerEnd={markerEnd}
            className={justCreated ? "splice-flash" : undefined}
            style={{
              stroke,
              strokeWidth,
              filter: isTraced
                ? `drop-shadow(0 0 4px ${edgeTraceColor}b3)`
                : undefined,
            }}
          />
          {/* Invisible wider hit path for right-click */}
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            style={{ pointerEvents: "stroke", cursor: "context-menu" }}
            onContextMenu={openMenu}
          />

          {/* Comment indicator — visible whenever edge has a note and not actively editing */}
          {comment && !editing && (
            <EdgeLabelRenderer>
              <div
                style={{
                  position: "absolute",
                  transform: `translate(-50%,-50%) translate(${effLabelX}px,${effLabelY}px)`,
                  pointerEvents: "all",
                  cursor: "grab",
                }}
                className="nodrag nopan"
                onContextMenu={openMenu}
                onMouseDown={onLabelMouseDown}
              >
                <div
                  className="text-[9px] rounded px-1.5 py-0.5 select-none"
                  style={{
                    background: "hsl(var(--background) / 0.9)",
                    border: `1px solid ${isTraced ? edgeTraceColor : selected ? "#f97316" : "hsl(var(--border))"}`,
                    color: "hsl(var(--muted-foreground))",
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={comment}
                >
                  ✎ {comment.length > 18 ? comment.slice(0, 17) + "…" : comment}
                </div>
              </div>
            </EdgeLabelRenderer>
          )}

          {/* Inline edit input — only visible while actively editing (triggered from context menu) */}
          {editing && (
            <EdgeLabelRenderer>
              <div
                style={{
                  position: "absolute",
                  transform: `translate(-50%,-50%) translate(${effLabelX}px,${effLabelY}px)`,
                  pointerEvents: "all",
                }}
                className="nodrag nopan"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  className="text-[11px] bg-background border border-primary rounded px-1.5 py-0.5 w-36 shadow-md outline-none"
                  value={draft}
                  autoFocus
                  placeholder="Add a note…"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") { setEditing(false); setDraft(comment); }
                  }}
                />
              </div>
            </EdgeLabelRenderer>
          )}
        </>
      )}
    </ContextMenu>
  );
}

export const SpliceEdge = memo(SpliceEdgeBase);
