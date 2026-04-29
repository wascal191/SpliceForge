# SpliceForge — Data Model Reference

This document describes the TypeScript types used in SpliceForge and the underlying Supabase database schema.

---

## Table of Contents

1. [TypeScript Types](#1-typescript-types)
2. [Database Schema](#2-database-schema)
3. [How Database Maps to Canvas](#3-how-database-maps-to-canvas)

---

## 1. TypeScript Types

All core types are in `src/types/fiber.ts`.

### ElementType

```typescript
type ElementType = "cable" | "splitter" | "equipment" | "closure"
// Note: "continuation" nodes use element type "equipment" in the DB
// but render as type "continuation" in React Flow (set in config_json).
```

### FiberPort

Represents a single connectable port on any node.

```typescript
type FiberPort = {
  id: string           // Supabase UUID
  elementId: string    // Parent node ID
  portIndex: number    // 0-based position (maps to fiber number)
  colors: string[]     // Hex color values from the color scheme
  status: "unoccupied" | "occupied"
  side: "left" | "right"   // Which side of the node this port is on
  label?: string            // Optional custom label (e.g. "DST-1736 / Rio Bayamón")
}
```

---

### Node Data Types

Each node type has its own data shape, stored in React Flow's `node.data` field. All fields marked `?` are optional.

#### CableNodeData

Represents a fiber optic cable.

```typescript
type CableNodeData = {
  label: string
  fiberCount: number            // Total fibers (e.g., 12, 24, 48, 96, 144)
  colorScheme?: string          // e.g., "EIA598", "ABNT"
  moduleFiberCount?: number     // If set, groups fibers into modules of this size
  collapsedModules?: number[]   // Indices of collapsed module groups
  collapsed?: boolean           // If true, shows compact single-row view
  ports: FiberPort[]
}
```

**Ports layout:**
- Left ports: indices `0` to `fiberCount - 1` (input side)
- Right ports: indices `fiberCount` to `2 * fiberCount - 1` (output side)

**Module grouping:** If `moduleFiberCount` is set (e.g. `12` for a 96-fiber cable), fibers are grouped into `fiberCount / moduleFiberCount` modules (e.g. 8 modules of 12). Each module can be independently collapsed.

#### SplitterNodeData

Represents an optical power splitter.

```typescript
type SplitterNodeData = {
  label: string
  ratio: string         // Display string, e.g., "1:8"
  inputCount: number    // Number of input ports
  outputCount: number   // Number of output ports
  collapsed?: boolean
  ports: FiberPort[]
}
```

#### EquipmentNodeData

Represents pass-through equipment (ROADM, transponder, ODF panel, etc.).

```typescript
type EquipmentNodeData = {
  label: string
  inputCount: number
  outputCount: number
  collapsed?: boolean
  ports: FiberPort[]
}
```

#### ClosureNodeData

Represents a fiber optic splice closure with tray-based port layout.

```typescript
type ClosureNodeData = {
  label: string
  inputCount: number           // Input ports per tray
  outputCount: number          // Output ports per tray (always equals inputCount)
  trayCount?: number           // Number of splice trays
  collapsed?: boolean          // If true, shows compact single-row view
  collapsedTrays?: number[]    // Tray indices that are individually collapsed
  trayNotes?: Record<number, string>  // Optional annotation per tray index
  ports: FiberPort[]
}
```

**Port layout:** Ports are grouped by tray. Each tray holds `inputCount + outputCount` ports. Total ports = `trayCount × (inputCount + outputCount)`.

**Splice semantics:** A real splice exists at tray row `i` only when both `leftPorts[i].status === "occupied"` AND `rightPorts[i].status === "occupied"`. A single occupied port on one side is a fiber entry, not a completed splice.

#### ContinuationNodeData

Represents a cross-page link node (virtual, not a physical device).

```typescript
type ContinuationNodeData = {
  label: string
  targetPageId: string    // UUID of the page this node links to
  targetPageLabel: string // Display name of the target page
  ports: FiberPort[]
}
```

Clicking the `→ <targetPageLabel>` label on the node navigates directly to the target page.

---

### React Flow Node and Edge Types

```typescript
type FiberNode =
  | Node<CableNodeData,        "cable">
  | Node<SplitterNodeData,     "splitter">
  | Node<EquipmentNodeData,    "equipment">
  | Node<ClosureNodeData,      "closure">
  | Node<ContinuationNodeData, "continuation">

type SpliceEdgeData = {
  comment?: string
  labelOffset?: { x: number; y: number }
}

type FiberEdge = Edge<SpliceEdgeData, "splice">
```

---

## 2. Database Schema

SpliceForge uses Supabase (PostgreSQL). The full SQL DDL with indexes, constraints, and RLS policies is in `docs/sql-schema.sql`. Below is a human-readable summary.

### organizations

Top-level tenant container. One per company.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `name` | `text` NOT NULL | Company/team name |
| `plan` | `text` NOT NULL DEFAULT `'trial'` | `'trial'` \| `'pro'` \| `'enterprise'` |
| `api_base_url` | `text` | Optional custom API endpoint |
| `created_at` | `timestamptz` | Auto-set on insert |

### organization_members

Maps Supabase auth users to an organization with a role.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `organization_id` | `uuid` FK → organizations.id | Parent organization |
| `user_id` | `uuid` FK → auth.users.id | Supabase auth user |
| `role` | `text` NOT NULL DEFAULT `'editor'` | `'owner'` \| `'editor'` \| `'viewer'` |
| `created_at` | `timestamptz` | Auto-set on insert |

### organization_invites

One active invite link per organization.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `organization_id` | `uuid` FK → organizations.id | Parent organization |
| `token` | `text` UNIQUE NOT NULL | 64-char hex token (crypto.randomBytes) |
| `created_by` | `uuid` FK → auth.users.id | User who generated the link |
| `created_at` | `timestamptz` | Auto-set on insert |

### projects

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `name` | `text` NOT NULL | Project display name |
| `description` | `text` | Optional description |
| `created_at` | `timestamptz` | Auto-set on insert |

### bedsheets

A named collection of pages within a project.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `project_id` | `uuid` FK → projects.id | Parent project (CASCADE delete) |
| `name` | `text` NOT NULL | Bedsheet display name |
| `created_at` | `timestamptz` | Auto-set on insert |

### pages

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `bedsheet_id` | `uuid` FK → bedsheets.id | Parent bedsheet (CASCADE delete) |
| `page_index` | `integer` NOT NULL | 0-based order within the bedsheet |
| `title` | `text` | Page display name (nullable) |
| `data_json` | `jsonb` | Page metadata: `{ color?, header?: { nodeName?, address?, description? } }` |
| `created_at` | `timestamptz` | Auto-set on insert |

### elements

A physical or logical component on a page.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `page_id` | `uuid` FK → pages.id | Parent page (CASCADE delete) |
| `type` | `text` NOT NULL | `cable` \| `splitter` \| `equipment` \| `closure` \| `continuation` |
| `label` | `text` NOT NULL | Display name shown on the node |
| `position_x` | `float` NOT NULL | X position on canvas |
| `position_y` | `float` NOT NULL | Y position on canvas |
| `config_json` | `jsonb` | Type-specific config (see examples below) |
| `created_at` | `timestamptz` | Auto-set on insert |

**config_json examples:**

Cable:
```json
{ "fiberCount": 48, "colorScheme": "EIA598", "moduleFiberCount": 12 }
```

Splitter:
```json
{ "ratio": "1:8", "inputCount": 1, "outputCount": 8 }
```

Closure:
```json
{ "inputCount": 12, "outputCount": 12, "trayCount": 4, "collapsedTrays": [], "trayNotes": {} }
```

Continuation:
```json
{
  "nodeType": "continuation",
  "targetPageId": "uuid-of-target-page",
  "targetPageLabel": "Page 2",
  "inputCount": 1,
  "outputCount": 1
}
```

### ports

Individual connectable ports on an element.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `element_id` | `uuid` FK → elements.id | Parent element (CASCADE delete) |
| `port_index` | `integer` NOT NULL | 0-based fiber index |
| `colors` | `text[]` | Array of hex color strings for this fiber |
| `status` | `text` NOT NULL | `unoccupied` or `occupied` |
| `label` | `text` | Optional custom label. Nullable. |
| `created_at` | `timestamptz` | Auto-set on insert |

### splices

A connection between two ports (a canvas edge).

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `port_from` | `uuid` FK → ports.id | Source port (CASCADE delete) |
| `port_to` | `uuid` FK → ports.id | Destination port (CASCADE delete) |
| `comment` | `text` | Optional text annotation shown as edge label |
| `color` | `text` | Hex color (used for trace display) |
| `created_at` | `timestamptz` | Auto-set on insert |

### library_cables

User-saved cable configurations.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PRIMARY KEY | Auto-generated |
| `name` | `text` NOT NULL | User-given name |
| `fiber_count` | `integer` NOT NULL | Total fibers |
| `color_scheme` | `text` NOT NULL | Color standard identifier |
| `module_fiber_count` | `integer` | Optional module grouping size |
| `created_at` | `timestamptz` | Auto-set on insert |

---

## 3. How Database Maps to Canvas

When a page is loaded, the data goes through this transformation:

```
Supabase
  ├── elements rows          ──→  React Flow Node[]
  ├── ports rows             ──→  node.data.ports[]
  └── splices rows           ──→  React Flow Edge[]
```

### Element → Node Mapping

```typescript
{
  id: element.id,
  type: element.type,           // "cable" | "splitter" | "equipment" | "closure" | "continuation"
  position: {
    x: element.position_x,
    y: element.position_y,
  },
  data: {
    label: element.label,
    ...element.config_json,     // spread type-specific config
    ports: portsForThisElement  // FiberPort[] with side assigned at load time
  }
}
```

### Splice → Edge Mapping

```typescript
{
  id: splice.id,
  type: "splice",
  source: portFromElementId,
  sourceHandle: splice.port_from,   // port UUID used as handle ID
  target: portToElementId,
  targetHandle: splice.port_to,     // port UUID used as handle ID
  data: {
    comment: splice.comment,
    color: splice.color
  }
}
```

### Port Side Assignment

Port `side` (`"left"` or `"right"`) is not stored in the database — it is computed at load time in `FiberCanvas.tsx` based on `port_index` relative to `inputCount`:

```typescript
// For standard nodes:
side = port_index < inputCount ? "left" : "right"

// For closure nodes (ports grouped per tray):
side = (port_index % portsPerTray) < inputCount ? "left" : "right"
```
