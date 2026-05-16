/**
 * Single source of truth for all environment variables.
 *
 * Throws at module load if a required var is missing, so a misconfigured
 * deploy fails fast at boot instead of with a cryptic runtime crash on the
 * first request (avoids the ERROR 3803919807 class of issue described in
 * the deployment notes).
 *
 * Server-only secrets live under `serverOnly` and MUST NOT be imported into
 * client components — Next.js will reject `NEXT_PUBLIC_*`-less imports in
 * client bundles via its module-graph analysis, but we still gate access
 * through a typed accessor for clarity.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Optional in dev; required for production correctness (invite redirects,
  // server-action allowlist). We don't .url() it because Vercel sometimes
  // provides bare hostnames during preview deploys.
  NEXT_PUBLIC_SITE_URL: z.string().min(1).optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Optional — when both are present the rate limiter switches to Upstash.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Test-tier cap; configurable per environment.
  MAX_MEMBERS_PER_ORG: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : 5;
      if (!Number.isFinite(n) || n < 1 || n > 10_000) {
        throw new Error(
          `Invalid MAX_MEMBERS_PER_ORG: "${v}" (expected 1..10000)`
        );
      }
      return n;
    }),
});

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
if (!publicParsed.success) {
  const issues = publicParsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid public env vars — ${issues}`);
}

// Server vars are only validated server-side. Doing it unconditionally would
// throw in client bundles because secrets aren't shipped to the browser.
const isServer = typeof window === "undefined";
let serverParsed: z.infer<typeof serverSchema> | null = null;
if (isServer) {
  const r = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    MAX_MEMBERS_PER_ORG: process.env.MAX_MEMBERS_PER_ORG,
  });
  if (!r.success) {
    const issues = r.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid server env vars — ${issues}`);
  }
  serverParsed = r.data;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: publicParsed.data.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicParsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: publicParsed.data.NEXT_PUBLIC_SITE_URL,
} as const;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (!serverParsed) {
    throw new Error("serverEnv() must only be called on the server");
  }
  return serverParsed;
}

export const MAX_MEMBERS_PER_ORG = isServer
  ? serverParsed!.MAX_MEMBERS_PER_ORG
  : 5;
