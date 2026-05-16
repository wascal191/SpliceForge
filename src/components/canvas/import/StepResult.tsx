"use client";

import { useTranslations } from "next-intl";

type Props = {
  success: boolean;
  elementCount: number;
  spliceCount: number;
  error: string | null;
};

export function StepResult({ success, elementCount, spliceCount, error }: Props) {
  const t = useTranslations("import");

  if (!success) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        <p className="text-sm text-destructive font-semibold">{t("result.failure")}</p>
        {error && <p className="text-xs text-muted-foreground font-mono">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-sm font-semibold text-green-600">{t("result.success")}</p>
      <p className="text-sm text-muted-foreground">
        {t("result.imported", { elements: elementCount, splices: spliceCount })}
      </p>
    </div>
  );
}
