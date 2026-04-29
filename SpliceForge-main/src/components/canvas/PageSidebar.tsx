"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPage, deletePage, renamePage, updatePageData, reorderPages, duplicatePage } from "@/lib/actions/pages";
import { useCanvasStore } from "@/store/canvasStore";
import { toast } from "sonner";

const PAGE_COLORS = [
  { label: "None",   value: "" },
  { label: "Red",    value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green",  value: "#22c55e" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink",   value: "#ec4899" },
];


type PageHeader = { nodeName?: string; address?: string; description?: string };

type Page = {
  id: string;
  page_index: number;
  title: string | null;
  data_json?: { color?: string; header?: PageHeader } | null;
};

type Props = {
  bedsheetId: string;
  pages: Page[];
  currentPageId: string;
  onPageChange: (pageId: string) => void;
  onPagesChange: (pages: Page[]) => void;
  onHeaderChange?: (header: PageHeader) => void;
};

type OpenPanel = "pages" | "history" | "settings" | null;

/* ─── Inline SVG icon ─── */
function Icon({ d, size = 16 }: { d: string | React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}>
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}

const ICONS = {
  layers:   "m12 2 10 5-10 5L2 7l10-5ZM2 17l10 5 10-5M2 12l10 5 10-5",
  history:  "M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8",
  settings: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>),
  chevLeft: "m15 18-6-6 6-6",
  chevRight:"m9 18 6-6-6-6",
  plus:     "M12 5v14M5 12h14",
  dots:     (<><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></>),
};

/* ─── Sortable page row ─── */
type RowProps = {
  page: Page;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  showDelete: boolean;
  darkMode: boolean;
  onSelect: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
};

