// Renamed from `middleware.ts` for Next.js 16 (V-11).
// Composes next-intl locale routing with the Better Auth session gate.
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);
const LOCALE_RE = /^\/(en|es|pt-br)(?=\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Better Auth API routes and any future unprefixed `/api/*` bypass both
  //    intl and the auth gate. The Better Auth catch-all lives at
  //    `/api/auth/[...all]/route.ts` and must not be locale-rewritten.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // 2. Let next-intl resolve locale: either keep the URL or redirect to
  //    `/{defaultLocale}/...` when the user lands on an unprefixed path.
  const intlResponse = intlMiddleware(request);
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  // 3. Strip the locale prefix to classify the route for auth gating.
  const match = pathname.match(LOCALE_RE);
  const locale = match ? match[1] : routing.defaultLocale;
  const stripped = pathname.replace(LOCALE_RE, "") || "/";

  // 4. Better Auth session lookup. The cookie is read out of request headers.
  const session = await auth.api.getSession({ headers: request.headers });

  const isProtected =
    stripped.startsWith("/dashboard") || stripped.startsWith("/canvas");
  const isAuthPage =
    stripped.startsWith("/login") || stripped.startsWith("/signup");

  if (isProtected && !session?.user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthPage && session?.user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
