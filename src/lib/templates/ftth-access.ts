import type { Template } from "./types";

// FTTH access network: 24F feeder cable lands in a splice closure, 12 fibers
// feed a 1:8 splitter, and a 12F drop cable carries 8 splitter outputs out
// to subscribers (4 spare fibers in the drop).
export const ftthAccess: Template = {
  id: "ftth-access",
  name: "FTTH access network",
  description: "24F feeder → closure → 1:8 splitter → 12F drop cable.",
  defaultProjectName: "Demo — FTTH Access",
  defaultBedsheetName: "Access Network",
  elements: [
    {
      key: "feeder",
      type: "cable",
      label: "Feeder 24F",
      positionX: 80,
      positionY: 200,
      config: { fiberCount: 24, colorScheme: "EIA598", moduleFiberCount: 12 },
    },
    {
      key: "closure",
      type: "closure",
      label: "Splice Closure A",
      positionX: 480,
      positionY: 180,
      config: { inputCount: 12, outputCount: 12, trayCount: 1 },
    },
    {
      key: "splitter",
      type: "splitter",
      label: "1:8 Splitter",
      positionX: 880,
      positionY: 220,
      config: { ratio: "1:8", inputCount: 1, outputCount: 8 },
    },
    {
      key: "drop",
      type: "cable",
      label: "Drop 12F",
      positionX: 1200,
      positionY: 180,
      config: { fiberCount: 12, colorScheme: "EIA598" },
    },
  ],
  // Feeder right-side ports 0–11 (first module) -> closure inputs 0–11
  splices: [
    ...Array.from({ length: 12 }, (_, i) => ({
      fromKey: "feeder",
      fromPortIndex: 24 + i, // right side of cable (fiberCount + i)
      toKey: "closure",
      toPortIndex: i,
      comment: i === 0 ? "Module 1 to tray inputs" : undefined,
    })),
    // Closure output 0 -> splitter input (port_index 0)
    { fromKey: "closure", fromPortIndex: 12, toKey: "splitter", toPortIndex: 0, comment: "Splitter feed" },
    // Splitter "output bundle" (port_index 1) -> drop cable left port 0
    { fromKey: "splitter", fromPortIndex: 1, toKey: "drop", toPortIndex: 0, comment: "8 outputs to drop" },
  ],
};
