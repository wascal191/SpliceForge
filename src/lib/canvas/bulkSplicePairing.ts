/**
 * Pure pairing logic for Bulk Range Splice.
 *
 * Lifted out of BulkSpliceRangeDialog so it can be unit-tested. The dialog
 * still owns its own state and rendering, but the math lives here.
 *
 * Inputs are arrays of "filtered ports" — already side-filtered by the
 * caller — sorted by portIndex.
 */

import type { FiberPort } from "@/types/fiber";

export type SplicePair = { portFrom: string; portTo: string };

export type PairingResult = {
  pairs: SplicePair[];
  /** Human-readable diagnostics for ports that couldn't be paired. */
  warnings: string[];
};

export type PairingInput = {
  /** Side-filtered, portIndex-sorted ports on the source node. */
  portsA: readonly FiberPort[];
  /** Side-filtered, portIndex-sorted ports on the destination node. */
  portsB: readonly FiberPort[];
  /** 1-indexed inclusive start position within portsA. */
  fromPort: number;
  /** 1-indexed inclusive end position within portsA. */
  toPort: number;
  /** Position offset applied to map portsA[i] → portsB[i + offset]. */
  destOffset: number;
  /** When true, only pair ports that share a module index. */
  respectBoundaries: boolean;
  /**
   * Module sizes for boundary-aware pairing. Provide non-zero values to opt
   * into the check; 0 / null disables it. The dialog passes
   * getModSize(nodeA) / getModSize(nodeB).
   */
  modSizeA: number;
  modSizeB: number;
  /** Source node label, used in warnings only. */
  nodeALabel?: string;
};

function sameGroup(
  pa: FiberPort,
  pb: FiberPort,
  modA: number,
  modB: number
): boolean {
  if (!modA || !modB) return true;
  return Math.floor(pa.portIndex / modA) === Math.floor(pb.portIndex / modB);
}

export function pairPorts(input: PairingInput): PairingResult {
  const {
    portsA,
    portsB,
    fromPort,
    toPort,
    destOffset,
    respectBoundaries,
    modSizeA,
    modSizeB,
    nodeALabel = "—",
  } = input;

  if (fromPort > toPort) return { pairs: [], warnings: [] };
  if (portsA.length === 0) return { pairs: [], warnings: [] };

  const warnings: string[] = [];
  const pairs: SplicePair[] = [];

  const lo = Math.max(1, fromPort);
  const hi = Math.min(portsA.length, toPort);

  for (let pos1 = lo; pos1 <= hi; pos1++) {
    const posA = pos1 - 1; // 0-indexed
    const pa = portsA[posA];
    if (!pa || pa.status !== "unoccupied") continue;

    const targetPos = posA + destOffset;
    const candidate = targetPos >= 0 && targetPos < portsB.length ? portsB[targetPos] : undefined;
    const groupOk = respectBoundaries && modSizeA > 0 && modSizeB > 0
      ? (candidate ? sameGroup(pa, candidate, modSizeA, modSizeB) : false)
      : true;

    const pb =
      candidate && candidate.status === "unoccupied" && groupOk
        ? candidate
        : undefined;

    if (!pb) {
      warnings.push(
        `Port ${posA + 1} on ${nodeALabel}: no free match at position ${targetPos + 1}`
      );
    } else {
      pairs.push({ portFrom: pa.id, portTo: pb.id });
    }
  }

  return { pairs, warnings };
}
