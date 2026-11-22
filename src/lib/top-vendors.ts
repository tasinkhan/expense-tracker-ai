import { CATEGORIES, type Category, type Expense } from "@/types/expense";
import { toISODate } from "./format";

export const VENDOR_PERIODS = [
  { value: "this-month", label: "This month" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "this-year", label: "This year" },
  { value: "all-time", label: "All time" },
] as const;

export type VendorPeriod = (typeof VENDOR_PERIODS)[number]["value"];

export interface VendorStat {
  /** Normalised grouping key (lowercase, single-spaced). */
  key: string;
  /** Most common original spelling (whitespace tidied). */
  name: string;
  total: number;
  count: number;
  /** Percentage of the period total (including expenses without a vendor), 1 decimal place. */
  share: number;
  /** Most recent expense date, YYYY-MM-DD. */
  lastDate: string;
  /** Category with the highest spend at this vendor. */
  mainCategory: Category;
}

export interface TopVendorsResult {
  /** Ranked: total desc, then count desc, then name. */
  vendors: VendorStat[];
  /** Expenses in the period without a vendor; never ranked. `null` when there are none. */
  noVendor: { total: number; count: number; share: number } | null;
  periodTotal: number;
  periodCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Collapse whitespace and trim; returns "" for missing or blank vendors. */
export function cleanVendor(vendor: string | undefined | null): string {
  return typeof vendor === "string" ? vendor.trim().replace(/\s+/g, " ") : "";
}

/** Grouping key: "  starbucks " and "Starbucks" match. "" means no vendor. */
export function vendorKey(vendor: string | undefined | null): string {
  return cleanVendor(vendor).toLowerCase();
}

/** Inclusive YYYY-MM-DD bounds for a period, or `null` for all time. */
export function periodRange(period: VendorPeriod, now: Date): { from: string; to: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "this-month":
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case "last-30-days":
      return { from: toISODate(new Date(y, m, now.getDate() - 29)), to: toISODate(now) };
    case "this-year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "all-time":
      return null;
  }
}

export function filterByPeriod(expenses: Expense[], period: VendorPeriod, now: Date): Expense[] {
  const range = periodRange(period, now);
  if (!range) return expenses;
  return expenses.filter((e) => e.date >= range.from && e.date <= range.to);
}

/** Most frequent spelling; ties go to the most recently used one, then alphabetical (deterministic). */
function pickDisplayName(spellings: Map<string, { count: number; lastDate: string }>): string {
  let best = "";
  let bestInfo = { count: -1, lastDate: "" };
  for (const [name, info] of spellings) {
    const better =
      info.count > bestInfo.count ||
      (info.count === bestInfo.count &&
        (info.lastDate > bestInfo.lastDate || (info.lastDate === bestInfo.lastDate && name < best)));
    if (better) {
      best = name;
      bestInfo = info;
    }
  }
  return best;
}

function pickMainCategory(totals: Map<Category, number>): Category {
  // Iterate in CATEGORIES order so ties resolve deterministically.
  let best: Category = CATEGORIES[0];
  let bestTotal = -1;
  for (const c of CATEGORIES) {
    const t = totals.get(c);
    if (t !== undefined && t > bestTotal) {
      best = c;
      bestTotal = t;
    }
  }
  return best;
}

interface Group {
  total: number;
  count: number;
  lastDate: string;
  spellings: Map<string, { count: number; lastDate: string }>;
  categories: Map<Category, number>;
}

export function topVendors(expenses: Expense[], period: VendorPeriod, now: Date = new Date()): TopVendorsResult {
  const inPeriod = filterByPeriod(expenses, period, now);
  const groups = new Map<string, Group>();
  let noVendorTotal = 0;
  let noVendorCount = 0;
  let periodTotal = 0;

  for (const e of inPeriod) {
    periodTotal += e.amount;
    const name = cleanVendor(e.vendor);
    if (!name) {
      noVendorTotal += e.amount;
      noVendorCount++;
      continue;
    }
    const key = name.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { total: 0, count: 0, lastDate: "", spellings: new Map(), categories: new Map() };
      groups.set(key, g);
    }
    g.total += e.amount;
    g.count++;
    if (e.date > g.lastDate) g.lastDate = e.date;
    const sp = g.spellings.get(name) ?? { count: 0, lastDate: "" };
    sp.count++;
    if (e.date > sp.lastDate) sp.lastDate = e.date;
    g.spellings.set(name, sp);
    g.categories.set(e.category, (g.categories.get(e.category) ?? 0) + e.amount);
  }

  periodTotal = round2(periodTotal);

  const vendors: VendorStat[] = [...groups].map(([key, g]) => {
    const total = round2(g.total);
    return {
      key,
      name: pickDisplayName(g.spellings),
      total,
      count: g.count,
      share: pct(total, periodTotal),
      lastDate: g.lastDate,
      mainCategory: pickMainCategory(g.categories),
    };
  });
  vendors.sort((a, b) => b.total - a.total || b.count - a.count || a.name.localeCompare(b.name));

  const nvTotal = round2(noVendorTotal);
  return {
    vendors,
    noVendor: noVendorCount ? { total: nvTotal, count: noVendorCount, share: pct(nvTotal, periodTotal) } : null,
    periodTotal,
    periodCount: inPeriod.length,
  };
}
