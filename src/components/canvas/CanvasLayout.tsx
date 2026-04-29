"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FiberCanvas from "./FiberCanvas";
import { PageSidebar } from "./PageSidebar";
import { BedsheetGrid } from "./BedsheetGrid";
import { createPage } from "@/lib/actions/pages";
import { useCanvasStore } from "@/store/canvasStore";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type PageHeader = { nodeName?: string; address?: string; description?: string };

type Page = {
  id: string;
  page_index: number;
  title: string | null;
  data_json?: { color?: string; header?: PageHeader } | null;
};

type Bedsheet = {
  id: string;
  name: string;
};

type Props = {
  bedsheet: Bedsheet;
  initialPages: Page[];
  userName?: string | null;
  userEmail?: string | null;
};

function useThemeStyles(darkMode: boolean) {
  return {
    appBar: {
      height: 52, flexShrink: 0,
      background: darkMode ? "linear-gradient(180deg, #0A0F1A, #070B14)" : "linear-gradient(180deg, #FAFBFD, #F2F5F9)",
      borderBottom: darkMode ? "1px solid rgba(148,184,255,0.10)" : "1px solid rgba(15,23,42,0.10)",
      display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
      position: "relative", zIndex: 30,
    } as React.CSSProperties,
    divider: {
      width: 1, height: 22,
      background: darkMode ? "rgba(148,184,255,0.14)" : "rgba(15,23,42,0.12)",
      flexShrink: 0,
    },
    breadcrumbSep: {
      color: darkMode ? "#3B4A66" : "#94A3B8",
      margin: "0 2px", fontFamily: "var(--font-geist-mono)", fontSize: 11,
    },
    viewSwitch: {
      display: "inline-flex",
      background: darkMode ? "rgba(148,184,255,0.06)" : "rgba(15,23,42,0.04)",
      border: darkMode ? "1px solid rgba(148,184,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
      borderRadius: 7, padding: 2, gap: 2,
    },
  };
}

function ViewBtn({ label, active, onClick, darkMode }: { label: string; active: boolean; onClick: () => void; darkMode: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active
          ? (darkMode ? "linear-gradient(180deg, #1A2438, #121A2B)" : "linear-gradient(180deg, #FFFFFF, #F1F5F9)")
          : "transparent",
        color: active ? (darkMode ? "#F1F5F9" : "#0F172A") : (darkMode ? "#94A3B8" : "#64748B"),
        border: "none", padding: "4px 12px", borderRadius: 5, cursor: "pointer",
        fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        boxShadow: active
          ? (darkMode
              ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,229,255,0.18)"
              : "0 1px 3px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.08)")
          : "none",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}

/* Pulsing status dot */
function SyncDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 6, height: 6 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: 999, background: "#3DF5A3",
        opacity: 0.5, animation: "fmPulse 2s cubic-bezier(0,0,0.2,1) infinite",
      }} />
      <span style={{
        position: "relative", width: 6, height: 6, borderRadius: 999, background: "#3DF5A3",
        boxShadow: "0 0 6px #3DF5A3",
      }} />
    </span>
  );
}

/* Minimal text button */
function AppBarBtn({ children, onClick, variant = "ghost", darkMode }: {
  children: React.ReactNode; onClick?: () => void; variant?: "ghost" | "primary"; darkMode: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "0 12px", height: 28, borderRadius: 6,
        fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        cursor: "pointer", border: "1px solid",
        background: variant === "primary"
          ? "linear-gradient(180deg, #22EEFF 0%, #00C8E0 100%)"
          : "transparent",
        color: variant === "primary" ? "#041018" : (darkMode ? "#CBD5E1" : "#475569"),
        borderColor: variant === "primary"
          ? "rgba(0,229,255,0.4)"
          : (darkMode ? "rgba(148,184,255,0.18)" : "rgba(15,23,42,0.16)"),
        boxShadow: variant === "primary"
          ? "0 0 0 1px rgba(0,229,255,0.2), 0 4px 12px rgba(0,229,255,0.2)"
          : "none",
        transition: "all 120ms",
      }}
    >
      {children}
    </button>
  );
}

