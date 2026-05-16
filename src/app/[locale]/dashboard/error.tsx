"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.dashboard");
  const tGlobal = useTranslations("errors.global");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[dashboard.error]", error);
  }, [error]);

  return (
    <div style={{ padding: 40, maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        {t("title")}
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
        {t("body")}
      </p>
      {error.digest && (
        <p
          style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 10.5,
            color: "#94A3B8",
            marginBottom: 12,
          }}
        >
          {tGlobal("reference", { digest: error.digest })}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        style={{
          background: "#00E5FF",
          color: "#05070C",
          border: "none",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {tCommon("tryAgain")}
      </button>
    </div>
  );
}
