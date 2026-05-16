import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/env";

// Cached as a module-level singleton to avoid re-instantiation on every call.
// The service role key bypasses RLS and is therefore reserved for trusted
// server-side flows — never expose it to a browser bundle.
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  return cached;
}
