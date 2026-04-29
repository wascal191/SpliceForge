"use client";

import { useState, memo, useCallback } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { getFiberHex, type FiberColorScheme } from "@/lib/fiber/colors";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElement, deleteElement } from "@/lib/actions/elements";
import { deleteSplicesBatch } from "@/lib/actions/splices";
import { updatePortStatusBatch } from "@/lib/actions/ports";
import { PortHandle } from "./PortHandle";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import type { FiberPort } from "@/types/fiber";
import type { ClosureNodeData } from "@/types/fiber";

function ClosureNodeBase({
  id,
  data,
  selected,
}: NodeProps<Node<ClosureNodeData, "closure">>) {
  const { label, inputCount, outputCount, ports } = data;
  const trayCount = (data.trayCount as number | undefined) ?? 1;
  const collapsed = (data.collapsed as boolean | undefined) ?? false;
  const portsPerTray = inputCount + outputCount;

  const [collapsedTrays, setCollapsedTrays] = useState<Set<number>>(
    () => new Set((data.collapsedTrays as number[] | undefined) ?? [])
  );
  const [trayNotes, setTrayNotes] = useState<Record<number, string>>(
    () => ((data.trayNotes as Record<number, string> | undefined) ?? {})
  );
  const [editingTrayNote, setEditingTrayNote] = useState<number | null>(null);
  const [trayNoteDraft, setTrayNoteDraft] = useState("");

  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const isTraced = tracedNodeIds.has(id);
  const traceColor = useCanvasStore((s) => s.tracedNodeColors.get(id) ?? "#3b82f6");
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();

  const handlePortLabelChange = useCallback((portId: string, newLabel: string | null) => {
    setNodes((nds) => nds.map((n) => n.id !== id ? n : {
      ...n, data: { ...n.data, ports: (n.data as ClosureNodeData).ports.map((p) => p.id === portId ? { ...p, label: newLabel ?? undefined } : p) },
    }));
  }, [id, setNodes]);

  function buildConfig(overrides: Record<string, unknown>) {
    return {
      inputCount,
      outputCount,
      trayCount,
      collapsed,
      collapsedTrays: Array.from(collapsedTrays),
      trayNotes,
      ...overrides,
    };
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    await deleteElement(id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }

  async function commitLabel() {
    const trimmed = labelDraft.trim() || label;
    setEditingLabel(false);
    setLabelDraft(trimmed);
    if (trimmed === label) return;
    await updateElement(id, { label: trimmed });
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n
      )
    );
  }

  async function toggleTray(trayIdx: number) {
    const next = new Set(collapsedTrays);
    if (next.has(trayIdx)) next.delete(trayIdx);
    else next.add(trayIdx);
    setCollapsedTrays(next);
    await updateElement(id, { config_json: buildConfig({ collapsedTrays: Array.from(next) }) });
  }

  async function saveTrayNote(trayIdx: number, note: string) {
    const next = { ...trayNotes };
    if (note) next[trayIdx] = note;
    else delete next[trayIdx];
    setTrayNotes(next);
    setEditingTrayNote(null);
    await updateElement(id, { config_json: buildConfig({ trayNotes: next }) });
  }

  function traceAllColor(portId: string): string {
    const edges = getEdges();
    const edge = edges.find(e => e.sourceHandle === portId || e.targetHandle === portId);
    if (!edge) return "#3b82f6";
    const otherPortId = edge.sourceHandle === portId ? edge.targetHandle : edge.sourceHandle;
    const otherNode = getNodes().find(n => (n.data as { ports?: FiberPort[] }).ports?.some(p => p.id === otherPortId));
    const otherPort = (otherNode?.data as { ports?: FiberPort[] })?.ports?.find(p => p.id === otherPortId);
    const scheme = ((otherNode?.data as { colorScheme?: string })?.colorScheme ?? "EIA598") as FiberColorScheme;
    return otherPort ? getFiberHex(otherPort.portIndex, scheme) : "#3b82f6";
  }

  async function clearTraySplices(trayPorts: FiberPort[]) {
    const portIds = new Set(trayPorts.map((p) => p.id));
    const edges = getEdges();
    const toDelete = edges.filter(
      (e) => portIds.has(e.sourceHandle ?? "") || portIds.has(e.targetHandle ?? "")
    );
    if (toDelete.length === 0) return;
    const allHandles = toDelete.flatMap((e) =>
      [e.sourceHandle, e.targetHandle].filter((h): h is string => Boolean(h))
    );
    await deleteSplicesBatch(toDelete.map((e) => e.id));
    await updatePortStatusBatch(allHandles, "unoccupied");
    const deleteIds = new Set(toDelete.map((e) => e.id));
    setEdges((eds) => eds.filter((e) => !deleteIds.has(e.id)));
    setNodes((nds) =>
      nds.map((n) => {
        const ps = (n.data as { ports?: { id: string; status: string }[] }).ports;
        if (!ps?.some((p) => allHandles.includes(p.id))) return n;
        return {
          ...n,
          data: {
            ...n.data,
            ports: ps.map((p) =>
              allHandles.includes(p.id) ? { ...p, status: "unoccupied" as const } : p
            ),
          },
        };
      })
    );
  }

  const borderStyle = isTraced
    ? `1px solid ${traceColor}`
    : selected
    ? "1px solid rgba(0,229,255,0.55)"
    : "1px solid rgba(168,85,247,0.50)";
  const boxShadow = isTraced
    ? `0 0 0 1px ${traceColor}50, 0 0 20px ${traceColor}40`
    : selected
    ? "0 0 0 1px rgba(0,229,255,0.3), 0 0 28px rgba(0,229,255,0.4)"
    : "0 6px 20px rgba(0,0,0,0.55), 0 0 20px rgba(168,85,247,0.10)";

  const menuItems: ContextMenuItem[] = [
    {
      label: "Rename",
      onSelect: () => { setLabelDraft(label); setEditingLabel(true); },
    },
    {
      label: collapsed ? "Expand node" : "Collapse node",
      onSelect: async () => {
        const next = !collapsed;
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, collapsed: next } } : n));
        await updateElement(id, { config_json: buildConfig({ collapsed: next }) });
      },
    },
    {
      label: "Expand all trays",
      onSelect: async () => {
        setCollapsedTrays(new Set());
        await updateElement(id, { config_json: buildConfig({ collapsedTrays: [] }) });
      },
    },
    {
      label: "Collapse all trays",
      onSelect: async () => {
        const all = Array.from({ length: trayCount }, (_, i) => i);
        setCollapsedTrays(new Set(all));
        await updateElement(id, { config_json: buildConfig({ collapsedTrays: all }) });
      },
    },
    {
      label: "Trace all connections",
      onSelect: () => {
        const edges = getEdges();
        for (const port of ports) {
          const edge = edges.find(e => e.sourceHandle === port.id || e.targetHandle === port.id);
          if (edge) toggleTraceEntry(edge.id, traceAllColor(port.id));
        }
      },
    },
    {
      label: "Delete closure",
      destructive: true,
      separatorBefore: true,
      onSelect: async () => {
        await deleteElement(id);
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      },
    },
  ];

  if (collapsed) {
    return (
      <ContextMenu items={menuItems}>
        {(openMenu) => (
          <div
            className="rounded-lg select-none relative"
            style={{ minWidth: 130, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #1A1528 0%, #0C0C1A 100%)" }}
            onContextMenu={openMenu}
          >
            {selected && (
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
                onClick={handleDelete}
                title="Delete closure"
              >×</button>
            )}
            <div className="bg-muted px-2 py-1.5 flex items-center justify-between gap-2 rounded-md">
              <span className="text-[11px] font-semibold truncate">{label}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {trayCount > 1 ? `${trayCount}T · ` : ""}{inputCount}↔{outputCount} ▶
              </span>
            </div>
          </div>
        )}
      </ContextMenu>
    );
  }

  return (
    <ContextMenu items={menuItems}>
      {(openMenu) => (
        <div
          className="rounded-lg select-none relative"
          style={{ minWidth: 200, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #1A1528 0%, #0C0C1A 100%)" }}
          onContextMenu={openMenu}
        >
          {selected && (
            <button
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
              onClick={handleDelete}
              title="Delete closure"
            >×</button>
          )}

          {/* Header */}
          <div className="border-b bg-muted px-2 py-1.5 flex items-center gap-1.5 rounded-t-md" style={{ minWidth: 0 }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#C4A7FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            {editingLabel ? (
              <input
                className="text-[11px] font-semibold bg-transparent border-b border-primary outline-none flex-1 min-w-0"
                value={labelDraft}
                autoFocus
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel();
                  if (e.key === "Escape") { setEditingLabel(false); setLabelDraft(label); }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-[11px] font-semibold truncate cursor-text flex-1 min-w-0"
                title="Double-click to rename"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setLabelDraft(label);
                  setEditingLabel(true);
                }}
              >
                {label}
              </span>
            )}
            <span style={{ fontSize: 9, background: "rgba(196,167,255,0.12)", color: "#C4A7FF", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-geist-mono,monospace)", flexShrink: 0 }}>
              {trayCount * inputCount}f
            </span>
          </div>

          {/* Subheader: summary */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 8px", borderBottom: "1px solid rgba(148,184,255,0.10)" }}>
            <span style={{ fontSize: 9, color: "rgba(196,167,255,0.55)", fontFamily: "var(--font-geist-mono,monospace)", letterSpacing: "0.04em" }}>
              SPLICE CLOSURE
            </span>
            <span style={{ fontSize: 9, color: "rgba(241,245,249,0.35)", fontFamily: "var(--font-geist-mono,monospace)" }}>
              {trayCount}T · {inputCount}↔{outputCount}
            </span>
          </div>

          {/* Trays */}
          {Array.from({ length: trayCount }, (_, trayIdx) => {
            const trayPorts = ports.filter(
              (p) => Math.floor(p.portIndex / portsPerTray) === trayIdx
            );
            const leftPorts = trayPorts
              .filter((p) => p.side === "left")
              .sort((a, b) => a.portIndex - b.portIndex);
            const rightPorts = trayPorts
              .filter((p) => p.side === "right")
              .sort((a, b) => a.portIndex - b.portIndex);
            const rows = Math.max(inputCount, outputCount, 1);
            const isTrayCollapsed = collapsedTrays.has(trayIdx);
            const note = trayNotes[trayIdx];
            // A splice requires both sides of the same row to be occupied
            const splicedCount = leftPorts.filter(
              (lp, i) => lp.status === "occupied" && rightPorts[i]?.status === "occupied"
            ).length;
            const splicePositions = Math.max(leftPorts.length, rightPorts.length);

            return (
              <div key={trayIdx} className="border-t border-border/40">
                {/* Tray header row */}
                <ContextMenu items={[
                  {
                    label: "Clear all splices in this tray",
                    destructive: true,
                    onSelect: () => clearTraySplices(trayPorts),
                  },
                ]}>
                  {(openTrayMenu) => (
                    <div
                      className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-muted/60 cursor-pointer group"
                      onClick={(e) => { e.stopPropagation(); toggleTray(trayIdx); }}
                      onContextMenu={openTrayMenu}
                    >
                      <span className="text-[10px] text-muted-foreground w-3 shrink-0 leading-none">
                        {isTrayCollapsed ? "▶" : "▼"}
                      </span>
                      <span className="text-[10px] font-medium flex-1 truncate min-w-0">
                        Tray {trayIdx + 1}
                        {note && (
                          <span className="text-muted-foreground font-normal"> · {note}</span>
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {splicedCount}/{splicePositions}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground w-4 text-center leading-none shrink-0"
                        title="Edit tray note"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTrayNote(trayIdx);
                          setTrayNoteDraft(note ?? "");
                        }}
                      >✏</button>
                    </div>
                  )}
                </ContextMenu>

                {/* Inline note editor */}
                {editingTrayNote === trayIdx && (
                  <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="w-full text-[10px] border rounded px-1.5 py-0.5 bg-background outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Tray note (e.g. Buffer Azul)"
                      value={trayNoteDraft}
                      autoFocus
                      onChange={(e) => setTrayNoteDraft(e.target.value)}
                      onBlur={() => saveTrayNote(trayIdx, trayNoteDraft.trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTrayNote(trayIdx, trayNoteDraft.trim());
                        if (e.key === "Escape") setEditingTrayNote(null);
                      }}
                    />
                  </div>
                )}

                {/* Hidden handles for collapsed trays — prevents RF error #008 */}
                {isTrayCollapsed && (
                  <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
                    {leftPorts.map((lp) => (
                      <Handle key={lp.id} type="target" position={Position.Left} id={lp.id} style={{ visibility: "hidden" }} />
                    ))}
                    {rightPorts.map((rp) => (
                      <Handle key={rp.id} type="source" position={Position.Right} id={rp.id} style={{ visibility: "hidden" }} />
                    ))}
                  </div>
                )}
                {/* Port rows */}
                {!isTrayCollapsed && (
                  <div className="flex flex-col pb-0.5">
                    {Array.from({ length: rows }, (_, i) => {
                      const lp = leftPorts[i];
                      const rp = rightPorts[i];
                      return (
                        <div key={i} className="relative flex items-center" style={{ height: 22 }}>
                          {lp && (
                            <PortHandle
                              portId={lp.id}
                              portStatus={lp.status}
                              side="left"
                              tracedColor={traceColor}
                              portLabel={lp.label}
                              onLabelChange={handlePortLabelChange}
                            />
                          )}
                          <div className="flex items-center min-w-0 flex-1 px-2 gap-1">
                            <span
                              className="text-[9px] leading-none truncate flex-1 text-left"
                              style={{ color: lp?.label ? "rgba(196,167,255,0.70)" : "transparent", minWidth: 0 }}
                              title={lp?.label}
                            >
                              {lp?.label ?? " "}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-none shrink-0 w-6 text-center">
                              {trayIdx * inputCount + i + 1}
                            </span>
                            <span
                              className="text-[9px] leading-none truncate flex-1 text-right"
                              style={{ color: rp?.label ? "rgba(196,167,255,0.70)" : "transparent", minWidth: 0 }}
                              title={rp?.label}
                            >
                              {rp?.label ?? " "}
                            </span>
                          </div>
                          {rp && (
                            <PortHandle
                              portId={rp.id}
                              portStatus={rp.status}
                              side="right"
                              tracedColor={traceColor}
                              portLabel={rp.label}
                              onLabelChange={handlePortLabelChange}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ContextMenu>
  );
}

export const ClosureNode = memo(ClosureNodeBase);
