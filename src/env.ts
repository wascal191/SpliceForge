/**
 * Single source of truth for all environment variables.
 *
 * Server-side env vars are validated lazily (on first `serverEnv()` call) so
 * that Next.js can collect page data and build static assets without needing
 * a real DATABASE_URL or BETTER_AUTH_SECRET at compile time.
 *
 * Server-only secrets MUST NOT be imported into client components.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().min(1).optional(),
});

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
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
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
if (!publicParsed.success) {
  const issues = publicParsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid public env vars — ${issues}`);
}

const isServer = typeof window === "undefined";
let serverCache: z.infer<typeof serverSchema> | null = null;

// Detect Next.js build phase so we can supply harmless placeholders during
// `next build`'s page-data collection (real values are required at runtime).
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

function parseServerEnv(): z.infer<typeof serverSchema> {
  const r = serverSchema.safeParse({
    DATABASE_URL:
      process.env.DATABASE_URL ??
      (isBuildPhase ? "postgres://build:build@localhost:5432/build" : undefined),
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ??
      (process.env.NODE_ENV === "production" && !isBuildPhase
        ? undefined
        : "dev-only-insecure-secret-please-change-32chars"),
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
  return r.data;
}

export const env = {
  NEXT_PUBLIC_SITE_URL: publicParsed.data.NEXT_PUBLIC_SITE_URL,
} as const;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (!isServer) {
    throw new Error("serverEnv() must only be called on the server");
  }
  if (!serverCache) {
    serverCache = parseServerEnv();
  }
  return serverCache;
}

/** Lazy accessor for the per-org member cap. Reads env on first call. */
export function maxMembersPerOrg(): number {
  if (!isServer) return 5;
  return serverEnv().MAX_MEMBERS_PER_ORG;
}
