/**
 * Open-redirect protection for ?next=... query params.
 *
 * Accepts only same-origin paths that start with a single forward slash
 * followed by a non-slash, non-backslash character. Rejects:
 *   - protocol-relative URLs  ("//evil.com")
 *   - absolute URLs           ("https://evil.com")
 *   - Windows path traversal  ("\\evil.com")
 *   - empty / null inputs
 *
 * Returns the default destination ("/dashboard") for anything invalid so
 * callers can use the result unconditionally without an extra null check.
 */
export const DEFAULT_REDIRECT = "/dashboard";

export function safeNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return DEFAULT_REDIRECT;
  if (raw.length > 1024) return DEFAULT_REDIRECT;
  // Must start with `/` followed by a non-`/` non-`\` char.
  if (!/^\/[^/\\]/.test(raw)) return DEFAULT_REDIRECT;
  return raw;
}
