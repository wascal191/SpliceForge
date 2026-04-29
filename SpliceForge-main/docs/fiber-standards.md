# Fiber Color Coding Standards

SpliceForge supports multiple international fiber optic color coding standards. This document explains each standard and how to use them in SpliceForge.

---

## What Are Fiber Color Standards?

In a multi-fiber cable, each individual fiber needs a unique identifier so technicians can distinguish them during splicing, testing, and troubleshooting. Color coding is the most common method. Different countries and manufacturers have adopted different standards, which is why SpliceForge supports several.

---

## Supported Standards

### EIA-598 (USA / International)

The most widely used standard globally, defined by the Telecommunications Industry Association (TIA) and Electronic Industries Alliance (EIA).

**12-Fiber Color Sequence:**

| Fiber # | Color |
|---|---|
| 1 | Blue |
| 2 | Orange |
| 3 | Green |
| 4 | Brown |
| 5 | Slate (Gray) |
| 6 | White |
| 7 | Red |
| 8 | Black |
| 9 | Yellow |
| 10 | Violet (Purple) |
| 11 | Rose (Pink) |
| 12 | Aqua (Turquoise) |

For cables with more than 12 fibers, the sequence repeats with a striped marker added to the buffer tube. For modular cables (e.g., 96-fiber with 8 modules of 12), each module uses the same 12-color sequence.

**When to use:** North America, most international projects, and anywhere EIA/TIA standards are specified.

---

### ABNT (Brazil)

The Brazilian standard, defined by ABNT (Associação Brasileira de Normas Técnicas). Similar to EIA-598 but with slight color variations.

**When to use:** Projects in Brazil or when working with Brazilian telecom operators.

---

### Turkish Standard (Turkcell / Turktelekom)

The color coding used by major Turkish telecommunications operators. Differs from EIA-598 in ordering and some color choices.

**When to use:** Projects in Turkey or when working with Turkish carriers.

---

### Dutch Standard (KPN)

The color coding used by KPN (the primary Dutch telecom operator) and other Dutch fiber providers.

**When to use:** Projects in the Netherlands or when working with Dutch operators.

---

### French Standard (France Telecom / Orange)

The color coding used by France Telecom (now Orange) and other French fiber providers.

**When to use:** Projects in France or when working with French operators.

---

### Ribbon Cable

Ribbon fiber cables arrange fibers in flat arrays (ribbons) rather than loose tubes. The color coding follows the ribbon structure.

**When to use:** When working with ribbon fiber cables, often found in high-density data center or backbone applications.

---

## How Colors Work in SpliceForge

### Color Display

Each port on a Cable node is displayed with a small colored dot matching its fiber's color according to the selected scheme. This lets technicians visually verify correct fiber identification.

### Color Schemes in Trace

When you trace a fiber path, SpliceForge follows the fiber from its source cable through all intermediate nodes (closures, splitters, equipment) and displays the path in the **originating fiber's color**. This means:

- If Fiber 1 (Blue in EIA-598) from Cable A is traced, the entire path from Cable A to its destination glows blue.
- This color is resolved dynamically by walking back upstream from any node to find the originating cable.

### Changing Color Scheme

When adding a Cable node, select the color scheme from the dialog dropdown. The scheme applies to that specific cable; different cables in the same project can use different schemes.

---

## Identifying Colors

If you're unsure what color a fiber is, you can check:

1. **Hover over a port** — a tooltip shows the fiber number and color name.
2. **Right-click a port → Trace** — the canvas highlights the path in that fiber's color.
3. **XLSX Export → Connections sheet** — the export includes color information for each splice.

---

## Standard Reference Table (EIA-598 for 24-Fiber Cable)

| Fiber # | Color | Module |
|---|---|---|
| 1 | Blue | Module 1 |
| 2 | Orange | Module 1 |
| 3 | Green | Module 1 |
| 4 | Brown | Module 1 |
| 5 | Slate | Module 1 |
| 6 | White | Module 1 |
| 7 | Red | Module 1 |
| 8 | Black | Module 1 |
| 9 | Yellow | Module 1 |
| 10 | Violet | Module 1 |
| 11 | Rose | Module 1 |
| 12 | Aqua | Module 1 |
| 13 | Blue (stripe) | Module 2 |
| 14 | Orange (stripe) | Module 2 |
| 15 | Green (stripe) | Module 2 |
| 16 | Brown (stripe) | Module 2 |
| 17 | Slate (stripe) | Module 2 |
| 18 | White (stripe) | Module 2 |
| 19 | Red (stripe) | Module 2 |
| 20 | Black (stripe) | Module 2 |
| 21 | Yellow (stripe) | Module 2 |
| 22 | Violet (stripe) | Module 2 |
| 23 | Rose (stripe) | Module 2 |
| 24 | Aqua (stripe) | Module 2 |
