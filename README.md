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
| Icons | Lucide React 0.460.0 |
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
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   NEXT_PUBLIC_SITE_URL=http://localhost:7000
   ```

   You can find these values in your Supabase project under **Settings → API**.

   > ⚠️  `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security and **must never be committed or shipped to the browser**. The supplied `.gitignore` excludes all `.env*` files; verify it has not been previously committed before publishing the repo.

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
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** service-role key. Bypasses RLS; never expose to the browser. |
| `NEXT_PUBLIC_SITE_URL` | Public URL (used for invite redirects + server-action allowlist). |

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Service-role keys must remain server-only.

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
│   ├── canvas/             # Canvas editor route
│   └── auth/callback/      # Supabase auth callback (invite / OAuth)
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
│   ├── supabase/
│   │   ├── server.ts       # Authenticated SSR client
│   │   └── admin.ts        # Service-role client (singleton)
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
@supabase/ssr                    ^0.10.2
@supabase/supabase-js            ^2.103.3
@tanstack/react-query            ^5.99.0
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

## Supabase Setup

SpliceForge uses Supabase as its backend. Follow the steps below to create all required tables.

### 1. Open the SQL Editor

Go to your Supabase project → **SQL Editor** → **New query**, then paste and run the script below.

### 2. Full Database Schema

Every domain table carries an `organization_id` for tenant isolation, and
Row-Level Security policies are enabled so a leaked anon key never grants
access to another tenant's data. Save the script below as
`supabase/migrations/0001_init.sql` for reproducible deployments.

