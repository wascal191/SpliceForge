# SpliceForge

A fiber optic network mapping and visualization application built with Next.js. SpliceForge provides an interactive canvas editor for designing, documenting, and tracing fiber optic infrastructure — cables, splitters, equipment, closures, and their interconnections.

## Documentation

| Document | Description |
|---|---|
| [User Guide](docs/user-guide.md) | Complete walkthrough of all features and workflows |
| [Keyboard Shortcuts](docs/keyboard-shortcuts.md) | Quick reference for all keyboard shortcuts |
| [Architecture](docs/architecture.md) | Technical architecture for developers |
| [Data Model](docs/data-model.md) | TypeScript types and database schema explained |
| [Fiber Color Standards](docs/fiber-standards.md) | EIA-598, ABNT, and other supported color standards |

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
- **Supabase backend** — persistent storage for projects, pages, elements, ports, and splices

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | Next.js 16.2.4 |
| UI Library | React 19.2.4 |
| Canvas / Diagrams | @xyflow/react 12.10.2 |
| State Management | Zustand 5.0.12 |
| Server State | @tanstack/react-query 5.99.0 |
| Database / Auth | Supabase (@supabase/supabase-js 2.103.3) |
| Drag & Drop | @dnd-kit/core 6.3.1 |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS v4) |
| Icons | Lucide React 1.8.0 |
| Styling | Tailwind CSS 4, tailwind-merge, tw-animate-css |
| Language | TypeScript 5 |

## Prerequisites

