"use client";

import { useTranslations } from "next-intl";
import type { ColumnMap, ElementField, ConnectionField } from "@/lib/import";

const ELEMENT_FIELDS: ElementField[] = [
  "label",
  "type",
  "fiberCount",
  "colorScheme",
  "moduleSize",
  "inputCount",
  "outputCount",
  "ratio",
  "trayCount",
  "lat",
  "lng",
];

const CONNECTION_FIELDS: ConnectionField[] = [
  "fromLabel",
  "fromPortIndex",
  "toLabel",
  "toPortIndex",
  "comment",
];

type Props = {
  rawColumns: string[];
  mapping: ColumnMap;
  onChange: (next: ColumnMap) => void;
  showConnections: boolean;
};

export function StepMapColumns({ rawColumns, mapping, onChange, showConnections }: Props) {
  const t = useTranslations("import");
  const NONE = "(skip)";

  function setElement(field: ElementField, column: string) {
    const next = { ...mapping.elements };
    if (column === NONE) {
      delete next[field];
    } else {
      next[field] = column;
    }
    onChange({ ...mapping, elements: next });
  }

  function setConnection(field: ConnectionField, column: string) {
    const next = { ...(mapping.connections ?? {}) };
    if (column === NONE) {
      delete next[field];
    } else {
      next[field] = column;
    }
    onChange({ ...mapping, connections: next });
  }

  return (
    <div className="flex flex-col gap-4 pt-1 max-h-[60vh] overflow-y-auto">
      <p className="text-xs text-muted-foreground">{t("mapping.instructions")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          <span>{t("mapping.yourColumn")}</span>
          <span>{t("mapping.spliceforgeField")}</span>
        </div>
        {rawColumns.map((col) => {
          const matchedElementField =
            (Object.entries(mapping.elements).find(([, c]) => c === col)?.[0] as ElementField | undefined);
          return (
            <div key={col} className="grid grid-cols-2 gap-2 items-center">
              <span className="text-sm font-mono truncate" title={col}>{col}</span>
              <select
                value={matchedElementField ?? NONE}
                onChange={(e) => {
                  const field = e.target.value;
                  if (field === NONE) {
                    if (matchedElementField) setElement(matchedElementField, NONE);
                  } else {
                    setElement(field as ElementField, col);
                  }
                }}
                className="rounded border border-input bg-background px-2 py-1 text-sm"
              >
                <option value={NONE}>{t("mapping.skip")}</option>
                {ELEMENT_FIELDS.map((f) => (
                  <option key={f} value={f}>{t(`field.${f}`)}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {showConnections && (
        <div className="flex flex-col gap-1.5 mt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t("mapping.connectionsHeader")}</h4>
          {CONNECTION_FIELDS.map((field) => (
            <div key={field} className="grid grid-cols-2 gap-2 items-center">
              <span className="text-sm">{t(`field.${field}`)}</span>
              <select
                value={mapping.connections?.[field] ?? NONE}
                onChange={(e) => setConnection(field, e.target.value)}
                className="rounded border border-input bg-background px-2 py-1 text-sm"
              >
                <option value={NONE}>{t("mapping.skip")}</option>
                {rawColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
