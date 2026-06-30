import "server-only";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { serverEnv } from "@/env";

// Single shared connection pool. In dev we cache on `globalThis` so HMR doesn't
// open a fresh pool on every reload (which leaks connections fast).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function makePool(): Pool {
  return new Pool({
    connectionString: serverEnv().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalThis.__pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

/**
 * Run a parameterized query and return the rows typed as `T`. Use `$1`, `$2`
 * etc. for parameters — never interpolate user input into the SQL string.
 *
 * Example:
 *   const rows = await query<{ id: string; name: string }>(
 *     `SELECT id, name FROM projects WHERE organization_id = $1`,
 *     [orgId]
 *   );
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[] | undefined);
}

/**
 * Convenience: run a query and return only the rows array.
 */
export async function rows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<T[]> {
  const r = await query<T>(text, params);
  return r.rows;
}

/**
 * Convenience: run a query and return the first row or null.
 */
export async function maybeOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<T | null> {
  const r = await query<T>(text, params);
  return r.rows[0] ?? null;
}

/**
 * Run a series of statements inside a single transaction. Rolls back on any
 * thrown error; commits otherwise.
 */
export async function withTransaction<T>(
  fn: (tx: {
    query: <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: readonly unknown[]
    ) => Promise<QueryResult<R>>;
  }) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = {
      query: <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: readonly unknown[]
      ) => client.query<R>(text, params as unknown[] | undefined),
    };
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
