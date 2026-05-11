"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { MapRef, MapMouseEvent } from "react-map-gl/maplibre";
import { useCanvasStore } from "@/store/canvasStore";
import { useGeoFeatures } from "@/hooks/useGeoFeatures";
import { useGeoTrace } from "@/hooks/useGeoTrace";
import { GeoElementsLayer } from "./GeoElementsLayer";
import { GeoCablesLayer } from "./GeoCablesLayer";
import { GeoTracePopup } from "./GeoTracePopup";
import type { HoveredFeature } from "./GeoTracePopup";
import { LocalizePanel } from "./LocalizePanel";
import { LayerControls } from "./LayerControls";
import { BasemapSwitcher, BASEMAPS } from "./BasemapSwitcher";
import type { BasemapKey } from "./BasemapSwitcher";
import { computeBounds } from "@/lib/geo/bounds";
import { traceFromPort } from "@/lib/fiber/trace";

// MapLibre touches `window` on import — must be dynamic/client-only.
const Map = dynamic(
  () => import("react-map-gl/maplibre").then((m) => m.default),
  { ssr: false }
);

const ALL_TYPES = new Set(["cable", "closure", "splitter", "equipment", "continuation"]);

function EmptyGeoState({ darkMode }: { darkMode: boolean }) {
  const setGeoLocalizingId = useCanvasStore((s) => s.setGeoLocalizingId);
  const nodes = useCanvasStore((s) => s.nodes);

  const firstUngeotagged = nodes.find((n) => {
    const geo = (n.data as { geo?: unknown }).geo as { lat?: number | null } | undefined;
    return !geo?.lat;
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", gap: 16,
      background: darkMode ? "#05070c" : "#f8fafc",
      color: darkMode ? "#64748b" : "#94a3b8",
      fontFamily: "inherit",
    }}>
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#f1f5f9" : "#0f172a", marginBottom: 4 }}>
          No locations yet
        </div>
        <div style={{ fontSize: 12, maxWidth: 260 }}>
          Right-click any element on the schematic and choose "Set location on map", or click below to start.
        </div>
      </div>
      {firstUngeotagged && (
        <button
          onClick={() => setGeoLocalizingId(firstUngeotagged.id)}
          style={{
            padding: "8px 18px", borderRadius: 8, border: "none",
            background: "linear-gradient(180deg, #22eeff 0%, #00c8e0 100%)",
            color: "#041018", fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}
        >
          Localize first element
        </button>
      )}
    </div>
  );
}

