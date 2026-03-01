import { describe, it, expect } from "vitest";
import { formatCurrency, parseCurrency } from "@/lib/utils/money";

describe("formatCurrency", () => {
  it("formats cents to BRL", () => {
    expect(formatCurrency(15000)).toBe("R$\u00a0150,00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });

  it("formats large values", () => {
    expect(formatCurrency(1000000)).toBe("R$\u00a010.000,00");
  });
});

describe("parseCurrency", () => {
  it("parses decimal string to cents", () => {
    expect(parseCurrency("150.00")).toBe(15000);
  });

  it("parses integer string", () => {
    expect(parseCurrency("100")).toBe(10000);
  });

  it("parses string with one decimal", () => {
    expect(parseCurrency("10.5")).toBe(1050);
  });
});
