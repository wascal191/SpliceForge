import { describe, it, expect } from "vitest";
import { pairPorts } from "@/lib/canvas/bulkSplicePairing";
import type { FiberPort } from "@/types/fiber";

function makePorts(ids: string[], status: "occupied" | "unoccupied" = "unoccupied"): FiberPort[] {
  return ids.map((id, i) => ({
    id,
    elementId: "n",
    portIndex: i,
    side: "left",
    status,
    colors: [],
  }));
}

describe("pairPorts", () => {
  it("pairs N → N with offset 0", () => {
    const portsA = makePorts(["a0", "a1", "a2"]);
    const portsB = makePorts(["b0", "b1", "b2"]);

    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 3,
      destOffset: 0,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
    });

    expect(r.pairs).toEqual([
      { portFrom: "a0", portTo: "b0" },
      { portFrom: "a1", portTo: "b1" },
      { portFrom: "a2", portTo: "b2" },
    ]);
    expect(r.warnings).toHaveLength(0);
  });

  it("applies destOffset", () => {
    const portsA = makePorts(["a0", "a1"]);
    const portsB = makePorts(["b0", "b1", "b2", "b3"]);

    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 2,
      destOffset: 2,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
    });

    expect(r.pairs).toEqual([
      { portFrom: "a0", portTo: "b2" },
      { portFrom: "a1", portTo: "b3" },
    ]);
  });

  it("skips occupied source ports silently", () => {
    const portsA: FiberPort[] = [
      { id: "a0", elementId: "n", portIndex: 0, side: "left", status: "unoccupied", colors: [] },
      { id: "a1", elementId: "n", portIndex: 1, side: "left", status: "occupied", colors: [] },
      { id: "a2", elementId: "n", portIndex: 2, side: "left", status: "unoccupied", colors: [] },
    ];
    const portsB = makePorts(["b0", "b1", "b2"]);

    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 3,
      destOffset: 0,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
    });

    expect(r.pairs).toEqual([
      { portFrom: "a0", portTo: "b0" },
      { portFrom: "a2", portTo: "b2" },
    ]);
    // Occupied source is just skipped — not a warning, per the original behavior.
    expect(r.warnings).toHaveLength(0);
  });

  it("warns when destination is occupied or missing", () => {
    const portsA = makePorts(["a0", "a1"]);
    const portsB: FiberPort[] = [
      { id: "b0", elementId: "n", portIndex: 0, side: "left", status: "occupied", colors: [] },
    ];

    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 2,
      destOffset: 0,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
      nodeALabel: "CableA",
    });

    expect(r.pairs).toHaveLength(0);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain("CableA");
  });

  it("handles negative destOffset", () => {
    const portsA = makePorts(["a0", "a1", "a2"]);
    const portsB = makePorts(["b0", "b1", "b2"]);

    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 3,
      destOffset: -1,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
    });

    // a0 → b[-1] (warn), a1 → b0, a2 → b1
    expect(r.pairs).toEqual([
      { portFrom: "a1", portTo: "b0" },
      { portFrom: "a2", portTo: "b1" },
    ]);
    expect(r.warnings).toHaveLength(1);
  });

  it("respects module boundaries when enabled", () => {
    const portsA = makePorts(["a0", "a1", "a2", "a3"]);
    const portsB = makePorts(["b0", "b1", "b2", "b3"]);

    // modSize 2 → groups [0,1] and [2,3]. Offset 1 would pair a1 (group 0)
    // with b2 (group 1), violating the boundary.
    const r = pairPorts({
      portsA,
      portsB,
      fromPort: 1,
      toPort: 4,
      destOffset: 1,
      respectBoundaries: true,
      modSizeA: 2,
      modSizeB: 2,
    });

    expect(r.pairs).toEqual([
      { portFrom: "a0", portTo: "b1" }, // both in group 0 ✓
      { portFrom: "a2", portTo: "b3" }, // both in group 1 ✓
    ]);
    expect(r.warnings).toHaveLength(2);
  });

  it("returns empty when range is inverted", () => {
    const portsA = makePorts(["a0", "a1"]);
    const r = pairPorts({
      portsA,
      portsB: makePorts(["b0", "b1"]),
      fromPort: 5,
      toPort: 2,
      destOffset: 0,
      respectBoundaries: false,
      modSizeA: 0,
      modSizeB: 0,
    });
    expect(r.pairs).toHaveLength(0);
  });
});
