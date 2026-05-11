import { useMemo } from "react";
import { useCanvasStore } from "@/store/canvasStore";
import { projectTraceToGeo } from "@/lib/fiber/geoTrace";
import type { GeoFeature } from "@/types/fiber";

/** Returns the subset of geographic features that are in the active BFS trace,
 *  plus their trace colors, and a list of traced-but-un-geotagged elements.
 *  Re-memoizes only when trace state or nodes change.
 */
export function useGeoTrace(): {
  features: GeoFeature[];
  colors: Map<string, string>;
  missing: { id: string; label: string }[];
  hasTrace: boolean;
} {
  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const tracedNodeColors = useCanvasStore((s) => s.tracedNodeColors);
  const nodes = useCanvasStore((s) => s.nodes);
  const traceEntries = useCanvasStore((s) => s.traceEntries);

  const hasTrace = traceEntries.size > 0;

  const result = useMemo(
    () => projectTraceToGeo(tracedNodeIds, tracedNodeColors, nodes),
    [tracedNodeIds, tracedNodeColors, nodes],
  );

  return { ...result, hasTrace };
}
