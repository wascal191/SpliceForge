# SpliceForge

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An **open-source** canvas editor for fiber-optic networks. SpliceForge provides an interactive editor for designing, documenting, and tracing fiber-optic infrastructure — cables, splitters, equipment, closures, and their interconnections. Built for ISPs, network contractors, educators, and self-hosters.

**Try it now without an account:** [open the live demo →](http://localhost:7000/demo) (or visit `/demo` on your deployment)

## Documentation

| Document | Description |
|---|---|
| [User Guide](docs/user-guide.md) | Complete walkthrough of all features and workflows |
| [Keyboard Shortcuts](docs/keyboard-shortcuts.md) | Quick reference for all keyboard shortcuts |
| [Architecture](docs/architecture.md) | Technical architecture for developers |
| [Data Model](docs/data-model.md) | TypeScript types and database schema explained |
| [Fiber Color Standards](docs/fiber-standards.md) | EIA-598, ABNT, and other supported color standards |
| [Contributing](CONTRIBUTING.md) | How to set up locally and submit changes |
| [Roadmap](ROADMAP.md) | What's in flight and where help is wanted |

---

## Features

- **Interactive canvas editor** — node-based diagram tool powered by React Flow (@xyflow/react)
- **Fiber element types** — cables, splitters, equipment, closures, and cross-page continuation nodes
- **Port & splice management** — connect fiber ports with typed splice edges and visualize signal paths
- **Fiber color tracing** — BFS-based trace that follows splices through the entire network with automatic color resolution
- **Multi-page projects** — organize large networks across multiple canvas pages with cross-page continuation links
- **Grid view** — overview of all pages with miniature previews and cross-page link visualization
- **Cable library** — save and reuse cable configurations across projects
- **Undo / redo** — full edit history per session (up to 50 snapshots)
- **Bulk splice** — connect all fibers of two cables at once with `Alt+Shift+C`
- **Copy / paste** — duplicate network elements with their port configurations
- **Dark mode & B&W mode** — for accessibility and print-ready exports
- **Search panel** — find elements by label or splice by comment, jump-to with `Ctrl+F`
- **Export** — PDF, PNG, and XLSX export; traced-path or full canvas scope
- **Import** — load networks from XLSX files with phase-based creation and error reporting
- **Multiple color standards** — EIA-598 (USA), ABNT (Brazil), Turkish, Dutch, French, Ribbon
- **Vanilla PostgreSQL backend** — runs on your own database, no managed-service dependency
- **Better Auth** — self-hosted email/password authentication with httpOnly session cookies

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | Next.js 16.2.4 |
| UI Library | React 19.2.4 |
| Canvas / Diagrams | @xyflow/react 12.10.2 |
| State Management | Zustand 5.0.12 |
| Server State | @tanstack/react-query 5.99.0 |
| Database | PostgreSQL 13+ (via `pg` driver) |
| Auth | Better Auth 1.x (email + password, session cookies) |
| Drag & Drop | @dnd-kit/core 6.3.1 |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS v4) |
| Icons | Lucide React 0.460.0 |
| Styling | Tailwind CSS 4, tailwind-merge, tw-animate-css |
| Language | TypeScript 5 |

## Prerequisites

- **Node.js** v18 or higher (v20 recommended)
- **npm** v9 or higher (comes with Node.js)
- **PostgreSQL** v13 or higher (vanilla — no Supabase, Docker, or other managed services required)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/wascal191/SpliceForge.git
   cd SpliceForge
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create the database**

   ```bash
   createdb spliceforge
   ```

4. **Configure environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local`:

   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/spliceforge
   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   NEXT_PUBLIC_SITE_URL=http://localhost:7000
   ```

