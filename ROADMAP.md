# SpliceForge Roadmap

A community-driven roadmap. No fixed dates — items move when they're ready. If something here matters to you, [open an issue](https://github.com/wascal191/SpliceForge/issues) or send a PR.

## Vision

SpliceForge is an open-source canvas editor for fiber-optic networks. It serves:

- **ISPs and TelCos** documenting OSP (outside plant) splice work
- **Contractors and field crews** that need clean as-builts
- **Educators and students** learning fiber topology
- **Tinkerers and self-hosters** running it on their own infrastructure

We aim for: solid fundamentals (correct EIA-598 colors, multi-page layouts, accurate traces), thoughtful UX (fast canvas, sane defaults, keyboard-friendly), and excellent local-first / self-hosted operation.

## Now

Active development. These are in flight or up next.

- **Anonymous `/demo` route** — public read-only preview so anyone can see the app before signing up. _(Initial version shipped — interactive walkthrough still being polished.)_
- **Onboarding polish** — relaxed signup (optional org name), clearer first-run experience for solo users.
- **Localization completeness** — keep EN / ES / PT-BR strings in sync; review fiber-industry terminology with native speakers.
- **Documentation pass** — restructure `docs/` for newcomers; clearer self-hosting guide.

## Next

Reasonably scoped and aligned with the vision. Looking for contributors here.

- **OSPInsight & Splice.me import presets** — column mappings for the most common legacy formats. _Initial scaffolding exists in the importer; needs field validation against real files._
- **Mobile / PWA polish** — touch-friendly canvas gestures, installable as a PWA, offline-tolerant for field use.
- **More color standards** — extend EIA-598 / ABNT / Turkish / Dutch / French / Ribbon with regional variants users actually need.
- **Better map integration** — improve the OSM layer for geo-localized elements; route drawing between geotagged nodes.
- **Single-user mode (no org)** — let self-hosters skip the organization concept entirely if they don't need teams.

## Later

Ideas worth doing but not prioritized. Designs welcome.

- **Real-time multi-user collaboration** — live cursors and CRDT-style edits on a bedsheet.
- **Public sharing links** — read-only published bedsheets for outside-org review.
- **Plugin / extension API** — let third parties add custom node types, importers, or exporters.
- **REST / GraphQL API** — programmatic access to projects and bedsheets for integrations.
- **Audit log** — who changed what, when (useful for regulated operators).
- **Versioned bedsheets** — branch/merge style history beyond the in-session undo stack.

## Help wanted

Good entry points for new contributors:

- [`good first issue`](https://github.com/wascal191/SpliceForge/labels/good%20first%20issue) — small, well-scoped tasks.
- [`help wanted`](https://github.com/wascal191/SpliceForge/labels/help%20wanted) — larger items where extra hands or domain expertise would speed things up.
- **Translations** — improving Spanish or Portuguese, or adding a new language. See [CONTRIBUTING.md](CONTRIBUTING.md#translations).
- **Real-world test data** — sample XLSX / KMZ / GeoJSON files from your network would help us harden the importer.

## Out of scope

To keep the project focused, these are explicitly **not** on the roadmap:

- Paid hosted SaaS tier with billing / subscriptions
- Vendor lock-in or proprietary file formats
- Telemetry that phones home without consent
- ML / AI features that don't have clear, useful fiber-network applications
