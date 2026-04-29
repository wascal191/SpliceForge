"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Node, Edge } from "@xyflow/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvasStore";
import { createElement } from "@/lib/actions/elements";
import { createPorts } from "@/lib/actions/ports";
import { createSplicesBatch } from "@/lib/actions/splices";
import { updatePortStatusBatch } from "@/lib/actions/ports";
import type { FiberPort } from "@/types/fiber";

type RawPort = { id: string; element_id: string; port_index: number; colors: string[]; status: string; label: string | null };

type ElementRecord = {
  Label: string;
  Type: string;
  "Fiber Count"?: number | string;
  "Color Scheme"?: string;
  "Module Size"?: number | string;
  Inputs?: number | string;
  Outputs?: number | string;
  Ratio?: string;
};

type ConnectionRecord = {
  "From Element": string;
  "From Type": string;
  "From Port #": number;
  "Fiber Color"?: string;
  "To Element": string;
  "To Type": string;
  "To Port #": number;
  Comment?: string;
};

type ImportedElement = {
  nodeId: string;
  type: string;
  label: string;
  ports: RawPort[];
  node: Node;
};

function buildFiberPorts(rawPorts: RawPort[], inputCount: number, portsPerTray?: number): FiberPort[] {
  return rawPorts.map((p) => ({
    id: p.id,
    elementId: p.element_id,
    portIndex: p.port_index,
    colors: p.colors,
    status: p.status as "occupied" | "unoccupied",
    label: p.label ?? undefined,
    side: (portsPerTray
      ? (p.port_index % portsPerTray) < inputCount
      : p.port_index < inputCount) ? "left" : "right",
  }));
}

type Props = {
  pageId: string;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
};

