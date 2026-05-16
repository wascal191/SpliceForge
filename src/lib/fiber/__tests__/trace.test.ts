import { describe, it, expect } from "vitest";
import { traceFromPort } from "@/lib/fiber/trace";
import type { Node, Edge } from "@xyflow/react";

function makeNode(id: string, type: string, portIds: string[]): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { ports: portIds.map((pid) => ({ id: pid })) },
  };
}

function makeSplice(id: string, srcPort: string, dstPort: string): Edge {
  return {
    id,
    source: "",
    target: "",
    sourceHandle: srcPort,
    targetHandle: dstPort,
  };
}

describe("traceFromPort", () => {
  it("walks across a single splice", () => {
    const nodes = [
      makeNode("cableA", "cable", ["pA1"]),
      makeNode("cableB", "cable", ["pB1"]),
    ];
    const edges = [makeSplice("s1", "pA1", "pB1")];

    const r = traceFromPort("pA1", nodes, edges);
    expect(r.nodeIds.has("cableA")).toBe(true);
    expect(r.nodeIds.has("cableB")).toBe(true);
    expect(r.edgeIds.has("s1")).toBe(true);
  });

  it("passes through closures and equipment via sibling ports", () => {
    const nodes = [
      makeNode("cableA", "cable", ["pA1"]),
      makeNode("closure1", "closure", ["pC_in", "pC_out"]),
      makeNode("cableB", "cable", ["pB1"]),
    ];
    const edges = [
      makeSplice("s1", "pA1", "pC_in"),
      makeSplice("s2", "pC_out", "pB1"),
    ];

    const r = traceFromPort("pA1", nodes, edges);
    expect(r.nodeIds.has("cableA")).toBe(true);
    expect(r.nodeIds.has("closure1")).toBe(true);
    expect(r.nodeIds.has("cableB")).toBe(true);
    expect(r.edgeIds.has("s1")).toBe(true);
    expect(r.edgeIds.has("s2")).toBe(true);
  });

  it("does NOT pass through plain cables (no sibling traversal)", () => {
    // cableA is the start, cableMiddle has two ports but trace should not jump
    // from pM1 to pM2 because cables aren't through-elements.
    const nodes = [
      makeNode("cableA", "cable", ["pA1"]),
      makeNode("cableMiddle", "cable", ["pM1", "pM2"]),
      makeNode("cableB", "cable", ["pB1"]),
    ];
    const edges = [
      makeSplice("s1", "pA1", "pM1"),
      makeSplice("s2", "pM2", "pB1"),
    ];

    const r = traceFromPort("pA1", nodes, edges);
    expect(r.nodeIds.has("cableA")).toBe(true);
    expect(r.nodeIds.has("cableMiddle")).toBe(true);
    // cableB should NOT be reached because cables don't cross fibers.
    expect(r.nodeIds.has("cableB")).toBe(false);
    expect(r.edgeIds.has("s2")).toBe(false);
  });

  it("handles cycles without infinite looping", () => {
    const nodes = [
      makeNode("closure1", "closure", ["p1", "p2"]),
      makeNode("closure2", "closure", ["p3", "p4"]),
    ];
    const edges = [
      makeSplice("s1", "p1", "p3"),
      makeSplice("s2", "p2", "p4"),
    ];

    const r = traceFromPort("p1", nodes, edges);
    expect(r.nodeIds.size).toBe(2);
    expect(r.edgeIds.size).toBe(2);
  });

  it("returns empty for an unknown port id", () => {
    const r = traceFromPort("nonexistent", [], []);
    expect(r.nodeIds.size).toBe(0);
    expect(r.edgeIds.size).toBe(0);
  });
});
