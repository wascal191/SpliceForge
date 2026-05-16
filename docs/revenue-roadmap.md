# SpliceForge — 6-Month Revenue Sprint Roadmap

## Context

The market report identifies a real window: ~50K ISPs/contractors trapped in Excel/Visio/AutoCAD, Splice.me proving SMB demand (>2,500 paying ISPs), and IQGeo/VETRO leaving the mid-market unserved. SpliceForge already has the **hard** parts built — React Flow canvas, BFS trace, 6 color standards, bulk splice, PDF/PNG/XLSX/KMZ/GeoJSON export, multi-org RLS auth, **and GIS support (MapLibre + lat/lng + KMZ already exist — the report understates this)**.

The goal of this roadmap is **not** to close every gap in the SWOT. It's to fix the *revenue-blocking* weaknesses so a solo founder can ship the product into the mid-market within 6 months and start accumulating the social proof that closes the rest of the SWOT.

**What the report claims is missing but already exists** (verified in code): GIS / lat-long support, XLSX import, KMZ/GeoJSON export, dark mode, multi-org RLS, BFS trace. These need **polish and marketing**, not rebuilding.

**Real blockers for the 6-month sprint:**
1. No frictionless onboarding (templates, demo project, wizard) → kills trial-to-paid
2. No i18n → kills the LATAM/Turkey/NL angle the report leans on
3. No legacy import path → kills the "migrate from OSPInsight/Excel" sales pitch
4. No mobile-responsive view → field techs can't even *view* diagrams on phone
5. No billing/pricing implementation → no way to take money
6. No social proof / landing pages → zero brand, zero conversion

**Explicitly deferred** (not 6-month scope): native mobile app, public REST API, work-orders module, AutoCAD .dwg import, Supabase abstraction, AI-assisted trace, white-label.

---

## Sprint 1 — Month 1 · Onboarding & Templates

**Why first:** Trial→paid conversion is the #1 lever. The report's funnel assumes 4% trial→paid; without onboarding work it'll be <1%.

- **Demo project seeded for new orgs**: on signup, create a realistic FTTH access network so the user sees the BFS trace + bulk splice on their first login
- **3 starter templates**: (a) FTTH access network, (b) urban distribution ring, (c) contractor splice job (small)
- **Empty-state wizard** when creating a project: "Start blank / From template / Import from Excel"
- **Onboarding tooltips** (first session only) pointing at toolbar, trace, export
- **"Open demo without signup"** route — anonymous read-only canvas with the FTTH demo, for marketing share

Files to touch:
- New: `src/lib/templates/` with template JSON
- Touch: `src/lib/actions/projects.ts`, project creation flow
- New route: `app/demo/[slug]/page.tsx` for anonymous demo
- Touch: signup callback to seed demo

## Sprint 2 — Month 2 · i18n (ES + PT-BR)

**Why second:** The roadmap's Phase 3 (LATAM expansion) is impossible without ES/PT. ABNT color standard is already in code — the *only* gap blocking Brazil is the UI language. Quick unlock.

- Install `next-intl`, set up locale routing (`/en`, `/es`, `/pt`)
- Extract every UI string to message catalogs (use a one-pass codemod or grep-and-extract script)
- Translate ES (Spanish, neutral LATAM) and PT-BR (Brazilian Portuguese)
- Locale-aware PDF/XLSX export headers (dates, labels)
- Browser-language auto-detect on first visit; user override in profile
- Translate the marketing landing page (separate static pages)

Files to touch:
- New: `messages/en.json`, `messages/es.json`, `messages/pt.json`
- New: `src/middleware.ts` for locale negotiation
- Touch: every component with hardcoded strings — sweep `src/components/`
- Touch: export modules in `src/lib/` (PDF/XLSX header strings)

## Sprint 3 — Month 3 · Legacy Import

**Why third:** Removes the #1 sales objection ("but my data is in X"). The XLSX importer already exists — extend it.

- **Generic CSV importer** with column-mapping wizard (user maps their columns → SpliceForge schema)
- **OSPInsight export mapper**: research OSPInsight's standard export columns and ship a one-click preset
- **Splice.me migration**: if Splice.me offers JSON/CSV export, ship a one-click migration page
- **Improve XLSX importer error UX**: row-level errors, "fix and retry" instead of all-or-nothing
- **KMZ/GeoJSON *import*** (the export exists; reverse it for users with existing geo data)

Files to touch:
- Extend: existing XLSX import in `src/lib/import/`
- New: column-mapping wizard component
- New: preset mappers for OSPInsight / Splice.me
- New: `src/lib/import/kmz.ts`, `src/lib/import/geojson.ts`

