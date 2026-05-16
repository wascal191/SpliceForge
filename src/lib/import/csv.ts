import Papa from "papaparse";

export type ParsedCsv = {
  rawColumns: string[];
  rows: Record<string, string>[];
};

// Browser-only CSV parser used by the CSV import path. Returns string
// values; per-column type coercion happens later in mapping.ts so the
// raw column names stay visible in the mapping UI.
export async function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
        if (headers.length === 0) {
          reject(new Error("CSV file has no header row"));
          return;
        }
        const rows = (result.data ?? []).map((r) => {
          const out: Record<string, string> = {};
          for (const h of headers) {
            const v = r[h];
            out[h] = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
          }
          return out;
        });
        resolve({ rawColumns: headers, rows });
      },
      error: (err) => reject(err instanceof Error ? err : new Error(String(err))),
    });
  });
}
