import { useCanvasStore } from "@/store/canvasStore";
import type { ContextMenuItem } from "@/components/ui/context-menu";

/** Returns a ContextMenuItem that opens the map Localize panel for this node. */
export function useGeoMenuItem(nodeId: string, hasGeo: boolean): ContextMenuItem {
  const setGeoLocalizingId = useCanvasStore((s) => s.setGeoLocalizingId);
  const setView = useCanvasStore((s) => s.setView);
  return {
    label: hasGeo ? "Edit location on map…" : "Set location on map…",
    separatorBefore: true,
    onSelect: () => {
      setGeoLocalizingId(nodeId);
      setView("map");
    },
  };
}
