// Generic error helper. Logs full Supabase / Postgres errors server-side
// (where they belong) but returns a generic message to the client so the
// schema/constraints don't leak to attackers.

function serializeError(error: unknown): unknown {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return { message: e.message, code: e.code, details: e.details, hint: e.hint };
  }
  return error;
}

export function fail(scope: string, error: unknown, clientMessage = "Operation failed"): never {
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, serializeError(error));
  throw new Error(clientMessage);
}

export function dbCheck<T>(scope: string, result: { data: T; error: unknown }, clientMessage?: string): T {
  if (result.error) fail(scope, result.error, clientMessage);
  return result.data;
}