## Sprint 4 — Month 4 · Mobile-Responsive Read View

**Why fourth:** Native mobile is out of scope solo. But a *read-only responsive web view* solves 80% of the field-tech pain at 5% of the cost.

- Read-only canvas route optimized for touch (`/m/projects/[id]`)
- Touch-friendly trace: tap a fiber port → highlight full path with color labels
- Splice port status updates from mobile (mark fiber as live/cut/test — minimal write surface)
- Larger touch targets, simplified toolbar
- PWA manifest + install prompt for "add to home screen"
- **Out of scope**: full canvas editing on mobile

Files to touch:
- New route: `app/m/projects/[id]/page.tsx`
- New: mobile-optimized canvas wrapper around the existing React Flow component
- Touch: `public/manifest.json`, service worker basics

## Sprint 5 — Month 5 · GIS Polish + Billing

**GIS polish** (already exists, needs to *look* differentiated vs Splice.me):
- Side-by-side map view + logical canvas view, with selection sync
- Cable path drawing on map (click waypoints)
- Snapshot the MapView in marketing screenshots and the demo video

**Billing** (so people can actually pay):
- Stripe integration with 4 tiers from the report: Free / Pro $49 / Team $149 / Business $349
- Seat-based billing on Pro, org-flat on Team/Business
- Self-serve upgrade flow, customer portal for invoices
- Plan enforcement: project limits, seat limits, feature flags per tier

Files to touch:
- Touch: `src/components/canvas/` + MapView component for sync
- New: `src/lib/billing/stripe.ts`
- New: `app/api/webhooks/stripe/route.ts`
- Touch: organization model to track `plan_tier` (column already exists in schema)

## Sprint 6 — Month 6 · Social Proof & GTM Hardening

**Why last:** The first 5 sprints generate the artifacts (working product, demo URL, screenshots, first 5–20 paying orgs) that this sprint converts into GTM.

- Public marketing site: home, pricing, "vs Splice.me", "vs Excel", "OSPInsight migration" comparison pages
- Case studies from the first paying customers (interviews → 2 written, 1 video)
- 5 SEO landing pages targeting buying-intent keywords from the report
- Public roadmap page (Canny or hand-rolled) — visible product velocity = trust
- Status page (uptime + incidents) — required for Business tier credibility
- Launch on Product Hunt, r/networking, r/telecom, WISPA forum, Brazilian ISP Telegram groups

Files to touch:
- New: marketing site (separate Next.js app or `/marketing/*` routes)
- New: comparison/SEO pages as MDX
- Third-party: BetterStack or similar for status page

---

## What gets explicitly deferred (and why)

| Weakness from report | Deferred until | Why |
|---|---|---|
| Native mobile app | Year 2 | Responsive PWA (Sprint 4) covers 80% of value at <10% effort |
| Public REST API | Year 2 | <50 customers don't yet need it; report's Phase 4 timeline agrees |
| Work-orders / field-ops | Year 2 | Adjacent market (Sitetracker/ServiceMax own it); partnership > build |
| AutoCAD .dwg import | Year 2 | Niche; CSV/XLSX/KMZ/GeoJSON covers majority |
| Supabase abstraction | Year 2 | Premature; nightly logical backup is enough risk mitigation now |
| AI-assisted trace | Year 3 | Report itself says Year 3 |

## Cross-cutting habits (every sprint)

- **Weekly community touch**: 1 useful comment in r/telecom or a WISPA forum
- **Bi-weekly SEO post**: target one buying-intent keyword
- **Bi-weekly demo-video update**: showcase the latest feature in <90s
- **Monthly customer call**: every paying org gets a 20-min call → fuel for case studies + roadmap

## Verification (end of each sprint)

- **S1**: New user signs up → lands on demo project → completes first trace within 5 min (measure with PostHog or similar)
- **S2**: Switch UI to ES/PT → no untranslated strings; export PDF in PT-BR has Portuguese headers
- **S3**: Import a known OSPInsight CSV export → all elements, ports, splices land correctly
- **S4**: Open `/m/projects/[id]` on a phone → can trace a fiber by tap and update splice status
- **S5**: Open map view next to canvas → selecting a node on map highlights it on canvas; Stripe test-mode upgrade flow works end-to-end
- **S6**: Marketing site lighthouse SEO >90; status page live; at least 1 published case study

## Success metrics

| Metric | M3 | M6 |
|---|---|---|
| Active trials | 100 | 400 |
| Paying orgs | 10 | 50 |
| MRR | $1.5K | $8K |
| Locales live | EN | EN/ES/PT |
| Case studies | 0 | 3 |

The M6 numbers match the market report's Phase 2 target of "$8K MRR · 50 orgs pagando".
