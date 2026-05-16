// Renamed from `middleware.ts` for Next.js 16 (V-11).
// Composes next-intl locale routing with the existing Supabase auth gate.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { env } from "@/env";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);
const LOCALE_RE = /^\/(en|es|pt-br)(?=\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Unprefixed routes: Supabase OAuth callback + any future API routes
  //    bypass both intl and auth. Supabase posts here with the exact path
  //    `/auth/callback?code=...` and must not be locale-rewritten.
  if (pathname.startsWith("/auth/callback") || pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // 2. Let next-intl resolve locale: either keep the URL or redirect to
  //    `/{defaultLocale}/...` when the user lands on an unprefixed path.
  const intlResponse = intlMiddleware(request);
  if (intlResponse.headers.get("location")) {
    // Intl is issuing a redirect — let it through unmodified.
    return intlResponse;
  }

  // 3. Strip the locale prefix to classify the route for auth gating.
  const match = pathname.match(LOCALE_RE);
  const locale = match ? match[1] : routing.defaultLocale;
  const stripped = pathname.replace(LOCALE_RE, "") || "/";

  // 4. Existing Supabase auth gate. Build response that preserves any
  //    cookies next-intl wrote on its pass-through response.
  let response = intlResponse;
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
    stripped.startsWith("/dashboard") || stripped.startsWith("/canvas");
  const isAuthPage =
    stripped.startsWith("/login") ||
    stripped.startsWith("/signup") ||
    (stripped.startsWith("/auth") && !stripped.startsWith("/auth/setup"));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
