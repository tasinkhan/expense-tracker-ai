import { describe, expect, it } from "vitest";
import type { Category, Expense } from "@/types/expense";
import { cleanVendor, filterByPeriod, periodRange, topVendors, vendorKey } from "./top-vendors";

let seq = 0;
function exp(date: string, amount: number, vendor?: string, category: Category = "Food"): Expense {
  seq++;
  return {
    id: `e${seq}`,
    date,
    amount,
    category,
    description: "Test",
    ...(vendor === undefined ? {} : { vendor }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Sunday 15 March 2026, local time, mid-day.
const NOW = new Date(2026, 2, 15, 12, 0, 0);

describe("vendor normalisation", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanVendor("  Trader   Joe's \t")).toBe("Trader Joe's");
    expect(cleanVendor("")).toBe("");
    expect(cleanVendor("   ")).toBe("");
    expect(cleanVendor(undefined)).toBe("");
    expect(cleanVendor(null)).toBe("");
  });

  it("builds a case-insensitive key", () => {
    expect(vendorKey("starbucks ")).toBe(vendorKey("Starbucks"));
    expect(vendorKey(" STAR  BUCKS")).toBe("star bucks");
  });
});

describe("grouping and display name", () => {
  it("groups spellings that differ only in case and whitespace", () => {
    const r = topVendors(
      [exp("2026-03-01", 5, "Starbucks"), exp("2026-03-02", 4, "starbucks "), exp("2026-03-03", 3, "  STARBUCKS")],
      "all-time",
      NOW,
    );
    expect(r.vendors).toHaveLength(1);
    expect(r.vendors[0]).toMatchObject({ key: "starbucks", total: 12, count: 3 });
  });

  it("uses the most common original spelling", () => {
    const r = topVendors(
      [exp("2026-03-01", 1, "whole foods"), exp("2026-03-02", 1, "Whole Foods"), exp("2026-03-03", 1, "Whole  Foods ")],
      "all-time",
      NOW,
    );
    // "Whole  Foods " tidies to "Whole Foods", so that spelling wins 2-1.
    expect(r.vendors[0].name).toBe("Whole Foods");
  });

  it("breaks spelling ties by most recent use", () => {
    const r = topVendors([exp("2026-03-01", 1, "UBER"), exp("2026-03-05", 1, "Uber")], "all-time", NOW);
    expect(r.vendors[0].name).toBe("Uber");
    const r2 = topVendors([exp("2026-03-05", 1, "UBER"), exp("2026-03-01", 1, "Uber")], "all-time", NOW);
    expect(r2.vendors[0].name).toBe("UBER");
  });

  it("reports last purchase date and main category by spend", () => {
    const r = topVendors(
      [
        exp("2026-02-10", 10, "Target", "Shopping"),
        exp("2026-03-12", 5, "Target", "Food"),
        exp("2026-01-02", 30, "Target", "Shopping"),
        exp("2026-03-01", 20, "Target", "Food"),
      ],
      "all-time",
      NOW,
    );
    expect(r.vendors[0].lastDate).toBe("2026-03-12");
    expect(r.vendors[0].mainCategory).toBe("Shopping"); // 40 vs 25
  });

  it("resolves main-category ties in category order", () => {
    const r = topVendors(
      [exp("2026-03-01", 10, "Costco", "Transportation"), exp("2026-03-02", 10, "Costco", "Food")],
      "all-time",
      NOW,
    );
    expect(r.vendors[0].mainCategory).toBe("Food");
  });
});

describe("no-vendor handling", () => {
  it("keeps missing, empty and blank vendors out of the ranking", () => {
    const r = topVendors(
      [exp("2026-03-01", 10), exp("2026-03-02", 20, ""), exp("2026-03-03", 30, "   "), exp("2026-03-04", 5, "Shell")],
      "all-time",
      NOW,
    );
    expect(r.vendors.map((v) => v.name)).toEqual(["Shell"]);
    expect(r.noVendor).toEqual({ total: 60, count: 3, share: 92.3 });
    expect(r.periodTotal).toBe(65);
    expect(r.periodCount).toBe(4);
  });

  it("is null when every expense has a vendor", () => {
    expect(topVendors([exp("2026-03-01", 1, "Shell")], "all-time", NOW).noVendor).toBeNull();
  });

  it("handles a period with only vendor-less expenses", () => {
    const r = topVendors([exp("2026-03-01", 7.5)], "all-time", NOW);
    expect(r.vendors).toEqual([]);
    expect(r.noVendor).toEqual({ total: 7.5, count: 1, share: 100 });
  });
});

