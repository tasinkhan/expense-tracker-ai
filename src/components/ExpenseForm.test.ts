import { describe, expect, it } from "vitest";
import { MAX_VENDOR_LENGTH, validateExpense } from "./ExpenseForm";

const base = { date: "2026-01-15", amount: "12.50", category: "Food", description: "Coffee" };

describe("validateExpense: vendor", () => {
  it("treats vendor as optional", () => {
    expect(validateExpense(base)).toEqual({});
    expect(validateExpense({ ...base, vendor: "" })).toEqual({});
    expect(validateExpense({ ...base, vendor: "    " })).toEqual({});
  });

  it(`accepts up to ${MAX_VENDOR_LENGTH} characters after trimming`, () => {
    expect(validateExpense({ ...base, vendor: "Starbucks" })).toEqual({});
    expect(validateExpense({ ...base, vendor: "x".repeat(MAX_VENDOR_LENGTH) })).toEqual({});
    expect(validateExpense({ ...base, vendor: `  ${"x".repeat(MAX_VENDOR_LENGTH)}  ` })).toEqual({});
  });

  it("rejects vendors that are too long", () => {
    const errors = validateExpense({ ...base, vendor: "x".repeat(MAX_VENDOR_LENGTH + 1) });
    expect(errors).toEqual({ vendor: `Keep it under ${MAX_VENDOR_LENGTH} characters.` });
  });
});
