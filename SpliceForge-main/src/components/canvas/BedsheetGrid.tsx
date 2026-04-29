"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getElements } from "@/lib/actions/elements";
import { getPortsByElements } from "@/lib/actions/ports";

type Page = {
  id: string;
  page_index: number;
  title: string | null;
  data_json?: { color?: string; header?: { nodeName?: string; address?: string; description?: string } } | null;
};
type RawElement = {
  id: string;
  type: string;
  position_x: number | null;
  position_y: number | null;
  config_json: Record<string, unknown> | null;
};
type RawPort = { id: string; element_id: string; status: string };
type PageData = { elements: RawElement[]; ports: RawPort[] };

const NODE_COLORS: Record<string, string> = {
  cable: "#3b82f6",
  splitter: "#f97316",
  equipment: "#22c55e",
  closure: "#a855f7",
};

function elColor(el: RawElement): string {
  if (el.type === "equipment" && el.config_json?.nodeType === "continuation") return "#8b5cf6";
  return NODE_COLORS[el.type] ?? "#94a3b8";
}

function statusDot(data: PageData): string {
  if (!data || data.elements.length === 0) return "#94a3b8";
  if (data.ports.length === 0) return "#94a3b8";
  const occ = data.ports.filter((p) => p.status === "occupied").length;
  if (occ === 0) return "#94a3b8";
  return occ === data.ports.length ? "#22c55e" : "#f59e0b";
}

function statusLabel(dot: string): string {
  if (dot === "#22c55e") return "complete";
  if (dot === "#f59e0b") return "partial";
  return "empty";
}

type LineData = { x1: number; y1: number; x2: number; y2: number; key: string };

type Props = {
  pages: Page[];
  currentPageId: string;
  onPageSelect: (id: string) => void;
  onAddPage: () => void;
};