export const MapView = React.memo(function MapView() {
  const mapRef = React.useRef<MapRef | null>(null);
  const darkMode = useCanvasStore((s) => s.darkMode);
  const geoLocalizingId = useCanvasStore((s) => s.geoLocalizingId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const toggleTraceEntry = useCanvasStore((s) => s.toggleTraceEntry);
  const setTracedIds = useCanvasStore((s) => s.setTracedIds);
  const setTracedNodeColors = useCanvasStore((s) => s.setTracedNodeColors);
  const clearTrace = useCanvasStore((s) => s.clearTrace);

  const allFeatures = useGeoFeatures();
  const { features: traceFeatures, colors: traceColors, hasTrace } = useGeoTrace();

  const [basemap, setBasemap] = React.useState<BasemapKey>(darkMode ? "dark" : "light");
  React.useEffect(() => { setBasemap(darkMode ? "dark" : "light"); }, [darkMode]);

  const [visibleTypes, setVisibleTypes] = React.useState(new Set(ALL_TYPES));
  const [traceOnly, setTraceOnly] = React.useState(false);
  const [hovered, setHovered] = React.useState<HoveredFeature | null>(null);

  // Fit to all features on first load
  const fitted = React.useRef(false);
  React.useEffect(() => {
    if (fitted.current || !mapRef.current || allFeatures.length === 0) return;
    const bounds = computeBounds(allFeatures);
    if (!bounds) return;
    fitted.current = true;
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 600 });
  }, [allFeatures]);

  const displayFeatures = hasTrace && traceOnly ? traceFeatures : allFeatures;
  const mapStyle = BASEMAPS[basemap].url;

  function toggleVisibleType(t: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  // Dispatch click location as a custom event so LocalizePanel can listen
  function handleMapClick(e: MapMouseEvent) {
    if (geoLocalizingId) {
      window.dispatchEvent(new CustomEvent("sf-map-click", {
        detail: { lat: e.lngLat.lat, lng: e.lngLat.lng },
      }));
      return;
    }

    // Click on a feature → trace it
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const existingLayers = ["sf-elements-dot", "sf-cables-line"].filter((l) => !!map.getLayer(l));
    if (existingLayers.length === 0) return;
    const pointFeatures = map.queryRenderedFeatures(e.point, {
      layers: existingLayers,
    });
    if (pointFeatures.length === 0) {
      clearTrace();
      return;
    }

    const clicked = pointFeatures[0];
    const elementId = clicked.properties?.elementId as string | undefined;
    if (!elementId) return;

    // Find the element's first port and run BFS trace
    const node = nodes.find((n) => n.id === elementId);
    if (!node) return;
    const ports = (node.data as { ports?: { id: string }[] }).ports ?? [];
    if (!ports.length) return;

    const result = traceFromPort(ports[0].id, nodes, edges);
    if (result.nodeIds.size === 0 && result.edgeIds.size === 0) return;

    // Pick a color for this trace (cycle through a palette)
    const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#60a5fa"];
    const color = COLORS[result.nodeIds.size % COLORS.length];

    clearTrace();

    // Populate node trace state directly (FiberCanvas is unmounted on map view)
    setTracedIds(result.nodeIds, result.edgeIds);
    const nodeColors: Record<string, string> = {};
    result.nodeIds.forEach((id) => { nodeColors[id] = color; });
    setTracedNodeColors(nodeColors);

    for (const edgeId of result.edgeIds) toggleTraceEntry(edgeId, color);
  }

  function handleMouseMove(e: MapMouseEvent) {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    // Only query layers that actually exist in the current style to avoid console errors
    const existingLayers = ["sf-elements-dot", "sf-cables-line"].filter(
      (l) => !!map.getLayer(l)
    );
    if (existingLayers.length === 0) return;
    const pointFeatures = map.queryRenderedFeatures(e.point, {
      layers: existingLayers,
    });

    if (pointFeatures.length === 0) {
      setHovered(null);
      map.getCanvas().style.cursor = geoLocalizingId ? "crosshair" : "";
      return;
    }

    const f = pointFeatures[0];
    const props = f.properties ?? {};
    map.getCanvas().style.cursor = geoLocalizingId ? "crosshair" : "pointer";

    const geom = f.geometry as { type: string; coordinates: unknown };
    const rawCoords = geom.coordinates;
    const coords = geom.type === "Point"
      ? (rawCoords as [number, number])
      : (rawCoords as [number, number][][])[0][Math.floor(((rawCoords as unknown[]).length) / 2)] ??
        (rawCoords as [number, number][])[0];

    setHovered({
      elementId: props.elementId,
      label: props.label ?? "",
      nodeType: props.nodeType ?? "",
      traceColor: props.traceColor || null,
      traced: props.traced === true || props.traced === "true",
      lng: coords[0],
      lat: coords[1],
    });
  }

  if (allFeatures.length === 0 && !geoLocalizingId) {
    return <EmptyGeoState darkMode={darkMode} />;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ longitude: -74, latitude: 40.7, zoom: 3 }}
        attributionControl={{ compact: true }}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        reuseMaps
        style={{ width: "100%", height: "100%" }}
      >
        <GeoCablesLayer
          features={displayFeatures}
          traceColors={traceColors}
          visibleTypes={visibleTypes}
          traceOnly={traceOnly}
        />
        <GeoElementsLayer
          features={displayFeatures}
          traceColors={traceColors}
          visibleTypes={visibleTypes}
          traceOnly={traceOnly}
        />
        <GeoTracePopup feature={hovered} />
        <LocalizePanel mapRef={mapRef} />
      </Map>

      <BasemapSwitcher value={basemap} onChange={setBasemap} />
      <LayerControls
        visibleTypes={visibleTypes as Set<"cable" | "closure" | "splitter" | "equipment" | "continuation">}
        onToggleType={(t) => toggleVisibleType(t)}
        traceOnly={traceOnly}
        onToggleTraceOnly={() => setTraceOnly((v) => !v)}
        hasTrace={hasTrace}
      />

      {geoLocalizingId && (
        <div style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,229,255,0.15)",
          border: "1px solid rgba(0,229,255,0.4)",
          borderRadius: 20,
          padding: "6px 16px",
          fontSize: 11,
          color: "#00e5ff",
          fontWeight: 600,
          pointerEvents: "none",
          zIndex: 30,
          backdropFilter: "blur(8px)",
        }}>
          Click the map to place a pin
        </div>
      )}
    </div>
  );
});
