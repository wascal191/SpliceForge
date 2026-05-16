"use client";

import { useState, memo } from "react";
import { useTranslations } from "next-intl";
import { useReactFlow } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElement, deleteElement } from "@/lib/actions/elements";
import { PortHandle } from "./PortHandle";
import type { ContinuationNodeData } from "@/types/fiber";

function ContinuationNodeBase({
  id,
  data,
  selected,
}: NodeProps<Node<ContinuationNodeData, "continuation">>) {
  const t = useTranslations("canvas.node");
  const { label, targetPageLabel, ports } = data;
  const inputPorts = ports.filter((p) => p.side === "left");
  const outputPorts = ports.filter((p) => p.side === "right");
  const rows = Math.max(inputPorts.length, outputPorts.length, 1);

  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const isTraced = tracedNodeIds.has(id);
  const pageNavigator = useCanvasStore((s) => s.pageNavigator);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const { setNodes, setEdges } = useReactFlow();

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

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    await deleteElement(id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }

  const borderColor = isTraced ? "#8b5cf6" : selected ? "#f97316" : "#8b5cf6";
  const boxShadow = isTraced
    ? "0 0 10px 3px rgba(139,92,246,0.5)"
    : selected
    ? undefined
    : undefined;

  return (
    <div
      className="rounded-lg bg-card shadow-md select-none relative"
      style={{
        minWidth: 130,
        border: `2px solid ${borderColor}`,
        boxShadow,
      }}
    >
      {selected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center z-10 leading-none"
          onClick={handleDelete}
          title={t("delete")}
        >
          ×
        </button>
      )}

      <div className="border-b px-2 py-1.5 flex items-center justify-center rounded-t-md"
        style={{ background: "rgba(139,92,246,0.15)", borderColor: "#8b5cf6" }}
      >
        {editingLabel ? (
          <input
            className="text-[11px] font-semibold bg-transparent border-b border-primary outline-none w-full text-center"
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
            className="text-[11px] font-semibold truncate cursor-text"
            style={{ color: "#8b5cf6" }}
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

      <div
        className="text-[10px] text-center px-2 py-0.5 cursor-pointer hover:underline"
        style={{ color: "#8b5cf6" }}
        title={t("continuation.goTo", { page: targetPageLabel })}
        onClick={(e) => { e.stopPropagation(); pageNavigator?.(data.targetPageId); }}
      >
        → {targetPageLabel}
      </div>

      <div className="flex flex-col pb-1.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="relative flex items-center px-2" style={{ height: 20 }}>
            {inputPorts[i] && (
              <PortHandle
                portId={inputPorts[i].id}
                portStatus={inputPorts[i].status}
                side="left"
                tracedColor="#8b5cf6"
              />
            )}
            {outputPorts[i] && (
              <PortHandle
                portId={outputPorts[i].id}
                portStatus={outputPorts[i].status}
                side="right"
                tracedColor="#8b5cf6"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ContinuationNode = memo(ContinuationNodeBase);