export function BedsheetGrid({ pages, currentPageId, onPageSelect, onAddPage }: Props) {
  const [dataMap, setDataMap] = useState<Record<string, PageData>>({});
  const [loading, setLoading] = useState(true);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [lines, setLines] = useState<LineData[]>([]);

  // Fetch element + port data for all pages
  const pageIdKey = pages.map((p) => p.id).join(",");
  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      const elementsByPage = await Promise.all(pages.map((p) => getElements(p.id)));
      const allIds = elementsByPage.flat().map((e) => e.id);
      const allPorts = allIds.length ? await getPortsByElements(allIds) : [];
      if (!live) return;
      const portByEl: Record<string, RawPort[]> = {};
      for (const p of allPorts) (portByEl[p.element_id] ??= []).push(p as RawPort);
      const map: Record<string, PageData> = {};
      for (let i = 0; i < pages.length; i++) {
        const els = elementsByPage[i] as RawElement[];
        map[pages[i].id] = { elements: els, ports: els.flatMap((e) => portByEl[e.id] ?? []) };
      }
      setDataMap(map);
      setLoading(false);
    })();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdKey]);

  // Compute cross-page continuation lines after data + layout settle
  const computeLines = useCallback(() => {
    if (!gridRef.current) return;
    const gr = gridRef.current.getBoundingClientRect();
    setSvgSize({ w: gr.width, h: gr.height });
    const seen = new Set<string>();
    const result: LineData[] = [];
    for (const [pageId, data] of Object.entries(dataMap)) {
      for (const el of data.elements) {
        if (!(el.type === "equipment" && el.config_json?.nodeType === "continuation")) continue;
        const tid = el.config_json?.targetPageId as string | undefined;
        if (!tid || tid === pageId) continue;
        const pairKey = [pageId, tid].sort().join(":");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const sa = cardRefs.current[pageId];
        const sb = cardRefs.current[tid];
        if (!sa || !sb) continue;
        const ra = sa.getBoundingClientRect();
        const rb = sb.getBoundingClientRect();
        result.push({
          x1: ra.left - gr.left + ra.width / 2,
          y1: ra.top - gr.top + ra.height / 2,
          x2: rb.left - gr.left + rb.width / 2,
          y2: rb.top - gr.top + rb.height / 2,
          key: pairKey,
        });
      }
    }
    setLines(result);
  }, [dataMap]);

  useEffect(() => {
    computeLines();
    window.addEventListener("resize", computeLines);
    return () => window.removeEventListener("resize", computeLines);
  }, [computeLines]);

  return (
    <div className="w-full h-full bg-muted/20 overflow-auto p-6">
      <div
        ref={gridRef}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto relative"
      >
        {/* SVG overlay for cross-page continuation links */}
        {lines.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgSize.w}
            height={svgSize.h}
            style={{ zIndex: 0 }}
          >
            {lines.map((l) => (
              <line
                key={l.key}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={0.5}
              />
            ))}
          </svg>
        )}

        {pages.map((page) => {
          const isActive = page.id === currentPageId;
          const color = page.data_json?.color ?? "";
          const pageLabel = page.title ?? `Page ${page.page_index + 1}`;
          const header = page.data_json?.header;
          const data = dataMap[page.id] ?? { elements: [], ports: [] };
          const dot = statusDot(data);

          // Scale elements into a 100×60 SVG viewBox
          let miniRects: { x: number; y: number; w: number; h: number; fill: string }[] = [];
          if (data.elements.length > 0) {
            const xs = data.elements.map((e) => e.position_x ?? 0);
            const ys = data.elements.map((e) => e.position_y ?? 0);
            const minX = Math.min(...xs), minY = Math.min(...ys);
            const rX = Math.max(Math.max(...xs) - minX, 1);
            const rY = Math.max(Math.max(...ys) - minY, 1);
            const scale = Math.min(76 / rX, 46 / rY) * 0.85;
            const ox = 12 + (76 - rX * scale) / 2;
            const oy = 7 + (46 - rY * scale) / 2;
            miniRects = data.elements.map((el) => ({
              x: ((el.position_x ?? 0) - minX) * scale + ox,
              y: ((el.position_y ?? 0) - minY) * scale + oy,
              w: Math.max(5, Math.min(22, 20 * scale)),
              h: Math.max(2, Math.min(8, 7 * scale)),
              fill: elColor(el),
            }));
          }

          return (
            <div
              key={page.id}
              ref={(el) => { cardRefs.current[page.id] = el; }}
              className={`relative cursor-pointer rounded-xl border-2 bg-card shadow-sm hover:shadow-lg transition-all overflow-hidden group ${
                isActive
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              }`}
              style={{ aspectRatio: "4/3", zIndex: 1 }}
              onClick={() => onPageSelect(page.id)}
            >
              {/* Top color strip */}
              <div className="h-1.5 w-full" style={{ backgroundColor: color || "transparent" }} />

              {/* Miniature preview */}
              <div className="relative overflow-hidden bg-muted/30" style={{ height: "calc(100% - 52px)" }}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 60"
                  preserveAspectRatio="xMidYMid meet"
                  className="absolute inset-0"
                >
                  <defs>
                    <pattern
                      id={`dots-${page.id}`}
                      width="10"
                      height="10"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" />
                    </pattern>
                  </defs>
                  <rect width="100" height="60" fill={`url(#dots-${page.id})`} opacity={0.12} />

                  {loading ? (
                    <text x="50" y="33" textAnchor="middle" fontSize="5" fill="currentColor" opacity={0.25}>
                      loading…
                    </text>
                  ) : miniRects.length === 0 ? (
                    <text x="50" y="33" textAnchor="middle" fontSize="5" fill="currentColor" opacity={0.2}>
                      empty
                    </text>
                  ) : (
                    miniRects.map((r, i) => (
                      <rect
                        key={i}
                        x={r.x} y={r.y}
                        width={r.w} height={r.h}
                        fill={r.fill}
                        opacity={0.8}
                        rx={0.5}
                      />
                    ))
                  )}
                </svg>

                {isActive && (
                  <span className="absolute top-2 right-2 text-[9px] bg-primary text-primary-foreground rounded px-1.5 py-0.5 font-medium z-10">
                    Active
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-card border-t flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dot }}
                  title={`Splice status: ${statusLabel(dot)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate">{pageLabel}</p>
                  {(header?.nodeName || header?.address) && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {header.nodeName ?? header.address}
                    </p>
                  )}
                </div>
                {!loading && data.elements.length > 0 && (
                  <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                    {data.elements.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add page card */}
        <div
          className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card/50 hover:bg-accent/30 transition-all flex items-center justify-center"
          style={{ aspectRatio: "4/3", zIndex: 1 }}
          onClick={onAddPage}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="text-4xl leading-none font-light">+</span>
            <span className="text-sm">Add Page</span>
          </div>
        </div>
      </div>
    </div>
  );
}
