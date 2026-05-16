import { describe, it, expect } from "vitest";
import { safeNext, DEFAULT_REDIRECT } from "@/lib/redirects";

describe("safeNext", () => {
  it("returns default for null/undefined/empty input", () => {
    expect(safeNext(null)).toBe(DEFAULT_REDIRECT);
    expect(safeNext(undefined)).toBe(DEFAULT_REDIRECT);
    expect(safeNext("")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.com")).toBe(DEFAULT_REDIRECT);
    expect(safeNext("//evil.com/path")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBe(DEFAULT_REDIRECT);
    expect(safeNext("http://evil.com")).toBe(DEFAULT_REDIRECT);
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects Windows-style traversal", () => {
    expect(safeNext("\\\\evil.com")).toBe(DEFAULT_REDIRECT);
    expect(safeNext("/\\evil.com")).toBe(DEFAULT_REDIRECT);
  });

  it("accepts same-origin paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/canvas/abc-123")).toBe("/canvas/abc-123");
    expect(safeNext("/a")).toBe("/a");
  });

  it("rejects pathological lengths", () => {
    expect(safeNext("/" + "a".repeat(2000))).toBe(DEFAULT_REDIRECT);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error - testing runtime guard
    expect(safeNext(123)).toBe(DEFAULT_REDIRECT);
    // @ts-expect-error - testing runtime guard
    expect(safeNext({})).toBe(DEFAULT_REDIRECT);
  });
});
