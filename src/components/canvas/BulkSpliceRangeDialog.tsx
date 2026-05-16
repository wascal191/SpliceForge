"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Node } from "@xyflow/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FiberPort, CableNodeData, ClosureNodeData } from "@/types/fiber";
import { pairPorts, type SplicePair } from "@/lib/canvas/bulkSplicePairing";

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

export function BulkSpliceRangeDialog({ open, nodeA, nodeB, onClose, onConfirm }: Props) {
  const t = useTranslations("canvas.bulkSplice");
  const tCommon = useTranslations("common");
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
    const portsA = filterBySide(getNodePorts(nodeA), sideA).sort((a, b) => a.portIndex - b.portIndex);
    const portsB = filterBySide(getNodePorts(nodeB), sideB).sort((a, b) => a.portIndex - b.portIndex);

    return pairPorts({
      portsA,
      portsB,
      fromPort,
      toPort,
      destOffset,
      respectBoundaries: respectBoundaries && canRespect,
      modSizeA: getModSize(nodeA),
      modSizeB: getModSize(nodeB),
      nodeALabel: getNodeLabel(nodeA),
    });
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
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {/* Node labels */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">{t("nodeA")}</p>
              <p className="text-xs font-medium truncate">{getNodeLabel(nodeA)}</p>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">{t("nodeB")}</p>
              <p className="text-xs font-medium truncate">{getNodeLabel(nodeB)}</p>
            </div>
          </div>

          {/* Port range */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{t("portRange")}</label>
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
            <span className="text-xs text-muted-foreground">{t("destinationOffset")}</span>
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
              <p className="text-xs text-muted-foreground mb-1">{t("sideA")}</p>
              <div className="flex gap-2">
                {(["left", "right"] as SideFilter[]).map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="sideA" checked={sideA === s} onChange={() => setSideA(s)} className="accent-primary" />
                    <span className="text-xs">{s === "left" ? t("sideLeft") : t("sideRight")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("sideB")}</p>
              <div className="flex gap-2">
                {(["left", "right"] as SideFilter[]).map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="sideB" checked={sideB === s} onChange={() => setSideB(s)} className="accent-primary" />
                    <span className="text-xs">{s === "left" ? t("sideLeft") : t("sideRight")}</span>
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
            <span className="text-xs">{t("respectBoundaries")}</span>
            {!canRespect && <span className="text-[10px] text-muted-foreground">{t("sameTypeRequired")}</span>}
          </label>

          {/* Preview */}
          <div className={`rounded px-3 py-2 text-xs ${pairs.length > 0 ? "bg-muted" : "bg-destructive/10"}`}>
            <span className={pairs.length > 0 ? "text-foreground" : "text-destructive"}>
              {t("pairsReady", { count: pairs.length })}
            </span>
            {warnings.length > 0 && (
              <span className="text-muted-foreground ml-2">{t("skippedCount", { count: warnings.length })}</span>
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
          <Button variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
          <Button onClick={handleConfirm} disabled={pairs.length === 0 || confirming}>
            {confirming ? t("splicing") : t("spliceAction", { count: pairs.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
