import { formatCurrency } from "@/lib/format";
import { CATEGORY_STYLES } from "@/lib/categories";
import type { summarize } from "@/lib/analytics";

type Summary = ReturnType<typeof summarize>;

export function SummaryCards({ s }: { s: Summary }) {
  const change = s.monthChangePct;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total spending" value={formatCurrency(s.total)} sub={`${s.count} expense${s.count === 1 ? "" : "s"} recorded`} />
      <Card
        label="This month"
        value={formatCurrency(s.thisMonthTotal)}
        sub={
          change === null ? (
            `${s.thisMonthCount} expense${s.thisMonthCount === 1 ? "" : "s"}`
          ) : (
            <span className={change > 0 ? "text-rose-600" : "text-emerald-600"}>
              {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs last month
            </span>
          )
        }
      />
      <Card label="Average expense" value={formatCurrency(s.average)} sub="per transaction" />
      <Card
        label="Top category"
        value={
          s.topCategory ? (
            <span className="flex items-center gap-2">
              <span aria-hidden>{CATEGORY_STYLES[s.topCategory.category].icon}</span>
              {s.topCategory.category}
            </span>
          ) : (
            "—"
          )
        }
        sub={
          s.topCategory
            ? `${formatCurrency(s.topCategory.total)} · ${s.total ? ((s.topCategory.total / s.total) * 100).toFixed(0) : 0}% of total`
            : "No data yet"
        }
      />
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
