"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOrganization } from "@/lib/actions/organizations";

const F = "var(--font-inter), sans-serif";
const FM = "var(--font-geist-mono), monospace";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: orgName.trim(),
            phone: phone.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;

      if (data.session) {
        await createOrganization(orgName.trim() || "My Organization");
        router.push("/dashboard");
        router.refresh();
      } else {
        setCheckEmail(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
            Check your email
          </h2>
          <p style={{ fontFamily: F, fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            We sent a confirmation link to{" "}
            <span style={{ color: "#00E5FF" }}>{email}</span>.
            Click it to activate your account and your organization will be created automatically.
          </p>
          <div style={{ marginTop: 24, fontFamily: F, fontSize: 12.5, color: "#3B4A66" }}>
            Already confirmed?{" "}
            <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none" }}>Sign in</Link>
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
              Create account
            </h1>
            <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", marginTop: 6, marginBottom: 0 }}>
              Start mapping fiber for your team
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                Organization name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Telecom"
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                Phone number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={{
                  background: "rgba(148,184,255,0.05)", border: "1px solid rgba(148,184,255,0.16)",
                  borderRadius: 8, padding: "10px 12px", color: "#F1F5F9",
                  fontFamily: F, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
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

            {/* Test mode notice */}
            <div style={{
              background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.18)",
              borderRadius: 8, padding: "9px 12px",
              fontFamily: FM, fontSize: 10, letterSpacing: "0.04em", color: "#64748B",
            }}>
              Test mode · up to 5 users per organization · free
            </div>

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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(148,184,255,0.08)",
            textAlign: "center", fontFamily: F, fontSize: 12.5, color: "#64748B",
          }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none", fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
