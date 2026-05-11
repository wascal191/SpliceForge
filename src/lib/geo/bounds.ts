import type { GeoFeature } from "@/types/fiber";

export type LngLatBounds = [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]

export function computeBounds(features: GeoFeature[]): LngLatBounds | null {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  let any = false;

  const visit = (lng: number, lat: number) => {
    any = true;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  };

  for (const f of features) {
    if (f.kind === "point") {
      visit(f.lng, f.lat);
    } else {
      for (const p of f.path) visit(p.lng, p.lat);
    }
  }

  if (!any) return null;

  const padLng = Math.max(0.001, (maxLng - minLng) * 0.1);
  const padLat = Math.max(0.001, (maxLat - minLat) * 0.1);

  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ];
}
