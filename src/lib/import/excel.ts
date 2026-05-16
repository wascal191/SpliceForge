import ExcelJS from "exceljs";

// ────────────────────────────────────────────────────────────────────────────
// SpliceForge XLSX layout (what `Export → XLSX` emits):
//   Sheet "Elements"    — one row per node (cable / closure / splitter /
//                         equipment). Configurable per type.
//   Sheet "Connections" — one row per splice (port-to-port).
//
// Extracted from the old src/components/canvas/ImportDialog.tsx so the
// new wizard can preview rows + per-row errors before kicking off the
// atomic bulkImport RPC.
// ────────────────────────────────────────────────────────────────────────────

export type ElementRow = {
  Label: string;
  Type: string;
  "Fiber Count"?: number | string;
  "Color Scheme"?: string;
  "Module Size"?: number | string;
  Inputs?: number | string;
  Outputs?: number | string;
  Ratio?: string;
};

export type ConnectionRow = {
  "From Element": string;
  "From Type"?: string;
  "From Port #": number | string;
  "Fiber Color"?: string;
  "To Element": string;
  "To Type"?: string;
  "To Port #": number | string;
  Comment?: string;
};

export type RowError = {
  sheet: "Elements" | "Connections";
  row: number; // 1-based sheet row (header = row 1)
  field?: string;
  message: string;
};

export type ParsedXlsx = {
  elementRows: ElementRow[];
  connectionRows: ConnectionRow[];
  rowErrors: RowError[];
};

function sheetToJson<T>(
  ws: ExcelJS.Worksheet
): { rows: T[]; rowOffsets: number[] } {
  const rows: T[] = [];
  const rowOffsets: number[] = [];
  let headers: string[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      headers = (row.values as Array<string | undefined>).slice(1).map((h) => String(h ?? "").trim());
      return;
    }
    const obj: Record<string, unknown> = {};
    (row.values as unknown[]).slice(1).forEach((val, i) => {
      const key = headers[i];
      if (!key) return;
      obj[key] = val ?? "";
    });
    rows.push(obj as T);
    rowOffsets.push(rowNumber);
  });
  return { rows, rowOffsets };
}

export async function parseXlsx(file: File): Promise<ParsedXlsx> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const rowErrors: RowError[] = [];

  const elementsSheet = wb.getWorksheet("Elements");
  const connectionsSheet = wb.getWorksheet("Connections");

  if (!elementsSheet) {
    rowErrors.push({
      sheet: "Elements",
      row: 0,
      message: 'Sheet "Elements" not found. Export a canvas first to get the correct format.',
    });
    return { elementRows: [], connectionRows: [], rowErrors };
  }
  if (!connectionsSheet) {
    rowErrors.push({
      sheet: "Connections",
      row: 0,
      message: 'Sheet "Connections" not found.',
    });
  }

  const { rows: elementRows } = sheetToJson<ElementRow>(elementsSheet);
  const { rows: connectionRows } = connectionsSheet
    ? sheetToJson<ConnectionRow>(connectionsSheet)
    : { rows: [] as ConnectionRow[] };

  if (elementRows.length === 0) {
    rowErrors.push({ sheet: "Elements", row: 0, message: "Elements sheet is empty." });
  }

  return { elementRows, connectionRows, rowErrors };
}
