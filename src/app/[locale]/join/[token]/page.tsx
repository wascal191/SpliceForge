import { validateInviteToken } from "@/lib/actions/invites";
import { createClient } from "@/lib/supabase/server";
import { JoinClient } from "./JoinClient";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await validateInviteToken(token);

  if (!invite) {
    return (
      <div style={{
        minHeight: "100vh", background: "#05070C", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-inter), sans-serif",
      }}>
        <div style={{ maxWidth: 400, width: "100%", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", margin: "0 0 10px" }}>
            Invalid invite link
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            This invite link is invalid or has been revoked. Ask the organization owner for a new one.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <JoinClient
      token={token}
      orgName={invite.orgName}
      isAuthenticated={!!user}
      userEmail={user?.email ?? null}
    />
  );
}