```sql
-- ─── organizations & membership ──────────────────────────────────────────────
create table if not exists organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  plan         text,
  api_base_url text,
  created_at   timestamptz not null default now()
);

create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id)    on delete cascade,
  role            text not null default 'editor',  -- 'owner' | 'editor' | 'viewer'
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on organization_members(user_id);
create index if not exists organization_members_org_idx  on organization_members(organization_id);

create table if not exists organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  token_hash      text not null unique,                       -- sha-256(token)
  created_by      uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  max_uses        integer not null default 5,
  uses            integer not null default 0
);
create index if not exists organization_invites_org_idx on organization_invites(organization_id);

-- ─── projects ────────────────────────────────────────────────────────────────
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now()
);
create index if not exists projects_org_idx on projects(organization_id);

-- ─── bedsheets ───────────────────────────────────────────────────────────────
create table if not exists bedsheets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid not null references projects(id)      on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists bedsheets_project_id_idx on bedsheets(project_id);
create index if not exists bedsheets_org_idx        on bedsheets(organization_id);

-- ─── pages ───────────────────────────────────────────────────────────────────
create table if not exists pages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  bedsheet_id     uuid not null references bedsheets(id)     on delete cascade,
  page_index      integer not null default 0,
  title           text,
  data_json       jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists pages_bedsheet_id_idx on pages(bedsheet_id);
create index if not exists pages_org_idx         on pages(organization_id);

-- ─── elements ────────────────────────────────────────────────────────────────
create table if not exists elements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  page_id         uuid not null references pages(id)         on delete cascade,
  type            text not null,            -- 'cable' | 'splitter' | 'equipment' | 'closure'
  label           text,
  position_x      numeric,
  position_y      numeric,
  config_json     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists elements_page_id_idx on elements(page_id);
create index if not exists elements_org_idx     on elements(organization_id);

-- ─── ports ───────────────────────────────────────────────────────────────────
create table if not exists ports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  element_id      uuid not null references elements(id)      on delete cascade,
  port_index      integer not null default 0,
  fiber_count     integer not null default 1,
  colors          text[] not null default '{}',
  status          text not null default 'unoccupied', -- 'occupied' | 'unoccupied'
  label           text,
  created_at      timestamptz not null default now()
);
create index if not exists ports_element_id_idx on ports(element_id);
create index if not exists ports_org_idx        on ports(organization_id);

-- ─── splices ─────────────────────────────────────────────────────────────────
create table if not exists splices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  port_from       uuid not null references ports(id)         on delete cascade,
  port_to         uuid not null references ports(id)         on delete cascade,
  comment         text,
  color           text,
  created_at      timestamptz not null default now()
);
create index if not exists splices_port_from_idx on splices(port_from);
create index if not exists splices_port_to_idx   on splices(port_to);
create index if not exists splices_org_idx       on splices(organization_id);

-- ─── library_cables ──────────────────────────────────────────────────────────
create table if not exists library_cables (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  name               text not null,
  fiber_count        integer not null,
  color_scheme       text not null,
  module_fiber_count integer,
  created_at         timestamptz not null default now()
);
create index if not exists library_cables_org_idx on library_cables(organization_id);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
-- Helper view: orgs the current auth.uid() belongs to.
-- (Inlined into each policy below for performance / portability.)

alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table organization_invites  enable row level security;
alter table projects              enable row level security;
alter table bedsheets             enable row level security;
alter table pages                 enable row level security;
alter table elements              enable row level security;
alter table ports                 enable row level security;
alter table splices               enable row level security;
alter table library_cables        enable row level security;

-- organizations: members can read their org; only owners can update.
create policy org_select on organizations for select using (
  id in (select organization_id from organization_members where user_id = auth.uid())
);
create policy org_update on organizations for update using (
  id in (
    select organization_id from organization_members
    where user_id = auth.uid() and role = 'owner'
  )
) with check (
  id in (
    select organization_id from organization_members
    where user_id = auth.uid() and role = 'owner'
  )
);

-- organization_members: each user can see rows where they are the member.
-- IMPORTANT: do NOT use a sub-select back into organization_members here —
-- that causes infinite recursion (Postgres error 42P17). Queries that need
-- to see *other* members of the same org go through the service-role admin
-- client in server actions, which bypasses RLS entirely.
create policy org_members_select on organization_members
  for select using (user_id = auth.uid());

-- organization_invites: only owners of the org can read invite metadata.
create policy invites_owner on organization_invites for select using (
  organization_id in (
    select organization_id from organization_members
    where user_id = auth.uid() and role = 'owner'
  )
);

-- Generic per-tenant CRUD policy for domain tables.
do $$
declare t text;
begin
  for t in select unnest(array['projects','bedsheets','pages','elements','ports','splices','library_cables'])
  loop
    execute format($f$
      create policy %I_tenant_read on %I for select using (
        organization_id in (select organization_id from organization_members where user_id = auth.uid())
      );
    $f$, t || '_read', t);

    execute format($f$
      create policy %I_tenant_write on %I for all using (
        organization_id in (
          select organization_id from organization_members
          where user_id = auth.uid() and role in ('owner','editor')
        )
      ) with check (
        organization_id in (
          select organization_id from organization_members
          where user_id = auth.uid() and role in ('owner','editor')
        )
      );
    $f$, t || '_write', t);
  end loop;
end$$;
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

## Deploying to Vercel

1. **Push your repository** to GitHub (or any Git provider supported by Vercel).

2. **Import the project** in the [Vercel dashboard](https://vercel.com/new). Vercel auto-detects Next.js — no framework override needed.

3. **Add environment variables** under **Settings → Environment Variables** (Production scope at minimum):

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role **secret** |
   | `NEXT_PUBLIC_SITE_URL` | Your Vercel production URL, e.g. `https://spliceforge.vercel.app` |

   > `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Keep it in the server-only scope; never add it as a `NEXT_PUBLIC_` variable.

4. **Deploy.** After the first deploy, copy the production URL into `NEXT_PUBLIC_SITE_URL` if it wasn't known beforehand, then redeploy.

5. **Email confirmation** — Supabase's free tier has a low email rate limit. For production, configure a custom SMTP provider (e.g. Resend) under Supabase → **Authentication → SMTP Settings**, or disable email confirmation under **Authentication → Providers → Email** for internal/test use.

---

## Post-Setup Checklist

After running the database migration for the first time, verify:

- [ ] All 10 tables exist in Supabase → **Table Editor**
- [ ] RLS is **enabled** on every table (the SQL script sets this, but confirm in **Authentication → Policies**)
- [ ] The `org_members_select` policy on `organization_members` reads `user_id = auth.uid()` — **not** a sub-select back into the same table (that causes infinite recursion, Postgres error `42P17`)
- [ ] Sign up a new user → confirm a new organization row and a member row with `role = 'owner'` are created
- [ ] Log in with that user → confirm the dashboard loads projects without errors
- [ ] Invite a second user (owner role required) → confirm the invite email arrives and the callback route attaches the new member to the correct org

---

## Building for Production

```bash
npm run build
npm start
```

The production server also runs on port 7000. To change the port, edit the `dev` and `start` scripts in `package.json`.
