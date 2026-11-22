import { describe, expect, it } from "vitest";
import { parseStoredExpenses } from "./storage";

const legacy = {
  id: "a",
  date: "2026-03-01",
  amount: 12.5,
  category: "Food",
  description: "Lunch",
  createdAt: "2026-03-01T12:00:00.000Z",
  updatedAt: "2026-03-01T12:00:00.000Z",
};

describe("parseStoredExpenses", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(parseStoredExpenses(null)).toEqual([]);
    expect(parseStoredExpenses("")).toEqual([]);
  });

  it("loads legacy data saved before vendors existed", () => {
    const [e] = parseStoredExpenses(JSON.stringify([legacy]));
    expect(e).toEqual(legacy);
    expect("vendor" in e).toBe(false);
  });

  it("keeps a string vendor, trimmed", () => {
    const [e] = parseStoredExpenses(JSON.stringify([{ ...legacy, vendor: "  Starbucks " }]));
    expect(e.vendor).toBe("Starbucks");
  });

  it("drops a blank or non-string vendor but keeps the expense", () => {
    const out = parseStoredExpenses(
      JSON.stringify([
        { ...legacy, id: "b", vendor: "   " },
        { ...legacy, id: "c", vendor: null },
        { ...legacy, id: "d", vendor: 42 },
      ]),
    );
    expect(out.map((e) => e.id)).toEqual(["b", "c", "d"]);
    for (const e of out) expect("vendor" in e).toBe(false);
  });

  it("still skips malformed entries and rejects non-list data", () => {
    expect(parseStoredExpenses(JSON.stringify([legacy, { id: "x" }]))).toHaveLength(1);
    expect(() => parseStoredExpenses("{}")).toThrow();
    expect(() => parseStoredExpenses("not json")).toThrow();
  });
});
