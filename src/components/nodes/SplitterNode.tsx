"use client";

import { useState, memo } from "react";
import { useTranslations } from "next-intl";
import { useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { getFiberHex, type FiberColorScheme } from "@/lib/fiber/colors";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElement, deleteElement } from "@/lib/actions/elements";
import { PortHandle } from "./PortHandle";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import type { FiberPort } from "@/types/fiber";
import type { SplitterNodeData } from "@/types/fiber";
import { useGeoMenuItem } from "@/hooks/useGeoMenuItem";

function SplitterNodeBase({
  id,
  data,
  selected,
}: NodeProps<Node<SplitterNodeData, "splitter">>) {
  const t = useTranslations("canvas.node");
  const tCommon = useTranslations("common");
  const { label, ratio, inputCount, outputCount, ports } = data;
  const collapsed = (data.collapsed as boolean | undefined) ?? false;
  const inputPorts = ports.filter((p) => p.side === "left");
  const outputPorts = ports.filter((p) => p.side === "right");
  const rows = Math.max(inputCount, outputCount);

  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const isTraced = tracedNodeIds.has(id);
  const traceColor = useCanvasStore((s) => s.tracedNodeColors[id] ?? "#3b82f6");
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const geoMenuItem = useGeoMenuItem(id, !!(data.geo?.lat));

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();

  const isCompact = outputPorts.length === 1;
  const singleOutputPort = isCompact ? outputPorts[0] : null;
  const liveConnectionCount = isCompact
    ? getEdges().filter(e => e.sourceHandle === singleOutputPort!.id || e.targetHandle === singleOutputPort!.id).length
    : 0;

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

  const borderStyle = isTraced
    ? `1px solid ${traceColor}`
    : selected
    ? "1px solid rgba(0,229,255,0.55)"
    : "1px solid rgba(245,158,11,0.45)";
  const boxShadow = isTraced
    ? `0 0 0 1px ${traceColor}50, 0 0 20px ${traceColor}40`
    : selected
    ? "0 0 0 1px rgba(0,229,255,0.3), 0 0 28px rgba(0,229,255,0.4)"
    : "0 6px 20px rgba(0,0,0,0.55), 0 0 18px rgba(245,158,11,0.10)";

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

  const menuItems: ContextMenuItem[] = [
    {
      label: tCommon("rename"),
      onSelect: () => { setLabelDraft(label); setEditingLabel(true); },
    },
    {
      label: collapsed ? t("expandNode") : t("collapseNode"),
      onSelect: async () => {
        const next = !collapsed;
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, collapsed: next } } : n));
        await updateElement(id, { config_json: { ratio, inputCount, outputCount, collapsed: next } });
      },
    },
    {
      label: t("traceAll"),
      onSelect: () => {
        const edges = getEdges();
        for (const port of ports) {
          const edge = edges.find(e => e.sourceHandle === port.id || e.targetHandle === port.id);
          if (edge) toggleTraceEntry(edge.id, traceAllColor(port.id));
        }
      },
    },
    geoMenuItem,
    {
      label: t("deleteSplitter"),
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
            style={{ minWidth: 100, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #1E1A10 0%, #0C0E18 100%)" }}
            onContextMenu={openMenu}
          >
            {selected && (
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
                onClick={handleDelete}
                title={t("deleteSplitter")}
              >×</button>
            )}
            <div className="bg-muted px-2 py-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold truncate">{label}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">{ratio} ▶</span>
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
      className="rounded bg-card shadow-sm select-none relative"
      style={{ minWidth: 100, border: borderStyle, boxShadow }}
      onContextMenu={openMenu}
    >
      {selected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
          onClick={handleDelete}
          title="Delete splitter"
        >×</button>
      )}
      <div className="border-b bg-muted px-2 py-1 flex items-center gap-1.5" style={{ minWidth: 0 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M12 5v7M8 19l4-7 4 7" />
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
        <span style={{ fontSize: 9, background: "rgba(252,211,77,0.12)", color: "#FCD34D", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-geist-mono,monospace)", flexShrink: 0 }}>
          {ratio}
        </span>
      </div>
      <div className="flex flex-col pb-0">
        {isCompact ? (
          Array.from({ length: Math.max(inputCount, 1) }, (_, i) => (
            <div
              key={i}
              className="relative flex items-center justify-between px-2"
              style={{ height: 20 }}
            >
              {inputPorts[i] && (
                <PortHandle
                  portId={inputPorts[i].id}
                  portStatus={inputPorts[i].status}
                  side="left"
                  tracedColor={traceColor}
                />
              )}
              {i === 0 && singleOutputPort && (
                <>
                  <span className="text-[9px] text-muted-foreground leading-none absolute right-5">
                    {liveConnectionCount}/{outputCount}
                  </span>
                  <PortHandle
                    portId={singleOutputPort.id}
                    portStatus={liveConnectionCount >= outputCount ? "occupied" : "unoccupied"}
                    side="right"
                    tracedColor={traceColor}
                  />
                </>
              )}
            </div>
          ))
        ) : (
          Array.from({ length: rows }, (_, i) => (
            <div
              key={i}
              className="relative flex items-center justify-between px-2"
              style={{ height: 20 }}
            >
              {inputPorts[i] && (
                <PortHandle
                  portId={inputPorts[i].id}
                  portStatus={inputPorts[i].status}
                  side="left"
                  tracedColor={traceColor}
                />
              )}
              {outputPorts[i] && (
                <PortHandle
                  portId={outputPorts[i].id}
                  portStatus={outputPorts[i].status}
                  side="right"
                  tracedColor={traceColor}
                />
              )}
            </div>
          ))
        )}
      </div>
      {/* Utilization bar */}
      {(() => {
        const usedIn = inputPorts.filter((p) => p.status === "occupied").length;
        const usedOut = isCompact ? liveConnectionCount : outputPorts.filter((p) => p.status === "occupied").length;
        const totalUsed = usedIn + usedOut;
        const totalCap = inputCount + outputCount;
        const pct = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;
        const barColor = pct >= 90 ? "#ef4444" : pct >= 65 ? "#f59e0b" : "#22c55e";
        return (
          <div style={{ padding: "5px 8px 6px", borderTop: "1px solid rgba(148,184,255,0.10)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "rgba(241,245,249,0.45)", fontFamily: "var(--font-geist-mono,monospace)", letterSpacing: "0.04em" }}>
                {totalUsed}/{totalCap} used
              </span>
              <span style={{ fontSize: 9, color: barColor, fontFamily: "var(--font-geist-mono,monospace)", fontWeight: 600 }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 3, background: "rgba(148,184,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999, transition: "width 300ms ease, background 300ms ease" }} />
            </div>
          </div>
        );
      })()}
    </div>
      )}
    </ContextMenu>
  );
}

export const SplitterNode = memo(SplitterNodeBase);
