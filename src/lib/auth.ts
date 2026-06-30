import "server-only";
import { betterAuth } from "better-auth";
import { pool } from "@/lib/db";
import { serverEnv } from "@/env";

export const auth = betterAuth({
  database: pool,
  secret: serverEnv().BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:7000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Email verification is disabled by default so self-hosters don't need an
    // SMTP transport to get the app running. To require verification, set
    // `requireEmailVerification: true` and configure an email sender below.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,      // refresh sliding session once per day
  },
});

export type Session = typeof auth.$Infer.Session;
