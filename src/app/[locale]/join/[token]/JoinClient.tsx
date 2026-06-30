"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { joinOrganizationByToken } from "@/lib/actions/invites";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

function inputStyle(focused: boolean = false) {
  return {
    background: "rgba(148,184,255,0.05)",
    border: `1px solid ${focused ? "rgba(0,229,255,0.4)" : "rgba(148,184,255,0.16)"}`,
    borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
    fontFamily: F, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
}

export function JoinClient({
  token,
  orgName,
  isAuthenticated,
  userEmail,
}: {
  token: string;
  orgName: string;
  isAuthenticated: boolean;
  userEmail: string | null;
}) {
  const t = useTranslations("auth.join");
  const tv = useTranslations("auth.join.validation");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      await joinOrganizationByToken(token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupAndJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trimmedName = fullName.trim();
      if (trimmedName.length < 1 || trimmedName.length > 120) throw new Error(tv("nameTooLong"));
      if (password.length < 8) throw new Error(tv("passwordTooShort"));

      document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;

      const result = await authClient.signUp.email({
        email,
        password,
        name: trimmedName,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "signup_failed");
      }

      await joinOrganizationByToken(token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const card = {
    background: "linear-gradient(180deg, rgba(15,22,36,0.95), rgba(10,15,26,0.95))",
    border: "1px solid rgba(148,184,255,0.14)", borderRadius: 16,
    padding: "32px 28px",
    boxShadow: "0 0 0 1px rgba(61,245,163,0.04), 0 24px 64px rgba(0,0,0,0.6)",
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#05070C", display: "flex",
      alignItems: "center", justifyContent: "center",
      backgroundImage: `
        radial-gradient(800px 600px at 85% -5%, rgba(61,245,163,0.07), transparent 55%),
        radial-gradient(600px 500px at 10% 10%, rgba(79,70,229,0.10), transparent 55%)`,
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(148,184,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <path d="M2 12 C5 5 8 19 12 12 C16 5 19 19 22 12" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
              <circle cx="2" cy="12" r="1.5" fill="#00E5FF" />
              <circle cx="22" cy="12" r="1.5" fill="#3DF5A3" />
            </svg>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: "#F1F5F9", letterSpacing: "-0.02em" }}>SpliceForge</span>
          </Link>
        </div>

        <div style={card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(61,245,163,0.08)", border: "1px solid rgba(61,245,163,0.25)",
              borderRadius: 8, padding: "6px 14px", marginBottom: 16,
            }}>
              <span style={{ fontFamily: FM, fontSize: 9.5, color: "#3DF5A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t("invitedToJoin")}
              </span>
            </div>
            <h1 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: 0, letterSpacing: "-0.02em" }}>
              {orgName}
            </h1>
          </div>

          {isAuthenticated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", textAlign: "center", margin: 0 }}>
                {t.rich("signedInAs", {
                  email: () => <span style={{ color: "#CBD5E1" }}>{userEmail}</span>,
                })}
              </p>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.28)", borderRadius: 8, padding: "10px 12px", fontFamily: F, fontSize: 12.5, color: "#F87171" }}>
                  {error}
                </div>
              )}
              <button
                onClick={handleJoin}
                disabled={loading}
                style={{
                  background: loading ? "rgba(61,245,163,0.3)" : "linear-gradient(135deg, #2AE89A, #3DF5A3)",
                  color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 13.5,
                  border: "none", borderRadius: 9, height: 44, cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 0 0 1px rgba(61,245,163,0.4), 0 4px 20px rgba(61,245,163,0.2)",
                }}
              >
                {loading ? t("joining") : t("joinButton", { orgName })}
              </button>
              <div style={{ textAlign: "center", fontFamily: F, fontSize: 12, color: "#3B4A66" }}>
                {t("notYou")}{" "}
                <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none" }}>{t("signInDifferent")}</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignupAndJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", margin: 0, textAlign: "center" }}>
                {t("createAccountToJoin")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>{t("fullName")}</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullNamePlaceholder")} style={inputStyle()} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>{t("email")}</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} style={inputStyle()} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>{t("password")}</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} style={inputStyle()} />
              </div>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.28)", borderRadius: 8, padding: "10px 12px", fontFamily: F, fontSize: 12.5, color: "#F87171" }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  background: loading ? "rgba(61,245,163,0.3)" : "linear-gradient(135deg, #2AE89A, #3DF5A3)",
                  color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 13.5,
                  border: "none", borderRadius: 9, height: 42, cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 0 0 1px rgba(61,245,163,0.4), 0 4px 20px rgba(61,245,163,0.2)",
                }}
              >
                {loading ? t("creatingAccount") : t("createAndJoin")}
              </button>
              <div style={{ paddingTop: 12, borderTop: "1px solid rgba(148,184,255,0.08)", textAlign: "center", fontFamily: F, fontSize: 12.5, color: "#64748B" }}>
                {t("haveAccount")}{" "}
                <Link href={`/login?next=/join/${token}`} style={{ color: "#00E5FF", textDecoration: "none", fontWeight: 600 }}>{t("signIn")}</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
