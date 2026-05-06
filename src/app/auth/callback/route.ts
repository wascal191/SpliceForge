import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = new Set(["editor", "viewer"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Authorization-bearing fields MUST come from app_metadata (server-only)
  // — never user_metadata, which is fully attacker-controlled at signUp time.
  const appMeta = (data.user.app_metadata ?? {}) as {
    invited_org_id?: string;
    invited_role?: string;
  };
  const userMeta = (data.user.user_metadata ?? {}) as {
    company_name?: string;
  };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!membership) {
    if (appMeta.invited_org_id) {
      // Trusted: only the service-role-backed invite flow writes app_metadata.
      const role = ALLOWED_ROLES.has(appMeta.invited_role ?? "")
        ? (appMeta.invited_role as string)
        : "editor";

      // Verify the org still exists and is below cap.
      const { data: org } = await admin
        .from("organizations")
        .select("id")
        .eq("id", appMeta.invited_org_id)
        .maybeSingle();

      if (org) {
        const { count } = await admin
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);
        if ((count ?? 0) < 5) {
          await admin.from("organization_members").insert({
            organization_id: org.id,
            user_id: data.user.id,
            role,
          });
          // Burn the invite payload after consumption so it can't be replayed
          // (e.g. if the user signs in again from a different device).
          await admin.auth.admin.updateUserById(data.user.id, { app_metadata: {} });
        }
      }
    } else {
      // Regular signup: create a brand new org from company_name (still
      // user-supplied, but used only as the new org's display name — it
      // cannot grant access to any pre-existing tenant).
      const companyNameRaw = (userMeta.company_name ?? "").toString().trim();
      const companyName = companyNameRaw.length > 0 && companyNameRaw.length <= 120
        ? companyNameRaw
        : "My Organization";

      const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name: companyName })
        .select()
        .single();
      if (!orgError && org) {
        await admin.from("organization_members").insert({
          organization_id: org.id,
          user_id: data.user.id,
          role: "owner",
        });
      } else {
        // eslint-disable-next-line no-console
        console.error("[auth.callback.createOrg]", orgError);
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
