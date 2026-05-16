"use client";

import { useTranslations } from "next-intl";
import type { ImportSource } from "@/lib/import/types";

type FormatChoice = {
  id: ImportSource;
  titleKey: string;
  subtitleKey: string;
};

const FORMATS: FormatChoice[] = [
  { id: "csv", titleKey: "format.csv", subtitleKey: "format.csvSubtitle" },
  { id: "xlsx", titleKey: "format.xlsx", subtitleKey: "format.xlsxSubtitle" },
  { id: "json", titleKey: "format.json", subtitleKey: "format.jsonSubtitle" },
  { id: "geojson", titleKey: "format.geojson", subtitleKey: "format.geojsonSubtitle" },
  { id: "kmz", titleKey: "format.kmz", subtitleKey: "format.kmzSubtitle" },
];

export function StepPickFormat({ onPick }: { onPick: (format: ImportSource) => void }) {
  const t = useTranslations("import");
  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-sm text-muted-foreground">{t("pickFormatPrompt")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="text-left rounded-lg border border-input px-4 py-3 hover:border-primary hover:bg-primary/5 transition"
          >
            <div className="text-sm font-semibold">{t(f.titleKey)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t(f.subtitleKey)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
