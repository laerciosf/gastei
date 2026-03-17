import { describe, expect, it } from "vitest";
import { goalSchema, goalEntrySchema } from "../goal";

describe("goalSchema", () => {
  it("accepts valid savings goal", () => {
    const result = goalSchema.safeParse({
      name: "Trip to Europe",
      type: "SAVINGS",
      targetAmount: "5000.00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid spending goal with optional fields", () => {
    const result = goalSchema.safeParse({
      name: "Reduce delivery",
      type: "SPENDING",
      targetAmount: "300.00",
      targetDate: "2026-12-31",
      icon: "utensils",
      color: "#f97316",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = goalSchema.safeParse({
      name: "",
      type: "SAVINGS",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero target amount", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "SAVINGS",
      targetAmount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "INVALID",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing optional fields", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "SAVINGS",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(true);
  });
});

describe("goalEntrySchema", () => {
  it("accepts valid deposit", () => {
    const result = goalEntrySchema.safeParse({
      amount: "500.00",
      type: "deposit",
      goalId: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid withdrawal with note", () => {
    const result = goalEntrySchema.safeParse({
      amount: "200.00",
      type: "withdrawal",
      goalId: "abc123",
      note: "Emergency",
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = goalEntrySchema.safeParse({
      amount: "0",
      type: "deposit",
      goalId: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing goalId", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "deposit",
      goalId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note over 200 chars", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "deposit",
      goalId: "abc123",
      note: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entry type", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "transfer",
      goalId: "abc123",
    });
    expect(result.success).toBe(false);
  });
});
