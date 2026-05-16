"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useCanvasStore } from "@/store/canvasStore";

const ELEMENT_TYPES = ["cable", "closure", "splitter", "equipment", "continuation"] as const;
type EType = (typeof ELEMENT_TYPES)[number];

interface Props {
  visibleTypes: Set<EType>;
  onToggleType: (t: EType) => void;
  traceOnly: boolean;
  onToggleTraceOnly: () => void;
  hasTrace: boolean;
}

const TYPE_COLORS: Record<EType, string> = {
  cable: "#f59e0b",
  closure: "#22d3ee",
  splitter: "#a78bfa",
  equipment: "#34d399",
  continuation: "#9ca3af",
};

export const LayerControls = React.memo(function LayerControls({
  visibleTypes,
  onToggleType,
  traceOnly,
  onToggleTraceOnly,
  hasTrace,
}: Props) {
  const darkMode = useCanvasStore((s) => s.darkMode);
  const t = useTranslations("canvas.map");

  const typeLabel: Record<EType, string> = {
    cable: t("layerCables"),
    closure: t("layerClosures"),
    splitter: t("layerSplitters"),
    equipment: t("layerEquipment"),
    continuation: t("layerCrossings"),
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: darkMode ? "rgba(10,15,26,0.88)" : "rgba(255,255,255,0.9)",
        border: darkMode ? "1px solid rgba(148,184,255,0.15)" : "1px solid rgba(15,23,42,0.12)",
        borderRadius: 10,
        padding: "10px 12px",
        backdropFilter: "blur(8px)",
        zIndex: 10,
        minWidth: 130,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: darkMode ? "#475569" : "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>
        {t("layers")}
      </div>

      {ELEMENT_TYPES.map((t) => (
        <label
          key={t}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            cursor: "pointer", userSelect: "none",
            fontSize: 11, fontFamily: "inherit",
            color: darkMode ? "#cbd5e1" : "#334155",
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: 999,
              background: TYPE_COLORS[t],
              flexShrink: 0,
              opacity: visibleTypes.has(t) ? 1 : 0.3,
            }}
          />
          <input
            type="checkbox"
            style={{ display: "none" }}
            checked={visibleTypes.has(t)}
            onChange={() => onToggleType(t)}
          />
          <span style={{ opacity: visibleTypes.has(t) ? 1 : 0.45 }}>
            {typeLabel[t]}
          </span>
        </label>
      ))}

      {hasTrace && (
        <>
          <div style={{ borderTop: "1px solid", borderColor: darkMode ? "rgba(148,184,255,0.10)" : "rgba(15,23,42,0.08)", margin: "2px 0" }} />
          <label
            style={{
              display: "flex", alignItems: "center", gap: 7,
              cursor: "pointer", userSelect: "none",
              fontSize: 11, fontFamily: "inherit",
              color: darkMode ? "#22d3ee" : "#0891b2",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={traceOnly}
              onChange={onToggleTraceOnly}
              style={{ accentColor: "#22d3ee" }}
            />
            {t("traceOnly")}
          </label>
        </>
      )}
    </div>
  );
});
