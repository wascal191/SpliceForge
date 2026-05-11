import type { Node } from "@xyflow/react";
import type { GeoFeature, ElementGeo, ElementType } from "@/types/fiber";

/** Project BFS trace results onto geographic features.
 *  Pure function — memoize at the hook layer.
 */
export function projectTraceToGeo(
  tracedNodeIds: ReadonlySet<string>,
  tracedNodeColors: Readonly<Record<string, string>>,
  nodes: Node[],
): {
  features: GeoFeature[];
  colors: Map<string, string>;
  missing: { id: string; label: string }[];
} {
  const features: GeoFeature[] = [];
  const colors = new Map<string, string>();
  const missing: { id: string; label: string }[] = [];

  for (const n of nodes) {
    if (!tracedNodeIds.has(n.id)) continue;

    const geo = (n.data as { geo?: ElementGeo }).geo;
    const label = (n.data as { label?: string }).label ?? n.id;
    const color = tracedNodeColors[n.id];
    if (color) colors.set(n.id, color);

    if (n.type === "cable" && geo?.path && geo.path.length >= 2) {
      features.push({ kind: "line", elementId: n.id, nodeType: "cable", path: geo.path, label });
    } else if (geo?.lat != null && geo?.lng != null) {
      features.push({
        kind: "point",
        elementId: n.id,
        nodeType: n.type as ElementType | "continuation",
        lat: geo.lat,
        lng: geo.lng,
        label,
      });
    } else {
      missing.push({ id: n.id, label });
    }
  }

  return { features, colors, missing };
}

/** Derive ALL localized features from the node list (no trace filter). */
export function allGeoFeatures(nodes: Node[]): GeoFeature[] {
  const features: GeoFeature[] = [];
  for (const n of nodes) {
    const geo = (n.data as { geo?: ElementGeo }).geo;
    const label = (n.data as { label?: string }).label ?? n.id;

    if (n.type === "cable" && geo?.path && geo.path.length >= 2) {
      features.push({ kind: "line", elementId: n.id, nodeType: "cable", path: geo.path, label });
    } else if (geo?.lat != null && geo?.lng != null) {
      features.push({
        kind: "point",
        elementId: n.id,
        nodeType: n.type as ElementType | "continuation",
        lat: geo.lat,
        lng: geo.lng,
        label,
      });
    }
  }
  return features;
}