- **Node.js** v18 or higher (v20 recommended)
- **npm** v9 or higher (comes with Node.js)
- A **Supabase** project (see [Environment Variables](#environment-variables))

## Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd SpliceForge
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the project root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   You can find these values in your Supabase project under **Settings → API**.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:7000](http://localhost:7000) in your browser.

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project's public anon key |

Both variables are prefixed with `NEXT_PUBLIC_` and are exposed to the browser. Do **not** store service-role keys here.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server on port 7000 with hot reload |
| `npm run build` | Create an optimized production build |
| `npm start` | Run the production build on port 7000 |
| `npm run lint` | Run ESLint across the project |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing / home page
│   ├── dashboard/          # Project dashboard
│   └── canvas/             # Canvas editor route
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
│   │   └── bedsheets.ts    # Bedsheet (project container) management
│   └── fiber/              # Fiber-domain utilities
│       ├── colors.ts       # EIA-598 and other color schemes
│       ├── trace.ts        # Path tracing logic
│       └── comments.ts     # Fiber comment helpers
├── store/
│   └── canvasStore.ts      # Zustand global canvas state
└── types/
    └── fiber.ts            # Shared TypeScript type definitions
```

## Full Dependency List

### Production Dependencies

```
@dnd-kit/core              ^6.3.1
@dnd-kit/sortable          ^10.0.0
@dnd-kit/utilities         ^3.2.2
@supabase/ssr              ^0.10.2
@supabase/supabase-js      ^2.103.3
@tanstack/react-query      ^5.99.0
@xyflow/react              ^12.10.2
class-variance-authority   ^0.7.1
clsx                       ^2.1.1
lucide-react               ^1.8.0
next                       16.2.4
radix-ui                   ^1.4.3
react                      19.2.4
react-dom                  19.2.4
shadcn                     ^4.3.0
tailwind-merge             ^3.5.0
tw-animate-css             ^1.4.0
zustand                    ^5.0.12
```

### Dev Dependencies

```
@tailwindcss/postcss       ^4
@types/node                ^20.19.39
@types/react               ^19
@types/react-dom           ^19
eslint                     ^9
eslint-config-next         16.2.4
tailwindcss                ^4
typescript                 ^5
```

## Supabase Setup

SpliceForge uses Supabase as its backend. Follow the steps below to create all required tables.

### 1. Open the SQL Editor

Go to your Supabase project → **SQL Editor** → **New query**, then paste and run the script below.

### 2. Full Database Schema

```sql
-- ─── projects ────────────────────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ─── bedsheets ───────────────────────────────────────────────────────────────
create table if not exists bedsheets (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists bedsheets_project_id_idx on bedsheets(project_id);

-- ─── pages ───────────────────────────────────────────────────────────────────
create table if not exists pages (
  id           uuid primary key default gen_random_uuid(),
  bedsheet_id  uuid not null references bedsheets(id) on delete cascade,
  page_index   integer not null default 0,
  title        text,
  data_json    jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists pages_bedsheet_id_idx on pages(bedsheet_id);

-- ─── elements ────────────────────────────────────────────────────────────────
create table if not exists elements (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  type        text not null,            -- 'cable' | 'splitter' | 'equipment' | 'closure'
  label       text,
  position_x  numeric,
  position_y  numeric,
  config_json jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists elements_page_id_idx on elements(page_id);

-- ─── ports ───────────────────────────────────────────────────────────────────
create table if not exists ports (
  id          uuid primary key default gen_random_uuid(),
  element_id  uuid not null references elements(id) on delete cascade,
  port_index  integer not null default 0,
  colors      text[] not null default '{}',
  status      text not null default 'unoccupied', -- 'occupied' | 'unoccupied'
  created_at  timestamptz not null default now()
);

create index if not exists ports_element_id_idx on ports(element_id);

-- ─── splices ─────────────────────────────────────────────────────────────────
create table if not exists splices (
  id        uuid primary key default gen_random_uuid(),
  port_from uuid not null references ports(id) on delete cascade,
  port_to   uuid not null references ports(id) on delete cascade,
  comment   text,
  color     text,
  created_at timestamptz not null default now()
);

create index if not exists splices_port_from_idx on splices(port_from);
create index if not exists splices_port_to_idx   on splices(port_to);

-- ─── library_cables ──────────────────────────────────────────────────────────
create table if not exists library_cables (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  fiber_count        integer not null,
  color_scheme       text not null,
  module_fiber_count integer,
  created_at         timestamptz not null default now()
);
```

### 3. Table Relationships

```
projects
  └── bedsheets       (project_id → projects.id)
        └── pages     (bedsheet_id → bedsheets.id)
              └── elements  (page_id → pages.id)
                    └── ports     (element_id → elements.id)
                          └── splices  (port_from / port_to → ports.id)

library_cables  (standalone — no foreign keys)
```

### 4. Column Reference

| Table | Column | Type | Notes |
|---|---|---|---|
| `projects` | `id` | uuid PK | |
| | `name` | text | |
| | `description` | text | nullable |
| | `created_at` | timestamptz | |
| `bedsheets` | `id` | uuid PK | |
| | `project_id` | uuid FK | → projects |
| | `name` | text | |
| | `created_at` | timestamptz | |
| `pages` | `id` | uuid PK | |
| | `bedsheet_id` | uuid FK | → bedsheets |
| | `page_index` | integer | ordering within bedsheet |
| | `title` | text | nullable |
| | `data_json` | jsonb | page-level state |
| | `created_at` | timestamptz | |
| `elements` | `id` | uuid PK | |
| | `page_id` | uuid FK | → pages |
| | `type` | text | `cable` `splitter` `equipment` `closure` |
| | `label` | text | nullable |
| | `position_x` | numeric | canvas X position |
| | `position_y` | numeric | canvas Y position |
| | `config_json` | jsonb | element configuration |
| | `created_at` | timestamptz | |
| `ports` | `id` | uuid PK | |
| | `element_id` | uuid FK | → elements |
| | `port_index` | integer | port order on element |
| | `colors` | text[] | fiber color names |
| | `status` | text | `occupied` or `unoccupied` |
| | `created_at` | timestamptz | |
| `splices` | `id` | uuid PK | |
| | `port_from` | uuid FK | → ports (source) |
| | `port_to` | uuid FK | → ports (destination) |
| | `comment` | text | nullable |
| | `color` | text | nullable |
| | `created_at` | timestamptz | |
| `library_cables` | `id` | uuid PK | |
| | `name` | text | |
| | `fiber_count` | integer | total fibers |
| | `color_scheme` | text | e.g. `EIA598`, `ABNT` |
| | `module_fiber_count` | integer | nullable, fibers per tube/module |
| | `created_at` | timestamptz | |

## Building for Production

```bash
npm run build
npm start
```

The production server also runs on port 7000. To change the port, edit the `dev` and `start` scripts in `package.json`.
