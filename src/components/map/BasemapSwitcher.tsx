"use client";

import * as React from "react";
import { useCanvasStore } from "@/store/canvasStore";

export const BASEMAPS = {
  // Stadia Maps: free on localhost without a key; add NEXT_PUBLIC_STADIA_API_KEY for production.
  dark:  { label: "Dark",  url: "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json" },
  light: { label: "Light", url: "https://tiles.stadiamaps.com/styles/alidade_smooth.json" },
  osm:   { label: "OSM",   url: "https://tiles.openfreemap.org/styles/liberty" },
} as const;

export type BasemapKey = keyof typeof BASEMAPS;

interface Props {
  value: BasemapKey;
  onChange: (k: BasemapKey) => void;
}

export const BasemapSwitcher = React.memo(function BasemapSwitcher({ value, onChange }: Props) {
  const darkMode = useCanvasStore((s) => s.darkMode);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: 12,
        display: "flex",
        gap: 4,
        background: darkMode ? "rgba(10,15,26,0.88)" : "rgba(255,255,255,0.9)",
        border: darkMode ? "1px solid rgba(148,184,255,0.15)" : "1px solid rgba(15,23,42,0.12)",
        borderRadius: 8,
        padding: "3px 4px",
        backdropFilter: "blur(8px)",
        zIndex: 10,
      }}
    >
      {(Object.entries(BASEMAPS) as [BasemapKey, { label: string }][]).map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: "3px 9px",
            borderRadius: 5,
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "inherit",
            background: value === key
              ? (darkMode ? "rgba(0,229,255,0.18)" : "rgba(15,23,42,0.10)")
              : "transparent",
            color: value === key
              ? (darkMode ? "#00e5ff" : "#0f172a")
              : (darkMode ? "#64748b" : "#94a3b8"),
            transition: "all 120ms",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
});
