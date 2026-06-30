"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ftthAccess } from "@/lib/templates/ftth-access";
import { portsForElement } from "@/lib/templates/types";
import { getFiberHex, getFiberName } from "@/lib/fiber/colors";

// --- inline demo nodes (decoupled from the real canvas components) ----------
// The production node components are tightly coupled to server actions and the
// canvas store, so for the public demo we use lightweight read-only renders
// that still showcase fiber colors, splices, and layout.

type DemoPort = { id: string; index: number; color: string; name: string; side: "left" | "right" };

type CableData = {
  label: string;
  fiberCount: number;
  ports: DemoPort[];
  moduleFiberCount?: number;
};

type SplitterData = {
  label: string;
  ratio: string;
  inputCount: number;
  outputCount: number;
  ports: DemoPort[];
};

type ClosureData = {
  label: string;
  inputCount: number;
  outputCount: number;
  ports: DemoPort[];
};

type DemoNodeData = CableData | SplitterData | ClosureData;

const NODE_BG = "linear-gradient(180deg, rgba(15,22,36,0.95), rgba(10,15,26,0.95))";
const NODE_BORDER = "1px solid rgba(148,184,255,0.18)";

function DemoCableNode({ data }: NodeProps<Node<CableData, "cable">>) {
  const leftPorts = data.ports.filter((p) => p.side === "left");
  const rightPorts = data.ports.filter((p) => p.side === "right");
  return (
    <div style={{
      background: NODE_BG, border: NODE_BORDER, borderRadius: 10,
      padding: "10px 14px", minWidth: 180, color: "#F1F5F9",
      boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, color: "#64748B", marginBottom: 8, fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.04em" }}>
        {data.fiberCount}F · EIA-598
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {Array.from({ length: Math.min(data.fiberCount, 12) }, (_, i) => {
          const left = leftPorts[i];
          const right = rightPorts[i];
          const color = left?.color ?? right?.color ?? "#475569";
          const name = left?.name ?? right?.name ?? "";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
              {left && <Handle type="target" position={Position.Left} id={left.id} style={{ background: color, width: 8, height: 8, border: "1px solid #0A0F1A" }} />}
              <div style={{
                flex: 1, height: 4, background: color,
                borderRadius: 2, border: color === "#FFFFFF" ? "1px solid rgba(148,184,255,0.3)" : "none",
              }} />
              <span style={{ fontSize: 8, color: "#64748B", minWidth: 40, fontFamily: "var(--font-geist-mono), monospace" }}>{name}</span>
              {right && <Handle type="source" position={Position.Right} id={right.id} style={{ background: color, width: 8, height: 8, border: "1px solid #0A0F1A" }} />}
            </div>
          );
        })}
        {data.fiberCount > 12 && (
          <div style={{ fontSize: 9, color: "#64748B", marginTop: 4, fontStyle: "italic" }}>
            +{data.fiberCount - 12} more fibers…
          </div>
        )}
      </div>
    </div>
  );
}

function DemoSplitterNode({ data }: NodeProps<Node<SplitterData, "splitter">>) {
  const inputs = data.ports.filter((p) => p.side === "left");
  const outputs = data.ports.filter((p) => p.side === "right");
  return (
    <div style={{
      background: NODE_BG, border: NODE_BORDER, borderRadius: 10,
      padding: "12px 16px", minWidth: 140, color: "#F1F5F9",
      boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
      <div style={{
        fontSize: 18, fontWeight: 700, color: "#3DF5A3", textAlign: "center",
        padding: "8px 0", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.05em",
      }}>
        {data.ratio}
      </div>
      <div style={{ fontSize: 9, color: "#64748B", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Optical splitter
      </div>
      {inputs.map((p, i) => (
        <Handle key={p.id} type="target" position={Position.Left} id={p.id}
          style={{ top: `${50 + i * 8}%`, background: "#00E5FF", width: 8, height: 8 }} />
      ))}
      {outputs.map((p, i) => (
        <Handle key={p.id} type="source" position={Position.Right} id={p.id}
          style={{ top: `${30 + i * 6}%`, background: "#3DF5A3", width: 8, height: 8 }} />
      ))}
    </div>
  );
}

function DemoClosureNode({ data }: NodeProps<Node<ClosureData, "closure">>) {
  return (
    <div style={{
      background: NODE_BG, border: NODE_BORDER, borderRadius: 10,
      padding: "12px 16px", minWidth: 160, color: "#F1F5F9",
      boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{data.label}</div>
      <div style={{
        background: "rgba(196,167,255,0.08)", border: "1px solid rgba(196,167,255,0.25)",
        borderRadius: 6, padding: "8px 10px",
      }}>
        <div style={{ fontSize: 9, color: "#C4A7FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Splice tray
        </div>
        <div style={{ fontSize: 11, color: "#CBD5E1", fontFamily: "var(--font-geist-mono), monospace" }}>
          {data.inputCount} in · {data.outputCount} out
        </div>
      </div>
      {data.ports.filter((p) => p.side === "left").map((p, i) => (
        <Handle key={p.id} type="target" position={Position.Left} id={p.id}
          style={{ top: `${20 + (i / data.inputCount) * 60}%`, background: "#C4A7FF", width: 8, height: 8 }} />
      ))}
      {data.ports.filter((p) => p.side === "right").map((p, i) => (
        <Handle key={p.id} type="source" position={Position.Right} id={p.id}
          style={{ top: `${20 + (i / data.outputCount) * 60}%`, background: "#C4A7FF", width: 8, height: 8 }} />
      ))}
    </div>
  );
}

const nodeTypes = {
  cable: DemoCableNode,
  splitter: DemoSplitterNode,
  closure: DemoClosureNode,
};

// --- build initial graph from the FTTH template -----------------------------

function buildInitial(): { nodes: Node[]; edges: Edge[] } {
  const portMap: Record<string, Record<number, DemoPort>> = {};

  const nodes: Node[] = ftthAccess.elements.map((el) => {
    const portCount = portsForElement(el);
    const inputCount =
      el.type === "cable"
        ? el.config.fiberCount
        : el.type === "splitter"
          ? el.config.inputCount
          : el.type === "closure"
            ? el.config.inputCount * el.config.trayCount
            : el.config.inputCount;

    const ports: DemoPort[] = Array.from({ length: portCount }, (_, i) => {
      const colorIndex = el.type === "cable" ? i % el.config.fiberCount : i;
      const side: "left" | "right" = i < inputCount ? "left" : "right";
      return {
        id: `${el.key}-p${i}`,
        index: i,
        color: getFiberHex(colorIndex, "EIA598"),
        name: getFiberName(colorIndex, "EIA598"),
        side,
      };
    });

    const portRecord: Record<number, DemoPort> = {};
    ports.forEach((p) => { portRecord[p.index] = p; });
    portMap[el.key] = portRecord;

    let data: DemoNodeData;
    if (el.type === "cable") {
      data = { label: el.label, fiberCount: el.config.fiberCount, ports, moduleFiberCount: el.config.moduleFiberCount };
    } else if (el.type === "splitter") {
      data = { label: el.label, ratio: el.config.ratio, inputCount: el.config.inputCount, outputCount: el.config.outputCount, ports };
    } else if (el.type === "closure") {
      data = { label: el.label, inputCount: el.config.inputCount, outputCount: el.config.outputCount, ports };
    } else {
      data = { label: el.label, inputCount: 1, outputCount: 1, ports } as ClosureData;
    }

    return {
      id: el.key,
      type: el.type === "equipment" ? "closure" : el.type,
      position: { x: el.positionX, y: el.positionY },
      data: data as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = ftthAccess.splices.map((s, i) => {
    const from = portMap[s.fromKey]?.[s.fromPortIndex];
    return {
      id: `splice-${i}`,
      source: s.fromKey,
      target: s.toKey,
      sourceHandle: `${s.fromKey}-p${s.fromPortIndex}`,
      targetHandle: `${s.toKey}-p${s.toPortIndex}`,
      style: { stroke: from?.color ?? "#3DF5A3", strokeWidth: 2 },
      animated: i < 4,
    };
  });

  return { nodes, edges };
}

// --- main client component --------------------------------------------------

export function DemoCanvasClient() {
  const initial = useMemo(() => buildInitial(), []);
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [edges] = useState<Edge[]>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selected = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#05070C", display: "flex", flexDirection: "column" }}>
      {/* Demo banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", gap: 16,
        background: "linear-gradient(90deg, rgba(0,229,255,0.12), rgba(61,245,163,0.10))",
        borderBottom: "1px solid rgba(0,229,255,0.25)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#F1F5F9" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
              <circle cx="2" cy="12" r="1.5" fill="#00E5FF" />
              <circle cx="22" cy="12" r="1.5" fill="#3DF5A3" />
            </svg>
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em" }}>
              SpliceForge
            </span>
          </Link>
          <span style={{
            fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, letterSpacing: "0.12em",
            color: "#00E5FF", textTransform: "uppercase",
            background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)",
            padding: "3px 8px", borderRadius: 4,
          }}>
            Demo mode
          </span>
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12.5, color: "#94A3B8" }}>
            Read-only preview — changes are not saved.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/signup" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
            color: "#05070C", fontFamily: "var(--font-inter), sans-serif", fontWeight: 700, fontSize: 12.5,
            padding: "7px 14px", borderRadius: 7, textDecoration: "none",
            boxShadow: "0 0 0 1px rgba(0,229,255,0.4), 0 4px 16px rgba(0,229,255,0.25)",
          }}>
            Sign up to save your work →
          </Link>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                setNodes((nds) => {
                  const next = [...nds];
                  for (const c of changes) {
                    if (c.type === "position" && c.position) {
                      const idx = next.findIndex((n) => n.id === c.id);
                      if (idx >= 0) next[idx] = { ...next[idx], position: c.position };
                    }
                  }
                  return next;
                });
              }}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1E293B" gap={20} />
              <Controls showInteractive={false} style={{ background: "#0D1525", border: "1px solid rgba(148,184,255,0.2)" }} />
              <MiniMap
                style={{ background: "#0A0F1A", border: "1px solid rgba(148,184,255,0.2)" }}
                nodeColor={(n) => n.type === "cable" ? "#00E5FF" : n.type === "splitter" ? "#3DF5A3" : "#C4A7FF"}
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Side panel */}
        <aside style={{
          width: 320, flexShrink: 0,
          background: "linear-gradient(180deg, #0A0F1A, #070B14)",
          borderLeft: "1px solid rgba(148,184,255,0.12)",
          padding: 20, overflowY: "auto",
          color: "#F1F5F9",
        }}>
          {selected ? (
            <NodeDetails node={selected} />
          ) : (
            <DemoIntro />
          )}
        </aside>
      </div>
    </div>
  );
}

function DemoIntro() {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, letterSpacing: "0.16em", color: "#00E5FF", textTransform: "uppercase", marginBottom: 8 }}>
        Welcome
      </div>
      <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 18, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
        An FTTH access network
      </h2>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>
        This demo shows a typical fiber-to-the-home build:
      </p>
      <ul style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.7, paddingLeft: 18, marginTop: 10 }}>
        <li>A <strong>24-fiber feeder cable</strong> lands in a splice closure.</li>
        <li>12 fibers feed a <strong>1:8 optical splitter</strong>.</li>
        <li>A <strong>12-fiber drop cable</strong> carries 8 splitter outputs out to subscribers.</li>
      </ul>
      <div style={{ marginTop: 20, padding: 12, background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.16)", borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6 }}>
          <strong style={{ color: "#F1F5F9" }}>Try it:</strong> drag nodes to reposition, pan and zoom the canvas, click any node for details.
        </div>
      </div>
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(148,184,255,0.12)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 9.5, letterSpacing: "0.12em", color: "#64748B", textTransform: "uppercase", marginBottom: 8 }}>
          In the full app
        </div>
        <ul style={{ fontSize: 11.5, color: "#94A3B8", lineHeight: 1.7, paddingLeft: 16, margin: 0 }}>
          <li>Edit cables, splices, ports, labels</li>
          <li>Trace any fiber end-to-end</li>
          <li>Multi-page bedsheets & cross-page links</li>
          <li>Export PDF / PNG / XLSX</li>
          <li>Import XLSX / CSV / KMZ / GeoJSON</li>
          <li>Collaborate with your team</li>
        </ul>
      </div>
      <Link href="/signup" style={{
        display: "block", marginTop: 20, textAlign: "center",
        background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
        color: "#05070C", fontFamily: "var(--font-inter), sans-serif", fontWeight: 700, fontSize: 13,
        padding: "10px 14px", borderRadius: 8, textDecoration: "none",
        boxShadow: "0 0 0 1px rgba(0,229,255,0.4), 0 6px 24px rgba(0,229,255,0.25)",
      }}>
        Create a free account →
      </Link>
    </div>
  );
}

function NodeDetails({ node }: { node: Node }) {
  const data = node.data as unknown as DemoNodeData;
  const type = node.type as "cable" | "splitter" | "closure";
  return (
    <div>
      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, letterSpacing: "0.16em", color: "#00E5FF", textTransform: "uppercase", marginBottom: 8 }}>
        {type}
      </div>
      <h2 style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 18, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
        {data.label}
      </h2>
      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "#64748B", marginBottom: 16, letterSpacing: "0.04em" }}>
        id: {node.id}
      </div>

      {type === "cable" && (
        <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.7 }}>
          <div><strong style={{ color: "#F1F5F9" }}>Fiber count:</strong> {(data as CableData).fiberCount}</div>
          <div><strong style={{ color: "#F1F5F9" }}>Color scheme:</strong> EIA-598</div>
          {(data as CableData).moduleFiberCount && (
            <div><strong style={{ color: "#F1F5F9" }}>Module size:</strong> {(data as CableData).moduleFiberCount} fibers</div>
          )}
        </div>
      )}

      {type === "splitter" && (
        <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.7 }}>
          <div><strong style={{ color: "#F1F5F9" }}>Ratio:</strong> {(data as SplitterData).ratio}</div>
          <div><strong style={{ color: "#F1F5F9" }}>Inputs:</strong> {(data as SplitterData).inputCount}</div>
          <div><strong style={{ color: "#F1F5F9" }}>Outputs:</strong> {(data as SplitterData).outputCount}</div>
        </div>
      )}

      {type === "closure" && (
        <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.7 }}>
          <div><strong style={{ color: "#F1F5F9" }}>Inputs:</strong> {(data as ClosureData).inputCount}</div>
          <div><strong style={{ color: "#F1F5F9" }}>Outputs:</strong> {(data as ClosureData).outputCount}</div>
        </div>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(148,184,255,0.12)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 9.5, letterSpacing: "0.12em", color: "#64748B", textTransform: "uppercase", marginBottom: 8 }}>
          Ports
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
          {data.ports.slice(0, 24).map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-geist-mono), monospace", color: "#94A3B8" }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2, background: p.color,
                border: p.color === "#FFFFFF" ? "1px solid rgba(148,184,255,0.4)" : "none",
                flexShrink: 0,
              }} />
              <span style={{ minWidth: 32 }}>#{String(p.index).padStart(2, "0")}</span>
              <span style={{ color: "#64748B" }}>{p.side}</span>
              <span style={{ marginLeft: "auto", color: "#CBD5E1" }}>{p.name}</span>
            </div>
          ))}
          {data.ports.length > 24 && (
            <div style={{ fontSize: 10.5, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
              +{data.ports.length - 24} more…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
