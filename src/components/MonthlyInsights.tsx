"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Category, Expense } from "@/types/expense";
import { CATEGORY_STYLES } from "@/lib/categories";
import { budgetStreak, monthCategoryTotals } from "@/lib/analytics";
import { formatCompactCurrency, formatCurrency, formatMonthKey, toISODate } from "@/lib/format";

const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
/** Fits the donut hole: "$262", "$4,180", then "$12.4K". */
const formatDonutTotal = (n: number) => (n < 10_000 ? wholeDollars.format(n) : formatCompactCurrency(n));

const BUDGET_KEY = "spendwise:monthly-budget";
const MILESTONES = [7, 14, 30, 60, 90, 180, 365];

type Slice = { category: Category; total: number };

/**
 * Monthly Insights: spending donut for a month, its top 3 categories, and the
 * running budget streak (days in a row within the daily share of the monthly budget).
 */
export function MonthlyInsights({ expenses }: { expenses: Expense[] }) {
  const currentMonth = toISODate(new Date()).slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const byCategory = useMemo(() => monthCategoryTotals(expenses, month), [expenses, month]);
  const total = byCategory.reduce((s, d) => s + d.total, 0);
  const [budget, setBudget] = useMonthlyBudget();
  const streak = useMemo(() => (budget ? budgetStreak(expenses, budget) : 0), [expenses, budget]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(toISODate(new Date(y, m - 1 + delta, 1)).slice(0, 7));
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-end justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Monthly Insights</h1>
          <p className="mt-1 text-sm text-slate-500">Where your money went this month.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="icon-btn" aria-label="Previous month">‹</button>
          <span className="min-w-[6.5rem] text-center text-sm font-medium text-slate-700" aria-live="polite">
            {formatMonthKey(month, "long")}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={month >= currentMonth}
            className="icon-btn disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <section className="card p-6">
        {byCategory.length ? (
          <>
            <SpendingDonut data={byCategory} total={total} />
            <h2 className="mt-8 text-sm font-semibold text-slate-900">Top 3 categories</h2>
            <TopCategories data={byCategory.slice(0, 3)} total={total} />
          </>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">No spending recorded in {formatMonthKey(month, "long")}.</p>
        )}
      </section>

      <BudgetStreak streak={streak} budget={budget} onBudgetChange={setBudget} />
    </div>
  );
}

function SpendingDonut({ data, total }: { data: Slice[]; total: number }) {
  const [hover, setHover] = useState<Category | null>(null);
  const r = 70;
  const stroke = 26;
  const C = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2 : 0;
  const active = hover ? data.find((d) => d.category === hover) : null;

  let offset = 0;
  const segments = data.map((d) => {
    const len = (d.total / total) * C;
    const seg = { ...d, len, offset };
    offset += len;
    return seg;
  });

  return (
    <div className="relative mx-auto w-56">
      <svg viewBox="0 0 200 200" className="h-auto w-full -rotate-90" role="img" aria-label="Spending by category this month">
        {segments.map((s) => (
          <circle
            key={s.category}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={CATEGORY_STYLES[s.category].color}
            strokeWidth={hover === s.category ? stroke + 4 : stroke}
            strokeDasharray={`${Math.max(s.len - gap, 0.01)} ${C}`}
            strokeDashoffset={-s.offset}
            className="cursor-default transition-[opacity,stroke-width]"
            opacity={hover && hover !== s.category ? 0.35 : 1}
            onMouseEnter={() => setHover(s.category)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${s.category}: ${formatCurrency(s.total)} (${((s.total / total) * 100).toFixed(0)}%)`}</title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{active ? active.category : "Spending"}</span>
        <span className="text-xl font-semibold tabular-nums text-slate-900">
          {formatDonutTotal(active ? active.total : total)}
        </span>
      </div>
    </div>
  );
}

function TopCategories({ data, total }: { data: Slice[]; total: number }) {
  return (
    <ul className="mt-3 space-y-2">
      {data.map((d) => (
        <li
          key={d.category}
          className="flex items-center justify-between gap-3 rounded-r-lg border-l-4 bg-slate-50 py-2.5 pl-3 pr-4"
          style={{ borderLeftColor: CATEGORY_STYLES[d.category].color }}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <span aria-hidden>{CATEGORY_STYLES[d.category].icon}</span>
            {d.category}
          </span>
          <span className="text-sm tabular-nums text-slate-900">
            {formatCurrency(d.total)}
            <span className="ml-2 text-xs text-slate-500">{((d.total / total) * 100).toFixed(0)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function BudgetStreak({
  streak,
  budget,
  onBudgetChange,
}: {
  streak: number;
  budget: number | null;
  onBudgetChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const next = MILESTONES.find((m) => m > streak) ?? null;
  const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const progress = next ? ((streak - prev) / (next - prev)) * 100 : 100;
  const now = new Date();
  const daysThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const startEdit = () => {
    setDraft(budget ? String(budget) : "");
    setEditing(true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(draft);
    if (draft.trim() === "") onBudgetChange(null);
    else if (Number.isFinite(v) && v > 0) onBudgetChange(Math.round(v * 100) / 100);
    else return;
    setEditing(false);
  };

  return (
    <section className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
      <h2 className="text-base font-semibold text-slate-900">Budget Streak</h2>

      {editing ? (
        <form onSubmit={submit} className="mx-auto mt-4 flex max-w-xs items-center gap-2">
          <label htmlFor="monthly-budget" className="sr-only">Monthly budget (USD)</label>
          <input
            id="monthly-budget"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoFocus
            placeholder="e.g. 1500"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input"
          />
          <button type="submit" className="btn-primary">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
        </form>
      ) : budget ? (
        <>
          <div className="mt-3 flex items-center justify-center gap-6">
            <p>
              <span className={`block text-5xl font-bold tabular-nums ${streak > 0 ? "text-emerald-600" : "text-slate-400"}`}>{streak}</span>
              <span className="text-sm text-slate-600">{streak === 1 ? "day" : "days"}{streak > 0 ? "!" : ""}</span>
            </p>
            <div className="w-32 text-left">
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label={next ? `Progress to ${next}-day milestone` : "All milestones reached"}
              >
                <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {next ? `${next - streak} more ${next - streak === 1 ? "day" : "days"} to a ${next}-day streak` : "All milestones hit 🎉"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {streak === 0 && "Today is over budget, so tomorrow is a fresh start. "}
            Days in a row within {formatCurrency(budget)}/month (≈{formatCurrency(budget / daysThisMonth)}/day).{" "}
            <button onClick={startEdit} className="font-medium text-brand-600 hover:text-brand-700">Edit budget</button>
          </p>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-500">Set a monthly budget to start tracking your streak.</p>
          <button onClick={startEdit} className="btn-primary mt-4">Set monthly budget</button>
        </div>
      )}
    </section>
  );
}

/** Monthly budget persisted per browser; read after mount to avoid hydration mismatches. */
function useMonthlyBudget(): [number | null, (v: number | null) => void] {
  const [budget, setBudget] = useState<number | null>(null);
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(BUDGET_KEY));
      if (v > 0) setBudget(v);
    } catch {
      /* storage unavailable: budget stays unset */
    }
  }, []);
  const update = (v: number | null) => {
    setBudget(v);
    try {
      if (v) window.localStorage.setItem(BUDGET_KEY, String(v));
      else window.localStorage.removeItem(BUDGET_KEY);
    } catch {
      /* ignore */
    }
  };
  return [budget, update];
}
