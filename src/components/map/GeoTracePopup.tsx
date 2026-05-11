"use client";

import * as React from "react";
import { Popup } from "react-map-gl/maplibre";
import { useCanvasStore } from "@/store/canvasStore";

export type HoveredFeature = {
  elementId: string;
  label: string;
  nodeType: string;
  traceColor: string | null;
  traced: boolean;
  lng: number;
  lat: number;
};

interface Props {
  feature: HoveredFeature | null;
}

export const GeoTracePopup = React.memo(function GeoTracePopup({ feature }: Props) {
  const darkMode = useCanvasStore((s) => s.darkMode);
  if (!feature) return null;

  const bg = darkMode ? "#0a0f1a" : "#ffffff";
  const border = darkMode ? "rgba(148,184,255,0.18)" : "rgba(15,23,42,0.12)";
  const textColor = darkMode ? "#f1f5f9" : "#0f172a";
  const mutedColor = darkMode ? "#64748b" : "#94a3b8";

  return (
    <Popup
      longitude={feature.lng}
      latitude={feature.lat}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={14}
      style={{ padding: 0 }}
    >
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: "8px 12px",
          minWidth: 140,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          fontFamily: "inherit",
        }}
      >
        {feature.traceColor && (
          <div
            style={{
              width: 32, height: 3, borderRadius: 2,
              background: feature.traceColor,
              marginBottom: 6,
            }}
          />
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: textColor, marginBottom: 2 }}>
          {feature.label}
        </div>
        <div style={{ fontSize: 10, color: mutedColor, textTransform: "capitalize" }}>
          {feature.nodeType}
          {feature.traced && (
            <span style={{ color: feature.traceColor ?? "#22d3ee", marginLeft: 6, fontWeight: 600 }}>
              ● traced
            </span>
          )}
        </div>
      </div>
    </Popup>
  );
});