function UserMenu({
  userName, userEmail, darkMode,
}: { userName?: string | null; userEmail?: string | null; darkMode: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayName = userName || userEmail;
  const initial = displayName ? displayName[0].toUpperCase() : "?";

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        title={userEmail ?? undefined}
        style={{
          width: 26, height: 26, borderRadius: 999,
          background: open
            ? "linear-gradient(135deg, #3DF5A3, #00E5FF)"
            : "linear-gradient(135deg, #00E5FF, #3DF5A3)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#05070C", fontWeight: 700, fontSize: 10,
          boxShadow: darkMode ? "0 0 0 2px #0A0F1A, 0 0 10px rgba(0,229,255,0.35)" : "0 0 0 2px #F0F4F8",
          cursor: "pointer", userSelect: "none",
        }}
      >
        {initial}
      </div>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 34, zIndex: 200,
          background: "linear-gradient(180deg, #111827, #0D1525)",
          border: "1px solid rgba(148,184,255,0.18)", borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.06)",
          minWidth: 220, overflow: "hidden",
        }}>
          {/* User info header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(148,184,255,0.10)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 999,
                background: "linear-gradient(135deg, #00E5FF, #3DF5A3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#05070C", fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "#F1F5F9",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {userEmail ?? "—"}
                </div>
                {userName && (
                  <div style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9.5, color: "#64748B", marginTop: 1, letterSpacing: "0.04em" }}>
                    {userName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: "6px 0" }}>
            <button
              onClick={() => { setOpen(false); handleSignOut(); }}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                width: "100%", padding: "10px 16px", background: "transparent", border: "none",
                color: "#F87171", fontFamily: "inherit", fontSize: 12.5, cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CanvasLayout({ bedsheet, initialPages, userName, userEmail }: Props) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [currentPageId, setCurrentPageId] = useState(initialPages[0].id);
  const [activeHeader, setActiveHeader] = useState<PageHeader>(
    initialPages[0]?.data_json?.header ?? {}
  );
  const [viewMode, setViewMode] = useState<"canvas" | "grid">("canvas");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const darkMode = useCanvasStore((s) => s.darkMode);
  const setExportOpen = useCanvasStore((s) => s.setExportOpen);
  const setImportOpen = useCanvasStore((s) => s.setImportOpen);
  const S = useThemeStyles(darkMode);

  function handleShare() {
    const url = `${window.location.origin}/view/${bedsheet.id}?page=${currentPageId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard", { description: "Anyone with this link can view this page." });
    }).catch(() => {
      setShareOpen(true);
    });
  }

  const currentPage = pages.find((p) => p.id === currentPageId);

  function handlePageChange(pageId: string) {
    setCurrentPageId(pageId);
    const p = pages.find((pg) => pg.id === pageId);
    setActiveHeader(p?.data_json?.header ?? {});
  }

  function handleGridPageSelect(pageId: string) {
    handlePageChange(pageId);
    setViewMode("canvas");
  }

  async function handleGridAddPage() {
    const nextIndex = pages.length;
    const newPage = await createPage(bedsheet.id, nextIndex, `Page ${nextIndex + 1}`);
    const updated = [...pages, { ...newPage, data_json: null }];
    setPages(updated);
    handlePageChange(newPage.id);
    setViewMode("canvas");
  }

  const currentPageLabel = currentPage?.title ?? `Page ${(currentPage?.page_index ?? 0) + 1}`;

  return (
    <div className="w-screen h-screen flex flex-col">
      {/* ── Premium AppBar ── */}
      <header style={S.appBar}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <svg width={22} height={22} viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="100" y2="100">
                <stop offset="0" stopColor="#22EEFF"/>
                <stop offset="0.5" stopColor="#00E5FF"/>
                <stop offset="1" stopColor="#3DF5A3"/>
              </linearGradient>
            </defs>
            <path d="M62 18 L36 18 C30 18 26 22 26 28 L26 82 L42 82 L42 58 L58 58 L58 44 L42 44 L42 34 L62 34 Z" fill="url(#logoGrad)"/>
            <path d="M62 58 L62 82 C62 88 58 92 52 92 L36 92" stroke="url(#logoGrad)" strokeWidth="8" fill="none" strokeLinecap="round"/>
          </svg>
          <div style={{ fontFamily: "var(--font-geist-sans, system-ui)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: darkMode ? "#F1F5F9" : "#0F172A", lineHeight: 1 }}>
            SPLICE<span style={{ color: "#00E5FF" }}>FORGE</span>
          </div>
        </div>

        {/* Sidebar toggle — visible on tablet */}
        <button
          className="lg:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer",
            background: sidebarOpen
              ? (darkMode ? "rgba(0,229,255,0.12)" : "rgba(15,23,42,0.08)")
              : "transparent",
            color: darkMode ? "#94A3B8" : "#64748B",
            flexShrink: 0,
          }}
          title={sidebarOpen ? "Hide pages" : "Show pages"}
          aria-label="Toggle sidebar"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
          </svg>
        </button>

        <div style={S.divider} />

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11, gap: 0, minWidth: 0, overflow: "hidden" }}>
          <Link
            href="/dashboard"
            style={{ color: darkMode ? "#64748B" : "#94A3B8", textDecoration: "none", transition: "color 120ms" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = darkMode ? "#94A3B8" : "#64748B")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = darkMode ? "#64748B" : "#94A3B8")}
          >
            Projects
          </Link>
          <span style={S.breadcrumbSep}>/</span>
          <span style={{ color: darkMode ? "#94A3B8" : "#64748B", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bedsheet.name}
          </span>
          {viewMode === "canvas" && (
            <>
              <span style={S.breadcrumbSep}>/</span>
              <span style={{ color: darkMode ? "#F1F5F9" : "#0F172A", fontWeight: 600, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentPageLabel}
              </span>
              {/* Active page header metadata */}
              {(activeHeader.nodeName || activeHeader.address) && (
                <>
                  <span style={S.breadcrumbSep}>·</span>
                  {currentPage?.data_json?.color && (
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: currentPage.data_json.color, display: "inline-block", marginRight: 4 }} />
                  )}
                  {activeHeader.nodeName && (
                    <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{activeHeader.nodeName}</span>
                  )}
                  {activeHeader.address && (
                    <span style={{ color: "#64748B", marginLeft: 4 }}>{activeHeader.address}</span>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        <div style={{ flex: 1 }} />

        {/* View switcher */}
        <div style={S.viewSwitch}>
          <ViewBtn label="Canvas" active={viewMode === "canvas"} onClick={() => setViewMode("canvas")} darkMode={darkMode} />
          <ViewBtn label="Grid" active={viewMode === "grid"} onClick={() => setViewMode("grid")} darkMode={darkMode} />
        </div>

        {/* Sync indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: darkMode ? "#64748B" : "#94A3B8", letterSpacing: "0.04em", flexShrink: 0 }}>
          <SyncDot />
          <span>{pages.length} page{pages.length !== 1 ? "s" : ""}</span>
        </div>

        <div style={S.divider} />

        <AppBarBtn darkMode={darkMode} onClick={handleShare}>Share</AppBarBtn>
        <AppBarBtn darkMode={darkMode} onClick={() => setImportOpen(true)}>Import</AppBarBtn>
        <AppBarBtn variant="primary" darkMode={darkMode} onClick={() => setExportOpen(true)}>Export</AppBarBtn>

        <UserMenu userName={userName} userEmail={userEmail} darkMode={darkMode} />
      </header>

      {/* Share fallback dialog (shown when clipboard API is unavailable) */}
      {shareOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: darkMode ? "#0A0F1A" : "#fff",
              border: darkMode ? "1px solid rgba(148,184,255,0.18)" : "1px solid rgba(15,23,42,0.12)",
              borderRadius: 12, padding: 24, width: 380,
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 14, color: darkMode ? "#F1F5F9" : "#0F172A", marginBottom: 12 }}>
              Share view-only link
            </p>
            <input
              readOnly
              value={`${window.location.origin}/view/${bedsheet.id}?page=${currentPageId}`}
              onFocus={(e) => e.target.select()}
              style={{
                width: "100%", background: darkMode ? "#161F30" : "#F1F5F9",
                border: "1px solid rgba(148,184,255,0.18)", borderRadius: 6,
                padding: "6px 10px", fontSize: 12, color: darkMode ? "#CBD5E1" : "#334155",
                fontFamily: "var(--font-geist-mono, monospace)", outline: "none", boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 11, color: darkMode ? "#64748B" : "#94A3B8", marginTop: 8 }}>
              Anyone with this link can view this page in read-only mode.
            </p>
            <button
              onClick={() => setShareOpen(false)}
              style={{
                marginTop: 16, padding: "6px 16px", borderRadius: 6, border: "none",
                background: darkMode ? "rgba(148,184,255,0.1)" : "rgba(15,23,42,0.06)",
                color: darkMode ? "#CBD5E1" : "#475569", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
              }}
            >Close</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — always visible on desktop (lg+), toggleable on tablet */}
        {viewMode === "canvas" && sidebarOpen && (
          <>
            {/* Tap-outside overlay on tablet */}
            <div
              className="fixed inset-0 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-30 lg:z-auto lg:relative">
              <PageSidebar
                bedsheetId={bedsheet.id}
                pages={pages}
                currentPageId={currentPageId}
                onPageChange={(id) => { handlePageChange(id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                onPagesChange={setPages}
                onHeaderChange={setActiveHeader}
              />
            </div>
          </>
        )}
        {/* Desktop sidebar toggle when closed */}
        {viewMode === "canvas" && !sidebarOpen && (
          <button
            className="hidden lg:flex"
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 20, alignItems: "center", justifyContent: "center",
              background: darkMode ? "rgba(148,184,255,0.05)" : "rgba(15,23,42,0.04)",
              borderRight: darkMode ? "1px solid rgba(148,184,255,0.10)" : "1px solid rgba(15,23,42,0.10)",
              color: darkMode ? "#475569" : "#94A3B8", cursor: "pointer", border: "none",
              flexShrink: 0,
            }}
            title="Show pages"
          >▶</button>
        )}
        <div className="flex-1 overflow-hidden min-w-0">
          {viewMode === "grid" ? (
            <BedsheetGrid
              pages={pages}
              currentPageId={currentPageId}
              onPageSelect={handleGridPageSelect}
              onAddPage={handleGridAddPage}
            />
          ) : (
            <FiberCanvas
              pageId={currentPageId}
              bedsheetId={bedsheet.id}
              pages={pages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
