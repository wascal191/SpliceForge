import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, MAX_MEMBERS_PER_ORG } from "@/env";
import { applyTemplate } from "@/lib/templates/apply";
import { ftthAccess } from "@/lib/templates/ftth-access";
import { routing } from "@/i18n/routing";

function resolveLocale(cookieValue: string | undefined): string {
  if (!cookieValue) return routing.defaultLocale;
  return (routing.locales as readonly string[]).includes(cookieValue)
    ? cookieValue
    : routing.defaultLocale;
}

const ALLOWED_ROLES = new Set(["editor", "viewer"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  const locale = resolveLocale(cookieStore.get("NEXT_LOCALE")?.value);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_callback_failed`);
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
        if ((count ?? 0) < MAX_MEMBERS_PER_ORG) {
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
      // Regular signup: provision a brand-new org atomically via RPC. Wrapping
      // org + owner-member insert in a single transaction prevents the
      // orphaned-row class of failures (see docs/migrations/2026-05-12-org-rpc.sql).
      const companyNameRaw = (userMeta.company_name ?? "").toString().trim();
      const companyName =
        companyNameRaw.length > 0 && companyNameRaw.length <= 120
          ? companyNameRaw
          : "My Organization";

      const { data: org, error: rpcError } = await admin.rpc("create_org_with_owner", {
        p_name: companyName,
        p_user_id: data.user.id,
      });
      if (rpcError) {
        // eslint-disable-next-line no-console
        console.error("[auth.callback.createOrg]", rpcError);
      } else if (org && (org as { id?: string }).id) {
        // Seed a demo FTTH project so the new user lands on a populated canvas
        // and can run a trace/export within their first session (Sprint 1 goal).
        const orgId = (org as { id: string }).id;
        try {
          const { data: project, error: projErr } = await admin
            .from("projects")
            .insert({
              name: ftthAccess.defaultProjectName,
              description: "Demo project — try the BFS trace and export tools on this seeded FTTH network.",
              organization_id: orgId,
            })
            .select("id")
            .single();
          if (projErr || !project) {
            // eslint-disable-next-line no-console
            console.error("[auth.callback.seedProject]", projErr);
          } else {
            const applied = await applyTemplate(admin, orgId, project.id as string, ftthAccess);
            return NextResponse.redirect(`${origin}/${locale}/canvas/${applied.bedsheetId}?welcome=1`);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[auth.callback.seedTemplate]", err);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/dashboard`);
}
