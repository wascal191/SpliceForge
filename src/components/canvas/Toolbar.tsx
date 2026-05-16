"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createElement } from "@/lib/actions/elements";
import { createPorts } from "@/lib/actions/ports";
import { getLibraryCables, deleteLibraryCable } from "@/lib/actions/library";
import { useCanvasStore } from "@/store/canvasStore";
import { SCHEME_LABELS, type FiberColorScheme } from "@/lib/fiber/colors";
import type { FiberPort, FiberNode } from "@/types/fiber";
import type { Node } from "@xyflow/react";
import type { LibraryCable } from "@/lib/actions/library";
import { toast } from "sonner";

const FIBER_COUNTS = [12, 24, 48, 96, 144, 288, 432, 864, 1728];
const MODULE_VALUES = [0, 12, 24] as const;

type Page = { id: string; page_index: number; title: string | null };

type Props = {
  pageId: string;
  bedsheetId: string;
  pages: Page[];
  onNodeAdded: (node: Node) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPageChange: (pageId: string) => void;
  onRangeSplice: () => void;
};

function buildFiberPorts(
  rawPorts: { id: string; element_id: string; port_index: number; colors: string[]; status: string; label?: string | null }[],
  inputCount: number,
  portsPerTray?: number
): FiberPort[] {
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

export function Toolbar({ pageId, pages, onNodeAdded, onUndo, onRedo, onPageChange, onRangeSplice }: Props) {
  const t = useTranslations("canvas.toolbar");
  const tCommon = useTranslations("common");
  const darkMode = useCanvasStore((s) => s.darkMode);
  const toggleDarkMode = useCanvasStore((s) => s.toggleDarkMode);
  const searchQuery = useCanvasStore((s) => s.searchQuery);
  const setSearchQuery = useCanvasStore((s) => s.setSearchQuery);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const paletteOpen = useCanvasStore((s) => s.paletteOpen);
  const setPaletteOpen = useCanvasStore((s) => s.setPaletteOpen);
  const keymapOpen = useCanvasStore((s) => s.keymapOpen);
  const setKeymapOpen = useCanvasStore((s) => s.setKeymapOpen);
  const bulkPortSelectMode = useCanvasStore((s) => s.bulkPortSelectMode);
  const setBulkPortSelectMode = useCanvasStore((s) => s.setBulkPortSelectMode);
  const clearBulkPorts = useCanvasStore((s) => s.clearBulkPorts);
  const bulkPortsA = useCanvasStore((s) => s.bulkPortsA);
  const bulkPortsB = useCanvasStore((s) => s.bulkPortsB);

  // Cable creation dialog
  const [cableOpen, setCableOpen] = useState(false);
  const [cableLabel, setCableLabel] = useState("Cable");
  const [fiberCount, setFiberCount] = useState(12);
  const [colorScheme, setColorScheme] = useState<FiberColorScheme>("EIA598");
  const [moduleFiberCount, setModuleFiberCount] = useState(0);
  const [cableQty, setCableQty] = useState(1);

  // Library panel
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryCable[]>([]);

  // Splitter creation dialog
  const [splitterOpen, setSplitterOpen] = useState(false);
  const [splitterLabel, setSplitterLabel] = useState("Splitter");
  const [splitterInputs, setSplitterInputs] = useState(1);
  const [splitterOutputs, setSplitterOutputs] = useState(8);
  const [splitterQty, setSplitterQty] = useState(1);

  // Equipment creation dialog
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipLabel, setEquipLabel] = useState("Equipment");
  const [equipInputs, setEquipInputs] = useState(2);
  const [equipOutputs, setEquipOutputs] = useState(2);
  const [equipQty, setEquipQty] = useState(1);

  // Closure creation dialog
  const [closureOpen, setClosureOpen] = useState(false);
  const [closureLabel, setClosureLabel] = useState("Closure");
  const [closurePortsPerSide, setClosurePortsPerSide] = useState(12);
  const [closureTrayCount, setClosureTrayCount] = useState(1);
  const [closureQty, setClosureQty] = useState(1);

  // Continuation dialog
  const [contOpen, setContOpen] = useState(false);
  const [contTargetId, setContTargetId] = useState("");
  const [contLabel, setContLabel] = useState("Cont.");

  // Command palette
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const filteredPages = pages.filter((p) =>
    (p.title ?? `Page ${p.page_index + 1}`)
      .toLowerCase()
      .includes(paletteQuery.toLowerCase())
  );
  useEffect(() => {
    if (paletteOpen) { setPaletteQuery(""); setPaletteIndex(0); }
  }, [paletteOpen]);
  function handlePaletteSelect(id: string) {
    onPageChange(id);
    setPaletteOpen(false);
  }

  useEffect(() => {
    if (libraryOpen) getLibraryCables().then(setLibraryItems);
  }, [libraryOpen]);

  // Initialize dark mode from localStorage on mount, then sync on change
  useEffect(() => {
    const stored = localStorage.getItem("spliceforge-dark-mode");
    if (stored === "true" && !darkMode) toggleDarkMode();
    if (stored === "false" && darkMode) toggleDarkMode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("spliceforge-dark-mode", String(darkMode));
  }, [darkMode]);

  async function addCable(
    label: string,
    count: number,
    scheme: FiberColorScheme,
    modSize: number
  ) {
    const config: Record<string, unknown> = { fiberCount: count, colorScheme: scheme };
    if (modSize > 0) config.moduleFiberCount = modSize;
    const el = await createElement(pageId, "cable", label, 100, 100, config);
    const raw = await createPorts(el.id, count * 2);  // dual-side: first half left, second half right
    const node: FiberNode = {
      id: el.id, type: "cable",
      position: { x: el.position_x ?? 100, y: el.position_y ?? 100 },
      data: {
        label,
        fiberCount: count,
        colorScheme: scheme,
        moduleFiberCount: modSize || undefined,
        ports: buildFiberPorts(raw, count),  // inputCount=count → ports 0..N-1 left, N..2N-1 right
      },
    };
    onNodeAdded(node);
  }

  async function handleAddCable() {
    const qty = Math.max(1, cableQty);
    try {
      for (let i = 0; i < qty; i++) {
        const label = qty > 1 ? `${cableLabel} ${i + 1}` : cableLabel;
        await addCable(label, fiberCount, colorScheme, moduleFiberCount);
      }
      setCableOpen(false);
      setCableLabel("Cable"); setFiberCount(12); setColorScheme("EIA598");
      setModuleFiberCount(0); setCableQty(1);
    } catch (err) {
      toast.error(t("toasts.addCableFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addCableFailedDesc"),
      });
    }
  }

  async function handleAddFromLibrary(cable: LibraryCable) {
    try {
      await addCable(
        cable.name,
        cable.fiber_count,
        (cable.color_scheme as FiberColorScheme) || "EIA598",
        cable.module_fiber_count ?? 0
      );
      setLibraryOpen(false);
    } catch (err) {
      toast.error(t("toasts.loadLibraryFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addCableFailedDesc"),
      });
    }
  }

  async function handleDeleteLibrary(id: string) {
    try {
      await deleteLibraryCable(id);
      setLibraryItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(t("toasts.deleteLibraryFailed"), {
        description: err instanceof Error ? err.message : t("toasts.deleteLibraryFailed"),
      });
    }
  }

  async function handleAddSplitter() {
    const inputCount = Math.max(1, splitterInputs);
    const outputCount = Math.max(1, splitterOutputs);
    const ratio = `${inputCount}:${outputCount}`;
    const baseLabel = splitterLabel.trim() || "Splitter";
    const qty = Math.max(1, splitterQty);
    try {
      for (let i = 0; i < qty; i++) {
        const label = qty > 1 ? `${baseLabel} ${i + 1}` : baseLabel;
        const el = await createElement(pageId, "splitter", label, 300 + i * 160, 100, { ratio, inputCount, outputCount });
        const raw = await createPorts(el.id, inputCount + 1);
        const node: FiberNode = {
          id: el.id, type: "splitter",
          position: { x: el.position_x ?? 300 + i * 160, y: el.position_y ?? 100 },
          data: { label, ratio, inputCount, outputCount, ports: buildFiberPorts(raw, inputCount) },
        };
        onNodeAdded(node);
      }
      setSplitterOpen(false);
      setSplitterLabel("Splitter"); setSplitterInputs(1); setSplitterOutputs(8); setSplitterQty(1);
    } catch (err) {
      toast.error(t("toasts.addSplitterFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addSplitterFailedDesc"),
      });
    }
  }

  async function handleAddEquipment() {
    const inputCount = Math.max(1, equipInputs);
    const outputCount = Math.max(1, equipOutputs);
    const baseLabel = equipLabel.trim() || "Equipment";
    const qty = Math.max(1, equipQty);
    try {
      for (let i = 0; i < qty; i++) {
        const label = qty > 1 ? `${baseLabel} ${i + 1}` : baseLabel;
        const el = await createElement(pageId, "equipment", label, 200 + i * 160, 300, { inputCount, outputCount });
        const raw = await createPorts(el.id, inputCount + outputCount);
        const node: FiberNode = {
          id: el.id, type: "equipment",
          position: { x: el.position_x ?? 200 + i * 160, y: el.position_y ?? 300 },
          data: { label, inputCount, outputCount, ports: buildFiberPorts(raw, inputCount) },
        };
        onNodeAdded(node);
      }
      setEquipOpen(false);
      setEquipLabel("Equipment"); setEquipInputs(2); setEquipOutputs(2); setEquipQty(1);
    } catch (err) {
      toast.error(t("toasts.addEquipmentFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addEquipmentFailedDesc"),
      });
    }
  }

  async function handleAddClosure() {
    const inputCount = Math.max(1, closurePortsPerSide);
    const outputCount = inputCount;
    const trayCount = Math.max(1, closureTrayCount);
    const portsPerTray = inputCount + outputCount;
    const baseLabel = closureLabel.trim() || "Closure";
    const qty = Math.max(1, closureQty);
    try {
      for (let i = 0; i < qty; i++) {
        const label = qty > 1 ? `${baseLabel} ${i + 1}` : baseLabel;
        const el = await createElement(pageId, "closure", label, 400 + i * 160, 300, { inputCount, outputCount, trayCount, collapsedTrays: [], trayNotes: {} });
        const raw = await createPorts(el.id, trayCount * portsPerTray);
        const node: FiberNode = {
          id: el.id, type: "closure",
          position: { x: el.position_x ?? 400 + i * 160, y: el.position_y ?? 300 },
          data: { label, inputCount, outputCount, trayCount, collapsedTrays: [], trayNotes: {}, ports: buildFiberPorts(raw, inputCount, portsPerTray) },
        };
        onNodeAdded(node);
      }
      setClosureOpen(false);
      setClosureLabel("Closure"); setClosurePortsPerSide(12); setClosureTrayCount(1); setClosureQty(1);
    } catch (err) {
      toast.error(t("toasts.addClosureFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addClosureFailedDesc"),
      });
    }
  }

  async function handleAddContinuation() {
    const targetId = contTargetId || (pages.find((p) => p.id !== pageId)?.id ?? pages[0]?.id ?? "");
    const target = pages.find((p) => p.id === targetId);
    const targetLabel = target?.title ?? `Page ${(target?.page_index ?? 0) + 1}`;
    const label = contLabel.trim() || "Cont.";
    const inputCount = 1; const outputCount = 1;
    try {
      const el = await createElement(pageId, "equipment", label, 500, 200, {
        nodeType: "continuation", targetPageId: targetId, targetPageLabel: targetLabel, inputCount, outputCount,
      });
      const raw = await createPorts(el.id, inputCount + outputCount);
      const node: FiberNode = {
        id: el.id, type: "continuation",
        position: { x: el.position_x ?? 500, y: el.position_y ?? 200 },
        data: { label, targetPageId: targetId, targetPageLabel: targetLabel, ports: buildFiberPorts(raw, inputCount) },
      };
      onNodeAdded(node);
      setContOpen(false);
      setContLabel("Cont.");
      setContTargetId("");
    } catch (err) {
      toast.error(t("toasts.addContinuationFailed"), {
        description: err instanceof Error ? err.message : t("toasts.addContinuationFailedDesc"),
      });
    }
  }

  /* ── inline style helpers ── */
  const pill: React.CSSProperties = {
    position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 20,
    display: "inline-flex", alignItems: "center", gap: 2, padding: 4,
    background: darkMode
      ? "linear-gradient(180deg, rgba(15,22,36,0.94), rgba(10,15,26,0.97))"
      : "rgba(255,255,255,0.97)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: darkMode ? "1px solid rgba(148,184,255,0.18)" : "1px solid rgba(15,23,42,0.14)",
    borderRadius: 999,
    boxShadow: darkMode
      ? "0 16px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
      : "0 4px 24px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06)",
  };
  const div_: React.CSSProperties = {
    width: 1, height: 16,
    background: darkMode ? "rgba(148,184,255,0.18)" : "rgba(15,23,42,0.12)",
    margin: "0 3px",
  };

  function IconBtn({ children, onClick, disabled, title, active }: {
    children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string; active?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={{
          background: active ? "rgba(148,184,255,0.08)" : "transparent",
          border: "none",
          color: disabled ? (darkMode ? "#3B4A66" : "#CBD5E1") : (darkMode ? "#94A3B8" : "#475569"),
          padding: "7px 9px", borderRadius: 999, cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 120ms", fontSize: 13, lineHeight: 1,
        }}
      >{children}</button>
    );
  }

  function ToolBtn({ label, color, dot, onClick, active, title }: {
    label: string; color: string; dot?: string; onClick: () => void; active?: boolean; title?: string;
  }) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          background: active ? `${color}15` : "transparent",
          border: "none",
          color: active ? color : (darkMode ? "#CBD5E1" : "#334155"),
          padding: "6px 10px", borderRadius: 999, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
          fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, lineHeight: 1,
          boxShadow: active ? `inset 0 0 0 1px ${color}55, 0 0 10px ${color}22` : "none",
          transition: "all 120ms",
        }}
      >
        {dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: dot, boxShadow: `0 0 5px ${dot}`, opacity: active ? 1 : 0.5 }} />}
        {label}
      </button>
    );
  }

  function ToggleBtn({ label, active, onClick, title, color }: {
    label: string; active: boolean; onClick: () => void; title?: string; color?: string;
  }) {
    const c = color ?? "#00E5FF";
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          background: active ? `${c}12` : "transparent",
          border: "none",
          color: active ? c : (darkMode ? "#94A3B8" : "#64748B"),
          padding: "6px 9px", borderRadius: 999, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600, lineHeight: 1,
          boxShadow: active ? `inset 0 0 0 1px ${c}40` : "none",
          transition: "all 120ms",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      {/* ── Floating pill toolbar ── */}
      <div style={pill} data-tour="toolbar">
        {/* Undo / Redo */}
        <IconBtn onClick={onUndo} disabled={!canUndo} title={t("undo")}>↩</IconBtn>
        <IconBtn onClick={onRedo} disabled={!canRedo} title={t("redo")}>↪</IconBtn>

        <div style={div_} />

        {/* Node creation tools */}
        <ToolBtn label={t("cable")}     color="#00E5FF" dot="#00E5FF" onClick={() => setCableOpen(true)} />
        <ToolBtn label={t("library")}   color="#22D3EE" dot="#22D3EE" onClick={() => setLibraryOpen(true)} />
        <ToolBtn label={t("splitter")}  color="#FCD34D" dot="#FCD34D" onClick={() => setSplitterOpen(true)} />
        <ToolBtn label={t("equipment")} color="#3DF5A3" dot="#3DF5A3" onClick={() => setEquipOpen(true)} />
        <ToolBtn label={t("closure")}   color="#C4A7FF" dot="#C4A7FF" onClick={() => setClosureOpen(true)} />
        <ToolBtn
          label={t("continuation")}
          color="#8b5cf6"
          dot="#8b5cf6"
          onClick={() => { setContTargetId(pages.find((p) => p.id !== pageId)?.id ?? ""); setContOpen(true); }}
        />

        <div style={div_} />

        {/* Mode toggles */}
        <ToggleBtn
          label={bulkPortSelectMode ? t("bulkExit") : t("bulk")}
          active={bulkPortSelectMode}
          color="#3DF5A3"
          onClick={() => { if (bulkPortSelectMode) { clearBulkPorts(); setBulkPortSelectMode(false); } else setBulkPortSelectMode(true); }}
          title={t("bulkTitle")}
        />
        <ToolBtn label={t("range")} color="#FCD34D" onClick={onRangeSplice} title={t("rangeTitle")} />

        <div style={div_} />

        {/* Utility */}
        <IconBtn onClick={() => setKeymapOpen(true)} title={t("keyboardShortcuts")}>?</IconBtn>
      </div>

      {/* ── Search oval ── */}
      <div
        style={{
          position: "absolute", top: 14, right: 16, zIndex: 20,
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "0 14px", height: 36,
          background: darkMode ? "linear-gradient(180deg, rgba(15,22,36,0.94), rgba(10,15,26,0.97))" : "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: searchQuery
            ? "1px solid rgba(0,229,255,0.45)"
            : (darkMode ? "1px solid rgba(148,184,255,0.18)" : "1px solid rgba(15,23,42,0.14)"),
          borderRadius: 999,
          boxShadow: searchQuery
            ? (darkMode ? "0 0 0 3px rgba(0,229,255,0.10), 0 8px 24px rgba(0,0,0,0.5)" : "0 0 0 3px rgba(2,132,199,0.10), 0 4px 16px rgba(15,23,42,0.10)")
            : (darkMode ? "0 8px 24px rgba(0,0,0,0.5)" : "0 4px 16px rgba(15,23,42,0.10)"),
          transition: "border 150ms, box-shadow 150ms",
        }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={darkMode ? "#64748B" : "#94A3B8"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
          placeholder={t("searchPlaceholder")}
          style={{
            background: "transparent", border: "none", outline: "none",
            fontSize: 11.5, fontWeight: 400, width: 120,
            color: darkMode ? "#F1F5F9" : "#0F172A",
            fontFamily: "inherit", letterSpacing: "0.01em",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
              color: darkMode ? "#64748B" : "#94A3B8", fontSize: 14, lineHeight: 1,
              display: "flex", alignItems: "center",
            }}
            title={t("clearSearch")}
          >×</button>
        )}
      </div>

      {/* Bulk connect status indicator */}
      {bulkPortSelectMode && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 20,
          display: "inline-flex", alignItems: "center", gap: 8,
          background: darkMode ? "rgba(10,15,26,0.95)" : "rgba(255,255,255,0.97)",
          border: "1px solid rgba(61,245,163,0.35)",
          borderRadius: 999, padding: "6px 14px", fontSize: 11, pointerEvents: "none",
          boxShadow: darkMode
            ? "0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(61,245,163,0.15)"
            : "0 4px 16px rgba(15,23,42,0.12)",
          fontFamily: "var(--font-geist-mono, monospace)", letterSpacing: "0.04em",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#3DF5A3", boxShadow: "0 0 6px #3DF5A3" }} />
          <span style={{ color: darkMode ? "#CBD5E1" : "#475569" }}>{t("bulkStatusA")} <strong style={{ color: darkMode ? "#F1F5F9" : "#0F172A" }}>{bulkPortsA.length}</strong></span>
          <span style={{ color: darkMode ? "#3B4A66" : "#94A3B8" }}>·</span>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#C4A7FF", boxShadow: "0 0 6px #C4A7FF" }} />
          <span style={{ color: darkMode ? "#CBD5E1" : "#475569" }}>{t("bulkStatusB")} <strong style={{ color: darkMode ? "#F1F5F9" : "#0F172A" }}>{bulkPortsB.length}</strong></span>
          {bulkPortsA.length > 0 && bulkPortsB.length > 0 && (
            <span style={{ color: "#64748B" }}>{t("bulkHint")}</span>
          )}
        </div>
      )}

      {/* Cable creation dialog */}
      <Dialog open={cableOpen} onOpenChange={setCableOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cableDialog.title")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("cableDialog.label")}
              <input
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={cableLabel}
                onChange={(e) => setCableLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCable()}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {t("cableDialog.fiberCount")}
              <select
                className="border rounded px-2 py-1 text-sm bg-background outline-none"
                value={fiberCount}
                onChange={(e) => setFiberCount(Number(e.target.value))}
              >
                {FIBER_COUNTS.map((c) => (
                  <option key={c} value={c}>{t("cableDialog.fibers", { count: c })}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {t("cableDialog.colorStandard")}
              <select
                className="border rounded px-2 py-1 text-sm bg-background outline-none"
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as FiberColorScheme)}
              >
                {(Object.keys(SCHEME_LABELS) as FiberColorScheme[]).map((k) => (
                  <option key={k} value={k}>{SCHEME_LABELS[k]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {t("cableDialog.moduleGrouping")}
              <select
                className="border rounded px-2 py-1 text-sm bg-background outline-none"
                value={moduleFiberCount}
                onChange={(e) => setModuleFiberCount(Number(e.target.value))}
              >
                {MODULE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? t("cableDialog.noModules") : t("cableDialog.fibersPerModule", { count: v })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("cableDialog.quantity")}
              <input
                type="number" min={1} max={50}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={cableQty}
                onChange={(e) => setCableQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCableOpen(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleAddCable}>{t("cableDialog.add", { count: cableQty })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cable library dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("libraryDialog.title")}</DialogTitle>
          </DialogHeader>

          {libraryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("libraryDialog.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {libraryItems.map((cable) => (
                <div
                  key={cable.id}
                  className="flex items-center justify-between rounded border px-3 py-2 hover:bg-accent cursor-pointer"
                  onClick={() => handleAddFromLibrary(cable)}
                >
                  <div>
                    <p className="text-sm font-medium">{cable.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cable.fiber_count}ct · {cable.color_scheme}
                      {cable.module_fiber_count ? ` · mod/${cable.module_fiber_count}` : ""}
                    </p>
                  </div>
                  <button
                    className="text-muted-foreground hover:text-destructive text-sm ml-2"
                    onClick={(e) => { e.stopPropagation(); handleDeleteLibrary(cable.id); }}
                    title={t("libraryDialog.remove")}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Keymap cheat-sheet */}
      <Dialog open={keymapOpen} onOpenChange={setKeymapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("keyboardShortcuts")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-y-2" style={{ gridTemplateColumns: "auto 1fr" }}>
            {([
              ["Ctrl+Z", t("shortcuts.undo")],
              ["Ctrl+Y / Ctrl+Shift+Z", t("shortcuts.redo")],
              ["Ctrl+C / V", t("shortcuts.copyPaste")],
              ["Ctrl+A", t("shortcuts.selectAll")],
              ["Ctrl+F", t("shortcuts.search")],
              ["Ctrl+B", t("shortcuts.bwToggle")],
              ["Ctrl+Shift+F", t("shortcuts.fitView")],
              ["Ctrl+P", t("shortcuts.switchPage")],
              ["Alt+Shift+C", t("shortcuts.bulkSplice")],
              ["Delete / Backspace", t("shortcuts.deleteSelected")],
              ["Arrow keys", t("shortcuts.nudge10")],
              ["Shift+Arrow", t("shortcuts.nudge40")],
              ["Right-click", t("shortcuts.contextMenu")],
              ["Escape", t("shortcuts.deselect")],
              ["?", t("shortcuts.thisHelp")],
            ] as [string, string][]).map(([key, desc]) => (
              <div key={key} className="contents">
                <kbd className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono self-start mr-6 whitespace-nowrap">{key}</kbd>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Ctrl+P command palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" showCloseButton={false}>
          <div className="px-3 pt-3 pb-1">
            <input
              ref={paletteInputRef}
              autoFocus
              className="w-full border rounded px-2 py-1.5 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("palette.placeholder")}
              value={paletteQuery}
              onChange={(e) => { setPaletteQuery(e.target.value); setPaletteIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIndex((i) => Math.min(i + 1, filteredPages.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIndex((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); const p = filteredPages[paletteIndex]; if (p) handlePaletteSelect(p.id); }
              }}
            />
          </div>
          <div className="flex flex-col max-h-64 overflow-y-auto pb-2">
            {filteredPages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("palette.noMatch")}</p>
            ) : filteredPages.map((p, i) => (
              <button
                key={p.id}
                className={`text-left px-3 py-2 text-sm hover:bg-accent ${i === paletteIndex ? "bg-accent" : ""}`}
                onClick={() => handlePaletteSelect(p.id)}
                onMouseEnter={() => setPaletteIndex(i)}
              >
                <span className="font-medium">{p.title ?? `Page ${p.page_index + 1}`}</span>
                {p.id === pageId && <span className="ml-2 text-xs text-muted-foreground">{t("palette.current")}</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Splitter creation dialog */}
      <Dialog open={splitterOpen} onOpenChange={setSplitterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("splitterDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("splitterDialog.label")}
              <input
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={splitterLabel}
                onChange={(e) => setSplitterLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSplitter()}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("splitterDialog.frontPorts")}
                <input
                  type="number" min={1} max={256}
                  className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                  value={splitterInputs}
                  onChange={(e) => setSplitterInputs(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("splitterDialog.backPorts")}
                <input
                  type="number" min={1} max={256}
                  className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                  value={splitterOutputs}
                  onChange={(e) => setSplitterOutputs(Math.max(1, Number(e.target.value)))}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("splitterDialog.ratioInfo", { inputs: splitterInputs, outputs: splitterOutputs, total: splitterInputs + splitterOutputs })}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              {t("splitterDialog.quantity")}
              <input
                type="number" min={1} max={50}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={splitterQty}
                onChange={(e) => setSplitterQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitterOpen(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleAddSplitter}>{t("splitterDialog.add", { count: splitterQty })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment creation dialog */}
      <Dialog open={equipOpen} onOpenChange={setEquipOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("equipmentDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("equipmentDialog.label")}
              <input
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={equipLabel}
                onChange={(e) => setEquipLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEquipment()}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("equipmentDialog.frontPorts")}
                <input
                  type="number" min={1} max={256}
                  className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                  value={equipInputs}
                  onChange={(e) => setEquipInputs(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("equipmentDialog.backPorts")}
                <input
                  type="number" min={1} max={256}
                  className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                  value={equipOutputs}
                  onChange={(e) => setEquipOutputs(Math.max(1, Number(e.target.value)))}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("equipmentDialog.totalPorts", { count: equipInputs + equipOutputs })}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              {t("equipmentDialog.quantity")}
              <input
                type="number" min={1} max={50}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={equipQty}
                onChange={(e) => setEquipQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipOpen(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleAddEquipment}>{t("equipmentDialog.add", { count: equipQty })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closure creation dialog */}
      <Dialog open={closureOpen} onOpenChange={setClosureOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("closureDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("closureDialog.label")}
              <input
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={closureLabel}
                onChange={(e) => setClosureLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddClosure()}
                placeholder={t("closureDialog.labelPlaceholder")}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("closureDialog.trays")}
                <select
                  className="border rounded px-2 py-1 text-sm bg-background outline-none"
                  value={closureTrayCount}
                  onChange={(e) => setClosureTrayCount(Number(e.target.value))}
                >
                  {[1, 2, 4, 6, 8, 12, 16, 24].map((n) => (
                    <option key={n} value={n}>{t("closureDialog.trayCount", { count: n })}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("closureDialog.portsPerTray")}
                <select
                  className="border rounded px-2 py-1 text-sm bg-background outline-none"
                  value={closurePortsPerSide}
                  onChange={(e) => setClosurePortsPerSide(Number(e.target.value))}
                >
                  {[6, 12, 24].map((n) => (
                    <option key={n} value={n}>{t("closureDialog.portsCount", { count: n })}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("closureDialog.summary", { trays: closureTrayCount, ports: closurePortsPerSide, total: closureTrayCount * closurePortsPerSide })}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              {t("closureDialog.quantity")}
              <input
                type="number" min={1} max={50}
                className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                value={closureQty}
                onChange={(e) => setClosureQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosureOpen(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleAddClosure}>{t("closureDialog.add", { count: closureQty })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Continuation node dialog */}
      <Dialog open={contOpen} onOpenChange={setContOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("continuationDialog.title")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            {t("continuationDialog.hint")}
          </p>

          {pages.filter((p) => p.id !== pageId).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("continuationDialog.needTwoPages")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("continuationDialog.label")}
                <input
                  className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                  value={contLabel}
                  onChange={(e) => setContLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContinuation()}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                {t("continuationDialog.targetPage")}
                <select
                  className="border rounded px-2 py-1 text-sm bg-background outline-none"
                  value={contTargetId}
                  onChange={(e) => setContTargetId(e.target.value)}
                >
                  {pages
                    .filter((p) => p.id !== pageId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title ?? `Page ${p.page_index + 1}`}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setContOpen(false)}>{tCommon("cancel")}</Button>
            {pages.filter((p) => p.id !== pageId).length > 0 && (
              <Button onClick={handleAddContinuation}>{t("continuationDialog.addBtn")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
