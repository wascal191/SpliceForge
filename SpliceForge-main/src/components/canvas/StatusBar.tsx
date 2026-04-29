"use client";

import { useState } from "react";
import { useViewport, useNodes, useReactFlow, useStoreApi } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";

type Props = { onFitView: () => void };

export function StatusBar({ onFitView }: Props) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut } = useReactFlow();
  const store = useStoreApi();
  const [interactive, setInteractiveState] = useState(true);

  function toggleInteractive() {
    const next = !interactive;
    setInteractiveState(next);
    store.setState({
      nodesDraggable: next,
      nodesConnectable: next,
      elementsSelectable: next,
    });
  }
  const nodes = useNodes();
  const darkMode = useCanvasStore((s) => s.darkMode);
  const cursorPos = useCanvasStore((s) => s.cursorPos);

  // A real splice = a row inside a closure where BOTH the left port AND the
  // right port at the same position are occupied. Connections that only touch
  // one side of a closure are fiber entries, not completed splices.
  const spliceCount = nodes.reduce((total, node) => {
    if (node.type !== "closure") return total;
    const ports = (node.data as { ports?: { side: string; status: string; portIndex: number }[] }).ports ?? [];
    const left = ports.filter((p) => p.side === "left").sort((a, b) => a.portIndex - b.portIndex);
    const right = ports.filter((p) => p.side === "right").sort((a, b) => a.portIndex - b.portIndex);
    return total + left.filter((lp, i) => lp.status === "occupied" && right[i]?.status === "occupied").length;
  }, 0);

  const bg = darkMode
    ? "linear-gradient(180deg, rgba(10,15,26,0.97), rgba(6,10,18,0.99))"
    : "rgba(255,255,255,0.97)";
  const border = darkMode ? "1px solid rgba(148,184,255,0.14)" : "1px solid rgba(15,23,42,0.10)";
  const dim = darkMode ? "#64748B" : "#94A3B8";
  const fg = darkMode ? "#94A3B8" : "#475569";
  const sep = darkMode ? "rgba(148,184,255,0.10)" : "rgba(15,23,42,0.08)";

  const mono: React.CSSProperties = {
    fontFamily: "var(--font-geist-mono, monospace)",
    letterSpacing: "0.04em",
  };

  return (
    <div
      style={{
        position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
        zIndex: 20, display: "inline-flex", alignItems: "center",
        background: bg, border, borderRadius: 999, height: 32,
        boxShadow: darkMode
          ? "0 8px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)"
          : "0 4px 16px rgba(15,23,42,0.10)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        overflow: "hidden", userSelect: "none",
      }}
    >
      {/* Zoom controls */}
      <button
        onClick={() => zoomOut({ duration: 200 })}
        title="Zoom out"
        style={{ padding: "0 10px", height: "100%", border: "none", background: "transparent", color: dim, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
      >−</button>

      <span style={{ ...mono, fontSize: 10, color: fg, minWidth: 36, textAlign: "center" }}>
        {Math.round(zoom * 100)}%
      </span>

      <button
        onClick={() => zoomIn({ duration: 200 })}
        title="Zoom in"
        style={{ padding: "0 10px", height: "100%", border: "none", background: "transparent", color: dim, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
      >+</button>

      <button
        onClick={onFitView}
        title="Fit to view"
        style={{ padding: "0 10px", height: "100%", border: "none", background: "transparent", color: dim, cursor: "pointer", fontSize: 12, lineHeight: 1 }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>

      <button
        onClick={toggleInteractive}
        title={interactive ? "Lock canvas" : "Unlock canvas"}
        style={{
          padding: "0 10px", height: "100%", border: "none", borderRight: `1px solid ${sep}`,
          background: interactive ? "transparent" : (darkMode ? "rgba(251,191,36,0.10)" : "rgba(245,158,11,0.08)"),
          color: interactive ? dim : (darkMode ? "#FCD34D" : "#D97706"),
          cursor: "pointer", fontSize: 12, lineHeight: 1,
          transition: "color 120ms, background 120ms",
        }}
      >
        {interactive ? (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
        ) : (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v1"/>
          </svg>
        )}
      </button>

      {/* Element count */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderRight: `1px solid ${sep}` }}>
        <span style={{ color: darkMode ? "#00E5FF" : "#0284C7", fontSize: 11, lineHeight: 1 }}>⊕</span>
        <span style={{ ...mono, fontSize: 10, color: fg }}>{nodes.length} elements</span>
      </div>

      {/* Splice count */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderRight: `1px solid ${sep}` }}>
        <span style={{ color: darkMode ? "#3DF5A3" : "#059669", fontSize: 11, lineHeight: 1 }}>↔</span>
        <span style={{ ...mono, fontSize: 10, color: fg }}>{spliceCount} splices</span>
      </div>

      {/* Cursor coordinates */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 14px" }}>
        <span style={{ ...mono, fontSize: 10, color: dim }}>
          x: <span style={{ color: fg }}>{cursorPos.x}</span>
          &nbsp;·&nbsp;
          y: <span style={{ color: fg }}>{cursorPos.y}</span>
        </span>
      </div>
    </div>
  );
}
