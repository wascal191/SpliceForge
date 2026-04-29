import { useEffect, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";
import { updateElement } from "@/lib/actions/elements";

type SetNodes = (updater: Node[] | ((nds: Node[]) => Node[])) => void;
type SetEdges = (updater: Edge[] | ((eds: Edge[]) => Edge[])) => void;

interface Deps {
  nodesRef: React.MutableRefObject<Node[]>;
  setNodes: SetNodes;
  setEdges: SetEdges;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  clipboard: Node[];
  fitView: (opts?: { duration?: number }) => void;
  getNodes: () => Node[];
  onPaste: () => void;
  onBulkSplice: () => void;
}

export function useCanvasKeyboard({
  nodesRef,
  setNodes,
  setEdges,
  undo,
  redo,
  pushHistory,
  clipboard,
  fitView,
  getNodes,
  onPaste,
  onBulkSplice,
}: Deps) {
  const toggleSearch = useCanvasStore((s) => s.toggleSearch);
  const toggleBwMode = useCanvasStore((s) => s.toggleBwMode);
  const setPaletteOpen = useCanvasStore((s) => s.setPaletteOpen);
  const setClipboard = useCanvasStore((s) => s.setClipboard);
  const setKeymapOpen = useCanvasStore((s) => s.setKeymapOpen);
  const clearTrace = useCanvasStore((s) => s.clearTrace);
  const clearBulkPorts = useCanvasStore((s) => s.clearBulkPorts);
  const setBulkPortSelectMode = useCanvasStore((s) => s.setBulkPortSelectMode);

  // Debounce arrow-key position saves: coalesce rapid keystrokes into one DB write per 300ms
  const posDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

      if (inInput) return;

      if ((e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey) {
        pushHistory();
        return;
      }

      if (e.ctrlKey) {
        switch (e.key) {
          case "f": e.preventDefault(); toggleSearch(); break;
          case "b": e.preventDefault(); toggleBwMode(); break;
          case "p": e.preventDefault(); setPaletteOpen(true); break;
          case "F": e.preventDefault(); fitView({ duration: 400 }); break;
          case "c": {
            e.preventDefault();
            const selected = getNodes().filter((n) => n.selected);
            if (selected.length > 0) setClipboard(selected);
            break;
          }
          case "v": {
            e.preventDefault();
            if (clipboard.length > 0) onPaste();
            break;
          }
          case "a": {
            e.preventDefault();
            setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
            break;
          }
        }
      }

      if (e.altKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        onBulkSplice();
        return;
      }

      if (!e.ctrlKey && !e.altKey && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        const step = e.shiftKey ? 40 : 10;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (nodesRef.current.some((n) => n.selected)) {
          e.preventDefault();
          setNodes((nds) => nds.map((n) => n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
        }
        return;
      }

      if (e.key === "?") { e.preventDefault(); setKeymapOpen(true); return; }

      if (e.key === "Escape") {
        clearTrace();
        clearBulkPorts();
        setBulkPortSelectMode(false);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;
      if (posDebounceRef.current) clearTimeout(posDebounceRef.current);
      posDebounceRef.current = setTimeout(() => {
        const selected = nodesRef.current.filter((n) => n.selected);
        if (selected.length === 0) return;
        Promise.all(selected.map((n) => updateElement(n.id, { position_x: n.position.x, position_y: n.position.y })));
      }, 300);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, clipboard]);
}