function SortablePage({
  page, isActive, isRenaming, renameValue, showDelete, darkMode,
  onSelect, onRenameChange, onRenameCommit, onRenameCancel,
  onDoubleClick, onDelete, onContextMenu, children,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const color = page.data_json?.color ?? "";
  const pageLabel = page.title ?? `Page ${page.page_index + 1}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
          marginBottom: 2, borderRadius: 7, cursor: "pointer", position: "relative",
          background: isActive
            ? (darkMode ? "linear-gradient(90deg, rgba(0,229,255,0.10), rgba(0,229,255,0.03))" : "rgba(2,132,199,0.07)")
            : "transparent",
          border: `1px solid ${isActive ? (darkMode ? "rgba(0,229,255,0.30)" : "rgba(2,132,199,0.25)") : "transparent"}`,
          boxShadow: isActive && darkMode ? "0 0 14px rgba(0,229,255,0.10)" : "none",
          transition: "all 120ms",
        }}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        {/* Active accent bar */}
        {isActive && (
          <div style={{
            position: "absolute", left: -10, top: 8, bottom: 8, width: 2,
            background: darkMode ? "#00E5FF" : "#0284C7",
            borderRadius: 999,
            boxShadow: darkMode ? "0 0 8px #00E5FF" : "none",
          }} />
        )}

        {/* Drag handle */}
        <span
          style={{ color: darkMode ? "#3B4A66" : "#CBD5E1", fontSize: 10, cursor: "grab", userSelect: "none", flexShrink: 0 }}
          {...attributes} {...listeners}
          title="Drag to reorder"
        >⣿</span>

        {/* Color dot */}
        <span style={{
          width: 6, height: 6, borderRadius: 999, flexShrink: 0,
          backgroundColor: color || "transparent",
          border: color ? undefined : `1.5px dashed ${darkMode ? "#3B4A66" : "#CBD5E1"}`,
        }} />

        {/* Label */}
        {isRenaming ? (
          <input
            style={{
              flex: 1, fontSize: 11.5, background: "transparent",
              borderBottom: `1px solid ${darkMode ? "rgba(0,229,255,0.5)" : "rgba(2,132,199,0.5)"}`,
              outline: "none", color: darkMode ? "#F1F5F9" : "#0F172A", padding: "0 2px",
            }}
            value={renameValue}
            autoFocus
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            style={{
              flex: 1, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: isActive ? (darkMode ? "#F1F5F9" : "#0F172A") : (darkMode ? "#CBD5E1" : "#475569"),
              fontWeight: isActive ? 600 : 400,
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
          >
            {pageLabel}
          </span>
        )}

        {/* Delete */}
        {showDelete && (
          <button
            style={{
              display: "none", width: 16, height: 16, alignItems: "center", justifyContent: "center",
              borderRadius: 4, border: "none", background: "transparent",
              color: darkMode ? "#64748B" : "#94A3B8", cursor: "pointer", fontSize: 12, flexShrink: 0,
            }}
            className="group-hover:flex"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete page"
          >×</button>
        )}
      </div>

      {isActive && children}
    </div>
  );
}

/* ─── Main Sidebar ─── */
export function PageSidebar({ bedsheetId, pages, currentPageId, onPageChange, onPagesChange, onHeaderChange }: Props) {
  const darkMode      = useCanvasStore((s) => s.darkMode);
  const toggleDarkMode= useCanvasStore((s) => s.toggleDarkMode);
  const bwMode        = useCanvasStore((s) => s.bwMode);
  const toggleBwMode  = useCanvasStore((s) => s.toggleBwMode);
  const snapGrid      = useCanvasStore((s) => s.snapGrid);
  const toggleSnapGrid= useCanvasStore((s) => s.toggleSnapGrid);

  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const [headerDraft, setHeaderDraft] = useState<PageHeader>({});
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [openPanel, setOpenPanel]     = useState<OpenPanel>("pages");
  const headerSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextRef      = useRef<HTMLDivElement>(null);

  const activePage = pages.find((p) => p.id === currentPageId);

  useEffect(() => {
    setHeaderDraft(activePage?.data_json?.header ?? {});
  }, [currentPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!contextMenu) return;
    function onDown(e: MouseEvent) {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex  = pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(pages, oldIndex, newIndex).map((p, i) => ({ ...p, page_index: i }));
    onPagesChange(reordered);
    await reorderPages(reordered.map((p) => ({ id: p.id, page_index: p.page_index })));
  }

  async function handleAddPage() {
    try {
      const nextIndex = pages.length;
      const newPage   = await createPage(bedsheetId, nextIndex, `Page ${nextIndex + 1}`);
      const updated   = [...pages, { ...newPage, data_json: null as Page["data_json"] }];
      onPagesChange(updated);
      onPageChange(newPage.id);
    } catch (err) {
      toast.error("Failed to create page", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDeletePage(pageId: string) {
    if (pages.length <= 1) return;
    try {
      await deletePage(pageId);
      const updated = pages.filter((p) => p.id !== pageId);
      onPagesChange(updated);
      if (currentPageId === pageId) onPageChange(updated[0].id);
    } catch (err) {
      toast.error("Failed to delete page", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDuplicate(pageId: string) {
    setContextMenu(null);
    setDuplicating(pageId);
    try {
      const newPage = await duplicatePage(pageId, bedsheetId);
      const updated = [...pages, { ...newPage, data_json: newPage.data_json as Page["data_json"] }];
      onPagesChange(updated);
      onPageChange(newPage.id);
    } catch (err) {
      toast.error("Failed to duplicate page", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDuplicating(null);
    }
  }

  async function commitRename(pageId: string) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;
    try {
      await renamePage(pageId, trimmed);
      onPagesChange(pages.map((p) => (p.id === pageId ? { ...p, title: trimmed } : p)));
    } catch (err) {
      toast.error("Failed to rename page", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function setPageColor(pageId: string, color: string) {
    setContextMenu(null);
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const newData = { ...(page.data_json ?? {}), color };
    try {
      await updatePageData(pageId, newData);
      onPagesChange(pages.map((p) => (p.id === pageId ? { ...p, data_json: newData } : p)));
    } catch (err) {
      toast.error("Failed to set page color", { description: err instanceof Error ? err.message : undefined });
    }
  }

  function handleHeaderChange(field: keyof PageHeader, value: string) {
    const draft = { ...headerDraft, [field]: value };
    setHeaderDraft(draft);
    onHeaderChange?.(draft);
    if (headerSaveTimer.current) clearTimeout(headerSaveTimer.current);
    headerSaveTimer.current = setTimeout(async () => {
      if (!activePage) return;
      const newData = { ...(activePage.data_json ?? {}), header: draft };
      try {
        await updatePageData(activePage.id, newData);
        onPagesChange(pages.map((p) => (p.id === activePage.id ? { ...p, data_json: newData } : p)));
      } catch (err) {
        toast.error("Failed to save header", { description: err instanceof Error ? err.message : undefined });
      }
    }, 800);
  }

  /* ── style helpers ── */
  const rail_bg   = darkMode ? "linear-gradient(180deg, #080D18, #060A12)" : "linear-gradient(180deg, #F8FAFC, #F1F5F9)";
  const rail_br   = darkMode ? "rgba(148,184,255,0.10)" : "rgba(15,23,42,0.10)";
  const flyout_bg = darkMode ? "linear-gradient(180deg, #0A0F1A, #070B14)" : "linear-gradient(180deg, #FFFFFF, #F8FAFC)";
  const flyout_br = darkMode ? "rgba(148,184,255,0.10)" : "rgba(15,23,42,0.10)";
  const sep       = darkMode ? "rgba(148,184,255,0.08)" : "rgba(15,23,42,0.08)";
  const dim       = darkMode ? "#64748B" : "#94A3B8";
  const fg        = darkMode ? "#F1F5F9" : "#0F172A";

  const railItems: { k: OpenPanel; icon: string | React.ReactNode; tip: string; color: string }[] = [
    { k: "pages",    icon: ICONS.layers,   tip: "Pages",    color: "#00E5FF" },
    { k: "history",  icon: ICONS.history,  tip: "History",  color: "#94A3B8" },
    { k: "settings", icon: ICONS.settings, tip: "Settings", color: "#94A3B8" },
  ];

  const settingRows: { label: string; desc: string; active: boolean; toggle: () => void; shortcut?: string }[] = [
    { label: "B&W Mode",     desc: "Grayscale fiber colors",   active: bwMode,      toggle: toggleBwMode,   shortcut: "Ctrl+B" },
    { label: "Snap to Grid", desc: "Align nodes to 10px grid", active: snapGrid,    toggle: toggleSnapGrid },
    { label: darkMode ? "Light Mode" : "Dark Mode", desc: darkMode ? "Switch to white theme" : "Switch to dark theme", active: darkMode, toggle: toggleDarkMode },
  ];

  return (
    <div style={{ display: "flex", flexShrink: 0, position: "relative", zIndex: 10 }}>

      {/* ── Icon rail ── */}
      <div style={{
        width: 52, flexShrink: 0,
        background: rail_bg,
        borderRight: `1px solid ${openPanel ? "transparent" : rail_br}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 0", gap: 3,
      }}>
        {/* Collapse/expand toggle */}
        <button
          onClick={() => setOpenPanel(openPanel ? null : "pages")}
          title={openPanel ? "Close panel" : "Open pages"}
          style={{
            width: 36, height: 36, border: "none", borderRadius: 8,
            background: "transparent", color: dim,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: 4, transition: "color 120ms",
          }}
        >
          <Icon d={openPanel ? ICONS.chevLeft : ICONS.chevRight} size={15} />
        </button>

        <div style={{ width: 28, height: 1, background: rail_br, marginBottom: 4 }} />

        {railItems.map((item) => {
          const isActive = openPanel === item.k;
          return (
            <button
              key={item.k}
              title={item.tip}
              onClick={() => setOpenPanel(isActive ? null : item.k)}
              style={{
                width: 36, height: 36, border: "none", borderRadius: 9,
                background: isActive ? `${item.color}18` : "transparent",
                color: isActive ? item.color : dim,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative",
                boxShadow: isActive ? `inset 0 0 0 1px ${item.color}40` : "none",
                transition: "all 150ms",
              }}
            >
              <Icon d={item.icon} size={16} />
              {isActive && (
                <div style={{
                  position: "absolute", right: -1, top: 8, bottom: 8, width: 2,
                  background: item.color, borderRadius: 999,
                  boxShadow: `0 0 8px ${item.color}`,
                }} />
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />
      </div>

      {/* ── Fly-out panel ── */}
      {openPanel && (
        <div style={{
          width: 224, flexShrink: 0,
          background: flyout_bg,
          borderRight: `1px solid ${flyout_br}`,
          display: "flex", flexDirection: "column",
          boxShadow: darkMode ? "4px 0 24px rgba(0,0,0,0.4)" : "4px 0 16px rgba(15,23,42,0.08)",
          animation: "flyOut 160ms cubic-bezier(.2,.8,.2,1)",
        }}>

          {/* ── Pages panel ── */}
          {openPanel === "pages" && (
            <>
              <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${sep}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: fg, letterSpacing: "-0.01em", marginBottom: 4 }}>Pages</div>
                <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9.5, color: dim }}>
                  {pages.length} page{pages.length !== 1 ? "s" : ""}
                </div>
              </div>

              <div style={{ padding: "7px 14px", borderBottom: `1px solid ${sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9, letterSpacing: "0.16em", color: "#00E5FF" }}>
                  PAGES · {pages.length}
                </div>
                <button
                  onClick={handleAddPage}
                  title="Add page"
                  style={{ background: "transparent", border: "none", color: "#00E5FF", cursor: "pointer", padding: 3, display: "flex" }}
                >
                  <Icon d={ICONS.plus} size={12} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {pages.map((page) => (
                      <SortablePage
                        key={page.id}
                        page={page}
                        isActive={page.id === currentPageId}
                        isRenaming={renamingId === page.id}
                        renameValue={renameValue}
                        showDelete={pages.length > 1}
                        darkMode={darkMode}
                        onSelect={() => onPageChange(page.id)}
                        onRenameChange={setRenameValue}
                        onRenameCommit={() => commitRename(page.id)}
                        onRenameCancel={() => setRenamingId(null)}
                        onDoubleClick={() => { setRenamingId(page.id); setRenameValue(page.title ?? `Page ${page.page_index + 1}`); }}
                        onDelete={() => handleDeletePage(page.id)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ pageId: page.id, x: e.clientX, y: e.clientY }); }}
                      >
                        {page.id === currentPageId && (
                          <div style={{ margin: "0 6px 6px 14px", display: "flex", flexDirection: "column", gap: 4, borderLeft: `2px solid ${darkMode ? "rgba(0,229,255,0.25)" : "rgba(2,132,199,0.25)"}`, paddingLeft: 8 }}>
                            {(["nodeName", "address", "description"] as (keyof PageHeader)[]).map((field) => (
                              <input
                                key={field}
                                style={{
                                  fontSize: 10, background: "transparent",
                                  borderBottom: `1px solid ${darkMode ? "rgba(148,184,255,0.15)" : "rgba(15,23,42,0.12)"}`,
                                  outline: "none", color: darkMode ? "#CBD5E1" : "#475569", padding: "2px 0",
                                }}
                                placeholder={field === "nodeName" ? "Node name…" : field === "address" ? "Address…" : "Description…"}
                                value={headerDraft[field] ?? ""}
                                onChange={(e) => handleHeaderChange(field, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ))}
                          </div>
                        )}
                      </SortablePage>
                    ))}
                  </SortableContext>
                </DndContext>

                <button
                  onClick={handleAddPage}
                  style={{
                    width: "100%", marginTop: 6, padding: "7px 0",
                    background: "transparent",
                    border: `1px dashed ${darkMode ? "rgba(148,184,255,0.20)" : "rgba(15,23,42,0.18)"}`,
                    borderRadius: 7, color: dim, fontSize: 11, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  <Icon d={ICONS.plus} size={11} /> Add Page
                </button>
              </div>

            </>
          )}

          {/* ── History panel ── */}
          {openPanel === "history" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9, letterSpacing: "0.18em", color: dim, marginBottom: 12 }}>HISTORY</div>
              {[
                { label: "Page renamed",  time: "just now", color: "#00E5FF" },
                { label: "Node moved",    time: "1m ago",   color: "#94A3B8" },
                { label: "Splice created",time: "3m ago",   color: "#3DF5A3" },
                { label: "Cable added",   time: "8m ago",   color: "#00E5FF" },
                { label: "Page created",  time: "12m ago",  color: "#64748B" },
              ].map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${sep}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: h.color, flexShrink: 0, boxShadow: `0 0 5px ${h.color}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: darkMode ? "#CBD5E1" : "#334155" }}>{h.label}</div>
                    <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9.5, color: dim, marginTop: 1 }}>{h.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings panel ── */}
          {openPanel === "settings" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9, letterSpacing: "0.18em", color: dim, marginBottom: 12 }}>CANVAS SETTINGS</div>

              {settingRows.map((item) => (
                <button
                  key={item.label}
                  onClick={item.toggle}
                  style={{
                    display: "flex", alignItems: "center", width: "100%",
                    padding: "10px 0", gap: 10, background: "transparent", border: "none",
                    borderBottom: `1px solid ${sep}`,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  {/* Toggle pill */}
                  <div style={{
                    width: 32, height: 18, borderRadius: 999, flexShrink: 0, position: "relative",
                    background: item.active ? "#00E5FF" : (darkMode ? "rgba(148,184,255,0.12)" : "rgba(15,23,42,0.10)"),
                    transition: "background 150ms",
                  }}>
                    <div style={{
                      position: "absolute", top: 3,
                      left: item.active ? 16 : 3,
                      width: 12, height: 12, borderRadius: 999,
                      background: item.active ? "#05070C" : dim,
                      transition: "left 150ms",
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: item.active ? fg : dim, lineHeight: 1.2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 9.5, color: darkMode ? "#3B4A66" : "#CBD5E1", marginTop: 1, fontFamily: "var(--font-geist-mono, monospace)" }}>
                      {item.desc}{item.shortcut ? ` · ${item.shortcut}` : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          ref={contextRef}
          style={{
            position: "fixed", zIndex: 50,
            top: contextMenu.y, left: contextMenu.x,
            background: darkMode ? "#0A0F1A" : "#FFFFFF",
            border: darkMode ? "1px solid rgba(148,184,255,0.18)" : "1px solid rgba(15,23,42,0.12)",
            borderRadius: 10,
            boxShadow: darkMode ? "0 20px 50px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 8px 24px rgba(15,23,42,0.14)",
            overflow: "hidden", minWidth: 160,
          }}
        >
          <button
            style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, color: darkMode ? "#CBD5E1" : "#334155", background: "transparent", border: "none", borderBottom: `1px solid ${sep}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => handleDuplicate(contextMenu.pageId)}
            disabled={duplicating === contextMenu.pageId}
          >
            {duplicating === contextMenu.pageId ? "Duplicating…" : "⧉  Duplicate page"}
          </button>

          <button
            style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, color: darkMode ? "#CBD5E1" : "#334155", background: "transparent", border: "none", borderBottom: `1px solid ${sep}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => {
              const page = pages.find((p) => p.id === contextMenu.pageId);
              if (!page) return;
              setContextMenu(null);
              setRenamingId(page.id);
              setRenameValue(page.title ?? `Page ${page.page_index + 1}`);
            }}
          >
            ✏️  Rename
          </button>

          {pages.length > 1 && (
            <button
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#ef4444", background: "transparent", border: "none", borderBottom: `1px solid ${sep}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => { handleDeletePage(contextMenu.pageId); setContextMenu(null); }}
            >
              🗑️  Delete page
            </button>
          )}

          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: dim, marginBottom: 6 }}>Page color</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {PAGE_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  style={{
                    width: 18, height: 18, borderRadius: 999, cursor: "pointer",
                    border: `2px solid ${(pages.find((p) => p.id === contextMenu.pageId)?.data_json?.color ?? "") === c.value ? (darkMode ? "#00E5FF" : "#0284C7") : "transparent"}`,
                    background: c.value
                      ? c.value
                      : (darkMode ? "repeating-conic-gradient(rgba(148,184,255,0.15) 0% 25%, rgba(255,255,255,0.03) 0% 50%) 0 0 / 8px 8px" : "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 8px 8px"),
                  }}
                  onClick={() => setPageColor(contextMenu.pageId, c.value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
