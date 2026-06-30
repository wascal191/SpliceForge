"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import { getBedsheets, createBedsheet, renameBedsheet, deleteBedsheet } from "@/lib/actions/bedsheets";
import { getOrgMembers, updateMemberRole, removeMember, type OrgMember } from "@/lib/actions/organizations";
import { createInviteToken, getInviteToken, revokeInviteToken } from "@/lib/actions/invites";

// Local UI shape: only the freshly-created invite carries the raw token.
// Once a session reloads, the API only returns metadata (the token hash is
// not reversible), so the UI shows a "regenerate to copy" affordance.
type InviteUI = {
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  token?: string;
};
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NewProjectWizard } from "@/components/dashboard/NewProjectWizard";
import { LocaleSwitcher } from "@/components/locale-switcher";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Bedsheet = {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
};

type DashIconName =
  | "grid" | "history" | "users" | "folder" | "bell" | "search" | "filter"
  | "pencil" | "link" | "plus" | "download" | "dots" | "share" | "cable"
  | "arrow" | "check" | "trash" | "edit";

function FMIcon({ name, size = 16, color = "currentColor", strokeWidth = 1.8 }: { name: DashIconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {name === "grid" && (<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>)}
      {name === "history" && (<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.79" /></>)}
      {name === "users" && (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>)}
      {name === "folder" && <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />}
      {name === "bell" && (<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>)}
      {name === "search" && (<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>)}
      {name === "filter" && <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />}
      {name === "pencil" && (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>)}
      {name === "link" && (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>)}
      {name === "plus" && (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
      {name === "download" && (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>)}
      {name === "dots" && (<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>)}
      {name === "share" && (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>)}
      {name === "cable" && <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" />}
      {name === "arrow" && (<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>)}
      {name === "check" && <polyline points="20 6 9 17 4 12" />}
      {name === "trash" && (<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>)}
      {name === "edit" && (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>)}
    </svg>
  );
}

function FMLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="12" r="1.5" fill="#00E5FF" />
        <circle cx="22" cy="12" r="1.5" fill="#3DF5A3" />
      </svg>
      <span style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "#F1F5F9", letterSpacing: "-0.02em" }}>SpliceForge</span>
    </div>
  );
}

function FMBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const colors: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
    ok:   { bg: "rgba(0,229,255,0.1)",    border: "rgba(0,229,255,0.3)",    text: "#00E5FF", glow: "0 0 8px rgba(0,229,255,0.3)" },
    warn: { bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.3)",   text: "#F59E0B" },
    live: { bg: "rgba(61,245,163,0.1)",   border: "rgba(61,245,163,0.3)",   text: "#3DF5A3", glow: "0 0 8px rgba(61,245,163,0.3)" },
    idle: { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)", text: "#64748B" },
  };
  const c = colors[tone] ?? colors.idle;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: FM, fontSize: 9.5, letterSpacing: "0.06em", fontWeight: 600,
      padding: "2px 8px", borderRadius: 999, boxShadow: c.glow,
    }}>
      {(tone === "ok" || tone === "live") && (
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.text, boxShadow: `0 0 4px ${c.text}` }} />
      )}
      {children}
    </span>
  );
}