describe("ranking", () => {
  it("sorts by total, then count, then name", () => {
    const r = topVendors(
      [
        exp("2026-03-01", 10, "Bravo"),
        exp("2026-03-01", 10, "Alpha"),
        exp("2026-03-01", 5, "Charlie"),
        exp("2026-03-02", 5, "Charlie"),
        exp("2026-03-01", 50, "Delta"),
        exp("2026-03-01", 1, "echo"),
      ],
      "all-time",
      NOW,
    );
    // Charlie (10, 2 expenses) beats Alpha/Bravo (10, 1 expense); Alpha beats Bravo by name.
    expect(r.vendors.map((v) => v.name)).toEqual(["Delta", "Charlie", "Alpha", "Bravo", "echo"]);
  });
});

describe("periods", () => {
  it("computes inclusive ranges from a fixed now", () => {
    expect(periodRange("this-month", NOW)).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(periodRange("last-30-days", NOW)).toEqual({ from: "2026-02-14", to: "2026-03-15" });
    expect(periodRange("this-year", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("all-time", NOW)).toBeNull();
  });

  it("handles month ends and leap years", () => {
    expect(periodRange("this-month", new Date(2024, 1, 10))).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(periodRange("last-30-days", new Date(2026, 0, 5))).toEqual({ from: "2025-12-07", to: "2026-01-05" });
  });

  it("filters on the boundaries", () => {
    const list = [
      exp("2026-02-13", 1, "A"), // day before last-30 window
      exp("2026-02-14", 1, "B"), // first day of last-30 window
      exp("2026-02-28", 1, "C"),
      exp("2026-03-01", 1, "D"), // first day of month
      exp("2026-03-15", 1, "E"), // today
      exp("2025-12-31", 1, "F"), // last year
      exp("2026-01-01", 1, "G"), // first day of year
    ];
    const names = (p: Parameters<typeof filterByPeriod>[1]) =>
      filterByPeriod(list, p, NOW)
        .map((e) => e.vendor)
        .sort();
    expect(names("this-month")).toEqual(["D", "E"]);
    expect(names("last-30-days")).toEqual(["B", "C", "D", "E"]);
    expect(names("this-year")).toEqual(["A", "B", "C", "D", "E", "G"]);
    expect(names("all-time")).toHaveLength(7);
  });

  it("only aggregates expenses in the period", () => {
    const r = topVendors([exp("2026-03-02", 10, "Shell"), exp("2026-01-15", 99, "Shell")], "this-month", NOW);
    expect(r.vendors[0]).toMatchObject({ total: 10, count: 1, lastDate: "2026-03-02" });
    expect(r.periodTotal).toBe(10);
  });
});

describe("shares and rounding", () => {
  it("rounds totals to cents", () => {
    const r = topVendors(
      [exp("2026-03-01", 0.1, "A"), exp("2026-03-02", 0.2, "A"), exp("2026-03-03", 0.7, "B")],
      "all-time",
      NOW,
    );
    expect(r.vendors.find((v) => v.name === "A")!.total).toBe(0.3); // not 0.30000000000000004
    expect(r.periodTotal).toBe(1);
  });

  it("computes shares of the whole period total to one decimal", () => {
    const r = topVendors(
      [exp("2026-03-01", 10, "A"), exp("2026-03-01", 10, "B"), exp("2026-03-01", 10, "C")],
      "all-time",
      NOW,
    );
    expect(r.vendors.map((v) => v.share)).toEqual([33.3, 33.3, 33.3]);
  });

  it("includes no-vendor spending in the share denominator", () => {
    const r = topVendors([exp("2026-03-01", 75, "A"), exp("2026-03-01", 25)], "all-time", NOW);
    expect(r.vendors[0].share).toBe(75);
    expect(r.noVendor!.share).toBe(25);
  });
});

describe("empty input", () => {
  it("returns an empty result", () => {
    expect(topVendors([], "all-time", NOW)).toEqual({ vendors: [], noVendor: null, periodTotal: 0, periodCount: 0 });
  });

  it("returns an empty result when nothing falls in the period", () => {
    const r = topVendors([exp("2025-06-01", 10, "A")], "this-year", NOW);
    expect(r).toEqual({ vendors: [], noVendor: null, periodTotal: 0, periodCount: 0 });
  });
});
