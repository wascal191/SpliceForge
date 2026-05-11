import { useMemo } from "react";
import { useCanvasStore } from "@/store/canvasStore";
import { allGeoFeatures } from "@/lib/fiber/geoTrace";
import type { GeoFeature } from "@/types/fiber";

/** Derives all localized geographic features from the current page's node list.
 *  Excludes un-geotagged elements. Re-memoizes only when nodes change.
 */
export function useGeoFeatures(): GeoFeature[] {
  const nodes = useCanvasStore((s) => s.nodes);
  return useMemo(() => allGeoFeatures(nodes), [nodes]);
}
