"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ImportSource } from "@/lib/import/types";

type Props = {
  format: ImportSource;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onText: (text: string) => void;
};

const ACCEPT: Record<ImportSource, string> = {
  csv: ".csv,text/csv",
  xlsx: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  kmz: ".kmz,application/vnd.google-earth.kmz",
  geojson: ".geojson,.json,application/geo+json,application/json",
  json: ".json,application/json",
};

export function StepUpload({ format, busy, error, onFile, onText }: Props) {
  const t = useTranslations("import");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");

  const canPaste = format === "json" || format === "geojson";

  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-sm text-muted-foreground">{t("upload.dropFile")}</p>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT[format]}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="text-sm file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:cursor-pointer cursor-pointer"
      />

      {canPaste && (
        <>
          <p className="text-xs text-muted-foreground mt-1">{t("upload.orPaste")}</p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={busy}
            className="min-h-32 rounded border border-input bg-background p-2 font-mono text-xs"
            placeholder={format === "json" ? '{"version":1,"elements":[],"splices":[]}' : '{"type":"FeatureCollection","features":[]}'}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || pasted.trim().length === 0}
              onClick={() => onText(pasted)}
            >
              {t("upload.usePasted")}
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
