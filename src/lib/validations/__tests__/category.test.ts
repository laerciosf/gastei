import { describe, it, expect } from "vitest";
import { categorySchema } from "@/lib/validations/category";

describe("categorySchema", () => {
  it("accepts valid expense category", () => {
    const result = categorySchema.safeParse({
      name: "Alimentação",
      icon: "utensils",
      color: "#ef4444",
      type: "EXPENSE",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid income category", () => {
    const result = categorySchema.safeParse({
      name: "Salário",
      icon: "banknote",
      color: "#10b981",
      type: "INCOME",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = categorySchema.safeParse({
      name: "",
      icon: "circle",
      color: "#000000",
      type: "EXPENSE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      icon: "circle",
      color: "red",
      type: "EXPENSE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      icon: "circle",
      color: "#000000",
      type: "TRANSFER",
    });
    expect(result.success).toBe(false);
  });
});
