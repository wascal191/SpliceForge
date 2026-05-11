"use client";

import * as React from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoFeature } from "@/types/fiber";

interface Props {
  features: GeoFeature[];
  traceColors: Map<string, string>;
  visibleTypes?: Set<string>;
  traceOnly?: boolean;
}

export const GeoCablesLayer = React.memo(function GeoCablesLayer({
  features,
  traceColors,
  visibleTypes,
  traceOnly = false,
}: Props) {
  const data = React.useMemo(() => {
    const lines = features.filter((f): f is Extract<GeoFeature, { kind: "line" }> => {
      if (f.kind !== "line") return false;
      if (visibleTypes && !visibleTypes.has("cable")) return false;
      if (traceOnly && !traceColors.has(f.elementId)) return false;
      return true;
    });

    return {
      type: "FeatureCollection" as const,
      features: lines.map((f) => ({
        type: "Feature" as const,
        id: f.elementId,
        geometry: {
          type: "LineString" as const,
          coordinates: f.path.map((p) => [p.lng, p.lat]),
        },
        properties: {
          elementId: f.elementId,
          label: f.label,
          traceColor: traceColors.get(f.elementId) ?? "",
          traced: traceColors.has(f.elementId),
        },
      })),
    };
  }, [features, traceColors, visibleTypes, traceOnly]);

  return (
    <Source id="sf-cables" type="geojson" data={data}>
      {/* Dark casing for contrast */}
      <Layer
        id="sf-cables-casing"
        type="line"
        paint={{
          "line-color": "#0b1220",
          "line-width": ["case", ["==", ["get", "traced"], true], 8, 5],
        }}
        layout={{ "line-cap": "round", "line-join": "round" }}
      />
      {/* Main line — trace color or amber default */}
      <Layer
        id="sf-cables-line"
        type="line"
        paint={{
          "line-color": [
            "case",
            ["==", ["get", "traced"], true],
            ["get", "traceColor"],
            "#f59e0b",
          ],
          "line-width": ["case", ["==", ["get", "traced"], true], 5, 3],
          "line-opacity": ["case", ["==", ["get", "traced"], true], 1, 0.75],
        }}
        layout={{ "line-cap": "round", "line-join": "round" }}
      />
      {/* Label along the line */}
      <Layer
        id="sf-cables-label"
        type="symbol"
        layout={{
          "symbol-placement": "line-center",
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, -1],
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
