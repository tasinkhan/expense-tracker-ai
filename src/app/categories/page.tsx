"use client";

import { useMemo, useState } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { PERIODS, topCategories, type Period } from "@/lib/top-categories";
import { CATEGORY_STYLES } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { CategoryBadge } from "@/components/CategoryBadge";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/States";

export default function CategoriesPage() {
  const { expenses, isLoading, error } = useExpenses();
  const [period, setPeriod] = useState<Period>("this-month");

  const result = useMemo(() => topCategories(expenses, period), [expenses, period]);
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "";
  const rangeLabel = result.from && result.to ? `${formatDate(result.from)} – ${formatDate(result.to)}` : "Every expense you've recorded";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Top categories</h1>
        <p className="mt-1 text-sm text-slate-500">See which categories take the biggest share of your spending.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-full sm:w-96" />
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add an expense, or load sample data, to see which categories you spend the most on." />
      ) : (
        <>
          <div role="group" aria-label="Period" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:inline-grid sm:grid-cols-4">
            {PERIODS.map((p) => {
              const on = p.id === period;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <section className="card flex flex-wrap items-end justify-between gap-3 p-5" aria-live="polite">
            <div>
              <h2 className="text-sm font-medium text-slate-500">Total spent · {periodLabel}</h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{formatCurrency(result.total)}</p>
            </div>
            <p className="text-sm text-slate-500">
              {result.count} expense{result.count === 1 ? "" : "s"} · {rangeLabel}
            </p>
          </section>

          {result.rows.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <h3 className="text-base font-semibold text-slate-900">No spending in this period</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">You haven&apos;t recorded any expenses for {periodLabel.toLowerCase()}.</p>
              {period !== "all-time" && (
                <button type="button" onClick={() => setPeriod("all-time")} className="btn-secondary mt-6">
                  View all time
                </button>
              )}
            </div>
          ) : (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Ranking</h2>
              <p className="text-xs text-slate-500">By total spend · {periodLabel}</p>
              <ol className="mt-4 divide-y divide-slate-100">
                {result.rows.map((r) => {
                  const pct = r.share.toFixed(1);
                  return (
                    <li key={r.category} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-700">
                        <span className="sr-only">Rank </span>
                        {r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <CategoryBadge category={r.category} />
                          <span className="text-sm tabular-nums text-slate-900">
                            <span className="font-semibold">{formatCurrency(r.total)}</span>
                            <span className="ml-2 text-xs text-slate-500">{pct}%</span>
                          </span>
                        </div>
                        <div
                          role="img"
                          aria-label={`${r.category}: ${pct}% of ${periodLabel.toLowerCase()} spending`}
                          className="mt-2 h-2 w-full rounded-full bg-slate-100"
                        >
                          <div className="h-full rounded-full" style={{ width: `${r.share}%`, background: CATEGORY_STYLES[r.category].color }} />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {r.count} expense{r.count === 1 ? "" : "s"} · avg{" "}
                          <span className="tabular-nums text-slate-700">{formatCurrency(r.average)}</span> per expense
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
