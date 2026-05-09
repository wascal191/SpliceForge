"use client";

import { useState } from "react";
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvasStore";
import type { FiberPort } from "@/types/fiber";
import type { Node } from "@xyflow/react";

const PADDING = 120;

function makeDomFilter(scope: Scope, tracedNodeIds: Set<string>, tracedEdgeIds: Set<string>) {
  return (el: HTMLElement) => {
    if (el.classList?.contains("react-flow__background")) return false;
    if (scope === "traced") {
      if (el.classList?.contains("react-flow__node")) {
        const id = el.getAttribute("data-id");
        if (id && !tracedNodeIds.has(id)) return false;
      }
      if (el.classList?.contains("react-flow__edge")) {
        const id = el.getAttribute("data-id");
        if (id && !tracedEdgeIds.has(id)) return false;
      }
    }
    return true;
  };
}

function calcImageSize(nodes: Node[]): { w: number; h: number } {
  if (!nodes.length) return { w: 3200, h: 2000 };
  const b = getNodesBounds(nodes);
  const contentW = b.width + PADDING * 2;
  const contentH = b.height + PADDING * 2;
  const aspect = contentW / contentH;
  // Target ~8M CSS pixels so at pixelRatio:2 we get ~32M actual pixels (HD)
  const BASE = 8_000_000;
  const h = Math.round(Math.sqrt(BASE / aspect));
  const w = Math.round(h * aspect);
  return {
    w: Math.max(1200, Math.min(6000, w)),
    h: Math.max(800, Math.min(6000, h)),
  };
}

function buildViewport(nodes: Node[], w: number, h: number, tracedOnly: boolean) {
  const bounds = getNodesBounds(nodes);
  // Higher maxZoom for traced subsets so they fill the frame
  return getViewportForBounds(bounds, w, h, 0.05, tracedOnly ? 10 : 4, 0.1);
}

