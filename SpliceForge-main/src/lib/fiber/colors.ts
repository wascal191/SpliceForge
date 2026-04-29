export type FiberColorScheme = "EIA598" | "ABNT" | "Turkish" | "Dutch" | "French" | "Ribbon";

export const SCHEME_LABELS: Record<FiberColorScheme, string> = {
  EIA598:  "EIA-598 (USA / International)",
  ABNT:    "ABNT NBR 14771 (Brazil)",
  Turkish: "Turkcell / Turktelekom (Turkey)",
  Dutch:   "KPN (Netherlands)",
  French:  "France Telecom",
  Ribbon:  "Ribbon Cable",
};

const BASE = [
  { name: "blue",   hex: "#0070C0" },
  { name: "orange", hex: "#FF6600" },
  { name: "green",  hex: "#00B050" },
  { name: "brown",  hex: "#7B3F00" },
  { name: "slate",  hex: "#808080" },
  { name: "white",  hex: "#FFFFFF" },
  { name: "red",    hex: "#FF0000" },
  { name: "black",  hex: "#1A1A1A" },
  { name: "yellow", hex: "#FFD700" },
  { name: "violet", hex: "#8B00FF" },
  { name: "rose",   hex: "#FF007F" },
  { name: "aqua",   hex: "#00FFFF" },
] as const;

function ordered(indices: number[]) {
  return indices.map((i, idx) => ({ index: idx, name: BASE[i].name, hex: BASE[i].hex }));
}

export const COLOR_SCHEMES: Record<FiberColorScheme, { index: number; name: string; hex: string }[]> = {
  EIA598:  ordered([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  ABNT:    ordered([2, 8, 5, 0, 6, 9, 3, 10, 7, 4, 1, 11]),
  Turkish: ordered([0, 6, 2, 8, 5, 7, 1, 3, 4, 9, 10, 11]),
  Dutch:   ordered([0, 8, 5, 6, 2, 7, 1, 3, 9, 10, 4, 11]),
  French:  ordered([6, 2, 0, 8, 9, 5, 1, 3, 10, 7, 4, 11]),
  Ribbon:  ordered([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
};

export const EIA598 = COLOR_SCHEMES.EIA598;

export function getFiberHex(index: number, scheme: FiberColorScheme = "EIA598"): string {
  return COLOR_SCHEMES[scheme][index % 12].hex;
}

export function getFiberName(index: number, scheme: FiberColorScheme = "EIA598"): string {
  return COLOR_SCHEMES[scheme][index % 12].name;
}

export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
