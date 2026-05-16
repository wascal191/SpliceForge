"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = {
  align?: "left" | "right";
};

export function LocaleSwitcher({ align = "right" }: Props) {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Persist for unprefixed redirects (e.g. /auth/callback after signup).
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(148,184,255,0.08)" }}>
      <div style={{
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 9, letterSpacing: "0.08em",
        color: "#64748B", textTransform: "uppercase",
        marginBottom: 6,
      }}>
        {t("label")}
      </div>
      <div style={{
        display: "flex", gap: 4,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        flexWrap: "wrap",
      }}>
        {routing.locales.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              onClick={() => switchTo(code as Locale)}
              style={{
                background: active ? "rgba(0,229,255,0.12)" : "transparent",
                border: `1px solid ${active ? "rgba(0,229,255,0.35)" : "rgba(148,184,255,0.18)"}`,
                color: active ? "#00E5FF" : "#94A3B8",
                fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600,
                padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              }}
            >
              {t(code)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
