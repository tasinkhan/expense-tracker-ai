import { CATEGORIES, EMPTY_FILTERS, type Category, type Expense } from "@/types/expense";
import { filterExpenses, sumAmounts } from "./analytics";
import { toISODate } from "./format";

export type Period = "this-month" | "last-30-days" | "this-year" | "all-time";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-30-days", label: "Last 30 days" },
  { id: "this-year", label: "This year" },
  { id: "all-time", label: "All time" },
];

/**
 * Inclusive YYYY-MM-DD bounds for a period, ending today (same ranges as the FilterBar presets).
 * Empty strings mean "unbounded" (All time).
 */
export function periodRange(period: Period, now = new Date()): { from: string; to: string } {
  const today = toISODate(now);
  switch (period) {
    case "this-month":
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "last-30-days":
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: today };
    case "this-year":
      return { from: `${now.getFullYear()}-01-01`, to: today };
    case "all-time":
      return { from: "", to: "" };
  }
}

export interface CategoryRank {
  rank: number;
  category: Category;
  /** Total spend, rounded to cents. */
  total: number;
  /** Share of the period total, 0–100 (unrounded; format for display). */
  share: number;
  count: number;
  /** Average per expense, rounded to cents. */
  average: number;
}

export interface TopCategories {
  from: string;
  to: string;
  total: number;
  count: number;
  rows: CategoryRank[];
}

/**
 * Ranks categories by total spend within a period. Categories without spending are omitted.
 * Ties keep the fixed CATEGORIES order so the ranking is deterministic.
 */
export function topCategories(expenses: Expense[], period: Period, now = new Date()): TopCategories {
  const { from, to } = periodRange(period, now);
  const inPeriod = filterExpenses(expenses, { ...EMPTY_FILTERS, from, to });
  const total = sumAmounts(inPeriod);

  const groups = new Map<Category, Expense[]>(CATEGORIES.map((c) => [c, []]));
  for (const e of inPeriod) groups.get(e.category)?.push(e);

  const rows = CATEGORIES.map((category) => {
    const list = groups.get(category) ?? [];
    const catTotal = sumAmounts(list);
    return {
      category,
      total: catTotal,
      share: total > 0 ? (catTotal / total) * 100 : 0,
      count: list.length,
      average: list.length ? Math.round((catTotal / list.length) * 100) / 100 : 0,
    };
  })
    .filter((r) => r.count > 0 && r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ rank: i + 1, ...r }));

  return { from, to, total, count: inPeriod.length, rows };
}
