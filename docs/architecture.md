# SpliceForge — Technical Architecture

This document describes the technical design of SpliceForge for developers working on the codebase.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Frontend Architecture](#2-frontend-architecture)
3. [State Management](#3-state-management)
4. [Canvas Engine](#4-canvas-engine)
5. [Canvas Hooks](#5-canvas-hooks)
6. [Fiber Tracing Engine](#6-fiber-tracing-engine)
7. [Auth System](#7-auth-system)
8. [Backend & Database](#8-backend--database)
9. [Server Actions](#9-server-actions)
10. [Export Pipeline](#10-export-pipeline)
11. [Import Pipeline](#11-import-pipeline)
12. [Undo / Redo System](#12-undo--redo-system)
13. [Performance Design](#13-performance-design)
14. [Error Handling](#14-error-handling)
15. [UI Design System](#15-ui-design-system)

---

## 1. Project Structure

```
SpliceForge/
├── db/
│   └── schema.sql              # Vanilla Postgres schema — run via `npm run db:init`
│
├── src/
│   ├── app/                    # Next.js App Router pages (locale-prefixed)
│   │   ├── layout.tsx          # Root layout — Inter + Geist Mono fonts, Providers wrapper
│   │   ├── globals.css         # Tailwind v4 theme, FM color tokens, animations, ReactFlow overrides
│   │   ├── [locale]/
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── demo/           # Anonymous read-only canvas preview (no account)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Server component: fetches projects, auto-provisions org on first load
│   │   │   ├── canvas/
│   │   │   │   └── [bedsheetId]/
│   │   │   │       └── page.tsx    # Server component: loads bedsheet + pages
│   │   │   ├── login/
│   │   │   │   └── page.tsx    # Email + password sign-in
│   │   │   ├── signup/
│   │   │   │   └── page.tsx    # New account registration
│   │   │   └── join/
│   │   │       └── [token]/
│   │   │           └── page.tsx    # Accept organization invite by token
│   │   └── api/
│   │       └── auth/
│   │           └── [...all]/
│   │               └── route.ts    # Better Auth catch-all (sign-in, sign-up, sign-out, session)
│   │
│   ├── proxy.ts                # Next.js 16 middleware: session gate + i18n locale routing
│   │
│   ├── components/
│   │   ├── canvas/             # Canvas-level UI components
│   │   │   ├── hooks/          # Extracted canvas behaviour hooks
│   │   │   │   ├── useCanvasHistory.ts     # Undo/redo stack (ref-based, no renders)
│   │   │   │   └── useCanvasKeyboard.ts    # Global keyboard shortcuts
│   │   │   ├── FiberCanvas.tsx             # React Flow orchestrator + cursor tracking
│   │   │   ├── CanvasLayout.tsx            # AppBar, breadcrumb, view switcher, theme-aware styles
│   │   │   ├── PageSidebar.tsx             # 52px icon rail + 224px fly-out (pages/history/settings)
│   │   │   ├── Toolbar.tsx                 # Floating pill — node creation, mode toggles, search oval
│   │   │   ├── SearchPanel.tsx             # Fixed dropdown driven by canvasStore.searchQuery
│   │   │   ├── StatusBar.tsx               # Bottom center: zoom, lock, element count, splices, cursor
│   │   │   ├── ExportDialog.tsx
│   │   │   ├── ImportDialog.tsx
│   │   │   └── BulkSpliceRangeDialog.tsx
│   │   ├── nodes/              # Individual node and edge renderers
│   │   │   ├── CableNode.tsx           # Wave icon + fiber count badge; React.memo
│   │   │   ├── ClosureNode.tsx         # Enclosure icon + capacity badge + "SPLICE CLOSURE" subheader; React.memo
│   │   │   ├── EquipmentNode.tsx       # Server-rack icon + port labels + status dots; React.memo
│   │   │   ├── SplitterNode.tsx        # Fork icon + ratio badge + utilization bar; React.memo
│   │   │   ├── ContinuationNode.tsx    # React.memo; click → target page navigates
│   │   │   ├── SpliceEdge.tsx          # React.memo
│   │   │   └── PortHandle.tsx          # React.memo; lazy trace color resolution
│   │   ├── dashboard/          # Dashboard UI components
│   │   └── ui/                 # shadcn/ui base components
│   │
│   ├── lib/
│   │   ├── actions/            # Next.js Server Actions (database CRUD)
│   │   │   ├── elements.ts     # createElement, updateElement, updateElementsBatch, deleteElement, getElements
│   │   │   ├── ports.ts        # createPorts, getPortsByElements (paginated), updatePortStatus/Batch, updatePortLabel
│   │   │   ├── splices.ts      # createSplice/Batch, deleteSplice/Batch, updateSplice, getSplicesByPortIds
│   │   │   ├── pages.ts        # createPage, getPages, renamePage, deletePage, updatePageData, reorderPages, duplicatePage
│   │   │   ├── projects.ts     # Project CRUD
│   │   │   ├── library.ts      # Cable library CRUD
│   │   │   ├── bedsheets.ts    # Bedsheet management
│   │   │   ├── organizations.ts  # Org CRUD, member management (all app-level filtered by org_id)
│   │   │   ├── invites.ts        # Token-based invite link create/validate/join
│   │   │   ├── templates.ts      # Create project from a pre-built template
│   │   │   └── import.ts         # Bulk import (elements + ports + splices) via import_bundle RPC
│   │   ├── fiber/              # Fiber domain utilities
│   │   │   ├── colors.ts       # EIA-598, ABNT, and other color scheme tables
│   │   │   ├── trace.ts        # BFS trace logic
│   │   │   └── comments.ts     # Splice comment helpers
│   │   ├── templates/          # Seedable project templates (FTTH, contractor splice)
│   │   ├── db.ts               # pg Pool + query/rows/maybeOne/withTransaction helpers
│   │   ├── auth.ts             # Better Auth server instance
│   │   ├── auth-client.ts      # Better Auth React client (signIn/signUp/signOut/useSession)
│   │   ├── guards.ts           # requireAuthContext, assertOrgOwnsRow(s), role checks
│   │   ├── validation.ts       # Zod schemas for every server-action input
│   │   ├── errors.ts           # fail() helper: logs full DB error, throws generic public message
│   │   └── ratelimit.ts        # Token-bucket rate limiter (in-memory or Upstash)
│   │
│   ├── store/
│   │   └── canvasStore.ts      # Zustand global canvas state
│   │
│   └── types/
│       └── fiber.ts            # TypeScript types and interfaces
│
├── scripts/
│   └── db-init.mjs             # Cross-platform runner for `npm run db:init`
├── public/                     # Static assets
├── docs/                       # Documentation
│   ├── architecture.md         # This file
│   ├── data-model.md           # TypeScript types + DB schema summary
│   ├── deployment.md           # Environment setup, deployment, troubleshooting
│   ├── fiber-standards.md      # Fiber color coding standards reference
│   ├── keyboard-shortcuts.md   # Keyboard shortcut reference
│   └── user-guide.md           # End-user feature documentation
├── messages/                   # next-intl JSON dictionaries (en, es, pt-br)
├── package.json
└── next.config.ts
```

---

## 2. Frontend Architecture

SpliceForge is a **Next.js 16 App Router** application with React 19.

### Page Routing

All app routes are prefixed with a locale (`en`, `es`, `pt-br`) resolved by next-intl.

| Route | Component | Purpose |
|---|---|---|
| `/[locale]/` | `app/[locale]/page.tsx` | Landing page |
| `/[locale]/demo` | `app/[locale]/demo/page.tsx` | Anonymous read-only canvas preview |
| `/[locale]/dashboard` | `app/[locale]/dashboard/page.tsx` | Project management |
| `/[locale]/canvas/[bedsheetId]` | `app/[locale]/canvas/[bedsheetId]/page.tsx` | Canvas editor |
| `/[locale]/login` | `app/[locale]/login/page.tsx` | Email + password sign-in |
| `/[locale]/signup` | `app/[locale]/signup/page.tsx` | New account registration |
| `/[locale]/join/[token]` | `app/[locale]/join/[token]/page.tsx` | Accept organization invite by token |
| `/api/auth/[...all]` | `app/api/auth/[...all]/route.ts` | Better Auth catch-all (sign-in, sign-up, session, sign-out) |

All routes under `/dashboard` and `/canvas` are protected by `src/proxy.ts` — unauthenticated requests redirect to `/login`. `/demo` is intentionally public.

### Server vs. Client Components

- **Server components** handle initial data fetching (projects, bedsheets, pages).
- **Client components** handle all interactivity (canvas, toolbar, dialogs).
- The `"use client"` directive marks all interactive components.
- `src/components/providers.tsx` wraps the app with `QueryClientProvider` (React Query) and mounts the global `<Toaster />` (sonner).

### Component Hierarchy (Canvas)

```
app/canvas/[bedsheetId]/page.tsx        (Server: loads data)
  └── CanvasLayout                      (Client: 52px AppBar, view switcher, theme-aware styles)
        ├── PageSidebar                 (52px icon rail + 224px fly-out: pages, history, settings)
        └── FiberCanvas                 (React Flow canvas orchestrator + cursor tracking)
              ├── useCanvasHistory      (hook: undo/redo stack with DB sync)
              ├── useCanvasKeyboard     (hook: keyboard shortcuts)
              ├── Toolbar               (floating pill: node creation + mode toggles + search oval)
              ├── CableNode             (memo; wave icon + fiber count badge; cyan glow)
              ├── SplitterNode          (memo; fork icon + ratio badge + utilization bar; amber glow)
              ├── EquipmentNode         (memo; server icon + port labels + status dots; green glow)
              ├── ClosureNode           (memo; enclosure icon + capacity badge; purple glow)
              ├── ContinuationNode      (memo; click → page navigate via pageNavigator store callback)
              │     └── PortHandle      (memo; lazy trace color resolution)
              ├── SpliceEdge            (memo)
              ├── SearchPanel           (inside ReactFlow context; reads searchQuery from store)
              └── StatusBar             (inside ReactFlow context; zoom, lock, elements, splices, cursor)
```

---

## 3. State Management

Global UI and canvas state is managed with **Zustand** in `src/store/canvasStore.ts`.

### Store Shape

```typescript
type CanvasStore = {
  // Active page
  pageId: string | null

  // React Flow state mirrors (real nodes/edges live in React Flow)
  nodes: Node[]
  edges: Edge[]

  // Fiber tracing (multi-trace model)
  traceEntries: Map<string, string>      // edgeId → hex color (source of truth)
  tracedNodeIds: Set<string>
  tracedEdgeIds: Set<string>
  tracedNodeColors: Map<string, string>  // nodeId → hex color

  // Legacy compat fields (kept for backward compatibility, not used in new code)
  tracedPortId: string | null
  traceColor: string

  // UI toggles
  bwMode: boolean
  darkMode: boolean         // default: true (dark-first); persisted to localStorage
  searchOpen: boolean
  searchQuery: string       // live search input value; drives SearchPanel
  snapGrid: boolean
  keymapOpen: boolean
  exportOpen: boolean
  importOpen: boolean
  paletteOpen: boolean

  // Undo/redo capability flags (managed by useCanvasHistory)
  canUndo: boolean
  canRedo: boolean

  // Clipboard
  clipboard: Node[]
  commentClipboard: string | null

  // Cross-page continuation
  pendingContinuationPortId: string | null

  // Per-page viewport persistence (in-memory, per session)
  viewports: Record<string, { x: number; y: number; zoom: number }>

  // Bulk port connection mode
  bulkPortSelectMode: boolean
  bulkPortsA: string[]
  bulkPortsB: string[]
  bulkPortsANodeId: string | null

  // Range-based bulk splice dialog
  bulkSpliceRangeOpen: boolean
  bulkSpliceRangeNodeIds: [string, string] | null

  // Cable split pending state
  pendingCableSplit: { nodeId: string; moduleIndex: number } | null

  // Cursor position in flow-space (updated on mousemove; drives StatusBar)
  cursorPos: { x: number; y: number }

  // Organization context (hydrated after login)
  currentOrganizationId: string | null
  currentOrganization: { id: string; name: string; plan: string } | null

  // Page navigation — registered by FiberCanvas on mount, called by ContinuationNode on click
  pageNavigator: ((pageId: string) => void) | null
}
```

### Key Actions

| Action | Description |
|---|---|
| `toggleTraceEntry(edgeId, color)` | Toggle a single edge in/out of the trace |
| `batchAddTraceEntries(entries)` | Add multiple entries in one update (avoids N re-renders) |
| `clearTrace()` | Reset all trace state |
| `setSearchQuery(q)` | Update the live search query; SearchPanel reacts immediately |
| `setCursorPos(pos)` | Update `{x, y}` cursor coords in flow-space; read by StatusBar |
| `setUndoRedo(canUndo, canRedo)` | Sync toolbar button enabled state |
| `toggleBulkPort(portId, nodeId)` | Add/remove a port from bulk selection |
| `saveViewport(pageId, vp)` | Persist `{x, y, zoom}` per page (in-memory) |
| `setPageNavigator(fn)` | Register a page-change callback; called by ContinuationNode |
| `setCurrentOrganization(org)` | Hydrate the organization context after login |

### Dark Mode Persistence

`darkMode` defaults to `true`. On mount, `Toolbar.tsx` reads `localStorage.getItem("spliceforge-dark-mode")` and aligns the store value. On every change it writes back and toggles `document.documentElement.classList` between `""` and `"dark"`.

### Selector Discipline

Every `useCanvasStore` call uses a **selector** to subscribe only to the required slice:

```typescript
// Good — re-renders only when bwMode changes
const bwMode = useCanvasStore((s) => s.bwMode);

// Avoid — subscribes to the entire store object
const store = useCanvasStore();
```

---

## 4. Canvas Engine

`FiberCanvas.tsx` is the core orchestrator. It wraps React Flow (`@xyflow/react` v12) and delegates specific behaviors to hooks and child components.

### Node Types Registration

```typescript
const nodeTypes = {
  cable: CableNode,
  splitter: SplitterNode,
  equipment: EquipmentNode,
  closure: ClosureNode,
  continuation: ContinuationNode,
}
```

Defined **outside** `FiberCanvasInner` for stable references — React Flow does not re-register on every render.

### Edge Types Registration

```typescript
const edgeTypes = {
  splice: SpliceEdge,
  "cable-split": CableSplitEdge,
}
```

### Key Behaviors

**Data Loading (`useEffect` on `pageId`)**
1. Clear nodes, edges, and trace state.
2. Call `resetHistory()`.
3. Fetch elements → ports → splices sequentially (inside try/catch).
4. Build React Flow `Node[]` and `Edge[]` arrays.
5. Call `seedHistory(loadedNodes, loadedEdges)` to set the undo baseline.
6. Restore saved viewport or call `fitView`.

**Splice Creation (`onConnect`)**
1. Validate compatibility (splitter output port cap check).
2. Call `createSplice` → update both ports to `occupied`.
3. State mutations (`setEdges`, `setNodes`) only execute after server actions succeed.

**Node / Edge Deletion**
- Both `onNodesDelete` and `onEdgesDelete` call server actions inside try/catch.
- `onEdgesDelete` additionally calls `updatePortStatusBatch` to free both ports back to `unoccupied`.

**Trace Propagation (`useEffect` on `traceEntries`)**
Propagates traces through pass-through nodes (closure, equipment, splitter). Builds O(1) Maps (`edgeById`, `portToEdgeId`, `portToNode`) once per effect run, then resolves paths without any linear scans. All new entries are committed via a single `batchAddTraceEntries` call.

**Page Navigation (ContinuationNode)**
`FiberCanvas` registers `onPageChange` as the `pageNavigator` callback in the store on mount, and clears it on unmount. `ContinuationNode` calls `pageNavigator?.(data.targetPageId)` when the user clicks the `→ targetPageLabel` row.

**Cursor Tracking**
`onMouseMove` on the canvas wrapper div calls `screenToFlowPosition` (from `useReactFlow`) and stores the result in `canvasStore.cursorPos`.

**Canvas Background Layers (Dark Mode)**
Five zero-interaction layers rendered before `<ReactFlow>` (`pointerEvents: none`):
1. Base fill — `#05070C` solid color.
2. Ambient radial glows — cyan (top-left), indigo (bottom-right), green (center).
3. Fine 24 px dot grid.
4. Coarse 120 px grid.
5. Crosshairs + edge vignette.

**Viewport Persistence**
`onMoveEnd` saves `{ x, y, zoom }` to `canvasStore.viewports[pageId]` (in-memory, per session).

---

## 5. Canvas Hooks

### `useCanvasHistory`

Manages the undo/redo stack entirely in refs (no React state, no extra renders).

```typescript
function useCanvasHistory(
  nodesRef: MutableRefObject<Node[]>,
  edgesRef: MutableRefObject<Edge[]>,
  setNodes: SetNodes,
  setEdges: SetEdges,
  dbSync?: (target: Snapshot, before: Snapshot) => Promise<void>
): {
  pushHistory: () => void
  seedHistory: (nodes, edges) => void
  resetHistory: () => void
  undo: () => void
  redo: () => void
}
```

**Storage:** `useRef<{ nodes: Node[]; edges: Edge[] }[]>` with a pointer ref. Max 50 snapshots.

**DB sync on undo/redo:** The optional `dbSync` callback receives `(target, before)` snapshots. It diffs them to find edges/nodes that exist in `before` but not in `target` (i.e., were added after the target snapshot) and issues DELETE operations (`deleteSplice`, `deleteElement`, `updatePortStatusBatch`) to keep the DB in sync with the UI after an undo.

### `useCanvasKeyboard`

Registers global `keydown` / `keyup` listeners for all canvas shortcuts.

Arrow-key position saves are **debounced 300 ms** — holding a key for 1 second produces 1 DB write.

---

## 6. Fiber Tracing Engine

### Algorithm

BFS starting from a given port ID.

```
traceFromPort(startPortId, nodes, edges):
  1. Find the starting port.
  2. Enqueue startPortId.
  3. While queue is not empty:
     a. Dequeue portId.
     b. Mark visited.
     c. Find all splice edges on this port.
     d. For each splice, mark the edge as traced.
     e. Walk to the other end.
     f. If the other port belongs to a pass-through node:
        - Resolve the sibling port using the pass-through mapping.
        - Enqueue the sibling.
     g. Otherwise, mark as endpoint.
  4. Return { tracedEdgeIds, tracedNodeIds }.
```

### Pass-Through Node Logic

| Node Type | Port Mapping Rule |
|---|---|
| Closure | Input port N → Output port N (1-to-1) |
| Equipment | Input port N → Output port N (1-to-1) |
| Splitter | All output ports → Single corresponding input port (N-to-1) |
| Cable | No pass-through; endpoints only |
| Continuation | No pass-through; endpoints only |

### Color Resolution in PortHandle

`resolveTraceColor(edge)` walks upstream through pass-through nodes until it reaches a Cable node, then calls `getFiberHex(portIndex, colorScheme)`.

**Performance:** Only called when the port is actively traced (`traced === true`). Zero graph walking on idle canvases.

---

## 7. Auth System

### Overview

Authentication is handled by **Better Auth** with email + password credentials and cookie-based sessions. Sessions are persisted in the `"session"` table in Postgres — nothing runs on a third-party auth service.

### Middleware (`src/proxy.ts`)

Runs on every request matching `/((?!_next/static|_next/image|favicon.ico|.*\\....)`. Combines next-intl locale routing with the session gate:

- Requests to `/api/auth/*` bypass locale rewriting and the auth gate (Better Auth handles its own).
- Reads the current session via `auth.api.getSession({ headers: request.headers })`.
- If the route starts with `/dashboard` or `/canvas` and there is no valid session → redirect to `/[locale]/login`.
- If the route is `/login` or `/signup` and there IS a valid session → redirect to `/[locale]/dashboard`.

### Auth modules

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | Server-side `betterAuth({...})` instance. Reads `DATABASE_URL` (via the shared `pg` Pool) and `BETTER_AUTH_SECRET`. Email verification is off by default. |
| `src/lib/auth-client.ts` | Client-side `createAuthClient()` from `better-auth/react` — exports `signIn`, `signUp`, `signOut`, `useSession`. |
| `src/app/api/auth/[...all]/route.ts` | Catch-all route handler — `export const { GET, POST } = toNextJsHandler(auth)`. |
| `src/lib/guards.ts` | `requireAuthContext()` reads the session server-side, joins `organization_members`, and returns `{ userId, orgId, role }` used by every server action. |

### Session shape

Better Auth stores session cookies under an HTTP-only, `SameSite=Lax` cookie. Session records live in Postgres:

```
"session"
├── id           TEXT PK
├── userId       TEXT → "user"(id)
├── token        TEXT UNIQUE
├── expiresAt    TIMESTAMP
├── ipAddress    TEXT
└── userAgent    TEXT
```

Signing out (`authClient.signOut()`) deletes the row.

### Organization flow

1. Signup calls `authClient.signUp.email({ email, password, name })` — Better Auth creates rows in `"user"` and `"session"`.
2. The signup client then calls `createOrganization(orgName)` (Server Action), which invokes the `create_org_with_owner(name, user_id)` RPC atomically. If it succeeds, the user is added as `owner`.
3. Dashboard recovery: if the user reaches `/dashboard` without an organization (e.g. `createOrganization` failed on a flaky signup), `dashboard/page.tsx` provisions one silently and seeds the FTTH demo project.
4. Invite flow is token-based only (no email transport required). Owners call `createInviteToken()`; the raw token is shown once. Recipients open `/join/<token>`; `joinOrganizationByToken()` calls the `consume_invite_token` RPC, which atomically checks the cap and inserts a member row.
5. Per-org member cap comes from `MAX_MEMBERS_PER_ORG` (defaults to 5). The RPC also has its own `v_max_members` constant — keep them aligned.

---

## 8. Backend & Database

SpliceForge uses **vanilla PostgreSQL 13+** via the `pg` driver. The single source of truth for the schema is [`db/schema.sql`](../db/schema.sql), applied with `npm run db:init`.

The only extension used is `pgcrypto` (for `gen_random_uuid()`). No Postgres extensions specific to any hosting provider are required.

### DB client (`src/lib/db.ts`)

```ts
export const pool: Pool;                                    // shared connection pool (HMR-safe singleton)
export function query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
export function rows<T>(text: string, params?: unknown[]): Promise<T[]>;
export function maybeOne<T>(text: string, params?: unknown[]): Promise<T | null>;
export function withTransaction<T>(fn: (tx: { query: ... }) => Promise<T>): Promise<T>;
```

All parameters are `$1, $2, ...` positional placeholders — never string-interpolate user input. `withTransaction` wraps the callback in `BEGIN ... COMMIT` and rolls back on any thrown error.

### Table Summary

```
"user", "session", "account", "verification"   — Owned by Better Auth (quoted, camelCase columns)

organizations           — Tenant container (one per company)
organization_members    — User ↔ organization with role (owner | editor | viewer)
organization_invites    — Shareable invite link tokens (SHA-256 hashed)

projects                — Top-level logical container
  └── bedsheets         — Named set of pages
        └── pages       — Individual canvas view
              └── elements     — Nodes on the canvas
                    └── ports  — Connectable fiber endpoints
                          └── splices  — Connections between ports

library_cables          — Saved cable configurations (org-scoped)
```

### Multi-tenant isolation (app-level)

There is **no RLS**. Every server-action query filters by `organization_id = ctx.orgId`, where `ctx` comes from `requireAuthContext()` in `src/lib/guards.ts`. Reviewers should verify this filter on every new query — there is no DB-level backstop.

Helpers in `guards.ts`:

- `requireAuthContext()` — resolves the user's session (via Better Auth) and their org membership.
- `assertOrgOwnsRow(table, id, orgId)` and `assertOrgOwnsRows(table, ids, orgId)` — confirm rows exist within the caller's org before an update/delete. Table names are validated against a whitelist to prevent injection.
- `requireRole(ctx, allowed)` — enforce role gates for owner-only or editor+ actions.

### Data Flow

1. **Page load:** Server component calls `getPages(bedsheetId)`. `FiberCanvas` calls `getElements(pageId)` → `getPortsByElements(elementIds)` → `getSplicesByPortIds(portIds)`.
2. **Port fetching is paginated** — `getPortsByElements` returns via a single `WHERE element_id = ANY($1)` query; the app orders by `port_index`.
3. **Mutations** go through Server Actions and return the updated record.
4. **React state** is updated only after the server action resolves.

### RPCs

The three stored procedures are plain PL/pgSQL and defined in [`db/schema.sql`](../db/schema.sql):

| RPC | Purpose |
|---|---|
| `create_org_with_owner(p_name, p_user_id)` | Atomically insert an org + owner-member row. |
| `consume_invite_token(p_token_hash, p_user_id)` | Row-lock the invite, check expiry/cap, insert membership, decrement uses. |
| `import_bundle(p_page_id, p_payload, p_user_id)` | Ingest a full elements + ports + splices payload from the importer, all in one transaction. |

All three take `p_user_id TEXT` as an explicit parameter — none of them read from an implicit session variable.

---

## 9. Server Actions

All database mutations use **Next.js Server Actions** (`"use server"`) in `src/lib/actions/`.

### elements.ts

| Action | Signature | Description |
|---|---|---|
| `createElement` | `(pageId, type, label, x, y, configJson?)` → `Element` | Create a new canvas element |
| `updateElement` | `(id, updates)` → `void` | Update a single element's fields |
| `updateElementsBatch` | `(rows: { id, config_json }[])` → `void` | Batch update via `Promise.all` |
| `deleteElement` | `(id)` → `void` | Delete element (cascades to ports/splices) |
| `getElements` | `(pageId)` → `Element[]` | Fetch all elements on a page |

### ports.ts

| Action | Signature | Description |
|---|---|---|
| `createPorts` | `(elementId, count, startIndex?)` → `Port[]` | Bulk-insert ports |
| `getPortsByElements` | `(elementIds)` → `Port[]` | Paginated; no row limit |
| `updatePortStatus` | `(portId, status)` → `void` | Update a single port |
| `updatePortStatusBatch` | `(portIds, status)` → `void` | Update many ports in one query |
| `updatePortLabel` | `(portId, label)` → `void` | Set or clear a custom port label |

### splices.ts

| Action | Signature | Description |
|---|---|---|
| `createSplice` | `(portFrom, portTo, comment?, color?)` → `Splice` | Create a single splice |
| `createSplicesBatch` | `(pairs)` → `Splice[]` | Create many splices in one insert |
| `deleteSplice` | `(id)` → `void` | Delete a single splice |
| `deleteSplicesBatch` | `(ids)` → `void` | Delete many in one query |
| `updateSplice` | `(id, updates)` → `void` | Update comment or color |
| `getSplicesByPortIds` | `(portIds)` → `Splice[]` | Batches IDs in groups of 80 to avoid URL limits |

### pages.ts

`createPage`, `getPages`, `renamePage`, `deletePage`, `updatePageData`, `reorderPages`, `duplicatePage`

### organizations.ts

| Action | Description |
|---|---|
| `createOrganization(name)` | Call `create_org_with_owner` RPC — atomic org + owner-member insert |
| `getCurrentOrganization()` | Fetch the org of the current user (JOIN through `organization_members`) |
| `getOrgMembers()` | List all members joined against the Better Auth `"user"` table for email/name |
| `getCurrentUserRole()` | Return `'owner'` \| `'editor'` \| `'viewer'` \| `null` |
| `updateMemberRole(memberId, role)` | Change a member's role |
| `removeMember(memberId)` | Remove a member (blocks self-removal and last-owner removal) |

### invites.ts

| Action | Description |
|---|---|
| `createInviteToken()` | Generate a 64-char hex token; replaces any existing token |
| `getInviteToken()` | Fetch the current invite token for the user's org |
| `revokeInviteToken()` | Delete the current invite token |
| `validateInviteToken(token)` | Resolve token → `{ orgId, orgName }` (public, no auth) |
| `joinOrganizationByToken(token)` | Add current user as `editor` if token is valid |

### Other

- **projects.ts** — `createProject`, `getProjects`, `deleteProject`
- **bedsheets.ts** — `createBedsheet`, `getBedsheets`, `getBedsheet`, `renameBedsheet`, `deleteBedsheet`
- **library.ts** — `getLibraryCables`, `saveToLibrary`, `deleteLibraryCable`

---

## 10. Export Pipeline

PDF / PNG export uses `html-to-image` + `jsPDF` in `ExportDialog.tsx`.

### Steps

1. Determine scope: full canvas or traced-path-only.
2. If traced scope, hide all non-traced DOM elements via CSS classes.
3. Calculate bounding box using `getNodes()`.
4. Call `toPng(element, { pixelRatio: 2 })`.
5. For PNG: download data URL. For PDF: create `jsPDF`, add image, save.
6. Restore hidden elements.

### XLSX Export

1. Build Elements array from `nodes` state (label, type, config).
2. Build Connections array from `edges` state (source, target, ports, comment).
3. `xlsx.utils.json_to_sheet()` → workbook → `xlsx.writeFile()`.

---

## 11. Import Pipeline

XLSX import in `ImportDialog.tsx` runs three sequential phases.

### Phase 1 — Create Elements
Read Elements sheet → `createElement()` for each row → `elementMap` keyed by label.

### Phase 2 — Create Splices
Read Connections sheet → look up ports by index in `elementMap` → `createSplice()`.

### Phase 3 — Update Display
Re-fetch elements and ports → rebuild `nodes` + `edges` → update React Flow state.

Errors in any phase are collected and displayed without aborting the remaining import.

---

## 12. Undo / Redo System

Lives in `src/components/canvas/hooks/useCanvasHistory.ts`. Entirely in-memory; operates on refs to avoid triggering renders.

```typescript
const historyRef      = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
const historyIndexRef = useRef<number>(-1);
const MAX_HISTORY = 50;
```

### pushHistory

Called **before** any destructive mutation (delete, paste, bulk splice).

### seedHistory / resetHistory

- `seedHistory(nodes, edges)` — sets the initial post-load baseline.
- `resetHistory()` — clears the stack on page switch.

### undo / redo with DB Sync

On undo/redo, the history hook restores UI state via `setNodes` / `setEdges`, then calls the `dbSync` callback with `(targetSnapshot, beforeSnapshot)`.

`dbSync` (defined in `FiberCanvas.tsx`) diffs the two snapshots:
- Edges in `before` but not in `target` → call `deleteSplice(edgeId)`
- Nodes in `before` but not in `target` → call `deleteElement(nodeId)`
- Port handles of removed edges → call `updatePortStatusBatch(portIds, "unoccupied")`

This keeps the DB consistent with the UI state after an undo, so a page refresh will not re-introduce the undone changes.

> **Note:** History is in-memory only. Refreshing the page clears the undo stack entirely.

---

## 13. Performance Design

### React.memo on All Node/Edge Components

All seven node and edge components are wrapped in `React.memo`. Stable `onLabelChange` callbacks are created with `useCallback` in each parent node component to avoid breaking memo on PortHandle children.

### O(1) Trace Propagation

The trace effect builds `edgeById`, `portToEdgeId`, and `portToNode` Maps once per run, replacing all `Array.find()` calls with O(1) map lookups.

### Lazy Trace Color Resolution

`resolveTraceColor()` in `PortHandle` only runs when the port is actively traced. On a page with 2000 ports where 20 are traced, this avoids 1980 expensive graph walks per render cycle.

### Narrow Zustand Selectors

Each `useCanvasStore` call subscribes only to the required slice — a bulk port toggle re-renders only the two affected `PortHandle` instances.

### Batch Trace Entry Updates

All propagated trace entries are committed in one `batchAddTraceEntries` call instead of N consecutive `set()` calls.

### Debounced Arrow-Key Position Saves

300 ms trailing-edge debounce — holding an arrow key for 1 second produces 1 DB write.

### Paginated Port Fetching

`getPortsByElements` loops in 1000-row pages. No hard cap — works for pages with 2000+ ports.

---

## 14. Error Handling

### Pattern

Every server action is wrapped in try/catch. On failure, `toast.error()` from **sonner** is called.

```typescript
try {
  const splice = await createSplice(sourceHandle, targetHandle);
  setEdges((eds) => addEdge({ id: splice.id, ... }, eds));
} catch (err) {
  toast.error("Splice failed", {
    description: err instanceof Error ? err.message : "Could not save the connection.",
  });
}
```

### Rollback Behavior

| Scenario | Canvas impact |
|---|---|
| `onConnect` fails | No edge drawn — mutations guarded inside try block |
| `onNodesDelete` fails | Node removed visually; toast warns DB is out of sync |
| `onNodeDragStop` fails | Node stays in new position; toast warns position not saved |
| All bulk splice operations fail | No edges added — mutations inside try block |
| Page load fails | Canvas stays empty; toast explains failure |

---

## 15. UI Design System

### Theming Architecture

The app supports two themes toggled by the `.dark` class on `<html>`:

| Selector | Mode | Base Background |
|---|---|---|
| `:root` | Light | `#FFFFFF` foreground, `#0F172A` text |
| `.dark` | Dark (default) | `#05070C` background, `#F1F5F9` text |

`darkMode` in the Zustand store defaults to `true`. The toggle is in the **Settings** panel inside the sidebar and is persisted to `localStorage`.

### Color Tokens

```css
--fm-cyan:      #00E5FF   /* Primary accent; cables, active controls */
--fm-electric:  #3DF5A3   /* Equipment nodes, bulk connect, success */
--fm-amber:     #FCD34D   /* Splitter nodes */
--fm-violet:    #C4A7FF   /* Closure nodes */
--fm-purple:    #8b5cf6   /* Continuation nodes */
```

### Toolbar — Floating Pill

Absolutely positioned at `top: 14px`, centered horizontally. Three helper components: `IconBtn`, `ToolBtn`, `ToggleBtn`.

Tool color assignments:

| Tool | Accent color | Hex |
|---|---|---|
| Cable | Cyan | `#00E5FF` |
| Library | Light cyan | `#22D3EE` |
| Splitter | Amber | `#FCD34D` |
| Equipment | Electric green | `#3DF5A3` |
| Closure | Soft violet | `#C4A7FF` |
| Continuation | Purple | `#8b5cf6` |

### Status Bar

A floating pill at the **bottom center** of the canvas, inside the ReactFlow context.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  −  125%  +  ⊡  🔓  │  ⊕ 5 elements  │  ↔ 2 splices  │  x: 482 · y: 216  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Section | Implementation |
|---|---|
| Zoom `−` / `%` / `+` | `useViewport()` + `zoomIn()` / `zoomOut()` from `useReactFlow()` |
| Fit-to-view `⊡` | Calls `onFitView` prop (bound to `fitView()` in FiberCanvas) |
| Lock `🔓/🔒` | `useStoreApi().setState({ nodesDraggable, nodesConnectable, elementsSelectable })` — same approach as ReactFlow's built-in Controls |
| Element count | `useNodes().length` |
| Splice count | Counts closure rows where both `leftPorts[i]` AND `rightPorts[i]` are `occupied` — only real splices, not single-sided fiber entries |
| Cursor coordinates | `canvasStore.cursorPos` updated by `onMouseMove` in FiberCanvas |

### Node Glow System

Three visual states per node type: Default, Selected (cyan ring), Traced (trace-color ring).

| Node type | Accent color |
|---|---|
| Cable | `rgba(0,229,255,0.22)` |
| Splitter | `rgba(245,158,11,0.45)` |
| Equipment | `rgba(61,245,163,0.40)` |
| Closure | `rgba(168,85,247,0.50)` |
| Continuation | `rgba(139,92,246,0.50)` |
