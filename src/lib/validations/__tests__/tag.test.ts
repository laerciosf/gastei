import { describe, it, expect } from "vitest";
import { tagSchema } from "@/lib/validations/tag";

describe("tagSchema", () => {
  it("accepts valid tag", () => {
    const result = tagSchema.safeParse({ name: "viagem", color: "#ef4444" });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases name", () => {
    const result = tagSchema.safeParse({ name: "  Viagem  ", color: "#ef4444" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("viagem");
    }
  });

  it("rejects empty name", () => {
    const result = tagSchema.safeParse({ name: "", color: "#ef4444" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 30 chars", () => {
    const result = tagSchema.safeParse({ name: "a".repeat(31), color: "#ef4444" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color", () => {
    const result = tagSchema.safeParse({ name: "viagem", color: "red" });
    expect(result.success).toBe(false);
  });

  it("rejects 3-char hex color", () => {
    const result = tagSchema.safeParse({ name: "viagem", color: "#fff" });
    expect(result.success).toBe(false);
  });
});
