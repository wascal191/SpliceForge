import Link from "next/link";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

const GITHUB_URL = "https://github.com/wascal191/SpliceForge";

function FMLogo({ size = 24 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="12" r="1.5" fill="#00E5FF" />
        <circle cx="22" cy="12" r="1.5" fill="#3DF5A3" />
      </svg>
      <span style={{ fontFamily: F, fontWeight: 700, fontSize: Math.round(size * 0.65), color: "#F1F5F9", letterSpacing: "-0.02em" }}>
        SpliceForge
      </span>
    </div>
  );
}

type IconName = "cable" | "activity" | "layers" | "share" | "bolt" | "users" | "arrow" | "play" | "check" | "github" | "heart";

function FMIcon({ name, size = 16, color = "currentColor", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {name === "cable" && <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" />}
      {name === "activity" && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
      {name === "layers" && (
        <>
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </>
      )}
      {name === "share" && (
        <>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </>
      )}
      {name === "bolt" && <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
      {name === "users" && (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "arrow" && (
        <>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </>
      )}
      {name === "play" && <polygon points="5 3 19 12 5 21 5 3" />}
      {name === "check" && <polyline points="20 6 9 17 4 12" />}
      {name === "github" && (
        <path
          fill={color}
          stroke="none"
          d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.17a11.1 11.1 0 0 1 5.79 0c2.21-1.48 3.18-1.17 3.18-1.17.62 1.58.23 2.75.11 3.04.73.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.36-5.27 5.65.41.35.78 1.05.78 2.12v3.14c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
        />
      )}
      {name === "heart" && <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />}
    </svg>
  );
}

const FIBERS = [
  { d: "M -40 260 C 280 140, 560 380, 900 280 S 1300 320, 1480 240", c: "#00E5FF", w: 1.4, op: 0.5 },
  { d: "M -40 340 C 280 240, 560 460, 900 380 S 1300 410, 1480 340", c: "#3DF5A3", w: 1.2, op: 0.4 },
  { d: "M -40 420 C 260 340, 520 520, 860 470 S 1280 500, 1480 440", c: "#4F46E5", w: 1.0, op: 0.35 },
  { d: "M -40 180 C 300 100, 580 300, 880 220 S 1300 250, 1480 170", c: "#00E5FF", w: 0.8, op: 0.25 },
  { d: "M -40 510 C 270 420, 550 590, 870 540 S 1280 560, 1480 510", c: "#3DF5A3", w: 0.8, op: 0.2 },
];

const HIGHLIGHTS = [
  { val: "AGPL-3.0", label: "Open source" },
  { val: "Self-host", label: "Your data, your servers" },
  { val: "EN · ES · PT", label: "Localized UI" },
  { val: "EIA-598", label: "Standards-compliant" },
];

const FEATURES: { icon: IconName; color: string; title: string; body: string }[] = [
  { icon: "cable",    color: "#00E5FF", title: "EIA-598 Color Coding",  body: "Industry-standard 12-color fiber identification baked into every node. ABNT, Turkish, Dutch, French, and Ribbon also supported." },
  { icon: "activity", color: "#3DF5A3", title: "Live Trace Mode",       body: "Highlight any path end-to-end across splices, splitters, and drops with BFS-based tracing." },
  { icon: "layers",   color: "#C4A7FF", title: "Multi-page Bedsheets",  body: "Organize large builds across pages with cross-page continuation nodes and a grid overview." },
  { icon: "share",    color: "#FCD34D", title: "Export Anywhere",       body: "PDF, PNG, or XLSX — traced-path or full canvas. Import from XLSX, CSV, GeoJSON, and KMZ." },
  { icon: "bolt",     color: "#00E5FF", title: "Snap & Auto-route",     body: "Magnetic port snapping, curved auto-routing, undo/redo, copy/paste, and bulk splice keep diagrams clean." },
  { icon: "users",    color: "#3DF5A3", title: "Team-friendly",         body: "Organizations, roles, and invite tokens for when you're ready to collaborate. Optional — solo works great too." },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#05070C", color: "#F1F5F9" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 64,
        background: "linear-gradient(180deg, rgba(5,7,12,0.92), transparent)",
      }}>
        <FMLogo size={26} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/demo" style={{ background: "transparent", color: "#94A3B8", fontSize: 13, fontFamily: F, fontWeight: 500, padding: "6px 12px", borderRadius: 6, textDecoration: "none" }}>
            Demo
          </Link>
          <a href={`${GITHUB_URL}#documentation`} target="_blank" rel="noopener noreferrer" style={{ background: "transparent", color: "#94A3B8", fontSize: 13, fontFamily: F, fontWeight: 500, padding: "6px 12px", borderRadius: 6, textDecoration: "none" }}>
            Docs
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: "#94A3B8", fontSize: 13, fontFamily: F, fontWeight: 500, padding: "6px 12px", borderRadius: 6, textDecoration: "none" }}>
            <FMIcon name="github" size={14} color="#94A3B8" />
            GitHub
          </a>
          <div style={{ width: 1, height: 18, background: "rgba(148,184,255,0.18)", margin: "0 8px" }} />
          <Link href="/login" style={{ background: "transparent", color: "#94A3B8", fontSize: 13, fontFamily: F, fontWeight: 500, padding: "6px 14px", borderRadius: 6, textDecoration: "none" }}>
            Sign in
          </Link>
          <Link href="/demo" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
            color: "#05070C", fontSize: 12.5, fontFamily: F, fontWeight: 700,
            padding: "7px 16px", borderRadius: 8, textDecoration: "none",
            boxShadow: "0 0 0 1px rgba(0,229,255,0.4), 0 4px 16px rgba(0,229,255,0.3)",
          }}>
            Try the demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        position: "relative", minHeight: 620, paddingTop: 64,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        background: `
          radial-gradient(1000px 600px at 15% -5%, rgba(0,229,255,0.13), transparent 55%),
          radial-gradient(800px 500px at 90% 10%, rgba(79,70,229,0.16), transparent 55%),
          radial-gradient(600px 400px at 50% 130%, rgba(61,245,163,0.09), transparent 60%),
          #05070C`,
      }}>
        {/* dot grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(148,184,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

        {/* fiber lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice">
          <defs><filter id="heroGlow"><feGaussianBlur stdDeviation="3" /></filter></defs>
          {FIBERS.map((f, i) => (
            <g key={i}>
              <path d={f.d} stroke={f.c} strokeWidth={f.w * 4} fill="none" opacity={f.op * 0.4} filter="url(#heroGlow)" />
              <path d={f.d} stroke={f.c} strokeWidth={f.w} fill="none" opacity={f.op} />
            </g>
          ))}
        </svg>

        {/* vignette */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 40%, rgba(5,7,12,0.5) 100%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 820, padding: "80px 40px 60px" }}>
          {/* eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", marginBottom: 32,
            background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.28)", borderRadius: 999,
            boxShadow: "inset 0 0 20px rgba(0,229,255,0.06)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5FF", boxShadow: "0 0 6px #00E5FF" }} />
            <span style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00E5FF" }}>
              Now open source — AGPL-3.0
            </span>
            <span style={{ color: "#64748B", fontSize: 10 }}>→</span>
          </div>

          <h1 style={{
            fontFamily: F, fontSize: "clamp(48px, 7vw, 76px)", fontWeight: 700,
            letterSpacing: "-0.035em", lineHeight: 1.01, margin: 0,
            background: "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 30%, #00E5FF 65%, #3DF5A3 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            Trace every fiber.<br />Map every splice.
          </h1>

          <p style={{ marginTop: 24, fontSize: 17.5, color: "#CBD5E1", lineHeight: 1.6, maxWidth: 600, margin: "24px auto 0", fontFamily: F }}>
            An open-source canvas editor for fiber-optic networks. Design splice diagrams, trace paths through your plant, and export production-ready documentation — for ISPs, contractors, educators, and tinkerers.
          </p>

          <div style={{ marginTop: 40, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/demo" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
              color: "#05070C", fontSize: 14, fontFamily: F, fontWeight: 700,
              height: 44, padding: "0 24px", borderRadius: 10, textDecoration: "none",
              boxShadow: "0 0 0 1px rgba(0,229,255,0.4), 0 6px 32px rgba(0,229,255,0.3)",
            }}>
              <FMIcon name="play" size={14} color="#05070C" />
              Try the live demo
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,184,255,0.2)",
              color: "#F1F5F9", fontSize: 14, fontFamily: F, fontWeight: 600,
              height: 44, padding: "0 24px", borderRadius: 10, textDecoration: "none",
            }}>
              <FMIcon name="github" size={16} color="#F1F5F9" /> Star on GitHub
            </a>
          </div>

          <div style={{ marginTop: 44, display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
            {["No account needed to demo", "Self-hostable", "Your data stays yours"].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 16, height: 16, borderRadius: 999, background: "rgba(61,245,163,0.15)", border: "1px solid rgba(61,245,163,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FMIcon name="check" size={9} color="#3DF5A3" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 12.5, color: "#94A3B8", fontFamily: F }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highlights strip */}
      <div style={{
        borderTop: "1px solid rgba(148,184,255,0.10)", borderBottom: "1px solid rgba(148,184,255,0.10)",
        background: "linear-gradient(90deg, rgba(0,229,255,0.04), rgba(61,245,163,0.03), rgba(79,70,229,0.04))",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 40px",
      }}>
        {HIGHLIGHTS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 44px", gap: 4 }}>
              <div style={{ fontFamily: F, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #F1F5F9, #00E5FF)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                {s.val}
              </div>
              <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.16em", color: "#64748B", textTransform: "uppercase" }}>
                {s.label}
              </div>
            </div>
            {i < HIGHLIGHTS.length - 1 && <div style={{ width: 1, height: 36, background: "rgba(148,184,255,0.12)" }} />}
          </div>
        ))}
      </div>

      {/* Features grid */}
      <div style={{ padding: "56px 48px 64px", background: "linear-gradient(180deg, #05070C, #070B14)" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.22em", color: "#00E5FF", marginBottom: 10, textTransform: "uppercase" }}>What it does</div>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, letterSpacing: "-0.025em", color: "#F1F5F9", lineHeight: 1.1, margin: 0 }}>
            Built for the field.<br />
            <span style={{ background: "linear-gradient(90deg, #00E5FF, #3DF5A3)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Yours to modify.
            </span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding: "24px 22px",
              background: "linear-gradient(180deg, rgba(15,22,36,0.9), rgba(10,15,26,0.6))",
              border: "1px solid rgba(148,184,255,0.12)", borderRadius: 14,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.35)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 1, background: `linear-gradient(90deg, transparent, ${f.color}60, transparent)` }} />
              <div style={{
                width: 36, height: 36, borderRadius: 9, marginBottom: 16,
                background: `${f.color}18`, border: `1px solid ${f.color}35`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 16px ${f.color}20`,
              }}>
                <FMIcon name={f.icon} size={17} color={f.color} />
              </div>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#F1F5F9", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.55, fontFamily: F }}>{f.body}</div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center", marginTop: 56, paddingTop: 44, borderTop: "1px solid rgba(148,184,255,0.08)" }}>
          <h3 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Open source, made for the community.
          </h3>
          <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 22, fontFamily: F, maxWidth: 540, margin: "0 auto 22px", lineHeight: 1.6 }}>
            Released under AGPL-3.0. Use it, fork it, deploy it on your own infrastructure. Contributions, bug reports, and translations welcome.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/demo" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
              color: "#05070C", fontSize: 14, fontFamily: F, fontWeight: 700,
              height: 44, padding: "0 28px", borderRadius: 10, textDecoration: "none",
              boxShadow: "0 0 0 1px rgba(0,229,255,0.4), 0 8px 40px rgba(0,229,255,0.25)",
            }}>
              <FMIcon name="play" size={14} color="#05070C" />
              Open the demo
            </Link>
            <a href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,184,255,0.2)",
              color: "#F1F5F9", fontSize: 14, fontFamily: F, fontWeight: 600,
              height: 44, padding: "0 24px", borderRadius: 10, textDecoration: "none",
            }}>
              <FMIcon name="heart" size={14} color="#F87171" />
              Contribute
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
