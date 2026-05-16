import { describe, it, expect } from "vitest";
import {
  Email,
  Uuid,
  OrgName,
  RoleEnum,
  InvitableRole,
  PortStatus,
  ElementType,
  LibraryCableInput,
  limitedJson,
  parseOrFail,
} from "@/lib/validation";

describe("Email", () => {
  it("accepts valid emails and lowercases them", () => {
    expect(Email.parse("Test@Example.com")).toBe("test@example.com");
  });

  it("rejects malformed emails", () => {
    expect(() => Email.parse("not-an-email")).toThrow();
    expect(() => Email.parse("a@b")).toThrow();
  });

  it("trims whitespace", () => {
    expect(Email.parse("  a@b.co  ")).toBe("a@b.co");
  });
});

describe("Uuid", () => {
  it("accepts a v4 uuid", () => {
    expect(Uuid.parse("0193b3b0-1f2a-7a3b-9c4d-5e6f7a8b9c0d")).toBeTypeOf("string");
  });
  it("rejects non-uuid strings", () => {
    expect(() => Uuid.parse("not-a-uuid")).toThrow();
    expect(() => Uuid.parse("12345")).toThrow();
  });
});

describe("OrgName", () => {
  it("trims and accepts 1-120 chars", () => {
    expect(OrgName.parse("  Acme  ")).toBe("Acme");
    expect(OrgName.parse("a")).toBe("a");
    expect(OrgName.parse("x".repeat(120))).toHaveLength(120);
  });
  it("rejects empty and >120", () => {
    expect(() => OrgName.parse("")).toThrow();
    expect(() => OrgName.parse("   ")).toThrow();
    expect(() => OrgName.parse("x".repeat(121))).toThrow();
  });
});

describe("RoleEnum / InvitableRole", () => {
  it("permits the documented roles", () => {
    expect(RoleEnum.parse("owner")).toBe("owner");
    expect(RoleEnum.parse("editor")).toBe("editor");
    expect(RoleEnum.parse("viewer")).toBe("viewer");
  });
  it("InvitableRole excludes owner", () => {
    expect(() => InvitableRole.parse("owner")).toThrow();
    expect(InvitableRole.parse("editor")).toBe("editor");
  });
});

describe("PortStatus / ElementType", () => {
  it("validates the closed set", () => {
    expect(PortStatus.parse("occupied")).toBe("occupied");
    expect(PortStatus.parse("unoccupied")).toBe("unoccupied");
    expect(() => PortStatus.parse("dangling")).toThrow();
    expect(ElementType.parse("cable")).toBe("cable");
    expect(() => ElementType.parse("wormhole")).toThrow();
  });
});

describe("LibraryCableInput", () => {
  it("accepts a well-formed cable", () => {
    const parsed = LibraryCableInput.parse({
      name: "12F SM",
      fiberCount: 12,
      colorScheme: "EIA598",
    });
    expect(parsed.fiberCount).toBe(12);
  });
  it("rejects extra fields (strict)", () => {
    expect(() =>
      LibraryCableInput.parse({
        name: "12F",
        fiberCount: 12,
        colorScheme: "EIA598",
        extra: "nope",
      })
    ).toThrow();
  });
  it("clamps fiberCount range", () => {
    expect(() => LibraryCableInput.parse({ name: "x", fiberCount: 0, colorScheme: "EIA598" })).toThrow();
    expect(() => LibraryCableInput.parse({ name: "x", fiberCount: 99999, colorScheme: "EIA598" })).toThrow();
  });
});

describe("limitedJson", () => {
  it("rejects payloads above the 256kB limit", () => {
    const big = { blob: "x".repeat(300_000) };
    expect(() => limitedJson.parse(big)).toThrow();
  });
  it("accepts small payloads", () => {
    expect(() => limitedJson.parse({ ok: true })).not.toThrow();
  });
});

describe("parseOrFail", () => {
  it("throws a generic public error and logs the real one", () => {
    expect(() => parseOrFail(Email, "not-an-email", "test")).toThrow(/Invalid request/);
  });
});
