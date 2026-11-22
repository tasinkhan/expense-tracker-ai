"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { topVendors, VENDOR_PERIODS, vendorKey, type TopVendorsResult, type VendorPeriod } from "@/lib/top-vendors";
import { formatCurrency, formatDate } from "@/lib/format";
import { CategoryBadge } from "@/components/CategoryBadge";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/States";

const TOP_N = 10;

export default function VendorsPage() {
  const { expenses, isLoading, error } = useExpenses();
  const [period, setPeriod] = useState<VendorPeriod>("this-month");
  const [showAll, setShowAll] = useState(false);

  const result = useMemo(() => topVendors(expenses, period), [expenses, period]);
  const hasAnyVendor = useMemo(() => expenses.some((e) => vendorKey(e.vendor) !== ""), [expenses]);
  const periodLabel = VENDOR_PERIODS.find((p) => p.value === period)!.label;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Top vendors</h1>
        <p className="mt-1 text-sm text-slate-500">See where your money goes, merchant by merchant.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-96" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add expenses with a vendor, or load sample data, to see where you spend the most." />
      ) : !hasAnyVendor ? (
        <EmptyState
          title="No vendors yet"
          message={`None of your ${expenses.length} expense${expenses.length === 1 ? "" : "s"} has a vendor. Vendor is optional: add one when you create or edit an expense and it will show up here.`}
          showActions={false}
        />
      ) : (
        <>
          <PeriodPicker
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setShowAll(false);
            }}
          />
          {result.periodCount === 0 ? (
            <EmptyState
              title="No spending in this period"
              message="There are no expenses for the selected period. Try a longer range."
              showActions={false}
            />
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {periodLabel} ·{" "}
                <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(result.periodTotal)}</span> across{" "}
                {result.periodCount} expense{result.periodCount === 1 ? "" : "s"} at{" "}
                {result.vendors.length} vendor{result.vendors.length === 1 ? "" : "s"}
              </p>
              {result.vendors.length === 0 ? (
                <EmptyState
                  title="No vendors in this period"
                  message="None of the expenses in this period has a vendor. Try another period, or edit them to add one."
                  showActions={false}
                />
              ) : (
                <VendorTable result={result} showAll={showAll} />
              )}
              {result.vendors.length > TOP_N && (
                <div className="flex justify-center">
                  <button onClick={() => setShowAll((s) => !s)} className="btn-secondary" aria-expanded={showAll}>
                    {showAll ? `Show top ${TOP_N}` : `Show all ${result.vendors.length} vendors`}
                  </button>
                </div>
              )}
              {result.noVendor && (
                <p className="text-sm text-slate-500">
                  {result.noVendor.count} expense{result.noVendor.count === 1 ? "" : "s"} in this period{" "}
                  {result.noVendor.count === 1 ? "has" : "have"} no vendor.{" "}
                  <Link href="/expenses" className="font-medium text-brand-600 hover:text-brand-700">
                    Edit {result.noVendor.count === 1 ? "it" : "them"} to add one →
                  </Link>
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function PeriodPicker({ value, onChange }: { value: VendorPeriod; onChange: (p: VendorPeriod) => void }) {
  return (
    <div role="group" aria-label="Period" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {VENDOR_PERIODS.map((p) => {
        const active = p.value === value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function ShareBar({ share, muted = false }: { share: number; muted?: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
      <div className={`h-full rounded-full ${muted ? "bg-slate-300" : "bg-brand-500"}`} style={{ width: `${Math.min(share, 100)}%` }} />
    </div>
  );
}

const plural = (n: number) => `${n} expense${n === 1 ? "" : "s"}`;

function VendorTable({ result, showAll }: { result: TopVendorsResult; showAll: boolean }) {
  const visible = showAll ? result.vendors : result.vendors.slice(0, TOP_N);
  const nv = result.noVendor;

  return (
    <div className="card overflow-hidden">
      {/* Desktop table */}
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">Vendors ranked by total spending</caption>
        <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="w-12 px-5 py-3">#</th>
            <th scope="col" className="px-5 py-3">Vendor</th>
            <th scope="col" className="px-5 py-3">Main category</th>
            <th scope="col" className="w-48 px-5 py-3">Share</th>
            <th scope="col" className="px-5 py-3 text-right">Expenses</th>
            <th scope="col" className="px-5 py-3">Last purchase</th>
            <th scope="col" className="px-5 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((v, i) => (
            <tr key={v.key} className="transition hover:bg-slate-50/70">
              <td className="px-5 py-3.5 tabular-nums text-slate-500">{i + 1}</td>
              <th scope="row" className="max-w-xs truncate px-5 py-3.5 text-left font-medium text-slate-900">{v.name}</th>
              <td className="px-5 py-3.5"><CategoryBadge category={v.mainCategory} /></td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <ShareBar share={v.share} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-600">{v.share.toFixed(1)}%</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{v.count}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(v.lastDate)}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(v.total)}</td>
            </tr>
          ))}
          {nv && (
            <tr className="bg-slate-50/60 text-slate-500">
              <td className="px-5 py-3.5"><span aria-hidden>—</span><span className="sr-only">Not ranked</span></td>
              <th scope="row" className="px-5 py-3.5 text-left font-medium italic">No vendor</th>
              <td className="px-5 py-3.5" />
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <ShareBar share={nv.share} muted />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums">{nv.share.toFixed(1)}%</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums">{nv.count}</td>
              <td className="px-5 py-3.5" />
              <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums">{formatCurrency(nv.total)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Mobile list */}
      <ol className="divide-y divide-slate-100 md:hidden" aria-label="Vendors ranked by total spending">
        {visible.map((v, i) => (
          <li key={v.key} className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-slate-400">
                <span className="sr-only">Rank </span>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium text-slate-900">{v.name}</p>
                  <p className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(v.total)}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <ShareBar share={v.share} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-600">{v.share.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <CategoryBadge category={v.mainCategory} />
                  <span>{plural(v.count)}</span>
                  <span aria-hidden>·</span>
                  <span>Last {formatDate(v.lastDate)}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {nv && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 text-slate-500 md:hidden">
          <div className="flex items-start gap-3">
            <span className="w-6 shrink-0 pt-0.5 text-sm">
              <span aria-hidden>—</span>
              <span className="sr-only">Not ranked</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium italic">No vendor</p>
                <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(nv.total)}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <ShareBar share={nv.share} muted />
                <span className="w-12 shrink-0 text-right text-xs tabular-nums">{nv.share.toFixed(1)}%</span>
              </div>
              <p className="mt-1.5 text-xs">{plural(nv.count)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