const NAV_ITEM_ICONS: { icon: DashIconName; key: "projects" | "recent" | "team" | "templates" }[] = [
  { icon: "grid",    key: "projects" },
  { icon: "history", key: "recent" },
  { icon: "users",   key: "team" },
  { icon: "folder",  key: "templates" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getProjectColor(id: string) {
  const colors = ["#00E5FF", "#3DF5A3", "#F59E0B", "#C4A7FF", "#F87171", "#4F46E5"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

function MiniPreview({ id, color }: { id: string; color: string }) {
  const rects = [
    { x: 8,  y: 12, w: 16, h: 40 },
    { x: 38, y: 18, w: 14, h: 14 },
    { x: 38, y: 38, w: 14, h: 10 },
    { x: 66, y: 16, w: 18, h: 16 },
  ];
  const nodeColors = ["#0070C0", "#F59E0B", "#A855F7", "#3DF5A3"];
  return (
    <div style={{
      width: 90, height: 60, borderRadius: 7, flexShrink: 0, marginLeft: 6,
      background: "#0A0F1A", border: "1px solid rgba(148,184,255,0.12)",
      backgroundImage: "linear-gradient(rgba(148,184,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,255,0.04) 1px, transparent 1px)",
      backgroundSize: "10px 10px", overflow: "hidden", position: "relative",
    }}>
      <svg viewBox="0 0 90 60" width="90" height="60" style={{ position: "absolute", inset: 0 }}>
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={nodeColors[i % nodeColors.length]} opacity="0.75" rx="1.5" />
        ))}
        <path d={`M ${rects[0].x + rects[0].w} ${rects[0].y + rects[0].h / 2} Q 45 ${rects[0].y + rects[0].h / 2}, ${rects[1].x} ${rects[1].y + rects[1].h / 2}`} stroke={color} strokeWidth="0.7" fill="none" opacity="0.7" />
      </svg>
    </div>
  );
}

// 3-dots dropdown
function ProjectMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations("dashboard.projects.menu");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          width: 28, height: 28, border: "1px solid rgba(148,184,255,0.16)",
          borderRadius: 6, background: open ? "rgba(0,229,255,0.08)" : "transparent",
          color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <FMIcon name="dots" size={12} color={open ? "#00E5FF" : "#64748B"} />
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 34, zIndex: 100,
          background: "linear-gradient(180deg, #111827, #0D1525)",
          border: "1px solid rgba(148,184,255,0.18)", borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,255,0.06)",
          overflow: "hidden", minWidth: 148,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              width: "100%", padding: "10px 14px", background: "transparent", border: "none",
              color: "#CBD5E1", fontFamily: F, fontSize: 12.5, cursor: "pointer",
              borderBottom: "1px solid rgba(148,184,255,0.08)",
            }}
          >
            <FMIcon name="edit" size={13} color="#94A3B8" /> {t("renameEdit")}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              width: "100%", padding: "10px 14px", background: "transparent", border: "none",
              color: "#F87171", fontFamily: F, fontSize: 12.5, cursor: "pointer",
            }}
          >
            <FMIcon name="trash" size={13} color="#F87171" /> {t("deleteProject")}
          </button>
        </div>
      )}
    </div>
  );
}

