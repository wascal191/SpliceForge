"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/redirects";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

type AuthErrorCode =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "tooManyRequests"
  | "userNotFound"
  | "default";

function classifyAuthError(err: unknown): AuthErrorCode {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("invalid login credentials") || msg.includes("invalid email or password"))
    return "invalidCredentials";
  if (msg.includes("email not confirmed")) return "emailNotConfirmed";
  if (msg.includes("too many requests") || msg.includes("rate limit")) return "tooManyRequests";
  if (msg.includes("user not found") || msg.includes("no user found")) return "userNotFound";
  return "default";
}

export default function LoginContent() {
  const t = useTranslations("auth.login");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message ?? "invalid_credentials");
      }
      router.push(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (err: unknown) {
      setError(tErr(classifyAuthError(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#05070C", display: "flex",
      alignItems: "center", justifyContent: "center",
      backgroundImage: `
        radial-gradient(800px 600px at 15% -5%, rgba(0,229,255,0.08), transparent 55%),
        radial-gradient(600px 500px at 90% 10%, rgba(79,70,229,0.10), transparent 55%)`,
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(148,184,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,255,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
              <circle cx="2" cy="12" r="1.5" fill="#00E5FF" />
              <circle cx="22" cy="12" r="1.5" fill="#3DF5A3" />
            </svg>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#F1F5F9", letterSpacing: "-0.02em" }}>
              SpliceForge
            </span>
          </Link>
        </div>

        <div style={{
          background: "linear-gradient(180deg, rgba(15,22,36,0.95), rgba(10,15,26,0.95))",
          border: "1px solid rgba(148,184,255,0.14)", borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 0 0 1px rgba(0,229,255,0.04), 0 24px 64px rgba(0,0,0,0.6)",
        }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: 0, letterSpacing: "-0.02em" }}>
              {t("title")}
            </h1>
            <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", marginTop: 6, marginBottom: 0 }}>
              {t("subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                {t("email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                {t("password")}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.28)",
                borderRadius: 8, padding: "10px 12px",
                fontFamily: F, fontSize: 12.5, color: "#F87171",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                background: loading ? "rgba(0,229,255,0.3)" : "linear-gradient(135deg, #00C8E0, #00E5FF)",
                color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 13.5,
                border: "none", borderRadius: 9, height: 42, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 0 1px rgba(0,229,255,0.4), 0 4px 20px rgba(0,229,255,0.25)",
              }}
            >
              {loading ? t("submitting") : t("submit")}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(148,184,255,0.08)",
            textAlign: "center", fontFamily: F, fontSize: 12.5, color: "#64748B",
          }}>
            {t("noAccount")}{" "}
            <Link href="/signup" style={{ color: "#00E5FF", textDecoration: "none", fontWeight: 600 }}>
              {t("signUp")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
