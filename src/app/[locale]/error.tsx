"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.global");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app.error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070C",
        color: "#F1F5F9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-inter), sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {t("title")}
        </h1>
        <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20, lineHeight: 1.6 }}>
          {t("body")}
        </p>
        {error.digest && (
          <p
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10.5,
              color: "#64748B",
              marginBottom: 20,
            }}
          >
            {t("reference", { digest: error.digest })}
          </p>
        )}
        <div style={{ display: "inline-flex", gap: 10 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "linear-gradient(135deg, #00C8E0, #00E5FF)",
              color: "#05070C",
              border: "none",
              padding: "10px 18px",
              borderRadius: 9,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            {tCommon("tryAgain")}
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: "10px 18px",
              borderRadius: 9,
              border: "1px solid rgba(148,184,255,0.20)",
              color: "#F1F5F9",
              textDecoration: "none",
              fontSize: 13.5,
            }}
          >
            {tCommon("goToDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
