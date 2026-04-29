"use client";

import { useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FiberPort, CableNodeData, ClosureNodeData } from "@/types/fiber";

type SplicePair = { portFrom: string; portTo: string };

type Props = {
  open: boolean;
  nodeA: Node | null;
  nodeB: Node | null;
  onClose: () => void;
  onConfirm: (pairs: SplicePair[]) => Promise<void>;
};

type SideFilter = "left" | "right";

function getNodeLabel(node: Node | null): string {
  return (node?.data as { label?: string })?.label ?? "—";
}

function getNodePorts(node: Node | null): FiberPort[] {
  return (node?.data as { ports?: FiberPort[] })?.ports ?? [];
}

function filterBySide(ports: FiberPort[], side: SideFilter): FiberPort[] {
  return ports.filter((p) => p.side === side);
}

function getModSize(node: Node | null): number {
  if (!node) return 0;
  if (node.type === "cable") {
    const d = node.data as CableNodeData;
    return d.moduleFiberCount ?? d.fiberCount ?? 0;
  }
  if (node.type === "closure") {
    const d = node.data as ClosureNodeData;
    return (d.inputCount ?? 6) + (d.outputCount ?? 6);
  }
  return 0;
}

function sameGroup(pa: FiberPort, pb: FiberPort, nodeA: Node, nodeB: Node): boolean {
  const modA = getModSize(nodeA);
  const modB = getModSize(nodeB);
  if (!modA || !modB) return true;
  return Math.floor(pa.portIndex / modA) === Math.floor(pb.portIndex / modB);
}

export function BulkSpliceRangeDialog({ open, nodeA, nodeB, onClose, onConfirm }: Props) {
  const [fromPort, setFromPort] = useState(1);
  const [toPort, setToPort] = useState(12);
  const [destOffset, setDestOffset] = useState(0);
  const [sideA, setSideA] = useState<SideFilter>("right");
  const [sideB, setSideB] = useState<SideFilter>("left");
  const [respectBoundaries, setRespectBoundaries] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const canRespect = nodeA !== null && nodeB !== null && nodeA.type === nodeB.type;

  const { pairs, warnings } = useMemo<{ pairs: SplicePair[]; warnings: string[] }>(() => {
    if (!nodeA || !nodeB) return { pairs: [], warnings: [] };

    // Sort by portIndex to get stable positions within each side group
    const allA = filterBySide(getNodePorts(nodeA), sideA).sort((a, b) => a.portIndex - b.portIndex);
    const allB = filterBySide(getNodePorts(nodeB), sideB).sort((a, b) => a.portIndex - b.portIndex);

    // Range is 1-indexed position within the side group, not raw portIndex
    const portsA = allA.filter((_, i) => i + 1 >= fromPort && i + 1 <= toPort && allA[i].status === "unoccupied");

    const warns: string[] = [];
    const result: SplicePair[] = [];

    for (const pa of portsA) {
      const posA = allA.findIndex((p) => p.id === pa.id); // 0-indexed position in side group
      const targetPos = posA + destOffset;                 // position in B side group

      let pb: FiberPort | undefined;
      if (respectBoundaries && canRespect) {
        const candidate = allB[targetPos];
        pb = candidate && candidate.status === "unoccupied" && sameGroup(pa, candidate, nodeA, nodeB) ? candidate : undefined;
      } else {
        const candidate = allB[targetPos];
        pb = candidate?.status === "unoccupied" ? candidate : undefined;
      }

      if (!pb) {
        warns.push(`Port ${posA + 1} on ${getNodeLabel(nodeA)}: no free match at position ${targetPos + 1}`);
      } else {
        result.push({ portFrom: pa.id, portTo: pb.id });
      }
    }
    return { pairs: result, warnings: warns };
  }, [nodeA, nodeB, fromPort, toPort, destOffset, sideA, sideB, respectBoundaries, canRespect]);

  async function handleConfirm() {
    if (pairs.length === 0 || confirming) return;
    setConfirming(true);
    try {
      await onConfirm(pairs);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Range Splice</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {/* Node labels */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Node A</p>
              <p className="text-xs font-medium truncate">{getNodeLabel(nodeA)}</p>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Node B</p>
              <p className="text-xs font-medium truncate">{getNodeLabel(nodeB)}</p>
            </div>
          </div>

          {/* Port range */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Port range on A (1-indexed)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary w-20"
                value={fromPort}
                onChange={(e) => setFromPort(Math.max(1, Number(e.target.value)))}
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="number" min={fromPort}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary w-20"
                value={toPort}
                onChange={(e) => setToPort(Math.max(fromPort, Number(e.target.value)))}
              />
            </div>
          </div>

          {/* Destination offset */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Destination offset (port N on A → port N+offset on B)</span>
            <input
              type="number"
              className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary w-24"
              value={destOffset}
              onChange={(e) => setDestOffset(Number(e.target.value))}
            />
          </label>

          {/* Side filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Side A</p>
              <div className="flex gap-2">
                {(["left", "right"] as SideFilter[]).map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="sideA" checked={sideA === s} onChange={() => setSideA(s)} className="accent-primary" />
                    <span className="text-xs capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Side B</p>
              <div className="flex gap-2">
                {(["left", "right"] as SideFilter[]).map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="sideB" checked={sideB === s} onChange={() => setSideB(s)} className="accent-primary" />
                    <span className="text-xs capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Respect boundaries */}
          <label className={`flex items-center gap-2 ${!canRespect ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={respectBoundaries}
              disabled={!canRespect}
              onChange={(e) => setRespectBoundaries(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs">Respect module / tray boundaries</span>
            {!canRespect && <span className="text-[10px] text-muted-foreground">(same node type required)</span>}
          </label>

          {/* Preview */}
          <div className={`rounded px-3 py-2 text-xs ${pairs.length > 0 ? "bg-muted" : "bg-destructive/10"}`}>
            <span className={pairs.length > 0 ? "text-foreground" : "text-destructive"}>
              {pairs.length} pair{pairs.length !== 1 ? "s" : ""} ready
            </span>
            {warnings.length > 0 && (
              <span className="text-muted-foreground ml-2">· {warnings.length} skipped</span>
            )}
            {warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                {warnings.map((w, i) => (
                  <li key={i} className="text-muted-foreground">⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={pairs.length === 0 || confirming}>
            {confirming ? "Splicing…" : `Splice ${pairs.length} pair${pairs.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
