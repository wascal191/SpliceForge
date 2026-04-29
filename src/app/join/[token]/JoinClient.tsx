"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  // Signup form state (for non-authenticated users)
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
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), joining_token: token },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;

      if (data.session) {
        await joinOrganizationByToken(token);
        router.push("/dashboard");
        router.refresh();
      } else {
        setCheckEmail(true);
      }
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

  if (checkEmail) {
    return (
      <div style={{ minHeight: "100vh", background: "#05070C", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 400, width: "100%", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>📬</div>
          <h2 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "0 0 12px" }}>
            Check your email
          </h2>
          <p style={{ fontFamily: F, fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            We sent a confirmation link to <span style={{ color: "#00E5FF" }}>{email}</span>.
            Click it to activate your account and join <strong style={{ color: "#F1F5F9" }}>{orgName}</strong>.
          </p>
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
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(148,184,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 420, padding: "0 24px" }}>
        {/* Logo */}
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
          {/* Org badge */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(61,245,163,0.08)", border: "1px solid rgba(61,245,163,0.25)",
              borderRadius: 8, padding: "6px 14px", marginBottom: 16,
            }}>
              <span style={{ fontFamily: FM, fontSize: 9.5, color: "#3DF5A3", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                You&apos;re invited to join
              </span>
            </div>
            <h1 style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: 0, letterSpacing: "-0.02em" }}>
              {orgName}
            </h1>
          </div>

          {isAuthenticated ? (
            // Already logged in — one-click join
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", textAlign: "center", margin: 0 }}>
                Signed in as <span style={{ color: "#CBD5E1" }}>{userEmail}</span>
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
                {loading ? "Joining…" : `Join ${orgName}`}
              </button>
              <div style={{ textAlign: "center", fontFamily: F, fontSize: 12, color: "#3B4A66" }}>
                Not you?{" "}
                <Link href="/login" style={{ color: "#00E5FF", textDecoration: "none" }}>Sign in with a different account</Link>
              </div>
            </div>
          ) : (
            // Not logged in — signup form
            <form onSubmit={handleSignupAndJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: F, fontSize: 13, color: "#64748B", margin: 0, textAlign: "center" }}>
                Create your account to join this organization
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>Full name</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" style={inputStyle()} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>Work email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle()} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase" }}>Password</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle()} />
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
                {loading ? "Creating account…" : "Create account & join"}
              </button>
              <div style={{ paddingTop: 12, borderTop: "1px solid rgba(148,184,255,0.08)", textAlign: "center", fontFamily: F, fontSize: 12.5, color: "#64748B" }}>
                Already have an account?{" "}
                <Link href={`/login?next=/join/${token}`} style={{ color: "#00E5FF", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