function getFlowEl(): HTMLElement | null {
  return document.querySelector(".react-flow__viewport");
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

type Scope = "traced" | "all";

export function ExportDialog() {
  const exportOpen = useCanvasStore((s) => s.exportOpen);
  const setExportOpen = useCanvasStore((s) => s.setExportOpen);
  const darkMode = useCanvasStore((s) => s.darkMode);
  const traceEntries = useCanvasStore((s) => s.traceEntries);
  const tracedNodeIds = useCanvasStore((s) => s.tracedNodeIds);
  const tracedEdgeIds = useCanvasStore((s) => s.tracedEdgeIds);

  const hasTrace = traceEntries.size > 0;
  const tracedNodeCount = tracedNodeIds.size;

  const [bw, setBw] = useState(false);
  const [xlsxScope, setXlsxScope] = useState<Scope>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { getNodes, getEdges } = useReactFlow();
  const bg = darkMode ? "#0f172a" : "#ffffff";

  function targetNodes(scope: Scope): Node[] {
    const all = getNodes();
    return scope === "traced" && hasTrace
      ? all.filter((n) => tracedNodeIds.has(n.id))
      : all;
  }

  async function capture(scope: Scope): Promise<{ dataUrl: string; w: number; h: number }> {
    const el = getFlowEl();
    if (!el) throw new Error("Canvas not found");
    const nodes = targetNodes(scope);
    if (!nodes.length) throw new Error("No nodes to export");
    const { w, h } = calcImageSize(nodes);
    const vp = buildViewport(nodes, w, h, scope === "traced");
    const dataUrl = await toPng(el, {
      backgroundColor: bg,
      width: w,
      height: h,
      pixelRatio: 2,
      filter: makeDomFilter(scope, tracedNodeIds, tracedEdgeIds),
      style: {
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        transformOrigin: "top left",
        filter: bw ? "grayscale(1)" : undefined,
      },
    });
    return { dataUrl, w, h };
  }

  async function exportPDF(scope: Scope) {
    const key = `pdf-${scope}`;
    setBusy(key);
    try {
      const { dataUrl, w, h } = await capture(scope);
      const orientation = w >= h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
      pdf.save(scope === "traced" ? "spliceforge-trace.pdf" : "spliceforge.pdf");
    } finally {
      setBusy(null);
    }
  }

  async function exportPNG(scope: Scope) {
    const key = `png-${scope}`;
    setBusy(key);
    try {
      const { dataUrl } = await capture(scope);
      download(dataUrl, scope === "traced" ? "spliceforge-trace.png" : "spliceforge.png");
    } finally {
      setBusy(null);
    }
  }

  async function exportXLSX() {
    setBusy("xlsx");
    try {
      const allNodes = getNodes();
      const allEdges = getEdges();
      const edges =
        xlsxScope === "traced" && hasTrace
          ? allEdges.filter((e) => tracedEdgeIds.has(e.id))
          : allEdges;

      const portOwner = new Map<string, Node>();
      for (const n of allNodes) {
        const ports = (n.data as { ports?: FiberPort[] }).ports ?? [];
        for (const p of ports) portOwner.set(p.id, n);
      }
      const getPort = (id?: string | null) => {
        if (!id) return undefined;
        const owner = portOwner.get(id);
        return (owner?.data as { ports?: FiberPort[] })?.ports?.find((p) => p.id === id);
      };

      const connections = edges.map((e) => {
        const srcNode = portOwner.get(e.sourceHandle ?? "");
        const tgtNode = portOwner.get(e.targetHandle ?? "");
        const srcPort = getPort(e.sourceHandle);
        const tgtPort = getPort(e.targetHandle);
        return {
          "From Element": (srcNode?.data as { label?: string })?.label ?? "—",
          "From Type": srcNode?.type ?? "—",
          "From Port #": srcPort ? srcPort.portIndex + 1 : "—",
          "From Label": srcPort?.label ?? "",
          "Fiber Color": srcPort?.colors?.[0] ?? "—",
          "To Element": (tgtNode?.data as { label?: string })?.label ?? "—",
          "To Type": tgtNode?.type ?? "—",
          "To Port #": tgtPort ? tgtPort.portIndex + 1 : "—",
          "To Label": tgtPort?.label ?? "",
          "Comment": (e.data as { comment?: string })?.comment ?? "",
        };
      });

      const elements = allNodes
        .filter((n) => n.type !== "continuation")
        .map((n) => {
          const d = n.data as Record<string, unknown>;
          const type = n.type ?? "";
          const base = { "Label": (d.label as string) ?? "", "Type": type };
          if (type === "cable") return {
            ...base,
            "Fiber Count": (d.fiberCount as number) ?? "",
            "Color Scheme": (d.colorScheme as string) ?? "EIA598",
            "Module Size": (d.moduleFiberCount as number) || "",
            "Inputs": "", "Outputs": "", "Ratio": "",
          };
          if (type === "splitter") return {
            ...base,
            "Fiber Count": "", "Color Scheme": "", "Module Size": "",
            "Inputs": (d.inputCount as number) ?? "",
            "Outputs": (d.outputCount as number) ?? "",
            "Ratio": (d.ratio as string) ?? "",
          };
          return {
            ...base,
            "Fiber Count": "", "Color Scheme": "", "Module Size": "",
            "Inputs": (d.inputCount as number) ?? "",
            "Outputs": (d.outputCount as number) ?? "",
            "Ratio": "",
          };
        });

      const wb = new ExcelJS.Workbook();

      const elemSheet = wb.addWorksheet("Elements");
      if (elements.length > 0) {
        elemSheet.columns = Object.keys(elements[0]).map((key) => ({ header: key, key }));
        elemSheet.addRows(elements);
      }

      const connSheet = wb.addWorksheet("Connections");
      if (connections.length > 0) {
        connSheet.columns = Object.keys(connections[0]).map((key) => ({ header: key, key }));
        connSheet.addRows(connections);
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const fname = xlsxScope === "traced" && hasTrace ? "spliceforge-trace.xlsx" : "spliceforge.xlsx";
      download(url, fname);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint(scope: Scope) {
    const key = `print-${scope}`;
    setBusy(key);
    try {
      const { dataUrl } = await capture(scope);
      // Open with noopener/noreferrer so the popup cannot navigate the opener,
      // and build the document via DOM construction (no string interpolation
      // of `${dataUrl}` into HTML — eliminates a latent XSS sink, V-09).
      const win = window.open("", "_blank", "noopener,noreferrer");
      if (!win) return;
      const doc = win.document;
      doc.title = "SpliceForge";
      const style = doc.createElement("style");
      style.textContent =
        "*{margin:0;padding:0;box-sizing:border-box}" +
        "body{background:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh}" +
        "img{max-width:100%;max-height:100vh;object-fit:contain}" +
        "@media print{body{margin:0}img{width:100%;height:auto;max-height:none}}";
      doc.head.appendChild(style);
      const img = doc.createElement("img");
      img.onload = () => win.print();
      img.src = dataUrl; // assigning to .src is safe; the value is treated as a URL, not HTML
      doc.body.appendChild(img);
    } finally {
      setBusy(null);
    }
  }

  const isBusy = !!busy;

  return (
    <Dialog open={exportOpen} onOpenChange={setExportOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export / Print</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          {/* B&W toggle — applies to all visual outputs */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-primary"
              checked={bw}
              onChange={(e) => setBw(e.target.checked)}
            />
            Black &amp; White output
          </label>

          {/* ── TRACED PATH (primary, shown only when trace is active) ── */}
          {hasTrace && (
            <section className="flex flex-col gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-primary">Traced Path HD</span>
                <span className="text-[10px] text-muted-foreground">{tracedNodeCount} node{tracedNodeCount !== 1 ? "s" : ""}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Exports only the highlighted trace — zoomed and cropped to fill the page.
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={isBusy} onClick={() => exportPDF("traced")}>
                  {busy === "pdf-traced" ? "…" : "PDF"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={isBusy} onClick={() => exportPNG("traced")}>
                  {busy === "png-traced" ? "…" : "PNG"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={isBusy} onClick={() => handlePrint("traced")}>
                  {busy === "print-traced" ? "…" : "Print"}
                </Button>
              </div>
            </section>
          )}

          <div className="h-px bg-border" />

          {/* ── FULL CANVAS ── */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {hasTrace ? "Full Canvas" : "Export Canvas"}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" disabled={isBusy} onClick={() => exportPDF("all")}>
                {busy === "pdf-all" ? "…" : "PDF"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" disabled={isBusy} onClick={() => exportPNG("all")}>
                {busy === "png-all" ? "…" : "PNG"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" disabled={isBusy} onClick={() => handlePrint("all")}>
                {busy === "print-all" ? "…" : "Print"}
              </Button>
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* ── SPREADSHEET ── */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spreadsheet (XLSX)</p>
            {hasTrace && (
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="xlsxScope" checked={xlsxScope === "all"} onChange={() => setXlsxScope("all")} />
                  All connections
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="xlsxScope" checked={xlsxScope === "traced"} onChange={() => setXlsxScope("traced")} />
                  Traced only
                </label>
              </div>
            )}
            <Button size="sm" variant="outline" disabled={isBusy} onClick={exportXLSX}>
              {busy === "xlsx" ? "…" : "Export XLSX"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