function UserMenu({
  userEmail,
  userName,
  organization,
}: {
  userEmail: string | null;
  userName: string | null;
  organization: { id: string; name: string } | null;
}) {
  const t = useTranslations("dashboard.team");
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
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        title={userEmail ?? ""}
        style={{
          width: 30, height: 30, borderRadius: 999,
          background: open
            ? "linear-gradient(135deg, #3DF5A3, #00E5FF)"
            : "linear-gradient(135deg, #00E5FF, #3DF5A3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 12,
          boxShadow: "0 0 0 2px #0A0F1A, 0 0 14px rgba(0,229,255,0.35)",
          cursor: "pointer",
        }}
      >
        {initial}
      </div>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 38, zIndex: 200,
          background: "linear-gradient(180deg, #111827, #0D1525)",
          border: "1px solid rgba(148,184,255,0.18)", borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.06)",
          minWidth: 220, overflow: "hidden",
        }}>
          {/* User / org info header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(148,184,255,0.10)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 999,
                background: "linear-gradient(135deg, #00E5FF, #3DF5A3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: F, fontSize: 12.5, fontWeight: 600, color: "#F1F5F9",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {userEmail ?? "—"}
                </div>
                <div style={{ fontFamily: FM, fontSize: 9.5, color: "#64748B", marginTop: 1, letterSpacing: "0.04em" }}>
                  {organization?.name ?? t("noOrganization")}
                </div>
              </div>
            </div>
          </div>

          <LocaleSwitcher />

          {/* Actions */}
          <div style={{ padding: "6px 0" }}>
            <button
              onClick={() => { setOpen(false); handleSignOut(); }}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                width: "100%", padding: "10px 16px", background: "transparent", border: "none",
                color: "#F87171", fontFamily: F, fontSize: 12.5, cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatFibers(n: number) {
  if (n === 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function DashboardClient({
  initialProjects,
  totalFibers,
  totalCables,
  userEmail,
  userName,
  organization,
  currentUserRole,
}: {
  initialProjects: Project[];
  totalFibers: number;
  totalCables: number;
  userEmail: string | null;
  userName: string | null;
  organization: { id: string; name: string } | null;
  currentUserRole: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  // create wizard
  const [dialogOpen, setDialogOpen] = useState(false);

  // edit dialog
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [openingId, setOpeningId] = useState<string | null>(null);

  // view
  const [activeView, setActiveView] = useState<"projects" | "team">("projects");

  // team view state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invite, setInvite] = useState<InviteUI | null | "none">("none");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // sheets panel state
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [sheetsMap, setSheetsMap] = useState<Record<string, Bedsheet[]>>({});
  const [loadingSheets, setLoadingSheets] = useState<string | null>(null);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameSheetValue, setRenameSheetValue] = useState("");
  const [addingSheet, setAddingSheet] = useState<string | null>(null);

  const filtered = initialProjects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm(t("projects.deleteConfirm"))) return;
    try {
      await deleteProject(id);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function openEdit(project: Project) {
    setEditProject(project);
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject || !editName.trim()) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateProject(editProject.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditProject(null);
      router.refresh();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function openProject(projectId: string) {
    if (openingId) return;
    setOpeningId(projectId);
    try {
      const bedsheets = await getBedsheets(projectId);
      if (bedsheets.length > 0) {
        router.push(`/canvas/${bedsheets[0].id}`);
      } else {
        const bs = await createBedsheet(projectId, "Sheet 1");
        router.push(`/canvas/${bs.id}`);
      }
    } catch (err) {
      alert((err as Error).message);
      setOpeningId(null);
    }
  }

  async function toggleSheets(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    if (!sheetsMap[projectId]) {
      setLoadingSheets(projectId);
      try {
        const data = await getBedsheets(projectId);
        setSheetsMap(prev => ({ ...prev, [projectId]: data }));
      } finally {
        setLoadingSheets(null);
      }
    }
  }

  async function handleAddSheet(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    setAddingSheet(projectId);
    try {
      const sheets = sheetsMap[projectId] ?? [];
      const newSheet = await createBedsheet(projectId, `Sheet ${sheets.length + 1}`);
      setSheetsMap(prev => ({ ...prev, [projectId]: [...(prev[projectId] ?? []), newSheet] }));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAddingSheet(null);
    }
  }

  async function handleRenameSheet(id: string, projectId: string) {
    if (!renameSheetValue.trim()) { setRenamingSheetId(null); return; }
    try {
      await renameBedsheet(id, renameSheetValue.trim());
      setSheetsMap(prev => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map(s =>
          s.id === id ? { ...s, name: renameSheetValue.trim() } : s
        ),
      }));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRenamingSheetId(null);
    }
  }

  async function handleDeleteSheet(e: React.MouseEvent, id: string, projectId: string) {
    e.stopPropagation();
    try {
      await deleteBedsheet(id);
      setSheetsMap(prev => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).filter(s => s.id !== id),
      }));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function loadTeam() {
    setMembersLoading(true);
    setTeamError(null);
    try {
      const [m, inv] = await Promise.all([getOrgMembers(), getInviteToken()]);
      setMembers(m);
      setInvite(inv ?? null);
    } catch (err) {
      setTeamError((err as Error).message);
    } finally {
      setMembersLoading(false);
    }
  }

  function openTeamView() {
    setActiveView("team");
    if (members.length === 0) loadTeam();
  }

  async function handleGenerateInvite() {
    setInviteLoading(true);
    setTeamError(null);
    try {
      const inv = await createInviteToken();
      setInvite(inv);
    } catch (err) {
      setTeamError((err as Error).message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevokeInvite() {
    setInviteLoading(true);
    try {
      await revokeInviteToken();
      setInvite(null);
    } catch (err) {
      setTeamError((err as Error).message);
    } finally {
      setInviteLoading(false);
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRoleChange(memberId: string, role: string) {
    try {
      await updateMemberRole(memberId, role);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
    } catch (err) {
      setTeamError((err as Error).message);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await removeMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      setTeamError((err as Error).message);
    }
  }

  const isOwner = currentUserRole === "owner";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const recentProjects = initialProjects.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#05070C", overflow: "hidden", fontFamily: F }}>
      {/* Topbar */}
      <div style={{
        height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
        background: "linear-gradient(180deg, rgba(8,13,24,0.97), rgba(6,10,18,0.99))",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(148,184,255,0.10)",
        zIndex: 30,
        boxShadow: "0 1px 0 rgba(0,229,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <FMLogo />
          <div style={{ width: 1, height: 18, background: "rgba(148,184,255,0.18)" }} />
          <span style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.04em", color: "#64748B" }}>{t("topbar.workspace")}</span>
          <span style={{ color: "#3B4A66", fontSize: 13 }}>/</span>
          <span style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.04em", color: "#F1F5F9", fontWeight: 600 }}>{t("topbar.projects")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setDialogOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
              color: "#05070C", fontSize: 12, fontFamily: F, fontWeight: 700,
              padding: "6px 14px", borderRadius: 7, cursor: "pointer", border: "none",
              boxShadow: "0 0 0 1px rgba(0,229,255,0.35), 0 4px 12px rgba(0,229,255,0.25)",
            }}
          >
            <FMIcon name="plus" size={12} color="#05070C" strokeWidth={2.5} /> {t("topbar.newProject")}
          </button>
          <div style={{ width: 1, height: 18, background: "rgba(148,184,255,0.14)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3DF5A3", boxShadow: "0 0 4px #3DF5A3" }} />
            <span style={{ fontFamily: FM, fontSize: 10, color: "#64748B", letterSpacing: "0.04em" }}>{t("topbar.synced")}</span>
          </div>
          <button style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer", padding: 4 }}>
            <FMIcon name="bell" size={15} color="#64748B" />
          </button>
          <UserMenu userEmail={userEmail} userName={userName} organization={organization} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left nav */}
        <div style={{
          width: 220, flexShrink: 0,
          background: "linear-gradient(180deg, #080D18, #060A12)",
          borderRight: "1px solid rgba(148,184,255,0.08)",
          display: "flex", flexDirection: "column", padding: "16px 12px",
        }}>
          <div style={{ padding: "8px 10px 12px", marginBottom: 4 }}>
            <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: "0.18em", color: "#64748B", marginBottom: 6, textTransform: "uppercase" }}>{t("nav.workspace")}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>{organization?.name ?? "My Workspace"}</div>
            <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 1 }}>
              {t("stats.projectsTotal", { count: initialProjects.length })}
            </div>
          </div>

          {NAV_ITEM_ICONS.map((item, i) => {
            const view = i === 0 ? "projects" : i === 2 ? "team" : null;
            const active = view ? activeView === view : false;
            return (
              <button key={i} onClick={() => {
                if (view === "projects") setActiveView("projects");
                else if (view === "team") openTeamView();
              }} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7,
                background: active ? "rgba(0,229,255,0.1)" : "transparent",
                border: `1px solid ${active ? "rgba(0,229,255,0.3)" : "transparent"}`,
                color: active ? "#00E5FF" : "#94A3B8",
                fontFamily: F, fontSize: 12.5, fontWeight: active ? 600 : 500,
                cursor: view ? "pointer" : "default", marginBottom: 2, textAlign: "left",
                boxShadow: active ? "0 0 12px rgba(0,229,255,0.12)" : "none",
              }}>
                <FMIcon name={item.icon} size={14} color={active ? "#00E5FF" : "#64748B"} />
                {t(`nav.${item.key}`)}
              </button>
            );
          })}

          <div style={{ margin: "12px 0", height: 1, background: "rgba(148,184,255,0.08)" }} />

          <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: "0.18em", color: "#64748B", padding: "0 10px", marginBottom: 8, textTransform: "uppercase" }}>{t("nav.recent")}</div>
          {recentProjects.length === 0 && (
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "#3B4A66", fontFamily: F }}>{t("nav.noProjects")}</div>
          )}
          {recentProjects.map((p) => {
            const color = getProjectColor(p.id);
            return (
              <div
                key={p.id}
                onClick={() => openProject(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 5, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FMIcon name="folder" size={10} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: "#CBD5E1", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 9.5, color: "#64748B", fontFamily: FM }}>{timeAgo(p.created_at)}</div>
                </div>
              </div>
            );
          })}

          <div style={{ flex: 1 }} />
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>

          {/* ── TEAM VIEW ── */}
          {activeView === "team" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: FM, fontSize: 9.5, letterSpacing: "0.22em", color: "#00E5FF", marginBottom: 6, textTransform: "uppercase" }}>{t("team.yourWorkspace")}</div>
                <h1 style={{ fontFamily: F, fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", color: "#F1F5F9", margin: 0 }}>{t("team.title")}</h1>
              </div>

              {teamError && (
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, padding: "10px 14px", fontFamily: F, fontSize: 12.5, color: "#F87171", marginBottom: 16 }}>
                  {teamError}
                </div>
              )}

              {/* Invite link section — owner only */}
              {isOwner && (
                <div style={{ background: "linear-gradient(180deg, rgba(15,22,36,0.9), rgba(10,15,26,0.7))", border: "1px solid rgba(148,184,255,0.12)", borderRadius: 12, padding: "20px 22px", marginBottom: 20 }}>
                  <div style={{ fontFamily: FM, fontSize: 9.5, letterSpacing: "0.16em", color: "#64748B", textTransform: "uppercase", marginBottom: 12 }}>{t("team.inviteLink")}</div>
                  {invite && invite !== "none" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {invite.token ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.14)", borderRadius: 7, padding: "8px 12px", fontFamily: FM, fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {typeof window !== "undefined" ? `${window.location.origin}/join/${invite.token}` : `/join/${invite.token}`}
                          </div>
                          <button
                            onClick={() => copyInviteLink(invite.token!)}
                            style={{ flexShrink: 0, height: 36, padding: "0 14px", background: copied ? "rgba(61,245,163,0.15)" : "rgba(0,229,255,0.1)", border: `1px solid ${copied ? "rgba(61,245,163,0.3)" : "rgba(0,229,255,0.25)"}`, borderRadius: 7, color: copied ? "#3DF5A3" : "#00E5FF", fontFamily: F, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                          >
                            {copied ? t("team.copied") : t("team.copy")}
                          </button>
                          <button
                            onClick={handleRevokeInvite}
                            disabled={inviteLoading}
                            style={{ flexShrink: 0, height: 36, padding: "0 12px", background: "transparent", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 7, color: "#F87171", fontFamily: F, fontSize: 12, cursor: "pointer" }}
                          >
                            {t("team.revoke")}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ fontFamily: F, fontSize: 12, color: "#64748B", margin: 0, flex: 1 }}>
                            {t("team.activeInviteExists")}
                          </p>
                          <button
                            onClick={handleGenerateInvite}
                            disabled={inviteLoading}
                            style={{ flexShrink: 0, height: 36, padding: "0 14px", background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: 7, color: "#00E5FF", fontFamily: F, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                          >
                            {inviteLoading ? "…" : t("team.regenerate")}
                          </button>
                          <button
                            onClick={handleRevokeInvite}
                            disabled={inviteLoading}
                            style={{ flexShrink: 0, height: 36, padding: "0 12px", background: "transparent", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 7, color: "#F87171", fontFamily: F, fontSize: 12, cursor: "pointer" }}
                          >
                            {t("team.revoke")}
                          </button>
                        </div>
                      )}
                      <p style={{ fontFamily: F, fontSize: 11.5, color: "#64748B", margin: 0 }}>
                        {t.rich("team.shareInviteHint", {
                          role: () => <strong style={{ color: "#CBD5E1" }}>{t("team.editor")}</strong>,
                          date: format.dateTime(new Date(invite.expires_at), { dateStyle: "medium" }),
                        })}
                      </p>
                    </div>
                  ) : invite === null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", margin: 0, flex: 1 }}>{t("team.noActiveInvite")}</p>
                      <button
                        onClick={handleGenerateInvite}
                        disabled={inviteLoading}
                        style={{ flexShrink: 0, height: 36, padding: "0 16px", background: "linear-gradient(135deg, #00C8E0, #00E5FF)", border: "none", borderRadius: 7, color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                      >
                        {inviteLoading ? t("team.generating") : t("team.generateLink")}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontFamily: FM, fontSize: 11, color: "#64748B" }}>{t("team.loading")}</div>
                  )}
                </div>
              )}

              {/* Members list */}
              <div style={{ background: "linear-gradient(180deg, rgba(15,22,36,0.9), rgba(10,15,26,0.7))", border: "1px solid rgba(148,184,255,0.12)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(148,184,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FM, fontSize: 9.5, letterSpacing: "0.16em", color: "#64748B", textTransform: "uppercase" }}>{t("team.members")} · {members.length}</span>
                  {!isOwner && <span style={{ fontFamily: FM, fontSize: 9.5, color: "#3B4A66", letterSpacing: "0.06em" }}>{t("team.viewOnly")}</span>}
                </div>

                {membersLoading ? (
                  <div style={{ padding: "24px 22px", fontFamily: FM, fontSize: 11, color: "#64748B" }}>{t("team.loadingMembers")}</div>
                ) : members.map((member) => {
                  const display = member.full_name || member.email || "Unknown";
                  const initial = display[0].toUpperCase();
                  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
                    owner:  { bg: "rgba(0,229,255,0.1)",   text: "#00E5FF", border: "rgba(0,229,255,0.3)"   },
                    editor: { bg: "rgba(61,245,163,0.08)", text: "#3DF5A3", border: "rgba(61,245,163,0.25)" },
                    viewer: { bg: "rgba(148,184,255,0.08)", text: "#94A3B8", border: "rgba(148,184,255,0.2)" },
                  };
                  const rc = roleColors[member.role] ?? roleColors.viewer;
                  const isSelf = member.email === userEmail;
                  return (
                    <div key={member.id} style={{ padding: "14px 22px", borderBottom: "1px solid rgba(148,184,255,0.06)", display: "flex", alignItems: "center", gap: 14 }}>
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #00C8E0, #3DF5A3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontWeight: 700, fontSize: 14, color: "#05070C", flexShrink: 0 }}>
                        {initial}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {member.full_name ?? member.email ?? "Unknown"}
                          </span>
                          {isSelf && <span style={{ fontFamily: FM, fontSize: 9, color: "#64748B", border: "1px solid rgba(148,184,255,0.2)", borderRadius: 4, padding: "1px 5px" }}>{t("team.you")}</span>}
                        </div>
                        {member.full_name && <div style={{ fontFamily: FM, fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</div>}
                      </div>
                      {/* Role */}
                      {isOwner && !isSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 6, padding: "4px 8px", color: rc.text, fontFamily: FM, fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", outline: "none" }}
                        >
                          <option value="owner">{t("team.roleOwner")}</option>
                          <option value="editor">{t("team.roleEditor")}</option>
                          <option value="viewer">{t("team.roleViewer")}</option>
                        </select>
                      ) : (
                        <span style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 6, padding: "4px 8px", color: rc.text, fontFamily: FM, fontSize: 10, letterSpacing: "0.06em" }}>
                          {member.role === "owner" ? t("team.roleOwner") : member.role === "editor" ? t("team.roleEditor") : t("team.roleViewer")}
                        </span>
                      )}
                      {/* Joined */}
                      <div style={{ fontFamily: FM, fontSize: 10, color: "#3B4A66", flexShrink: 0, width: 64, textAlign: "right" }}>
                        {timeAgo(member.created_at)}
                      </div>
                      {/* Remove */}
                      {isOwner && !isSelf && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          title={t("team.removeMember")}
                          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "#64748B", borderRadius: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
                        >
                          <FMIcon name="trash" size={13} color="#64748B" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PROJECTS VIEW ── */}
          {activeView === "projects" && <>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: FM, fontSize: 9.5, letterSpacing: "0.22em", color: "#00E5FF", marginBottom: 6, textTransform: "uppercase" }}>{t("projects.yourWorkspace")}</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <h1 style={{ fontFamily: F, fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", color: "#F1F5F9", margin: 0 }}>{t("projects.title")}</h1>
              <div style={{ fontFamily: FM, fontSize: 10.5, color: "#64748B", letterSpacing: "0.04em" }}>{t("projects.lastUpdated", { date: today })}</div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: t("stats.totalProjects"),  val: initialProjects.length,    icon: "folder" as DashIconName, color: "#00E5FF", sub: t("stats.projectsTotal", { count: initialProjects.length }) },
              { label: t("stats.totalFibers"),    val: formatFibers(totalFibers), icon: "cable" as DashIconName,  color: "#3DF5A3", sub: t("stats.acrossAllProjects") },
              { label: t("stats.totalCables"),    val: totalCables,               icon: "cable" as DashIconName,  color: "#FCD34D", sub: totalCables === 0 ? t("stats.noCablesYet") : t("stats.cableElements") },
              { label: t("stats.teamMembers"),    val: 1,                         icon: "users" as DashIconName,  color: "#C4A7FF", sub: t("stats.onlineNow") },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "16px 18px",
                background: "linear-gradient(180deg, rgba(15,22,36,0.9), rgba(10,15,26,0.7))",
                border: "1px solid rgba(148,184,255,0.12)", borderRadius: 12,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: "0.14em", color: "#64748B", textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${s.color}18`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FMIcon name={s.icon} size={13} color={s.color} />
                  </div>
                </div>
                <div style={{ fontFamily: F, fontSize: 28, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontFamily: FM, fontSize: 9.5, color: "#64748B", marginTop: 5 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <FMIcon name="search" size={13} color="#64748B" />
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("projects.searchPlaceholder")}
                style={{
                  width: "100%", height: 34, paddingLeft: 32, paddingRight: 12,
                  background: "rgba(15,22,36,0.8)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, color: "#F1F5F9", fontFamily: F, fontSize: 12.5,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "inline-flex", background: "rgba(148,184,255,0.06)", border: "1px solid rgba(148,184,255,0.12)", borderRadius: 8, padding: 2 }}>
              {(["all", "active", "draft"] as const).map((k) => {
                const labels = { all: t("projects.filter.all"), active: t("projects.filter.active"), draft: t("projects.filter.draft") };
                const active = filter === k;
                return (
                  <button key={k} onClick={() => setFilter(k)} style={{
                    background: active ? "linear-gradient(180deg, #1A2438, #121A2B)" : "transparent",
                    border: "none", padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                    color: active ? "#F1F5F9" : "#64748B",
                    fontFamily: F, fontSize: 11.5, fontWeight: active ? 600 : 500,
                    boxShadow: active ? "inset 0 0 0 1px rgba(0,229,255,0.2)" : "none",
                  }}>
                    {labels[k]}
                  </button>
                );
              })}
            </div>
            <button style={{ height: 34, padding: "0 14px", background: "rgba(148,184,255,0.06)", border: "1px solid rgba(148,184,255,0.14)", borderRadius: 8, color: "#94A3B8", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 12 }}>
              <FMIcon name="filter" size={12} color="#94A3B8" /> {t("projects.sort")}
            </button>
          </div>

          {/* Project cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((project) => {
              const color = getProjectColor(project.id);
              const isExpanded = expandedProjectId === project.id;
              const sheets = sheetsMap[project.id] ?? [];
              return (
                <div
                  key={project.id}
                  style={{
                    background: "linear-gradient(90deg, rgba(15,22,36,0.9), rgba(10,15,26,0.7))",
                    border: `1px solid ${openingId === project.id ? "rgba(0,229,255,0.35)" : isExpanded ? "rgba(0,229,255,0.2)" : "rgba(148,184,255,0.12)"}`,
                    borderRadius: 12, padding: "16px 18px",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.3)",
                    position: "relative", overflow: "visible",
                  }}
                >
                  <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 3, background: color, borderRadius: "0 2px 2px 0", boxShadow: `0 0 10px ${color}` }} />

                  {/* Top row — click to expand sheets */}
                  <div
                    onClick={(e) => toggleSheets(e, project.id)}
                    style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
                  >
                    <MiniPreview id={project.id} color={color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.01em" }}>{project.name}</div>
                        <FMBadge tone="ok">{t("projects.active")}</FMBadge>
                      </div>
                      {project.description && (
                        <div style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 8 }}>{project.description}</div>
                      )}
                      <div style={{ display: "flex", gap: 12, fontFamily: FM, fontSize: 10.5, color: "#64748B" }}>
                        <span>{t("projects.createdAgo")} <span style={{ color: "#CBD5E1" }}>{timeAgo(project.created_at)}</span></span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <div style={{ fontFamily: FM, fontSize: 10, color: "#64748B" }}>{timeAgo(project.created_at)}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 28, height: 28, border: "1px solid rgba(148,184,255,0.16)", borderRadius: 6, background: "transparent", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        >
                          <FMIcon name="share" size={12} color="#64748B" />
                        </button>
                        <div onClick={(e) => e.stopPropagation()}>
                          <ProjectMenu
                            onEdit={() => openEdit(project)}
                            onDelete={() => handleDelete(project.id)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sheets count + chevron */}
                  <div style={{
                    marginTop: 10, paddingTop: 8,
                    borderTop: "1px solid rgba(148,184,255,0.07)",
                    display: "flex", alignItems: "center", gap: 5,
                    fontFamily: FM, fontSize: 10, color: "#3B4A66",
                    pointerEvents: "none",
                  }}>
                    <FMIcon name="folder" size={10} color="#3B4A66" />
                    <span>{sheetsMap[project.id] !== undefined ? t("projects.sheetCount", { count: sheets.length }) : t("projects.sheets")}</span>
                    <span style={{ marginLeft: "auto", fontSize: 9 }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded sheets list */}
                  {isExpanded && (
                    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                      {loadingSheets === project.id ? (
                        <span style={{ fontFamily: FM, fontSize: 10, color: "#64748B", padding: "4px 8px", display: "block" }}>{t("team.loading")}</span>
                      ) : sheets.length === 0 ? (
                        <span style={{ fontFamily: FM, fontSize: 10, color: "#3B4A66", padding: "4px 8px", display: "block" }}>{t("projects.noSheetsYet")}</span>
                      ) : sheets.map((sheet) => (
                        <div
                          key={sheet.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "5px 8px", borderRadius: 6, marginBottom: 2,
                            background: "rgba(148,184,255,0.03)",
                            border: "1px solid transparent",
                          }}
                        >
                          {renamingSheetId === sheet.id ? (
                            <input
                              autoFocus
                              value={renameSheetValue}
                              onChange={(e) => setRenameSheetValue(e.target.value)}
                              onBlur={() => handleRenameSheet(sheet.id, project.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSheet(sheet.id, project.id);
                                if (e.key === "Escape") setRenamingSheetId(null);
                              }}
                              style={{
                                flex: 1, background: "rgba(148,184,255,0.08)",
                                border: "1px solid rgba(0,229,255,0.35)", borderRadius: 5,
                                padding: "3px 8px", color: "#F1F5F9",
                                fontFamily: F, fontSize: 12.5, outline: "none",
                              }}
                            />
                          ) : (
                            <button
                              onClick={() => router.push(`/canvas/${sheet.id}`)}
                              style={{
                                flex: 1, textAlign: "left", background: "transparent", border: "none",
                                color: "#CBD5E1", fontFamily: F, fontSize: 12.5, cursor: "pointer",
                                padding: "2px 4px", borderRadius: 4,
                              }}
                            >
                              {sheet.name}
                            </button>
                          )}
                          <button
                            onClick={() => { setRenamingSheetId(sheet.id); setRenameSheetValue(sheet.name); }}
                            title={tCommon("edit")}
                            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "#64748B", borderRadius: 4, display: "flex", alignItems: "center" }}
                          >
                            <FMIcon name="edit" size={11} color="#64748B" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSheet(e, sheet.id, project.id)}
                            title={tCommon("delete")}
                            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "#64748B", borderRadius: 4, display: "flex", alignItems: "center" }}
                          >
                            <FMIcon name="trash" size={11} color="#64748B" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={(e) => handleAddSheet(e, project.id)}
                        disabled={addingSheet === project.id}
                        style={{
                          marginTop: 6, display: "flex", alignItems: "center", gap: 5,
                          background: "transparent",
                          border: "1px dashed rgba(148,184,255,0.18)",
                          borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                          color: "#64748B", fontFamily: F, fontSize: 11.5,
                          opacity: addingSheet === project.id ? 0.5 : 1,
                        }}
                      >
                        <FMIcon name="plus" size={10} color="#64748B" />
                        {addingSheet === project.id ? t("projects.adding") : t("projects.newSheet")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* New project dashed card */}
            <div
              onClick={() => setDialogOpen(true)}
              style={{
                border: "1.5px dashed rgba(148,184,255,0.18)", borderRadius: 12, padding: "20px 18px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                background: "rgba(10,15,26,0.3)",
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(0,229,255,0.12)" }}>
                <FMIcon name="plus" size={20} color="#00E5FF" strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#94A3B8", fontFamily: F }}>{t("projects.newProjectTitle")}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, fontFamily: F }}>{t("projects.newProjectSubtitle")}</div>
              </div>
            </div>

            {filtered.length === 0 && initialProjects.length > 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B", fontFamily: F, fontSize: 13 }}>
                {t("projects.noProjectsMatchSearch")}
              </div>
            )}
          </div>
          </>}
        </div>
      </div>

      {/* Create wizard */}
      <NewProjectWizard open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Edit dialog */}
      <Dialog open={!!editProject} onOpenChange={(open) => { if (!open) setEditProject(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("projects.editTitle")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">{t("projects.name")}</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("projects.namePlaceholder")} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-desc">{t("projects.description")}</Label>
              <Input id="edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={t("projects.descriptionPlaceholder")} />
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditProject(null)}>{tCommon("cancel")}</Button>
              <Button type="submit" disabled={!editName.trim() || saving}>{saving ? t("projects.saving") : t("projects.saveChanges")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
