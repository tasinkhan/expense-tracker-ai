"use client";

import { CATEGORIES, EMPTY_FILTERS, type ExpenseFilters } from "@/types/expense";
import { toISODate, todayISO } from "@/lib/format";

interface Props {
  filters: ExpenseFilters;
  onChange: (f: ExpenseFilters) => void;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "This month", range: () => { const n = new Date(); return [toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), todayISO()]; } },
  { label: "Last 30 days", range: () => { const n = new Date(); return [toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), todayISO()]; } },
  { label: "This year", range: () => [`${new Date().getFullYear()}-01-01`, todayISO()] },
];

export function FilterBar({ filters, onChange }: Props) {
  const set = <K extends keyof ExpenseFilters>(k: K, v: ExpenseFilters[K]) => onChange({ ...filters, [k]: v });
  const isActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const invalidRange = filters.from && filters.to && filters.from > filters.to;

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_160px]">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            placeholder="Search descriptions…"
            aria-label="Search expenses"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) => set("category", e.target.value as ExpenseFilters["category"])}
          className="input"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} className="input" />
        <input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const [from, to] = p.range();
          const on = filters.from === from && filters.to === to;
          return (
            <button
              key={p.label}
              onClick={() => onChange({ ...filters, from: on ? "" : from, to: on ? "" : to })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                on ? "bg-brand-600 text-white ring-brand-600" : "text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {invalidRange && <span className="text-xs font-medium text-rose-600">“From” date is after “To” date.</span>}
        {isActive && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