export function ImportDialog({ pageId, setNodes, setEdges }: Props) {
  const importOpen = useCanvasStore((s) => s.importOpen);
  const setImportOpen = useCanvasStore((s) => s.setImportOpen);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setStatus(null);
    setErrors([]);
    setBusy(false);
    setDone(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose(open: boolean) {
    if (!open) { reset(); setImportOpen(false); }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setErrors([]);
    setStatus("Reading file…");
    const errs: string[] = [];

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const elemSheet = wb.Sheets["Elements"];
      const connSheet = wb.Sheets["Connections"];

      if (!elemSheet) { errs.push('Sheet "Elements" not found. Export a canvas first to get the correct format.'); setErrors(errs); setBusy(false); return; }
      if (!connSheet) { errs.push('Sheet "Connections" not found.'); setErrors(errs); setBusy(false); return; }

      const elemRows = XLSX.utils.sheet_to_json<ElementRecord>(elemSheet, { defval: "" });
      const connRows = XLSX.utils.sheet_to_json<ConnectionRecord>(connSheet, { defval: "" });

      if (elemRows.length === 0) { errs.push("Elements sheet is empty."); setErrors(errs); setBusy(false); return; }

      // ── Phase 1: create elements ───────────────────────────────────────────
      setStatus(`Creating ${elemRows.length} elements…`);

      const elementMap = new Map<string, ImportedElement>();
      // Track duplicates: if same label appears twice, append index
      const labelCount = new Map<string, number>();
      for (const row of elemRows) {
        const raw = String(row.Label ?? "").trim();
        labelCount.set(raw, (labelCount.get(raw) ?? 0) + 1);
      }
      const labelSeen = new Map<string, number>();

      let xOffset = 100;
      const Y_CABLE = 100, Y_CLOSURE = 400, Y_SPLITTER = 700, Y_EQUIP = 1000;
      const yCounters: Record<string, number> = { cable: 0, closure: 0, splitter: 0, equipment: 0 };

      for (const row of elemRows) {
        const rawLabel = String(row.Label ?? "").trim();
        const type = String(row.Type ?? "").trim().toLowerCase();

        if (!rawLabel) { errs.push(`Row skipped: missing Label.`); continue; }
        if (!["cable", "closure", "splitter", "equipment"].includes(type)) {
          errs.push(`"${rawLabel}": unknown type "${type}" — skipped.`); continue;
        }

        // Disambiguate duplicate labels
        const count = labelCount.get(rawLabel) ?? 1;
        const seen = labelSeen.get(rawLabel) ?? 0;
        labelSeen.set(rawLabel, seen + 1);
        const label = count > 1 ? `${rawLabel} (${seen + 1})` : rawLabel;
        const mapKey = count > 1 ? `${rawLabel}#${seen}` : rawLabel;

        // Position nodes in a loose grid by type
        const col = yCounters[type] ?? 0;
        yCounters[type] = col + 1;
        const yBase: Record<string, number> = { cable: Y_CABLE, closure: Y_CLOSURE, splitter: Y_SPLITTER, equipment: Y_EQUIP };
        const x = xOffset + col * 220;
        const y = yBase[type] ?? 100;
        xOffset = 0; // only offset first column

        try {
          if (type === "cable") {
            const fiberCount = Number(row["Fiber Count"]) || 12;
            const colorScheme = String(row["Color Scheme"] || "EIA598");
            const moduleFiberCount = Number(row["Module Size"]) || undefined;
            const cfg: Record<string, unknown> = { fiberCount, colorScheme };
            if (moduleFiberCount) cfg.moduleFiberCount = moduleFiberCount;
            const el = await createElement(pageId, "cable", label, x, y, cfg);
            const raw = await createPorts(el.id, fiberCount * 2);
            const node: Node = {
              id: el.id, type: "cable", position: { x, y },
              data: { label, fiberCount, colorScheme, moduleFiberCount, collapsedModules: [], collapsed: false, ports: buildFiberPorts(raw, fiberCount) },
            };
            elementMap.set(mapKey, { nodeId: el.id, type, label, ports: raw, node });

          } else if (type === "splitter") {
            const inputCount = Number(row.Inputs) || 1;
            const outputCount = Number(row.Outputs) || 8;
            const ratio = String(row.Ratio || `${inputCount}:${outputCount}`);
            const el = await createElement(pageId, "splitter", label, x, y, { ratio, inputCount, outputCount });
            const raw = await createPorts(el.id, inputCount + 1);
            const node: Node = {
              id: el.id, type: "splitter", position: { x, y },
              data: { label, ratio, inputCount, outputCount, collapsed: false, ports: buildFiberPorts(raw, inputCount) },
            };
            elementMap.set(mapKey, { nodeId: el.id, type, label, ports: raw, node });

          } else {
            const inputCount = Number(row.Inputs) || 6;
            const outputCount = Number(row.Outputs) || 6;
            const portsPerTray = inputCount + outputCount;
            const el = await createElement(pageId, type as "closure" | "equipment", label, x, y, { inputCount, outputCount });
            const raw = await createPorts(el.id, inputCount + outputCount);
            const node: Node = {
              id: el.id, type: type as Node["type"], position: { x, y },
              data: { label, inputCount, outputCount, collapsed: false, ports: buildFiberPorts(raw, inputCount, type === "closure" ? portsPerTray : undefined) },
            };
            elementMap.set(mapKey, { nodeId: el.id, type, label, ports: raw, node });
          }
        } catch (err) {
          errs.push(`"${label}": failed to create — ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // ── Phase 2: create splices ────────────────────────────────────────────
      setStatus(`Creating ${connRows.length} connections…`);

      type SplicePair = { portFrom: string; portTo: string; comment: string; srcNode: string; tgtNode: string; srcHandle: string; tgtHandle: string };
      const pairs: SplicePair[] = [];

      for (let i = 0; i < connRows.length; i++) {
        const row = connRows[i];
        const fromLabel = String(row["From Element"] ?? "").trim();
        const toLabel = String(row["To Element"] ?? "").trim();
        const fromPortNum = Number(row["From Port #"]);
        const toPortNum = Number(row["To Port #"]);

        const fromEl = elementMap.get(fromLabel);
        const toEl = elementMap.get(toLabel);

        if (!fromEl) { errs.push(`Row ${i + 2}: "From Element" "${fromLabel}" not found — skipped.`); continue; }
        if (!toEl) { errs.push(`Row ${i + 2}: "To Element" "${toLabel}" not found — skipped.`); continue; }

        const fromPort = fromEl.ports.find((p) => p.port_index === fromPortNum - 1);
        const toPort = toEl.ports.find((p) => p.port_index === toPortNum - 1);

        if (!fromPort) { errs.push(`Row ${i + 2}: "${fromLabel}" has no port #${fromPortNum} — skipped.`); continue; }
        if (!toPort) { errs.push(`Row ${i + 2}: "${toLabel}" has no port #${toPortNum} — skipped.`); continue; }

        pairs.push({
          portFrom: fromPort.id,
          portTo: toPort.id,
          comment: String(row.Comment ?? ""),
          srcNode: fromEl.nodeId,
          tgtNode: toEl.nodeId,
          srcHandle: fromPort.id,
          tgtHandle: toPort.id,
        });
      }

      let newEdges: Edge[] = [];
      if (pairs.length > 0) {
        const splices = await createSplicesBatch(pairs.map((p) => ({ portFrom: p.portFrom, portTo: p.portTo })));
        const occupiedIds = pairs.flatMap((p) => [p.portFrom, p.portTo]);
        await updatePortStatusBatch(occupiedIds, "occupied");

        newEdges = splices.map((s, i) => ({
          id: s.id, type: "splice",
          source: pairs[i].srcNode,
          target: pairs[i].tgtNode,
          sourceHandle: pairs[i].srcHandle,
          targetHandle: pairs[i].tgtHandle,
          data: { comment: pairs[i].comment },
        }));

        // Update port status in local node state
        const occupiedSet = new Set(occupiedIds);
        const updatedMap = new Map<string, RawPort[]>();
        for (const [key, el] of elementMap) {
          const updated = el.ports.map((p) => occupiedSet.has(p.id) ? { ...p, status: "occupied" } : p);
          updatedMap.set(key, updated);
          el.node = {
            ...el.node,
            data: {
              ...el.node.data,
              ports: buildFiberPorts(updated, getInputCount(el.node)),
            },
          };
        }
      }

      // ── Phase 3: add to canvas ─────────────────────────────────────────────
      const newNodes = Array.from(elementMap.values()).map((e) => e.node);
      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);

      setErrors(errs);
      setStatus(
        `Done — ${newNodes.length} element${newNodes.length !== 1 ? "s" : ""} and ${newEdges.length} connection${newEdges.length !== 1 ? "s" : ""} imported.`
      );
      setDone(true);
    } catch (err) {
      errs.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      setErrors(errs);
      setStatus("Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={importOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from XLSX</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          <p className="text-xs text-muted-foreground leading-snug">
            Upload a SpliceForge XLSX file. It must have an <strong>Elements</strong> sheet and a <strong>Connections</strong> sheet — use Export to get the correct format.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={handleFile}
            className="text-sm file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:cursor-pointer cursor-pointer"
          />

          {status && (
            <p className={`text-sm font-medium ${done && errors.length === 0 ? "text-green-600" : done ? "text-yellow-600" : "text-muted-foreground"}`}>
              {status}
            </p>
          )}

          {errors.length > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-destructive mb-1">{errors.length} warning{errors.length !== 1 ? "s" : ""}:</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive/80">{e}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {done && (
              <Button size="sm" variant="outline" onClick={reset}>Import another</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleClose(false)}>
              {done ? "Close" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getInputCount(node: Node): number {
  const d = node.data as Record<string, unknown>;
  if (node.type === "cable") return (d.fiberCount as number) ?? 0;
  return (d.inputCount as number) ?? 0;
}
