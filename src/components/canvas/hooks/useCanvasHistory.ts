import { useRef, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";

const MAX_HISTORY = 50;

type Snapshot = { nodes: Node[]; edges: Edge[] };
type SetNodes = (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
type SetEdges = (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;

// Called after a snapshot is restored so DB can be synced to match.
// Receives (targetSnapshot, stateBeforeRestore) so the caller can diff them.
export type HistoryDbSync = (
  target: Snapshot,
  before: Snapshot,
) => Promise<void>;

export function useCanvasHistory(
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>,
  setNodes: SetNodes,
  setEdges: SetEdges,
  dbSync?: HistoryDbSync,
) {
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const setUndoRedo = useCanvasStore((s) => s.setUndoRedo);

  function pushHistory() {
    const snap: Snapshot = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      edges: edgesRef.current.map((e) => ({ ...e })),
    };
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snap);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setUndoRedo(historyIndexRef.current > 0, false);
  }

  function seedHistory(nodes: Node[], edges: Edge[]) {
    historyRef.current = [{ nodes, edges }];
    historyIndexRef.current = 0;
    setUndoRedo(false, false);
  }

  function resetHistory() {
    historyRef.current = [];
    historyIndexRef.current = -1;
    setUndoRedo(false, false);
  }

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const before: Snapshot = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      edges: edgesRef.current.map((e) => ({ ...e })),
    };
    historyIndexRef.current--;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setUndoRedo(
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );
    dbSync?.(snap, before);
  }, [setNodes, setEdges, setUndoRedo, dbSync]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const before: Snapshot = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      edges: edgesRef.current.map((e) => ({ ...e })),
    };
    historyIndexRef.current++;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setUndoRedo(
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );
    dbSync?.(snap, before);
  }, [setNodes, setEdges, setUndoRedo, dbSync]);

  return { pushHistory, seedHistory, resetHistory, undo, redo };
}
