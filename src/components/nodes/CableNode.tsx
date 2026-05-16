"use client";

import { useState, memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { getFiberHex, isLightColor, type FiberColorScheme } from "@/lib/fiber/colors";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElement, deleteElement } from "@/lib/actions/elements";
import { saveToLibrary } from "@/lib/actions/library";
import { deleteSplicesBatch } from "@/lib/actions/splices";
import { updatePortStatusBatch } from "@/lib/actions/ports";
import { PortHandle } from "./PortHandle";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import type { CableNodeData } from "@/types/fiber";
import { useGeoMenuItem } from "@/hooks/useGeoMenuItem";

function CableNodeBase({
  id,
  data,
  selected,
}: NodeProps<Node<CableNodeData, "cable">>) {
  const t = useTranslations("canvas.node");
  const tCommon = useTranslations("common");
  const { label, fiberCount, ports } = data;
  const colorScheme = (data.colorScheme as FiberColorScheme | undefined) ?? "EIA598";
  const moduleFiberCount = (data.moduleFiberCount as number | undefined) ?? 0;
  const collapsed = (data.collapsed as boolean | undefined) ?? false;

  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const isTraced = tracedNodeIds.has(id);
  const traceColor = useCanvasStore((s) => s.tracedNodeColors[id] ?? "#3b82f6");
  const setPendingCableSplit = useCanvasStore((s) => s.setPendingCableSplit);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [collapsedModules, setCollapsedModules] = useState<Set<number>>(
    () => new Set((data.collapsedModules as number[] | undefined) ?? [])
  );
  const [savedMsg, setSavedMsg] = useState(false);
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const traceEntries = useCanvasStore((s) => s.traceEntries);
  const geoMenuItem = useGeoMenuItem(id, !!(data.geo?.lat));
  const { setNodes, setEdges, getEdges } = useReactFlow();

  const handlePortLabelChange = useCallback((portId: string, newLabel: string | null) => {
    setNodes((nds) => nds.map((n) => n.id !== id ? n : {
      ...n, data: { ...n.data, ports: (n.data as CableNodeData).ports.map((p) => p.id === portId ? { ...p, label: newLabel ?? undefined } : p) },
    }));
  }, [id, setNodes]);

  async function clearModuleSplices(modulePorts: typeof ports) {
    const portIds = new Set(modulePorts.map((p) => p.id));
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

  function persistCollapsed(next: Set<number>) {
    updateElement(id, {
      config_json: {
        fiberCount,
        colorScheme,
        ...(moduleFiberCount ? { moduleFiberCount } : {}),
        collapsedModules: Array.from(next),
        collapsed, // preserve node-level collapsed state
      },
    });
  }

  function toggleModule(mi: number) {
    // Compute next outside the updater so persistCollapsed (a server action)
    // is not called inside a state updater function, which React forbids.
    const next = new Set(collapsedModules);
    if (next.has(mi)) next.delete(mi); else next.add(mi);
    setCollapsedModules(next);
    persistCollapsed(next);
  }

  const borderStyle = isTraced
    ? `1px solid ${traceColor}`
    : selected
    ? "1px solid rgba(0,229,255,0.55)"
    : "1px solid rgba(148,184,255,0.22)";
  const boxShadow = isTraced
    ? `0 0 0 1px ${traceColor}50, 0 0 20px ${traceColor}40`
    : selected
    ? "0 0 0 1px rgba(0,229,255,0.3), 0 0 28px rgba(0,229,255,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
    : "0 6px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)";

  const modSize = moduleFiberCount > 0 ? moduleFiberCount : fiberCount;
  const moduleCount = Math.ceil(fiberCount / modSize);

  // dual-side: new cables have 2×fiberCount ports (first N=left, next N=right)
  const leftPorts = ports.filter((p) => p.side === "left");
  const rightPorts = ports.filter((p) => p.side === "right");
  const isDualSide = leftPorts.length > 0 && rightPorts.length > 0;

  const allCollapsed = moduleCount > 1 && collapsedModules.size === moduleCount;

  const menuItems: ContextMenuItem[] = [
    {
      label: tCommon("rename"),
      onSelect: () => {
        setLabelDraft(label);
        setEditingLabel(true);
      },
    },
    {
      label: collapsed ? t("expandNode") : t("collapseNode"),
      onSelect: async () => {
        const next = !collapsed;
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, collapsed: next } } : n));
        await updateElement(id, {
          config_json: {
            fiberCount, colorScheme,
            ...(moduleFiberCount ? { moduleFiberCount } : {}),
            collapsedModules: Array.from(collapsedModules),
            collapsed: next,
          },
        });
      },
    },
    ...(moduleCount > 1 ? [{
      label: allCollapsed ? t("cable.expandAllModules") : t("cable.collapseAllModules"),
      onSelect: () => {
        const next = allCollapsed
          ? new Set<number>()
          : new Set(Array.from({ length: moduleCount }, (_, i) => i));
        setCollapsedModules(next);
        persistCollapsed(next);
      },
    }] : []),
    {
      label: t("traceAll"),
      onSelect: () => {
        const edges = getEdges();
        for (const port of ports) {
          const edge = edges.find(e => e.sourceHandle === port.id || e.targetHandle === port.id);
          if (edge) {
            const color = getFiberHex(port.portIndex % fiberCount, colorScheme);
            toggleTraceEntry(edge.id, color);
          }
        }
      },
    },
    {
      label: t("cable.saveToLibrary"),
      onSelect: async () => {
        await saveToLibrary(label, fiberCount, colorScheme, moduleFiberCount || undefined);
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2000);
      },
    },
    geoMenuItem,
    {
      label: t("deleteCable"),
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
            className="rounded select-none relative"
            style={{ minWidth: 110, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #121B2D 0%, #0B1220 100%)" }}
            onContextMenu={openMenu}
          >
            {selected && (
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
                onClick={handleDelete}
                title={t("deleteCable")}
              >×</button>
            )}
            <div className="bg-muted px-2 py-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold truncate">{label}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">{fiberCount}f ▶</span>
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
      className="rounded select-none relative"
      style={{ minWidth: isDualSide ? 220 : 110, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #121B2D 0%, #0B1220 100%)" }}
      onContextMenu={openMenu}
    >
      {selected && (
        <>
          <button
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
            onClick={handleDelete}
            title={t("deleteCable")}
          >×</button>
          <button
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-muted border rounded px-1 py-0 leading-4 z-10 whitespace-nowrap hover:bg-accent"
            onClick={(e) => { e.stopPropagation(); saveToLibrary(label, fiberCount, colorScheme, moduleFiberCount || undefined).then(() => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); }); }}
            title={t("cable.saveToLibraryTitle")}
          >{savedMsg ? t("cable.saved") : t("cable.saveToLibraryShort")}</button>
        </>
      )}

      <div className="border-b bg-muted px-2 py-1 flex items-center gap-1.5" style={{ minWidth: 0 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" />
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
            title={t("doubleClickRename")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setLabelDraft(label);
              setEditingLabel(true);
            }}
          >
            {label}
          </span>
        )}
        <span style={{ fontSize: 9, background: "rgba(0,229,255,0.12)", color: "#00E5FF", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-geist-mono,monospace)", flexShrink: 0 }}>
          {fiberCount}f
        </span>
      </div>

      <div className="flex flex-col py-0.5">
        {Array.from({ length: moduleCount }, (_, mi) => {
          const start = mi * modSize;
          const end = Math.min(start + modSize, fiberCount);
          const isCollapsed = collapsedModules.has(mi);
          return (
            <div key={mi}>
              {moduleCount > 1 && (() => {
                const modHex = getFiberHex(mi, colorScheme);
                const modLight = isLightColor(modHex);
                const modulePorts = [
                  ...leftPorts.slice(start, end),
                  ...rightPorts.slice(start, end),
                ];
                const currentEdges = getEdges();
                const allModuleTraced =
                  modulePorts.length > 0 &&
                  modulePorts.every(p =>
                    currentEdges.some(e =>
                      (e.sourceHandle === p.id || e.targetHandle === p.id) && traceEntries.has(e.id)
                    )
                  );
                const moduleMenuItems: ContextMenuItem[] = [
                  {
                    label: allModuleTraced ? t("cable.untraceModule") : t("cable.traceModule"),
                    onSelect: () => {
                      const edges = getEdges();
                      for (const port of modulePorts) {
                        for (const edge of edges.filter(e => e.sourceHandle === port.id || e.targetHandle === port.id)) {
                          const color = getFiberHex(port.portIndex % fiberCount, colorScheme);
                          if (allModuleTraced ? traceEntries.has(edge.id) : !traceEntries.has(edge.id)) {
                            toggleTraceEntry(edge.id, color);
                          }
                        }
                      }
                    },
                  },
                  {
                    label: t("cable.clearModuleSplices"),
                    destructive: true,
                    onSelect: () => clearModuleSplices([
                      ...leftPorts.slice(start, end),
                      ...rightPorts.slice(start, end),
                    ]),
                  },
                  {
                    label: `Split cable here → ${(moduleCount - mi) * modSize}f new node`,
                    disabled: mi === 0,
                    separatorBefore: true,
                    onSelect: () => setPendingCableSplit({ nodeId: id, moduleIndex: mi }),
                  },
                ];
                return (
                  <ContextMenu items={moduleMenuItems}>
                    {(openModuleMenu) => (
                      <div
                        className="flex items-center gap-1 px-2 cursor-pointer border-y text-[9px]"
                        style={{ height: 16, backgroundColor: modHex, color: modLight ? "#1a1a1a" : "#ffffff", borderColor: modLight ? "#aaa" : modHex }}
                        onClick={() => toggleModule(mi)}
                        onContextMenu={openModuleMenu}
                      >
                        <span className="leading-none">{isCollapsed ? "▶" : "▼"}</span>
                        <span>Mod {mi + 1} &middot; {end - start}f</span>
                      </div>
                    )}
                  </ContextMenu>
                );
              })()}
              {/* Hidden handles for collapsed modules — keeps RF edges from throwing error #008 */}
              {isCollapsed && (
                <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
                  {Array.from({ length: end - start }, (_, j) => {
                    const i = start + j;
                    const lp = isDualSide ? leftPorts[i] : (ports[i]?.side === "left" ? ports[i] : undefined);
                    const rp = isDualSide ? rightPorts[i] : (ports[i]?.side === "right" ? ports[i] : undefined);
                    return (
                      <div key={i}>
                        {lp && <Handle type="target" position={Position.Left} id={lp.id} style={{ visibility: "hidden" }} />}
                        {rp && <Handle type="source" position={Position.Right} id={rp.id} style={{ visibility: "hidden" }} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {!isCollapsed && Array.from({ length: end - start }, (_, j) => {
                const i = start + j;
                const hex = getFiberHex(i, colorScheme);
                const light = isLightColor(hex);

                if (isDualSide) {
                  const lp = leftPorts[i];
                  const rp = rightPorts[i];
                  return (
                    <div
                      key={i}
                      className="relative flex items-center px-4"
                      style={{ height: 20 }}
                    >
                      {lp && (
                        <PortHandle portId={lp.id} portStatus={lp.status} side="left" tracedColor={hex}
                          portLabel={lp.label}
                          onLabelChange={handlePortLabelChange}
                        />
                      )}
                      <span
                        className="text-[9px] leading-none truncate flex-1 text-left"
                        style={{ color: lp?.label ? "rgba(0,229,255,0.65)" : "transparent", minWidth: 0 }}
                        title={lp?.label}
                      >
                        {lp?.label ?? " "}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <div
                          className="w-3 h-3 rounded-sm border"
                          style={{ backgroundColor: hex, borderColor: light ? "#aaa" : hex }}
                        />
                        <span className="text-[10px] text-muted-foreground leading-none w-5 text-center">{i + 1}</span>
                      </div>
                      <span
                        className="text-[9px] leading-none truncate flex-1 text-right"
                        style={{ color: rp?.label ? "rgba(0,229,255,0.65)" : "transparent", minWidth: 0 }}
                        title={rp?.label}
                      >
                        {rp?.label ?? " "}
                      </span>
                      {rp && (
                        <PortHandle portId={rp.id} portStatus={rp.status} side="right" tracedColor={hex}
                          portLabel={rp.label}
                          onLabelChange={handlePortLabelChange}
                        />
                      )}
                    </div>
                  );
                }

                // legacy single-side
                const port = ports[i];
                return (
                  <div
                    key={i}
                    className="relative flex items-center gap-1.5 px-2"
                    style={{ height: 20 }}
                  >
                    <div
                      className="w-3 h-3 rounded-sm shrink-0 border"
                      style={{ backgroundColor: hex, borderColor: light ? "#aaa" : hex }}
                    />
                    <span className="text-[10px] text-muted-foreground leading-none">{i + 1}</span>
                    {port?.label && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-none" title={port.label}>
                        {port.label}
                      </span>
                    )}
                    {port && (
                      <PortHandle
                        portId={port.id}
                        portStatus={port.status}
                        side={port.side}
                        tracedColor={hex}
                        portLabel={port.label}
                        onLabelChange={handlePortLabelChange}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
      )}
    </ContextMenu>
  );
}

export const CableNode = memo(CableNodeBase);
