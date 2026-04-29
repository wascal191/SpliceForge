"use client";

import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";

export function SearchPanel() {
  const searchQuery = useCanvasStore((s) => s.searchQuery);
  const darkMode = useCanvasStore((s) => s.darkMode);
  const { getNodes, getEdges, setCenter } = useReactFlow();

  const q = searchQuery.trim().toLowerCase();
  if (!q) return null;

  const nodeResults = getNodes().filter((n) =>
    ((n.data as { label?: string }).label ?? "").toLowerCase().includes(q)
  );
  const edgeResults = getEdges().filter((e) =>
    ((e.data as { comment?: string })?.comment ?? "").toLowerCase().includes(q)
  );

  if (nodeResults.length === 0 && edgeResults.length === 0) {
    return (
      <div style={dropdownStyle(darkMode)}>
        <span style={{ fontSize: 11, color: darkMode ? "#64748B" : "#94A3B8" }}>No results</span>
      </div>
    );
  }

  return (
    <div style={{ ...dropdownStyle(darkMode), maxHeight: 280, overflowY: "auto" }}>
      {nodeResults.map((n) => (
        <button
          key={n.id}
          onClick={() =>
            setCenter(
              n.position.x + (n.measured?.width ?? 100) / 2,
              n.position.y + (n.measured?.height ?? 60) / 2,
              { zoom: 1.5, duration: 500 }
            )
          }
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "8px 12px", background: "transparent", border: "none",
            borderBottom: darkMode ? "1px solid rgba(148,184,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            background: darkMode ? "rgba(0,229,255,0.10)" : "rgba(2,132,199,0.08)",
            color: darkMode ? "#00E5FF" : "#0284C7",
            fontFamily: "var(--font-geist-mono, monospace)", flexShrink: 0,
          }}>
            {n.type}
          </span>
          <span style={{ fontSize: 12, color: darkMode ? "#F1F5F9" : "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(n.data as { label?: string }).label}
          </span>
        </button>
      ))}
      {edgeResults.map((e) => (
        <div
          key={e.id}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            borderBottom: darkMode ? "1px solid rgba(148,184,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            background: darkMode ? "rgba(61,245,163,0.10)" : "rgba(5,150,105,0.08)",
            color: darkMode ? "#3DF5A3" : "#059669",
            fontFamily: "var(--font-geist-mono, monospace)", flexShrink: 0,
          }}>
            splice
          </span>
          <span style={{ fontSize: 12, color: darkMode ? "#94A3B8" : "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(e.data as { comment?: string })?.comment}
          </span>
        </div>
      ))}
    </div>
  );
}

function dropdownStyle(darkMode: boolean): React.CSSProperties {
  return {
    position: "fixed",
    top: 105,
    right: 16,
    zIndex: 40,
    width: 260,
    background: darkMode ? "linear-gradient(180deg, #0A0F1A, #070B14)" : "#FFFFFF",
    border: darkMode ? "1px solid rgba(148,184,255,0.18)" : "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    boxShadow: darkMode ? "0 16px 40px rgba(0,0,0,0.7)" : "0 8px 24px rgba(15,23,42,0.12)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    padding: "4px 0",
  };
}
