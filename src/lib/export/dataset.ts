import { CATEGORIES, type Category, type Expense } from "../../types/expense";
import type { ExportCriteria, ExportDataset } from "./types";

const toCents = (n: number) => Math.round(n * 100);

export const isRangeInvalid = (c: Pick<ExportCriteria, "from" | "to">) => Boolean(c.from && c.to && c.from > c.to);

export function matchesDateRange(date: string, c: Pick<ExportCriteria, "from" | "to">): boolean {
  return (!c.from || date >= c.from) && (!c.to || date <= c.to);
}

/** Apply criteria to the expense list and compute the aggregates every format and the UI need. */
export function buildDataset(expenses: readonly Expense[], criteria: ExportCriteria): ExportDataset {
  const selected = new Set<Category>(criteria.categories);
  const records = isRangeInvalid(criteria)
    ? []
    : expenses
        .filter((e) => selected.has(e.category) && matchesDateRange(e.date, criteria))
        .map(({ date, category, amount, description }) => ({ date, category, amount, description }))
        .sort((a, b) => a.date.localeCompare(b.date));

  // Sum in integer cents so totals don't drift (0.1 + 0.2 problem).
  const perCategory = new Map<Category, { count: number; cents: number }>();
  let totalCents = 0;
  for (const r of records) {
    const cents = toCents(r.amount);
    totalCents += cents;
    const entry = perCategory.get(r.category) ?? { count: 0, cents: 0 };
    entry.count += 1;
    entry.cents += cents;
    perCategory.set(r.category, entry);
  }

  return {
    criteria,
    records,
    count: records.length,
    total: totalCents / 100,
    byCategory: CATEGORIES.filter((c) => perCategory.has(c)).map((c) => ({
      category: c,
      count: perCategory.get(c)!.count,
      total: perCategory.get(c)!.cents / 100,
    })),
    firstDate: records[0]?.date ?? null,
    lastDate: records[records.length - 1]?.date ?? null,
  };
}

/** Count expenses per category inside a date range — used to annotate the category picker. */
export function countByCategory(expenses: readonly Expense[], range: Pick<ExportCriteria, "from" | "to">): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  if (isRangeInvalid(range)) return counts;
  for (const e of expenses) if (matchesDateRange(e.date, range)) counts[e.category] += 1;
  return counts;
}
