"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { MapRef } from "react-map-gl/maplibre";
import { Marker } from "react-map-gl/maplibre";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElementGeo } from "@/lib/actions/elements";
import type { GeoPath } from "@/types/fiber";
import { toast } from "sonner";

interface Props {
  mapRef: React.RefObject<MapRef | null>;
}

export const LocalizePanel = React.memo(function LocalizePanel({ mapRef: _mapRef }: Props) {
  const t = useTranslations("canvas.map");
  const darkMode = useCanvasStore((s) => s.darkMode);
  const geoLocalizingId = useCanvasStore((s) => s.geoLocalizingId);
  const setGeoLocalizingId = useCanvasStore((s) => s.setGeoLocalizingId);
  const nodes = useCanvasStore((s) => s.nodes);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const bumpGeoVersion = useCanvasStore((s) => s.bumpGeoVersion);

  const [lat, setLat] = React.useState("");
  const [lng, setLng] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [polylineMode, setPolylineMode] = React.useState(false);
  const [waypoints, setWaypoints] = React.useState<{ lat: number; lng: number }[]>([]);
  const [saving, setSaving] = React.useState(false);

  const node = React.useMemo(
    () => nodes.find((n) => n.id === geoLocalizingId),
    [nodes, geoLocalizingId],
  );
  const isCable = node?.type === "cable";

  // Pre-fill from existing geo when the panel opens
  React.useEffect(() => {
    if (!node) return;
    const geo = (node.data as { geo?: { lat?: number | null; lng?: number | null; address?: string | null; path?: { lat: number; lng: number }[] | null } }).geo;
    setLat(geo?.lat != null ? String(geo.lat) : "");
    setLng(geo?.lng != null ? String(geo.lng) : "");
    setAddress(geo?.address ?? "");
    if (isCable && geo?.path?.length) {
      setWaypoints(geo.path);
      setPolylineMode(true);
    } else {
      setWaypoints([]);
      setPolylineMode(false);
    }
  }, [node, isCable]);

  // Map click handler — injected via a data attribute listened by MapView
  React.useEffect(() => {
    if (!geoLocalizingId) return;
    const handler = (e: CustomEvent<{ lat: number; lng: number }>) => {
      const { lat: clickLat, lng: clickLng } = e.detail;
      if (polylineMode) {
        setWaypoints((prev) => [...prev, { lat: clickLat, lng: clickLng }]);
      } else {
        setLat(clickLat.toFixed(6));
        setLng(clickLng.toFixed(6));
      }
    };
    window.addEventListener("sf-map-click" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("sf-map-click" as keyof WindowEventMap, handler as EventListener);
  }, [geoLocalizingId, polylineMode]);

  async function handleSave() {
    if (!geoLocalizingId) return;
    setSaving(true);
    try {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      if (isCable && polylineMode) {
        if (waypoints.length < 2) {
          toast.error(t("toasts.needWaypoints"));
          return;
        }
        await updateElementGeo({
          elementId: geoLocalizingId,
          path: waypoints as GeoPath,
          address: address || null,
        });
        // Optimistic update in the store so the map reflects immediately
        setNodes(
          nodes.map((n) =>
            n.id === geoLocalizingId
              ? { ...n, data: { ...n.data, geo: { path: waypoints, address: address || null, updatedAt: new Date().toISOString() } } }
              : n
          )
        );
      } else {
        if (isNaN(parsedLat) || isNaN(parsedLng)) {
          toast.error(t("toasts.invalidLatLng"));
          return;
        }
        await updateElementGeo({
          elementId: geoLocalizingId,
          lat: parsedLat,
          lng: parsedLng,
          address: address || null,
        });
        setNodes(
          nodes.map((n) =>
            n.id === geoLocalizingId
              ? { ...n, data: { ...n.data, geo: { lat: parsedLat, lng: parsedLng, address: address || null, updatedAt: new Date().toISOString() } } }
              : n
          )
        );
      }

      // Signal FiberCanvas to reload from DB next time the schematic is shown
      bumpGeoVersion();
      toast.success(t("toasts.locationSaved"));
      setGeoLocalizingId(null);
    } catch (err) {
      toast.error(t("toasts.saveFailed"), { description: err instanceof Error ? err.message : t("toasts.saveFailedDesc") });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!geoLocalizingId) return;
    setSaving(true);
    try {
      await updateElementGeo({ elementId: geoLocalizingId, lat: null, lng: null, path: null, address: null });
      setNodes(
        nodes.map((n) =>
          n.id === geoLocalizingId ? { ...n, data: { ...n.data, geo: undefined } } : n
        )
      );
      bumpGeoVersion();
      toast.success(t("toasts.locationCleared"));
      setGeoLocalizingId(null);
    } catch (err) {
      toast.error(t("toasts.clearFailed"), { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  if (!geoLocalizingId || !node) return null;

  const bg = darkMode ? "rgba(7,11,20,0.95)" : "rgba(255,255,255,0.95)";
  const border = darkMode ? "rgba(148,184,255,0.18)" : "rgba(15,23,42,0.12)";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const muted = darkMode ? "#64748b" : "#94a3b8";
  const inputBg = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const label = (node.data as { label?: string }).label ?? node.id;

  return (
    <>
      {/* Point marker preview */}
      {!polylineMode && lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
        <Marker longitude={parseFloat(lng)} latitude={parseFloat(lat)} anchor="center">
          <div style={{
            width: 16, height: 16, borderRadius: 999,
            background: "#22d3ee",
            border: "2px solid #fff",
            boxShadow: "0 0 8px #22d3ee",
          }} />
        </Marker>
      )}

      {/* Waypoint markers for polyline mode */}
      {polylineMode && waypoints.map((wp, i) => (
        <Marker key={i} longitude={wp.lng} latitude={wp.lat} anchor="center">
          <div
            style={{
              width: 12, height: 12, borderRadius: 999,
              background: i === 0 || i === waypoints.length - 1 ? "#f59e0b" : "#22d3ee",
              border: "1.5px solid #fff",
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setWaypoints((prev) => prev.filter((_, j) => j !== i));
            }}
          />
        </Marker>
      ))}

      {/* Panel */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          width: 260,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: "14px 16px",
          backdropFilter: "blur(12px)",
          zIndex: 20,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: text }}>{t("setLocation")}</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 1 }}>{label}</div>
          </div>
          <button
            onClick={() => setGeoLocalizingId(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        </div>

        {isCable && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {["Point", "Route"].map((m) => (
              <button
                key={m}
                onClick={() => setPolylineMode(m === "Route")}
                style={{
                  flex: 1, padding: "4px 0", border: "1px solid",
                  borderColor: darkMode ? "rgba(148,184,255,0.2)" : "rgba(15,23,42,0.12)",
                  borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 600,
                  fontFamily: "inherit",
                  background: (m === "Route") === polylineMode
                    ? (darkMode ? "rgba(0,229,255,0.15)" : "rgba(15,23,42,0.08)")
                    : "transparent",
                  color: (m === "Route") === polylineMode ? (darkMode ? "#00e5ff" : "#0f172a") : muted,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {polylineMode ? (
          <div>
            <div style={{ fontSize: 10, color: muted, marginBottom: 6 }}>
              Click the map to add waypoints. Right-click a waypoint to remove it.
              {waypoints.length > 0 && <span style={{ color: "#22d3ee" }}> ({waypoints.length} pts)</span>}
            </div>
            {waypoints.length > 0 && (
              <button
                onClick={() => setWaypoints([])}
                style={{ fontSize: 10, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: 8 }}
              >
                Clear all waypoints
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["Latitude", lat, setLat], ["Longitude", lng, setLng]].map(([placeholder, val, setter]) => (
              <input
                key={placeholder as string}
                placeholder={placeholder as string}
                value={val as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: 11,
                  border: `1px solid ${border}`,
                  background: inputBg, color: text, fontFamily: "var(--font-geist-mono, monospace)",
                  outline: "none",
                }}
              />
            ))}
          </div>
        )}

        <input
          placeholder={t("addressPlaceholder")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            width: "100%", padding: "5px 8px", borderRadius: 6, fontSize: 11,
            border: `1px solid ${border}`,
            background: inputBg, color: text, fontFamily: "inherit",
            outline: "none", boxSizing: "border-box", marginBottom: 10,
          }}
        />

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
              background: "linear-gradient(180deg, #22eeff 0%, #00c8e0 100%)",
              color: "#041018", fontWeight: 700, fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleClear}
            disabled={saving}
            style={{
              padding: "6px 10px", borderRadius: 6,
              border: `1px solid ${border}`,
              background: "transparent", color: "#f87171",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 9, color: muted }}>
          {polylineMode
            ? t("clickRoute")
            : t("clickPin")}
        </div>
      </div>
    </>
  );
});
