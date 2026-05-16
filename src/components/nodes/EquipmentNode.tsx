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
import type { EquipmentNodeData } from "@/types/fiber";
import { useGeoMenuItem } from "@/hooks/useGeoMenuItem";

function EquipmentNodeBase({
  id,
  data,
  selected,
}: NodeProps<Node<EquipmentNodeData, "equipment">>) {
  const t = useTranslations("canvas.node");
  const tCommon = useTranslations("common");
  const { label, inputCount, outputCount, ports } = data;
  const collapsed = (data.collapsed as boolean | undefined) ?? false;
  const inputPorts = ports.filter((p) => p.side === "left");
  const outputPorts = ports.filter((p) => p.side === "right");
  const rows = Math.max(inputCount, outputCount, 1);

  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const isTraced = tracedNodeIds.has(id);
  const traceColor = useCanvasStore((s) => s.tracedNodeColors[id] ?? "#3b82f6");
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const geoMenuItem = useGeoMenuItem(id, !!(data.geo?.lat));

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();

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
    : "1px solid rgba(61,245,163,0.40)";
  const boxShadow = isTraced
    ? `0 0 0 1px ${traceColor}50, 0 0 20px ${traceColor}40`
    : selected
    ? "0 0 0 1px rgba(0,229,255,0.3), 0 0 28px rgba(0,229,255,0.4)"
    : "0 6px 20px rgba(0,0,0,0.55), 0 0 18px rgba(61,245,163,0.06)";

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
        await updateElement(id, { config_json: { inputCount, outputCount, collapsed: next } });
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
      label: t("deleteEquipment"),
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
            style={{ minWidth: 120, border: borderStyle, boxShadow, background: "linear-gradient(180deg, #0D1A18 0%, #0A1018 100%)" }}
            onContextMenu={openMenu}
          >
            {selected && (
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
                onClick={handleDelete}
                title={t("deleteEquipment")}
              >×</button>
            )}
            <div className="bg-muted px-2 py-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold truncate">{label}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">{inputCount}↔{outputCount} ▶</span>
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
      style={{ minWidth: 120, border: borderStyle, boxShadow }}
      onContextMenu={openMenu}
    >
      {selected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
          onClick={handleDelete}
          title={t("deleteEquipment")}
        >×</button>
      )}
      <div className="border-b bg-muted px-2 py-1 flex items-center gap-1.5" style={{ minWidth: 0 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#3DF5A3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/>
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
      </div>
      <div className="flex flex-col pb-1">
        {Array.from({ length: rows }, (_, i) => {
          const lp = inputPorts[i];
          const rp = outputPorts[i];
          const portLabel = lp?.label ?? rp?.label;
          const portName = portLabel ?? (lp ? `IN ${i + 1}` : `OUT ${i + 1}`);
          const isOccupied = (lp?.status ?? rp?.status) === "occupied";
          return (
            <div key={i} className="relative flex items-center px-3" style={{ height: 20, gap: 6 }}>
              {lp && <PortHandle portId={lp.id} portStatus={lp.status} side="left" tracedColor={traceColor} />}
              <span style={{ fontSize: 10, color: "rgba(241,245,249,0.65)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {portName}
              </span>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: isOccupied ? "#22c55e" : "rgba(148,184,255,0.25)", flexShrink: 0, boxShadow: isOccupied ? "0 0 4px #22c55e" : "none" }} />
              {rp && <PortHandle portId={rp.id} portStatus={rp.status} side="right" tracedColor={traceColor} />}
            </div>
          );
        })}
      </div>
    </div>
      )}
    </ContextMenu>
  );
}

export const EquipmentNode = memo(EquipmentNodeBase);
