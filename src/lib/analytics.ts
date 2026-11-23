import { CATEGORIES, type Category, type Expense, type ExpenseFilters } from "@/types/expense";
import { monthKey, toISODate } from "./format";

export function filterExpenses(expenses: Expense[], f: ExpenseFilters): Expense[] {
  const q = f.search.trim().toLowerCase();
  return expenses.filter((e) => {
    if (f.category !== "All" && e.category !== f.category) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (q && !e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const sumAmounts = (list: Expense[]) => Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100;

export function totalsByCategory(list: Expense[]): { category: Category; total: number }[] {
  const map = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  for (const e of list) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return CATEGORIES.map((category) => ({ category, total: map.get(category) ?? 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Totals for the last `count` months, ending with the current month (zero-filled). */
export function monthlyTotals(list: Expense[], count = 6, now = new Date()): { month: string; total: number }[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(toISODate(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
  }
  const map = new Map(months.map((m) => [m, 0]));
  for (const e of list) {
    const k = monthKey(e.date);
    if (map.has(k)) map.set(k, map.get(k)! + e.amount);
  }
  return months.map((month) => ({ month, total: map.get(month)! }));
}

export function summarize(list: Expense[], now = new Date()) {
  const thisMonth = toISODate(now).slice(0, 7);
  const lastMonth = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const thisMonthList = list.filter((e) => monthKey(e.date) === thisMonth);
  const lastMonthTotal = sumAmounts(list.filter((e) => monthKey(e.date) === lastMonth));
  const thisMonthTotal = sumAmounts(thisMonthList);
  const byCat = totalsByCategory(list);
  const total = sumAmounts(list);
  return {
    total,
    count: list.length,
    average: list.length ? total / list.length : 0,
    thisMonthTotal,
    thisMonthCount: thisMonthList.length,
    lastMonthTotal,
    monthChangePct: lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null,
    topCategory: byCat[0] ?? null,
    byCategory: byCat,
  };
}

/** Totals by category for one calendar month (`YYYY-MM`), largest first. */
export function monthCategoryTotals(list: Expense[], month: string) {
  return totalsByCategory(list.filter((e) => monthKey(e.date) === month));
}

/**
 * Budget streak: consecutive days, ending today, on which spending stayed within the
 * daily share of the monthly budget (monthly budget ÷ days in that month). Days with
 * no expenses count as under budget. Counting stops at the earliest recorded expense,
 * so an empty history never yields an endless streak. Returns 0 if today is over budget.
 */
export function budgetStreak(list: Expense[], monthlyBudget: number, now = new Date()): number {
  if (!list.length || !(monthlyBudget > 0)) return 0;
  const daily = new Map<string, number>();
  let earliest = list[0].date;
  for (const e of list) {
    daily.set(e.date, (daily.get(e.date) ?? 0) + e.amount);
    if (e.date < earliest) earliest = e.date;
  }
  let streak = 0;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 3660; i++) {
    const iso = toISODate(day);
    if (iso < earliest) break;
    const daysInMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    if ((daily.get(iso) ?? 0) > monthlyBudget / daysInMonth + 0.005) break;
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
