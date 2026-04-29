"use client";

import { getStraightPath, type EdgeProps } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";

export function CableSplitEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const darkMode = useCanvasStore((s) => s.darkMode);
  const stroke = darkMode ? "#f1f5f9" : "#1e293b";

  return (
    <g>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeDasharray="8 4"
        strokeLinecap="round"
        opacity={0.7}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}
