"use client";

import * as React from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoFeature } from "@/types/fiber";

export const TYPE_COLOR: Record<string, string> = {
  closure: "#22d3ee",
  splitter: "#a78bfa",
  equipment: "#34d399",
  cable: "#f59e0b",
  continuation: "#9ca3af",
};

// MapLibre paint expression: match nodeType → type color, or fall back to traceColor
const NODE_TYPE_COLOR_EXPR = [
  "match",
  ["get", "nodeType"],
  "closure",     "#22d3ee",
  "splitter",    "#a78bfa",
  "equipment",   "#34d399",
  "cable",       "#f59e0b",
  "continuation","#9ca3af",
  "#94a3b8",
] as unknown as string;

interface Props {
  features: GeoFeature[];
  traceColors: Map<string, string>;
  visibleTypes?: Set<string>;
  traceOnly?: boolean;
}

export const GeoElementsLayer = React.memo(function GeoElementsLayer({
  features,
  traceColors,
  visibleTypes,
  traceOnly = false,
}: Props) {
  const data = React.useMemo(() => {
    const points = features.filter((f): f is Extract<GeoFeature, { kind: "point" }> => {
      if (f.kind !== "point") return false;
      if (visibleTypes && !visibleTypes.has(f.nodeType)) return false;
      if (traceOnly && !traceColors.has(f.elementId)) return false;
      return true;
    });

    return {
      type: "FeatureCollection" as const,
      features: points.map((f) => ({
        type: "Feature" as const,
        id: f.elementId,
        geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
        properties: {
          elementId: f.elementId,
          nodeType: f.nodeType,
          label: f.label,
          traceColor: traceColors.get(f.elementId) ?? null,
          traced: traceColors.has(f.elementId),
        },
      })),
    };
  }, [features, traceColors, visibleTypes, traceOnly]);

  return (
    <Source id="sf-elements" type="geojson" data={data}>
      {/* Glow ring for traced elements */}
      <Layer
        id="sf-elements-glow"
        type="circle"
        filter={["boolean", ["get", "traced"], false]}
        paint={{
          "circle-radius": 18,
          "circle-color": ["coalesce", ["get", "traceColor"], "#94a3b8"],
          "circle-opacity": 0.3,
          "circle-blur": 0.7,
        }}
      />
      {/* Main dot */}
      <Layer
        id="sf-elements-dot"
        type="circle"
        paint={{
          "circle-radius": 7,
          "circle-color": [
            "case",
            ["boolean", ["get", "traced"], false],
            ["coalesce", ["get", "traceColor"], "#94a3b8"],
            NODE_TYPE_COLOR_EXPR,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0b1220",
          "circle-opacity": ["case", ["boolean", ["get", "traced"], false], 1, 0.9],
        }}
      />
      {/* Label */}
      <Layer
        id="sf-elements-label"
        type="symbol"
        layout={{
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-max-width": 12,
        }}
        paint={{
          "text-color": "#e2e8f0",
          "text-halo-color": "#0b1220",
          "text-halo-width": 1.5,
        }}
      />
    </Source>
  );
});
