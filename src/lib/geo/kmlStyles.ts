/** KML color = aabbggrr (alpha-blue-green-red). */
function hexToKml(hex: string, alpha = "ff"): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `${alpha}ffffff`;
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `${alpha}${b}${g}${r}`;
}

const TYPE_DEFAULTS: Record<string, string> = {
  cable: "#f59e0b",
  closure: "#22d3ee",
  splitter: "#a78bfa",
  equipment: "#34d399",
  continuation: "#9ca3af",
  other: "#94a3b8",
};

export function styleIdFor(nodeType: string, traceColor: string | null): string {
  if (traceColor) return `trace_${traceColor.replace("#", "")}`;
  return `type_${nodeType}`;
}

/** Emit all <Style> blocks needed for the given node set. */
export function kmlStylesXml(tracedNodeColors: Readonly<Record<string, string>>): string {
  const styles: string[] = [];

  // One style per element type (default palette)
  for (const [type, color] of Object.entries(TYPE_DEFAULTS)) {
    const kmlColor = hexToKml(color);
    styles.push(`
  <Style id="type_${type}">
    <IconStyle>
      <color>${kmlColor}</color>
      <scale>0.9</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle>
    <LineStyle><color>${kmlColor}</color><width>3</width></LineStyle>
    <LabelStyle><scale>0.8</scale></LabelStyle>
  </Style>`);
  }

  // One style per unique trace color (vivid, wider line)
  const seen = new Set<string>();
  for (const color of Object.values(tracedNodeColors)) {
    if (seen.has(color)) continue;
    seen.add(color);
    const id = color.replace("#", "");
    const kmlColor = hexToKml(color);
    styles.push(`
  <Style id="trace_${id}">
    <IconStyle>
      <color>${kmlColor}</color>
      <scale>1.1</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle>
    <LineStyle><color>${kmlColor}</color><width>5</width></LineStyle>
    <LabelStyle><scale>0.9</scale></LabelStyle>
  </Style>`);
  }

  return styles.join("\n");
}
