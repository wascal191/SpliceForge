import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Resolve the calling user, their current organization, and role inside it.
 * Uses the authenticated server client + a single admin lookup to read the
 * membership row (filtered by user_id — never trust client-supplied org id).
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new UnauthorizedError("Not authenticated");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    const e = error as unknown as Record<string, unknown>;
    // eslint-disable-next-line no-console
    console.error("[guards.requireAuthContext]", { message: e.message, code: e.code, details: e.details, hint: e.hint });
    throw new UnauthorizedError("Membership lookup failed");
  }
  if (!data) throw new ForbiddenError("No organization membership");

  const role = (data.role as AuthContext["role"]) ?? "viewer";
  return { userId: user.id, orgId: data.organization_id as string, role };
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[guards.assertCallerIsOwnerOfMember]", error);
    throw new ForbiddenError();
  }
  if (!data) throw new ForbiddenError("Member not found");
  if (data.organization_id !== ctx.orgId) throw new ForbiddenError();
  return { ctx, targetOrgId: data.organization_id as string };
}

/**
 * Check that a row in `table` with primary key `id` belongs to `orgId`.
 * Throws ForbiddenError otherwise. The caller should still re-apply
 * `.eq("organization_id", orgId)` on the actual update/delete query for
 * defence in depth (TOCTOU).
 */
export async function assertOrgOwnsRow(
  table: string,
  id: string,
  orgId: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[guards.assertOrgOwnsRow:${table}]`, error);
    throw new ForbiddenError();
  }
  if (!data) throw new ForbiddenError("Resource not found");
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .in("id", ids)
    .eq("organization_id", orgId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[guards.assertOrgOwnsRows:${table}]`, error);
    throw new ForbiddenError();
  }
  const found = new Set((data ?? []).map((r) => r.id as string));
  for (const id of ids) {
    if (!found.has(id)) throw new ForbiddenError("Resource not found");
  }
}

/** Map any guard error to a stable client message; rethrow others. */
export function isAuthError(err: unknown): err is UnauthorizedError | ForbiddenError {
  return err instanceof UnauthorizedError || err instanceof ForbiddenError;
}
