import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// In production: strict CSP.
// In development: relax script-src so Turbopack's HMR inline scripts can run.
// Without this, React won't hydrate in dev and forms submit as native HTML POSTs.
// MapLibre GL tile sources — extend if you add additional providers.
const tileHosts = [
  "https://*.stadiamaps.com",      // Stadia Maps (free on localhost, key for prod)
  "https://tiles.openfreemap.org", // OpenFreeMap — no key required
  "https://*.openfreemap.org",
  "https://demotiles.maplibre.org", // MapLibre demo fallback
].join(" ");

const csp = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // blob: needed for MapLibre raster tile workers; tile CDNs for raster sprites/glyphs
  `img-src 'self' data: blob: ${tileHosts}`,
  `font-src 'self' data: ${tileHosts}`,
  // MapLibre fetches style JSON + vector/raster tiles from external CDNs
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${tileHosts}`,
  // MapLibre runs its rendering on a blob: Web Worker
  "worker-src blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Restrict cross-origin server-action invocations to known production hosts
// in addition to the same-origin default check (§2.1).
const allowedOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, ""),
  "localhost:7000",
].filter(Boolean) as string[];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
