# SpliceForge — User Guide

This guide walks you through every feature in SpliceForge, from creating your first project to exporting a full network diagram.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Account & Sign In](#2-account--sign-in)
3. [Dashboard — Managing Projects](#3-dashboard--managing-projects)
4. [The Canvas Interface](#4-the-canvas-interface)
5. [Node Types](#5-node-types)
6. [Creating and Connecting Nodes](#6-creating-and-connecting-nodes)
7. [Bulk Splice Tools](#7-bulk-splice-tools)
8. [Fiber Tracing](#8-fiber-tracing)
9. [Multi-Page Projects](#9-multi-page-projects)
10. [The Cable Library](#10-the-cable-library)
11. [Search](#11-search)
12. [Command Palette](#12-command-palette)
13. [Export](#13-export)
14. [Import](#14-import)
15. [Dark Mode & B&W Mode](#15-dark-mode--bw-mode)
16. [Canvas Lock](#16-canvas-lock)
17. [Error Notifications](#17-error-notifications)
18. [Undo & Redo](#18-undo--redo)
19. [Keyboard Shortcuts](#19-keyboard-shortcuts)

---

## 1. Overview

SpliceForge is organized into three levels:

```
Project
  └── Bedsheet (a drawing set / document)
        └── Page (an individual canvas view)
```

- A **Project** is the top-level container (e.g., "Downtown Network Expansion").
- A **Bedsheet** is a set of pages within that project (e.g., "Feeder Plant", "Distribution").
- A **Page** is a single canvas where you place and connect fiber nodes.

---

## 2. Account & Sign In

### Creating an Account

1. Go to `/signup` and enter your email and password.
2. After registration you are redirected to the **Dashboard**.

### Signing In

1. Go to `/login`, enter your credentials, and click **Sign in**.
2. You will be redirected to `/dashboard`. If you were trying to access a specific page, you will be redirected there instead.

### Organization Invites

If a colleague has sent you an invite link (`/join?token=...`):

1. Open the link in your browser.
2. Sign in or create an account if prompted.
3. You will automatically be added to their organization as an **editor**.

If you received an invite by email (magic link):

1. Click the link in the email.
2. You are taken to `/auth/callback`, which exchanges the token and redirects you to the dashboard.

---

## 3. Dashboard — Managing Projects

When you open SpliceForge, you land on the **Dashboard**.

### Creating a Project

1. Click **New Project**.
2. Enter a project name and optional description.
3. Click **Create**.

### Opening a Bedsheet

1. Click a project card to expand it.
2. Click a bedsheet name to open it on the canvas.
3. To create a new bedsheet, click **+ New Bedsheet** inside a project card.

### Renaming and Deleting

- Hover over a bedsheet to see rename and delete icons.
- Hover over a project card header for delete option.

> **Warning:** Deleting a project or bedsheet is permanent and removes all pages, elements, and connections inside it.

---

## 4. The Canvas Interface

Once you open a bedsheet, you see the canvas editor.

```
┌────────────────────── AppBar ──────────────────────────────────┐
│  SpliceForge Logo  /  Projects / My Project / Page 1              │
│                         [Canvas] [Grid]     [Share] [Export]   │
├─────────┬──────────────────────────────────────────────────────┤
│ Sidebar │                                                       │
│  Page 1 │           [Toolbar — top center]                     │
│  Page 2 │                                                       │
│  + Add  │           Canvas (React Flow)                        │
│         │                                                       │
│         │   [−  125%  +  ⊡  🔓 | ⊕ 5 elements | ↔ 2 splices]  │
└─────────┴──────────────────────────────────────────────────────┘
```

### Navigation

| Action | How |
|---|---|
| Pan the canvas | Click and drag on empty space |
| Zoom in/out | Mouse scroll wheel or `−` / `+` in the Status Bar |
| Fit all nodes to view | `Ctrl + Shift + F` or the ⊡ button in the Status Bar |
| Select a node | Click on it |
| Select multiple nodes | Hold `Shift` and click, or drag a selection box |
| Move a node | Click and drag the node |
| Nudge selected nodes | Arrow keys (10 px) or `Shift + Arrow` (40 px) |

### Status Bar

The pill at the bottom center shows real-time canvas information:

| Control | Description |
|---|---|
| `−` / `%` / `+` | Zoom out, current zoom level, zoom in |
| `⊡` | Fit all nodes to view |
| `🔓/🔒` | Lock / unlock canvas interactivity (see [Canvas Lock](#16-canvas-lock)) |
| `⊕ N elements` | Total number of nodes on the current page |
| `↔ N splices` | Number of completed splices (closure rows with both sides occupied) |
| `x: … · y: …` | Real-time cursor position in canvas coordinates |

### Context Menu

Right-click on empty canvas space to get a context menu with:
- **Collapse All** — Collapses all nodes to save space
- **Expand All** — Expands all nodes

### Snap to Grid

Open the sidebar **Settings** panel and toggle **Snap to Grid**. When active, nodes snap to a 10 px grid as you drag them. Toggle again to disable.

---

## 5. Node Types

SpliceForge has five types of nodes, each representing a real-world fiber optic component.

### Cable Node

Represents a fiber optic cable with individual fibers.

**Properties:**
- **Label** — Cable name (e.g., "Trunk-01")
- **Fiber Count** — Total number of fibers (e.g., 12, 24, 48, 96, 144…)
- **Color Scheme** — The fiber identification standard (EIA-598, ABNT, etc.)
- **Module Fiber Count** — (Optional) Groups fibers into modules (e.g., 12 fibers per module in a 96-fiber cable = 8 modules)

**Ports:** Each fiber has a port on the left side (input) and right side (output). Ports are color-coded according to the selected color scheme.

**Port labels:** Hover over any port to see a tooltip with the port label (if set). Double-click a port or right-click → **Set label…** to add a custom label.

**Module grouping:** When a Module Fiber Count is set, fibers are displayed in labeled module groups. Each module can be independently collapsed or expanded by clicking its header.

**Right-click menu on a Cable node:**
- Rename
- Collapse / Expand all modules
- Save to Library (saves this cable config for reuse)
- Delete

### Splitter Node

Represents an optical power splitter (e.g., 1:2, 1:4, 1:8, 1:16).

**Properties:**
- **Label** — Splitter name
- **Ratio** — Split ratio (e.g., "1:8")
- **Input Count** — Number of input fibers
- **Output Count** — Number of output fibers

**How it works:** One input port carries signal to all corresponding output ports. The trace engine automatically propagates fiber colors from the input through all outputs.

### Equipment Node

Represents pass-through equipment such as a ROADM, transponder, ODF panel, or splice tray.

**Properties:**
- **Label** — Equipment name
- **Input Count** — Number of input ports
- **Output Count** — Number of output ports

**How it works:** Input port N connects directly to Output port N (1-to-1 mapping).

### Closure Node

Represents a fiber optic splice closure with a tray-based port layout.

**Properties:**
- **Label** — Closure name (e.g., "FOSC-369")
- **Ports / tray** — Number of splice positions per tray (6, 12, or 24)
- **Trays** — Number of splice trays inside the closure

**Port layout:** Ports are grouped by tray. Each tray holds `portsPerSide × 2` ports (one left, one right). Total ports = `trays × portsPerSide × 2`.

**Splice counting:** A splice is counted only when **both** the left port AND the right port at the same tray row are occupied. A single occupied port means fiber entered the closure but has not been spliced through — this is intentional domain behavior.

**Tray header badge** shows `spliced / total positions` (e.g., `2/12`).

**Tray notes:** Each tray has an optional annotation field. Click the note area next to a tray header to add or edit a short description.

**Individual tray collapse:** Click any tray header to collapse or expand it independently. Right-clicking a tray header offers:
- **Collapse / Expand this tray**
- **Clear tray splices** — removes all splice connections within that tray

### Continuation Node

A special virtual node used to link two pages together. It appears as a purple node.

**Properties:**
- **Label** — Descriptive name for the continuation
- **Target Page** — The page this node points to

**How it works:**
1. When you add a Continuation node, you select which page it links to.
2. The node shows `→ <target page name>` in purple.
3. **Clicking the `→ Page Name` row navigates directly to that page.** The canvas switches to the target page instantly.
4. Connect fiber ports to the Continuation node's handles to model fibers crossing page boundaries.

> **Tip:** Continuation nodes require at least two pages in the bedsheet. The **Cont.** button in the toolbar is always visible; if you open it with only one page, a message prompts you to create another page first.

---

## 6. Creating and Connecting Nodes

### Adding a Node

1. Click the appropriate button in the **Toolbar** (top center of the canvas):
   - **Cable** — Add a cable node
   - **Library** — Add from saved cable library
   - **Splitter** — Add a splitter node
   - **Equipment** — Add equipment
   - **Closure** — Add a splice closure
   - **Cont.** — Add a cross-page continuation node (purple dot)

2. Fill in the dialog (label, fiber count, etc.).

3. **Quantity field:** Every creation dialog (except Continuation) includes a **Quantity** field. Enter a number greater than 1 to add multiple identical nodes at once — they are automatically numbered (e.g., "Cable-1", "Cable-2", "Cable-3").

4. Click **Add**. The node(s) appear on the canvas. Drag them to position.

### Creating a Splice (Connection)

A splice connects one fiber port to another fiber port.

1. **Click** on a source port (the small colored circle on a node).
2. A blue draggable line appears.
3. **Click** on the destination port to complete the splice.

> **Tip:** Ports turn orange when occupied (already connected).

### Reconnecting an Existing Splice

1. Click on the splice edge to select it.
2. Drag either endpoint handle (source or destination) to a new port.
3. Release on the target port — the splice updates in place.

### Deleting Nodes and Splices

- **Delete a node:** Select it, then press `Delete` or `Backspace`.
- **Delete a splice:** Click the splice edge to select it, then press `Delete` or `Backspace`.
- **Delete multiple:** Select multiple with `Shift` + click or drag-select, then press `Delete`.

### Copy & Paste Nodes

- **Copy:** Select one or more nodes, press `Ctrl + C`.
- **Paste:** Press `Ctrl + V`. Pasted nodes appear offset from the originals.

### Port Custom Labels

Any port can have a custom text label saved to the database.

1. **Double-click** any port — an inline text field opens next to the handle.
2. Type the label and press `Enter`.
3. Alternatively, **right-click** → **Set label…** for the same editor.
4. To remove a label, open the editor and clear the field.

Saved labels appear as a tooltip on hover and are shown inline in the port row on Cable and Closure nodes.

### Splice Comments / Notes

You can attach a text note to any splice connection:

1. Right-click on a splice edge.
2. Select **Edit Note**.
3. Type a comment and press `Enter`.
4. The comment appears as a label on the splice line.

**Repositioning a splice label:** Drag the label to any position along the splice line.

To copy/paste notes between splices:
- Right-click a port on a spliced connection → **Copy note**
- Right-click another port → **Paste note**

---

## 7. Bulk Splice Tools

### Quick Bulk Splice (`Alt + Shift + C`)

The fastest way to splice two cables fiber-by-fiber in order:

1. Select exactly two cable nodes (hold `Shift` and click both).
2. Press `Alt + Shift + C`.
3. All fiber pairs are spliced simultaneously (port 0↔0, port 1↔1, …).

### Bulk Connect Mode

Lets you hand-pick specific ports on two nodes and connect them in click order.

1. Click the **Bulk** button in the toolbar. The indicator shows `A: 0 · B: 0`.
2. Click ports on the **first node** — they turn **teal** (group A).
3. Click ports on the **second node** — they turn **purple** (group B).
4. When both groups have ports, **right-click** on empty canvas space → **Connect Bulk Ports**.
5. Ports are paired in order (A1↔B1, A2↔B2, …).
6. To cancel: click **✕ Bulk** or press `Escape`.

### Range Splice Dialog

Click the **Range** button in the toolbar for precise port-range control.

| Field | Description |
|---|---|
| Node A | Select the source node |
| Node B | Select the destination node |
| From (Port) | First port to splice on Node A (1-based) |
| To (Port) | Last port to splice on Node A (1-based) |
| Destination Offset | Shift the starting port on Node B |
| Side (A / B) | Filter to Left ports, Right ports, or Both |
| Respect boundaries | Skip ports that would cross a module (cable) or tray (closure) boundary |

A live preview shows exactly which port pairs will be created before you confirm.

---

## 8. Fiber Tracing

Fiber tracing highlights a specific fiber path through the network.

### Starting a Trace

**Option 1 — Click a port:** If the port has a splice, click it to toggle the trace on/off.

**Option 2 — Right-click → Trace from here:** Always opens a trace from that port.

The trace highlights all connected nodes and splice edges in the fiber's color.

### What the Trace Does

- Follows splices (edges) from the starting port.
- Automatically passes through **Closure**, **Equipment**, and **Splitter** nodes.
- Assigns colors based on the fiber's color scheme and port index.
- Multiple simultaneous traces are supported with different colors.

### Clearing a Trace

- Press `Escape` to clear all traces.
- Click a traced port to clear just that trace.

### Tracing All Connections

Right-click any node → **Trace All Connections** to trace every fiber through that node simultaneously.

---

## 9. Multi-Page Projects

For large networks, spread your design across multiple pages within a bedsheet.

### Page Sidebar

The left sidebar lists all pages. You can:
- **Add a page** — Click **+** at the bottom, or use the Grid view **+ Add Page**.
- **Switch pages** — Click a page name, or use `Ctrl + P` command palette.
- **Rename** — Double-click the page name, or right-click → **Rename**.
- **Reorder** — Drag a page up or down.
- **Duplicate** — Right-click → **Duplicate**.
- **Delete** — Right-click → **Delete** (only when more than one page exists).
- **Set page color** — Right-click → color picker.

### Page Header Fields

Each page can store metadata shown in the breadcrumb:
- **Node Name** (e.g., "Central Office")
- **Address**
- **Description**

### Cross-Page Continuation

To link a fiber path from one page to another:

**Method 1 — Toolbar button:**
1. Click **Cont.** in the toolbar.
2. Choose the target page from the dialog.
3. A Continuation node is placed on the canvas. Connect fiber ports to it.
4. **Click the `→ Page Name` label** on the node to jump to the target page.

**Method 2 — Port context menu:**
1. Right-click a port.
2. Select **Continue to page…**.
3. A Continuation node is automatically created and connected to that port.

### Grid View

Click **Grid** in the AppBar to see all pages as a thumbnail grid. Click any thumbnail to switch to that page.

### Responsive Layout

On smaller screens (tablet), the page sidebar is hidden by default. Use the **hamburger icon** (☰) in the AppBar to toggle it. Tapping outside the sidebar closes it automatically.

---

## 10. The Cable Library

Save frequently used cable configurations for quick reuse.

### Saving to Library

1. Right-click a Cable node.
2. Select **Save to Library**.

### Using Library Cables

1. Click **Library** in the toolbar.
2. Click a cable to add it to the canvas.

### Deleting from Library

In the Library dialog, click `×` next to a cable to remove it.

---

## 11. Search

Press `Ctrl + F` or click the search input in the top-right corner.

1. Type to filter — results update in real time.
2. Results show matching **nodes** (by label) and **edges** (by comment).
3. Click a result to center and zoom to that element.
4. Click `×` or press `Escape` to clear.

---

## 12. Command Palette

Press `Ctrl + P` to open the page switcher.

1. Start typing a page name — results filter in real time.
2. Press `Enter` or click a result to switch to that page.
3. Press `Escape` to close.

---

## 13. Export

Click the **Export** button in the AppBar, or press `Ctrl + E`.

### PDF / PNG (Visual)

- **Scope:** Full canvas, or traced-path-only.
- **B&W Mode:** Convert to grayscale.
- **Format:** PDF or PNG.

### XLSX (Spreadsheet)

Exports two sheets:
- **Elements:** All nodes with type, label, and config.
- **Connections:** All splices with source element, source port, destination element, destination port, and comment.

### Print

Opens the browser's print dialog with the current canvas view.

---

## 14. Import

Click the **Import** button in the toolbar.

### XLSX File Format

The import file must have exactly two sheets:

**Sheet 1: Elements**

| Column | Description |
|---|---|
| Type | `cable`, `splitter`, `equipment`, or `closure` |
| Label | Node display name |
| FiberCount | Number of fibers or ports |
| ColorScheme | Color standard (e.g., `EIA598`) |
| ModuleFiberCount | Fibers per module (optional, cables only) |

**Sheet 2: Connections**

| Column | Description |
|---|---|
| FromElement | Label of the source element |
| FromPort | Port index (1-based) |
| ToElement | Label of the destination element |
| ToPort | Port index (1-based) |
| Comment | Optional note for the splice |

---

## 15. Dark Mode & B&W Mode

Both settings live in the **Settings** panel inside the left sidebar (click the gear icon).

### Dark Mode

Toggle **Light Mode** in Settings to switch between the dark (default) and light theme. Your preference is remembered across sessions via `localStorage`.

### B&W Mode

Toggle **B&W Mode** in Settings (or press `Ctrl + B`) to apply a grayscale filter to the entire canvas. Useful for black-and-white printing or accessibility.

---

## 16. Canvas Lock

Click the **lock icon** (🔓/🔒) in the Status Bar to toggle canvas interactivity.

- **Unlocked (🔓):** Normal mode — you can drag nodes, create connections, and select elements.
- **Locked (🔒):** Read-only mode — the canvas is frozen. Nodes cannot be moved, connections cannot be created, and nothing can be selected. The lock button turns amber when active.

This is useful when presenting a diagram and you want to prevent accidental edits.

---

## 17. Error Notifications

SpliceForge displays a toast notification in the **bottom-right corner** whenever a database operation fails.

The notification shows:
- A short title describing which action failed.
- A detail line with the specific error message from the server.
- A close button (also auto-dismisses).

**What to do:**
1. Check your internet connection.
2. Try the action again — most failures are transient.
3. If "Position not saved" appears after dragging, reload the page — the position will revert to the last saved location.
4. If a splice or node appears visually but the save failed, use `Ctrl + Z` to undo, then retry.

---

## 18. Undo & Redo

SpliceForge keeps a history of up to **50 snapshots** per page per session.

| Action | How |
|---|---|
| Undo | `Ctrl + Z` or the ↩ button in the toolbar |
| Redo | `Ctrl + Y` or `Ctrl + Shift + Z` or the ↪ button |

Undo is **DB-synced** — undoing a splice deletion or node deletion also reverses the database change, so refreshing the page will not re-introduce the undone state.

> **Note:** History is in-memory only. Refreshing the page clears the undo stack.

---

## 19. Keyboard Shortcuts

See the full [Keyboard Shortcuts Reference](keyboard-shortcuts.md) for a complete list.

Quick summary:

| Shortcut | Action |
|---|---|
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + C` | Copy selected nodes |
| `Ctrl + V` | Paste nodes |
| `Ctrl + A` | Select all nodes |
| `Ctrl + F` | Open search |
| `Ctrl + B` | Toggle B&W mode |
| `Ctrl + P` | Open command palette (page switcher) |
| `Ctrl + E` | Open export dialog |
| `Ctrl + Shift + F` | Fit view |
| `Alt + Shift + C` | Quick bulk splice selected cables |
| `?` | Show keyboard shortcut reference |
| `Escape` | Clear trace, cancel bulk connect, deselect all |
| Arrow keys | Nudge selected node 10 px |
| `Shift + Arrow` | Nudge selected node 40 px |
| `Delete / Backspace` | Delete selected node or splice |
