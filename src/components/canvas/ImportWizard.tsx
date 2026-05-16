"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/canvasStore";
import {
  applyMapping,
  autoDetectMapping,
  buildBulkInput,
  parseCsv,
  parseGeoJson,
  parseJson,
  parseKmz,
  parseXlsx,
  type ColumnMap,
} from "@/lib/import";
import type {
  ImportSource,
  ImportedBundle,
} from "@/lib/import/types";
import { bulkImport } from "@/lib/actions/import";
import { StepPickFormat } from "./import/StepPickFormat";
import { StepUpload } from "./import/StepUpload";
import { StepMapColumns } from "./import/StepMapColumns";
import { StepPreview } from "./import/StepPreview";
import { StepResult } from "./import/StepResult";

type WizardStep = "format" | "upload" | "mapping" | "preview" | "importing" | "done";

const MAPPING_STORAGE_KEY = "splice.import.mapping.csv.v1";

export function ImportWizard({ pageId }: { pageId: string }) {
  const t = useTranslations("import");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const importOpen = useCanvasStore((s) => s.importOpen);
  const setImportOpen = useCanvasStore((s) => s.setImportOpen);

  const [step, setStep] = useState<WizardStep>("format");
  const [format, setFormat] = useState<ImportSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  // CSV-only state (raw rows + column map; bundle is recomputed on the fly).
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMap>({ elements: {}, connections: {} });

  // Final bundle (for XLSX/KMZ/GeoJSON/JSON) and for CSV after applyMapping.
  const [bundle, setBundle] = useState<ImportedBundle | null>(null);

  // Result state
  const [result, setResult] = useState<{ elementCount: number; spliceCount: number } | null>(null);

  const reset = () => {
    setStep("format");
    setFormat(null);
    setError(null);
    setCsvRows([]);
    setCsvColumns([]);
    setMapping({ elements: {}, connections: {} });
    setBundle(null);
    setResult(null);
  };

  function close(open: boolean) {
    if (!open) {
      reset();
      setImportOpen(false);
    }
  }

  useEffect(() => {
    if (!importOpen) reset();
  }, [importOpen]);

  // CSV: recompute bundle whenever mapping changes.
  useEffect(() => {
    if (format !== "csv" || csvRows.length === 0) return;
    const result = applyMapping(csvRows, csvRows, mapping);
    setBundle(result);
  }, [format, csvRows, mapping]);

  async function handleFile(file: File) {
    if (!format) return;
    setError(null);
    try {
      if (format === "csv") {
        const { rawColumns, rows } = await parseCsv(file);
        setCsvColumns(rawColumns);
        setCsvRows(rows);
        // Hydrate mapping from localStorage if available, else autodetect.
        let initial: ColumnMap | null = null;
        try {
          const saved = window.localStorage.getItem(MAPPING_STORAGE_KEY);
          if (saved) initial = JSON.parse(saved) as ColumnMap;
        } catch { /* ignore */ }
        setMapping(initial ?? autoDetectMapping(rawColumns));
        setStep("mapping");
      } else if (format === "xlsx") {
        const { elementRows, connectionRows, rowErrors } = await parseXlsx(file);
        if (rowErrors.length > 0 && elementRows.length === 0) {
          setError(rowErrors[0]?.message ?? t("errors.invalidFile"));
          return;
        }
        const rawColumns = elementRows.length > 0 ? Object.keys(elementRows[0]) : [];
        const xlsxMapping: ColumnMap = {
          elements: {
            label: "Label",
            type: "Type",
            fiberCount: "Fiber Count",
            colorScheme: "Color Scheme",
            moduleSize: "Module Size",
            inputCount: "Inputs",
            outputCount: "Outputs",
            ratio: "Ratio",
          },
          connections: {
            fromLabel: "From Element",
            fromPortIndex: "From Port #",
            toLabel: "To Element",
            toPortIndex: "To Port #",
            comment: "Comment",
          },
        };
        const parsed = applyMapping(
          elementRows as unknown as Record<string, unknown>[],
          connectionRows as unknown as Record<string, unknown>[],
          xlsxMapping
        );
        setCsvColumns(rawColumns);
        setBundle({
          ...parsed,
          warnings: [...rowErrors.map((e) => ({ row: e.row, message: e.message, severity: "error" as const })), ...parsed.warnings],
        });
        setStep("preview");
      } else if (format === "kmz") {
        const parsed = await parseKmz(file);
        setBundle(parsed);
        setStep("preview");
      } else if (format === "geojson") {
        const text = await file.text();
        const parsed = parseGeoJson(text);
        setBundle(parsed);
        setStep("preview");
      } else if (format === "json") {
        const text = await file.text();
        const parsed = parseJson(text);
        setBundle(parsed);
        setStep("preview");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleText(text: string) {
    if (format !== "json" && format !== "geojson") return;
    setError(null);
    try {
      const parsed = format === "json" ? parseJson(text) : parseGeoJson(text);
      setBundle(parsed);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function persistMapping(next: ColumnMap) {
    setMapping(next);
    try {
      window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }

  async function handleImport() {
    if (!bundle || !format) return;
    setStep("importing");
    setError(null);
    try {
      const input = buildBulkInput(pageId, format, bundle);
      const res = await bulkImport(input);
      setResult({ elementCount: res.elementCount, spliceCount: res.spliceCount });
      setStep("done");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setStep("done");
    }
  }

  const canImport = useMemo(() => {
    if (!bundle) return false;
    if (bundle.elements.length === 0) return false;
    if (bundle.warnings.some((w) => w.severity === "error")) return false;
    return true;
  }, [bundle]);

  const title = step === "format" ? t("title")
    : step === "upload" ? t("upload.title")
    : step === "mapping" ? t("mapping.title")
    : step === "preview" ? t("preview.title")
    : step === "importing" ? t("importing")
    : t("result.title");

  return (
    <Dialog open={importOpen} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {step === "format" && (
          <StepPickFormat onPick={(f) => { setFormat(f); setStep("upload"); }} />
        )}

        {step === "upload" && format && (
          <StepUpload
            format={format}
            busy={false}
            error={error}
            onFile={handleFile}
            onText={handleText}
          />
        )}

        {step === "mapping" && (
          <StepMapColumns
            rawColumns={csvColumns}
            mapping={mapping}
            onChange={persistMapping}
            showConnections={true}
          />
        )}

        {step === "preview" && bundle && (
          <StepPreview bundle={bundle} />
        )}

        {step === "importing" && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-sm text-muted-foreground">{t("importing")}…</p>
          </div>
        )}

        {step === "done" && (
          <StepResult
            success={result !== null && error === null}
            elementCount={result?.elementCount ?? 0}
            spliceCount={result?.spliceCount ?? 0}
            error={error}
          />
        )}

        <DialogFooter>
          {step === "format" && (
            <Button variant="outline" onClick={() => close(false)}>{tCommon("cancel")}</Button>
          )}
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={() => { setStep("format"); setError(null); }}>{tCommon("back")}</Button>
            </>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>{tCommon("back")}</Button>
              <Button onClick={() => setStep("preview")} disabled={!bundle || bundle.elements.length === 0}>
                {tCommon("next")}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep(format === "csv" ? "mapping" : "upload")}>
                {tCommon("back")}
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>{t("import")}</Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={reset}>{t("result.importAnother")}</Button>
              <Button onClick={() => close(false)}>{tCommon("close")}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
