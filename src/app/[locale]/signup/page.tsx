"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { createOrganization } from "@/lib/actions/organizations";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const tv = useTranslations("auth.signup.validation");
  const locale = useLocale();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmedName = fullName.trim();
      const trimmedOrg = orgName.trim();
      const finalOrg = trimmedOrg.length > 0 ? trimmedOrg : `${trimmedName}'s workspace`;
      if (trimmedName.length < 1 || trimmedName.length > 120) throw new Error(tv("nameTooLong"));
      if (trimmedOrg.length > 120) throw new Error(tv("orgTooLong"));
      if (password.length < 8) throw new Error(tv("passwordTooShort"));

      // Stamp the current locale into the cookie next-intl reads, so the
      // /auth/callback redirect after email confirmation lands on the right
      // locale-prefixed page.
      document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName,
            company_name: finalOrg,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;

      if (data.session) {
        await createOrganization(finalOrg);
        router.push("/dashboard");
        router.refresh();
      } else {
        setCheckEmail(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tv("signupFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div style={{
        minHeight: "100vh", background: "#05070C", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          maxWidth: 400, width: "100%", padding: "0 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>📬</div>
          <h2 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            {t("checkEmailTitle")}
          </h2>
          <p style={{ fontFamily: F, fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            {t.rich("checkEmailBody", {
              email: () => <span style={{ color: "#00E5FF" }}>{email}</span>,
            })}
          </p>
          <div style={{ marginTop: 24, fontFamily: F, fontSize: 12.5, color: "#3B4A66" }}>
            {t("alreadyConfirmed")}{" "}
            <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none" }}>{t("signIn")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#05070C", display: "flex",
      alignItems: "center", justifyContent: "center",
      backgroundImage: `
        radial-gradient(800px 600px at 85% -5%, rgba(61,245,163,0.07), transparent 55%),
        radial-gradient(600px 500px at 10% 10%, rgba(79,70,229,0.10), transparent 55%)`,
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
          boxShadow: "0 0 0 1px rgba(61,245,163,0.04), 0 24px 64px rgba(0,0,0,0.6)",
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
            <Field label={t("fullName")}>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fullNamePlaceholder")} style={inputStyle} />
            </Field>
            <Field label={t("email")}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")} style={inputStyle} />
            </Field>
            <Field label={t("orgName")}>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("orgNamePlaceholder")} style={inputStyle} />
            </Field>
            <Field label={t("password")}>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")} style={inputStyle} />
            </Field>

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
                background: loading ? "rgba(61,245,163,0.3)" : "linear-gradient(135deg, #2AE89A, #3DF5A3)",
                color: "#05070C", fontFamily: F, fontWeight: 700, fontSize: 13.5,
                border: "none", borderRadius: 9, height: 42, cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 0 1px rgba(61,245,163,0.4), 0 4px 20px rgba(61,245,163,0.2)",
              }}
            >
              {loading ? t("submitting") : t("submit")}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(148,184,255,0.08)",
            textAlign: "center", fontFamily: F, fontSize: 12.5, color: "#64748B",
          }}>
            {t("haveAccount")}{" "}
            <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none", fontWeight: 600 }}>
              {t("signIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
  fontFamily: F, fontSize: 13, outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
