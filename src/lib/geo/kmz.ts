import JSZip from "jszip";
import type { Node } from "@xyflow/react";
import type { ElementGeo } from "@/types/fiber";
import { kmlStylesXml, styleIdFor } from "./kmlStyles";

export type KmzScope = "all" | "traced";

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] ?? c)
  );
}

function describeBalloon(n: Node): string {
  const d = n.data as Record<string, unknown>;
  const type = n.type ?? "element";
  const label = (d.label as string) ?? n.id;
  const geo = d.geo as ElementGeo | undefined;

  let rows = `<b>${esc(label)}</b><br/>Type: ${esc(type)}<br/>`;
  if (type === "cable") rows += `Fibers: ${d.fiberCount ?? "—"}<br/>Scheme: ${d.colorScheme ?? "EIA598"}<br/>`;
  if (type === "splitter") rows += `Ratio: ${d.ratio ?? "—"}<br/>`;
  if (type === "closure" || type === "equipment") {
    rows += `Inputs: ${d.inputCount ?? "—"} / Outputs: ${d.outputCount ?? "—"}<br/>`;
  }
  if (geo?.address) rows += `Address: ${esc(geo.address)}<br/>`;
  return rows;
}

export async function generateKmz(args: {
  bedsheetName: string;
  pageName: string;
  nodes: Node[];
  tracedNodeIds: ReadonlySet<string>;
  tracedNodeColors: Readonly<Record<string, string>>;
  scope: KmzScope;
}): Promise<Blob> {
  const { bedsheetName, pageName, nodes, scope, tracedNodeIds, tracedNodeColors } = args;

  const candidates = scope === "traced"
    ? nodes.filter((n) => tracedNodeIds.has(n.id))
    : nodes;

  // Group by type for clean KML folder structure
  const folders = new Map<string, Node[]>();
  let geoCount = 0;

  for (const n of candidates) {
    const geo = (n.data as { geo?: ElementGeo }).geo;
    if (!geo) continue;
    if (n.type === "cable") {
      if (!geo.path || geo.path.length < 2) continue;
    } else {
      if (geo.lat == null || geo.lng == null) continue;
    }
    geoCount++;
    const folder = (n.type ?? "other") + "s";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder)!.push(n);
  }

  const folderBlocks: string[] = [];
  for (const [folderName, ns] of folders) {
    const placemarks: string[] = [];
    for (const n of ns) {
      const geo = (n.data as { geo?: ElementGeo }).geo!;
      const label = (n.data as { label?: string }).label ?? n.id;
      const traceColor = tracedNodeColors[n.id] ?? null;
      const styleId = styleIdFor(n.type ?? "other", traceColor);
      const desc = describeBalloon(n);

      if (n.type === "cable" && geo.path) {
        const coords = geo.path.map((p) => `${p.lng},${p.lat},0`).join(" ");
        placemarks.push(
          `      <Placemark>` +
          `<name>${esc(label)}</name>` +
          `<styleUrl>#${styleId}</styleUrl>` +
          `<description><![CDATA[${desc}]]></description>` +
          `<LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString>` +
          `</Placemark>`
        );
      } else if (geo.lat != null && geo.lng != null) {
        placemarks.push(
          `      <Placemark>` +
          `<name>${esc(label)}</name>` +
          `<styleUrl>#${styleId}</styleUrl>` +
          `<description><![CDATA[${desc}]]></description>` +
          `<Point><coordinates>${geo.lng},${geo.lat},0</coordinates></Point>` +
          `</Placemark>`
        );
      }
    }
    folderBlocks.push(
      `    <Folder><name>${esc(folderName)}</name>\n` +
      placemarks.join("\n") +
      `\n    </Folder>`
    );
  }

  const scopeNote = scope === "traced" ? " (active trace)" : "";
  const kml =
`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(bedsheetName)} — ${esc(pageName)}${esc(scopeNote)}</name>
    <description>SpliceForge export — ${geoCount} element${geoCount !== 1 ? "s" : ""}</description>
    ${kmlStylesXml(tracedNodeColors)}
${folderBlocks.join("\n")}
  </Document>
</kml>`;

  const zip = new JSZip();
  zip.file("doc.kml", kml);
  return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
}
