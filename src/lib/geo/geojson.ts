import type { Node } from "@xyflow/react";
import type { ElementGeo } from "@/types/fiber";

export type GeoJsonScope = "all" | "traced";

export function generateGeoJson(args: {
  nodes: Node[];
  tracedNodeIds: ReadonlySet<string>;
  tracedNodeColors: Readonly<Record<string, string>>;
  scope: GeoJsonScope;
}): string {
  const { nodes, scope, tracedNodeIds, tracedNodeColors } = args;

  const candidates = scope === "traced"
    ? nodes.filter((n) => tracedNodeIds.has(n.id))
    : nodes;

  const features: object[] = [];

  for (const n of candidates) {
    const geo = (n.data as { geo?: ElementGeo }).geo;
    if (!geo) continue;

    const label = (n.data as { label?: string }).label ?? n.id;
    const traceColor = tracedNodeColors[n.id] ?? null;
    const props: Record<string, unknown> = {
      elementId: n.id,
      label,
      nodeType: n.type,
      traceColor,
      traced: traceColor !== null,
    };

    const d = n.data as Record<string, unknown>;
    if (n.type === "cable") {
      props.fiberCount = d.fiberCount;
      props.colorScheme = d.colorScheme;
    } else if (n.type === "splitter") {
      props.ratio = d.ratio;
    }
    if (geo.address) props.address = geo.address;

    if (n.type === "cable" && geo.path && geo.path.length >= 2) {
      features.push({
        type: "Feature",
        properties: props,
        geometry: {
          type: "LineString",
          coordinates: geo.path.map((p) => [p.lng, p.lat]),
        },
      });
    } else if (geo.lat != null && geo.lng != null) {
      features.push({
        type: "Feature",
        properties: props,
        geometry: {
          type: "Point",
          coordinates: [geo.lng, geo.lat],
        },
      });
    }
  }

  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}