5. **Initialize the schema**

   ```bash
   npm run db:init
   ```

   This runs `psql $DATABASE_URL -f db/schema.sql` which creates all tables (including those Better Auth needs) plus the RPCs used for atomic org provisioning, invite consumption, and bulk import.

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:7000](http://localhost:7000) in your browser, or jump straight to [http://localhost:7000/demo](http://localhost:7000/demo) to explore the canvas without signing up.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Example: `postgres://user:pass@host:5432/spliceforge` |
| `BETTER_AUTH_SECRET` | Yes (prod) | 32+ character secret used to sign session cookies. Generate with `openssl rand -base64 32`. A dev-only default is used if omitted in development. |
| `NEXT_PUBLIC_SITE_URL` | No | Public base URL (used by Better Auth for callbacks and CSRF). Defaults to `http://localhost:7000`. |
| `MAX_MEMBERS_PER_ORG` | No | Per-org member cap (default 5). Self-hosters can raise this for larger teams. |
| `UPSTASH_REDIS_REST_URL` | No | Optional — when both Upstash vars are present, the in-memory rate limiter is replaced by a distributed one. |
| `UPSTASH_REDIS_REST_TOKEN` | No | See above. |

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. The rest are server-only — never log them or send them to the client.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server on port 7000 with hot reload |
| `npm run build` | Create an optimized production build |
| `npm start` | Run the production build on port 7000 |
| `npm run lint` | Run ESLint across the project |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |
| `npm test` | Run the unit-test suite (Vitest) |
| `npm run db:init` | Apply `db/schema.sql` to the database pointed to by `$DATABASE_URL` |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing / home page
│   ├── demo/               # Anonymous read-only demo (no account)
│   ├── dashboard/          # Project dashboard
│   ├── canvas/             # Canvas editor route
│   └── api/auth/[...all]/  # Better Auth catch-all handler
├── components/
│   ├── canvas/             # Toolbar, PageSidebar, SearchPanel, etc.
│   │   └── hooks/          # Extracted canvas behaviour hooks
│   │       ├── useCanvasHistory.ts   # Undo/redo stack
│   │       └── useCanvasKeyboard.ts  # Global keyboard shortcuts
│   ├── nodes/              # Custom React Flow node components (all React.memo)
│   │   ├── CableNode.tsx
│   │   ├── SplitterNode.tsx
│   │   ├── EquipmentNode.tsx
│   │   ├── ClosureNode.tsx
│   │   ├── ContinuationNode.tsx
│   │   ├── SpliceEdge.tsx
│   │   └── PortHandle.tsx
│   ├── dashboard/          # Dashboard-specific components
│   └── ui/                 # shadcn/ui base components
├── lib/
│   ├── actions/            # Next.js server actions (DB operations)
│   │   ├── elements.ts     # Create / update / delete / batch-update canvas elements
│   │   ├── ports.ts        # Port management; paginated fetch (no row cap)
│   │   ├── splices.ts      # Fiber splice connections
│   │   ├── pages.ts        # Multi-page support
│   │   ├── projects.ts     # Project CRUD
│   │   ├── library.ts      # Cable library
│   │   ├── organizations.ts # Org & member management
│   │   ├── invites.ts      # Invite token lifecycle
│   │   └── bedsheets.ts    # Bedsheet (project container) management
│   ├── db.ts               # PostgreSQL pool + query helpers
│   ├── auth.ts             # Better Auth server-side instance
│   ├── auth-client.ts      # Better Auth client-side (signIn/signUp/signOut)
│   ├── guards.ts           # requireAuthContext, assertOrgOwnsRow, etc.
│   ├── validation.ts       # Zod schemas for all user inputs
│   ├── errors.ts           # fail() helper — logs full error, throws generic message
│   ├── ratelimit.ts        # In-memory token-bucket rate limiter
│   └── fiber/              # Fiber-domain utilities
│       ├── colors.ts       # EIA-598 and other color schemes
│       ├── trace.ts        # Path tracing logic
│       └── comments.ts     # Fiber comment helpers
├── proxy.ts                # Next.js 16 route proxy / auth middleware (replaces middleware.ts)
├── store/
│   └── canvasStore.ts      # Zustand global canvas state
└── types/
    └── fiber.ts            # Shared TypeScript type definitions
```

## Full Dependency List

### Production Dependencies

```
@dnd-kit/core                    ^6.3.1
@dnd-kit/sortable                ^10.0.0
@dnd-kit/utilities               ^3.2.2
@radix-ui/react-context-menu     ^2.2.4
@radix-ui/react-dialog           ^1.1.4
@radix-ui/react-label            ^2.1.1
@radix-ui/react-separator        ^1.1.1
@radix-ui/react-slot             ^1.1.2
@radix-ui/react-tooltip          ^1.1.6
@tanstack/react-query            ^5.99.0
better-auth                      ^1.6.23
pg                               ^8.22.0
@xyflow/react                    ^12.10.2
class-variance-authority         ^0.7.1
clsx                             ^2.1.1
html-to-image                    ^1.11.13
jspdf                            ^4.2.1
lucide-react                     ^0.460.0
next                             16.2.4
react                            19.2.4
react-dom                        19.2.4
sonner                           ^2.0.7
tailwind-merge                   ^3.5.0
tw-animate-css                   ^1.4.0
xlsx                             ^0.18.5
zod                              ^3.23.8
zustand                          ^5.0.12
```

### Dev Dependencies

```
@tailwindcss/postcss       ^4
@types/node                ^20.19.39
@types/react               ^19
@types/react-dom           ^19
eslint                     ^9
eslint-config-next         16.2.4
shadcn                     ^4.3.0
tailwindcss                ^4
typescript                 ^5
```


## Building for Production

```bash
npm run build
npm start
```

The production server also runs on port 7000. To change the port, edit the `dev` and `start` scripts in `package.json`.

---

## Contributing

Contributions are welcome — bug reports, docs, translations, features, code review, everything. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions, and check the [roadmap](ROADMAP.md) for items where help is wanted.

By contributing, you agree to license your work under the project's AGPL-3.0 license. You retain copyright on your contributions.

## License

SpliceForge is released under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE) for the full text.

The AGPL requires that anyone who runs a modified version of SpliceForge as a network service must publish the modified source code to its users. If you self-host an unmodified copy for your own organization, no extra obligations apply.
