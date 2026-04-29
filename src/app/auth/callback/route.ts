import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const meta = data.user.user_metadata ?? {};
      const admin = createAdminClient();

      const { data: membership } = await admin
        .from("organization_members")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!membership) {
        // Case 1: user arrived via invite URL — joining_token is set
        const joiningToken = meta.joining_token as string | undefined;
        if (joiningToken) {
          const { data: invite } = await admin
            .from("organization_invites")
            .select("organization_id")
            .eq("token", joiningToken)
            .maybeSingle();
          if (invite) {
            await admin.from("organization_members").insert({
              organization_id: invite.organization_id,
              user_id: data.user.id,
              role: "editor",
            });
          }
        }
        // Case 2: Supabase email invite — organization_id passed in metadata
        else if (meta.organization_id) {
          await admin.from("organization_members").insert({
            organization_id: meta.organization_id,
            user_id: data.user.id,
            role: (meta.role as string | undefined) ?? "editor",
          });
        }
        // Case 3: regular signup — create a new org from company_name
        else {
          const companyName = (meta.company_name as string | undefined) ?? "My Organization";
          let db: typeof supabase;
          try { db = admin as unknown as typeof supabase; } catch { db = supabase; }
          const { data: org, error: orgError } = await db
            .from("organizations")
            .insert({ name: companyName })
            .select()
            .single();
          if (!orgError && org) {
            await db.from("organization_members").insert({
              organization_id: org.id,
              user_id: data.user.id,
              role: "owner",
            });
          }
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
