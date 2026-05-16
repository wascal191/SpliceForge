"use client";

import { useTranslations } from "next-intl";
import type { ImportedBundle } from "@/lib/import/types";

export function StepPreview({ bundle }: { bundle: ImportedBundle }) {
  const t = useTranslations("import");

  const byType = bundle.elements.reduce<Record<string, number>>((acc, el) => {
    acc[el.type] = (acc[el.type] ?? 0) + 1;
    return acc;
  }, {});

  const errorCount = bundle.warnings.filter((w) => w.severity === "error").length;
  const warningCount = bundle.warnings.filter((w) => w.severity === "warning").length;

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-input bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {t("preview.elements")}
          </div>
          <div className="text-lg font-semibold">{bundle.elements.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {Object.entries(byType).map(([t, c]) => `${c} ${t}`).join(" · ")}
          </div>
        </div>
        <div className="rounded border border-input bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {t("preview.splices")}
          </div>
          <div className="text-lg font-semibold">{bundle.splices.length}</div>
        </div>
      </div>

      {(errorCount > 0 || warningCount > 0) && (
        <div className="rounded border border-input bg-destructive/5 px-3 py-2 max-h-48 overflow-y-auto">
          <div className="text-xs font-semibold mb-1 text-destructive">
            {errorCount > 0 ? t("preview.errorCount", { count: errorCount }) : t("preview.warningCount", { count: warningCount })}
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {bundle.warnings.map((w, i) => (
              <li key={i}>
                {w.severity === "error" ? "✕ " : "⚠ "}
                {w.row != null ? `[row ${w.row}] ` : ""}
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
