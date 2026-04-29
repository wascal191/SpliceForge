import type { Node, Edge } from "@xyflow/react";

type TraceResult = { nodeIds: Set<string>; edgeIds: Set<string> };

export function traceFromPort(
  startPortId: string,
  nodes: Node[],
  edges: Edge[]
): TraceResult {
  // portId → nodeId
  const portToNode = new Map<string, string>();
  // nodeId → portId[]
  const nodeToPorts = new Map<string, string[]>();
  // nodeId → type
  const nodeType = new Map<string, string>();

  for (const node of nodes) {
    const ports = (node.data as { ports?: Array<{ id: string }> }).ports ?? [];
    const portIds = ports.map((p) => p.id);
    nodeToPorts.set(node.id, portIds);
    nodeType.set(node.id, node.type ?? "");
    for (const pid of portIds) portToNode.set(pid, node.id);
  }

  // portId → edges that touch it
  const portToEdges = new Map<string, Edge[]>();
  for (const edge of edges) {
    for (const h of [edge.sourceHandle, edge.targetHandle]) {
      if (!h) continue;
      if (!portToEdges.has(h)) portToEdges.set(h, []);
      portToEdges.get(h)!.push(edge);
    }
  }

  const visited = new Set<string>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const queue: string[] = [startPortId];

  while (queue.length > 0) {
    const portId = queue.shift()!;
    if (visited.has(portId)) continue;
    visited.add(portId);

    const nId = portToNode.get(portId);
    if (!nId) continue;
    nodeIds.add(nId);

    // Follow splice edges
    for (const edge of portToEdges.get(portId) ?? []) {
      edgeIds.add(edge.id);
      const other =
        edge.sourceHandle === portId ? edge.targetHandle : edge.sourceHandle;
      if (other && !visited.has(other)) queue.push(other);
    }

    // Through-elements: follow all sibling ports so the trace crosses the element
    const type = nodeType.get(nId);
    if (type === "closure" || type === "equipment") {
      for (const sibling of nodeToPorts.get(nId) ?? []) {
        if (!visited.has(sibling)) queue.push(sibling);
      }
    }
  }

  return { nodeIds, edgeIds };
}
