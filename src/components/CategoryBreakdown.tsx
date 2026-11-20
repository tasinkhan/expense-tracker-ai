"use client";

import { useState } from "react";
import type { Category } from "@/types/expense";
import { CATEGORY_STYLES } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";

/** Horizontal share bar + ranked list (easier to compare than a pie). */
export function CategoryBreakdown({ data }: { data: { category: Category; total: number }[] }) {
  const [hover, setHover] = useState<Category | null>(null);
  const total = data.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...data.map((d) => d.total), 0);

  if (!data.length) return <p className="py-10 text-center text-sm text-slate-500">No spending in this period.</p>;

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Share of spending by category">
        {data.map((d) => (
          <div
            key={d.category}
            title={`${d.category}: ${formatCurrency(d.total)}`}
            onMouseEnter={() => setHover(d.category)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-opacity first:rounded-l last:rounded-r"
            style={{
              width: `${(d.total / total) * 100}%`,
              background: CATEGORY_STYLES[d.category].color,
              opacity: hover && hover !== d.category ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      <ul className="mt-5 space-y-3">
        {data.map((d) => {
          const pct = (d.total / total) * 100;
          return (
            <li
              key={d.category}
              onMouseEnter={() => setHover(d.category)}
              onMouseLeave={() => setHover(null)}
              className={`rounded-md transition-opacity ${hover && hover !== d.category ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_STYLES[d.category].color }} />
                  {d.category}
                </span>
                <span className="tabular-nums text-slate-900">
                  {formatCurrency(d.total)} <span className="ml-1 text-xs text-slate-500">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(d.total / max) * 100}%`, background: CATEGORY_STYLES[d.category].color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
