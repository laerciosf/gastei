import { describe, it, expect } from "vitest";
import { transactionSchema } from "@/lib/validations/transaction";

describe("transactionSchema", () => {
  it("accepts valid transaction", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty description", () => {
    const result = transactionSchema.safeParse({
      description: "",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "0",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "-10",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts transaction with tagIds", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
      tagIds: ["tag-1", "tag-2"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts transaction without tagIds", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 2 tagIds", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
      tagIds: ["tag-1", "tag-2", "tag-3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string tagIds", () => {
    const result = transactionSchema.safeParse({
      description: "Almoço",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
      tagIds: [""],
    });
    expect(result.success).toBe(false);
  });
});
