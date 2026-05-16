import type { Template } from "./types";

// Small contractor splice job: butt-splice two 12F cables through a closure,
// straight-through. Common pole-line repair / extension scenario.
export const contractorSplice: Template = {
  id: "contractor-splice",
  name: "Contractor splice job",
  description: "Two 12F cables butt-spliced through a single closure.",
  defaultProjectName: "Demo — Splice Job",
  defaultBedsheetName: "Splice Job",
  elements: [
    {
      key: "cable-in",
      type: "cable",
      label: "Cable In 12F",
      positionX: 80,
      positionY: 200,
      config: { fiberCount: 12, colorScheme: "EIA598" },
    },
    {
      key: "closure",
      type: "closure",
      label: "Closure",
      positionX: 480,
      positionY: 180,
      config: { inputCount: 12, outputCount: 12, trayCount: 1 },
    },
    {
      key: "cable-out",
      type: "cable",
      label: "Cable Out 12F",
      positionX: 880,
      positionY: 200,
      config: { fiberCount: 12, colorScheme: "EIA598" },
    },
  ],
  splices: [
    // Cable In right side -> closure inputs
    ...Array.from({ length: 12 }, (_, i) => ({
      fromKey: "cable-in",
      fromPortIndex: 12 + i,
      toKey: "closure",
      toPortIndex: i,
    })),
    // Closure outputs -> Cable Out left side (straight-through)
    ...Array.from({ length: 12 }, (_, i) => ({
      fromKey: "closure",
      fromPortIndex: 12 + i,
      toKey: "cable-out",
      toPortIndex: i,
    })),
  ],
};
