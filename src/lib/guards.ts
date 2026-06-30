import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { maybeOne, rows } from "@/lib/db";

export type AuthContext = {
  userId: string;
  orgId: string;
  role: "owner" | "editor" | "viewer";
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const TABLE_WHITELIST = new Set([
  "organizations",
  "organization_members",
  "organization_invites",
  "projects",
  "bedsheets",
  "pages",
  "elements",
  "ports",
  "splices",
  "library_cables",
]);

function assertTable(name: string): string {
  if (!TABLE_WHITELIST.has(name)) {
    throw new Error(`assertTable: ${name} is not allowed`);
  }
  return name;
}

/**
 * Resolve the calling user (via Better Auth), their current organization,
 * and role inside it.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  const userId = session.user.id;

  const row = await maybeOne<{ organization_id: string; role: string }>(
    `SELECT organization_id, role
       FROM organization_members
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId]
  );
  if (!row) throw new ForbiddenError("No organization membership");

  return {
    userId,
    orgId: row.organization_id,
    role: (row.role as AuthContext["role"]) ?? "viewer",
  };
}

export function requireRole(ctx: AuthContext, allowed: AuthContext["role"][]): void {
  if (!allowed.includes(ctx.role)) throw new ForbiddenError();
}

/**
 * Confirm that a member row belongs to the caller's organization, returning
 * the target organization_id. Used by member management actions.
 */
export async function assertCallerIsOwnerOfMember(memberId: string): Promise<{
  ctx: AuthContext;
  targetOrgId: string;
}> {
  const ctx = await requireAuthContext();
  requireRole(ctx, ["owner"]);

  const row = await maybeOne<{ organization_id: string }>(
    `SELECT organization_id FROM organization_members WHERE id = $1`,
    [memberId]
  );
  if (!row) throw new ForbiddenError("Member not found");
  if (row.organization_id !== ctx.orgId) throw new ForbiddenError();
  return { ctx, targetOrgId: row.organization_id };
}

/**
 * Check that a row in `table` with primary key `id` belongs to `orgId`.
 * Throws ForbiddenError otherwise. Callers should still re-apply
 * `organization_id = $orgId` on the actual update/delete query for
 * defence in depth (TOCTOU).
 */
export async function assertOrgOwnsRow(
  table: string,
  id: string,
  orgId: string
): Promise<void> {
  const t = assertTable(table);
  const row = await maybeOne<{ id: string }>(
    `SELECT id FROM ${t} WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  if (!row) throw new ForbiddenError("Resource not found");
}

/**
 * Bulk variant — fetches all matching rows and verifies that every requested
 * id was found and owned by `orgId`.
 */
export async function assertOrgOwnsRows(
  table: string,
  ids: string[],
  orgId: string
): Promise<void> {
  if (ids.length === 0) return;
  const t = assertTable(table);
  const found = await rows<{ id: string }>(
    `SELECT id FROM ${t} WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
    [ids, orgId]
  );
  const foundSet = new Set(found.map((r) => r.id));
  for (const id of ids) {
    if (!foundSet.has(id)) throw new ForbiddenError("Resource not found");
  }
}

/** Map any guard error to a stable client message; rethrow others. */
export function isAuthError(err: unknown): err is UnauthorizedError | ForbiddenError {
  return err instanceof UnauthorizedError || err instanceof ForbiddenError;
}
