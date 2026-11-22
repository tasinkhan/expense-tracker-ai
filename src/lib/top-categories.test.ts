import { describe, expect, it } from "vitest";
import type { Category, Expense } from "@/types/expense";
import { PERIODS, periodRange, topCategories } from "./top-categories";

let seq = 0;
const exp = (date: string, amount: number, category: Category): Expense => ({
  id: `e${++seq}`,
  date,
  amount,
  category,
  description: "test",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

// Local time, mid-day, so the date is unambiguous in any timezone.
const NOW = new Date(2026, 10, 22, 12, 0, 0); // 2026-11-22

describe("periodRange", () => {
  it("computes inclusive bounds ending today", () => {
    expect(periodRange("this-month", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-22" });
    expect(periodRange("last-30-days", NOW)).toEqual({ from: "2026-10-24", to: "2026-11-22" });
    expect(periodRange("this-year", NOW)).toEqual({ from: "2026-01-01", to: "2026-11-22" });
    expect(periodRange("all-time", NOW)).toEqual({ from: "", to: "" });
  });

  it("handles month and year edges", () => {
    const jan1 = new Date(2026, 0, 1, 12);
    expect(periodRange("this-month", jan1)).toEqual({ from: "2026-01-01", to: "2026-01-01" });
    expect(periodRange("this-year", jan1)).toEqual({ from: "2026-01-01", to: "2026-01-01" });
    // 30 days back crosses into the previous year
    expect(periodRange("last-30-days", jan1)).toEqual({ from: "2025-12-03", to: "2026-01-01" });
    // Leap year: Mar 1 2024 minus 29 days is Feb 1
    expect(periodRange("last-30-days", new Date(2024, 2, 1, 12))).toEqual({ from: "2024-02-01", to: "2024-03-01" });
  });

  it("exposes the four periods in display order", () => {
    expect(PERIODS.map((p) => p.label)).toEqual(["This month", "Last 30 days", "This year", "All time"]);
  });
});

describe("topCategories", () => {
  it("returns an empty result for empty input", () => {
    for (const p of PERIODS) {
      const r = topCategories([], p.id, NOW);
      expect(r.total).toBe(0);
      expect(r.count).toBe(0);
      expect(r.rows).toEqual([]);
    }
  });

  it("ranks categories by total spend, descending, omitting categories with no spend", () => {
    const r = topCategories(
      [
        exp("2026-11-02", 10, "Food"),
        exp("2026-11-03", 50, "Bills"),
        exp("2026-11-04", 15, "Food"),
        exp("2026-11-05", 5, "Other"),
      ],
      "all-time",
      NOW,
    );
    expect(r.rows.map((x) => [x.rank, x.category, x.total])).toEqual([
      [1, "Bills", 50],
      [2, "Food", 25],
      [3, "Other", 5],
    ]);
    expect(r.rows.some((x) => x.category === "Shopping")).toBe(false);
  });

  it("breaks ties by the fixed category order", () => {
    const r = topCategories([exp("2026-11-02", 20, "Other"), exp("2026-11-02", 20, "Food")], "all-time", NOW);
    expect(r.rows.map((x) => x.category)).toEqual(["Food", "Other"]);
  });

  it("includes both period boundaries and excludes dates outside them", () => {
    const list = [
      exp("2026-10-31", 1, "Food"), // day before this month
      exp("2026-11-01", 2, "Food"), // first day of month (inclusive)
      exp("2026-11-22", 4, "Food"), // today (inclusive)
      exp("2026-11-23", 8, "Food"), // future, excluded from bounded periods
      exp("2026-10-23", 16, "Bills"), // day before the 30-day window
      exp("2026-10-24", 32, "Bills"), // first day of the 30-day window
      exp("2025-12-31", 64, "Shopping"), // last year
      exp("2026-01-01", 128, "Shopping"), // first day of the year
    ];
    expect(topCategories(list, "this-month", NOW).total).toBe(6);
    expect(topCategories(list, "last-30-days", NOW).total).toBe(1 + 2 + 4 + 32);
    expect(topCategories(list, "this-year", NOW).total).toBe(1 + 2 + 4 + 16 + 32 + 128);
    expect(topCategories(list, "all-time", NOW).total).toBe(255);
    expect(topCategories(list, "all-time", NOW).count).toBe(8);
  });

  it("computes counts and per-expense averages rounded to cents", () => {
    const r = topCategories(
      [exp("2026-11-01", 10, "Food"), exp("2026-11-02", 10, "Food"), exp("2026-11-03", 0.01, "Food")],
      "this-month",
      NOW,
    );
    const [food] = r.rows;
    expect(food.count).toBe(3);
    expect(food.total).toBe(20.01);
    expect(food.average).toBe(6.67); // 20.01 / 3 = 6.67
  });

  it("rounds totals to cents, avoiding float drift", () => {
    const r = topCategories(
      [exp("2026-11-01", 0.1, "Food"), exp("2026-11-01", 0.2, "Food"), exp("2026-11-01", 0.3, "Bills")],
      "this-month",
      NOW,
    );
    expect(r.total).toBe(0.6);
    expect(r.rows.find((x) => x.category === "Food")!.total).toBe(0.3);
    // Exact tie after rounding (0.1 + 0.2 vs 0.3) falls back to category order
    expect(r.rows.map((x) => x.category)).toEqual(["Food", "Bills"]);
  });

  it("computes shares of the period total that sum to 100%", () => {
    const r = topCategories(
      [exp("2026-11-01", 10, "Food"), exp("2026-11-01", 10, "Bills"), exp("2026-11-01", 10, "Other")],
      "this-month",
      NOW,
    );
    for (const row of r.rows) expect(row.share).toBeCloseTo(100 / 3, 10);
    expect(r.rows.reduce((s, x) => s + x.share, 0)).toBeCloseTo(100, 10);

    const single = topCategories([exp("2026-11-01", 42.42, "Shopping")], "this-month", NOW);
    expect(single.rows[0].share).toBe(100);
  });

  it("only counts expenses inside the selected period for shares and averages", () => {
    const r = topCategories(
      [exp("2026-11-10", 30, "Food"), exp("2026-11-11", 10, "Bills"), exp("2025-05-01", 1000, "Bills")],
      "this-month",
      NOW,
    );
    expect(r.total).toBe(40);
    expect(r.rows.map((x) => [x.category, x.share, x.count, x.average])).toEqual([
      ["Food", 75, 1, 30],
      ["Bills", 25, 1, 10],
    ]);
  });
});
