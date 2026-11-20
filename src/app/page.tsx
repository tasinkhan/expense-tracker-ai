"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseModal } from "@/hooks/useExpenseModal";
import { useDeleteExpense } from "@/hooks/useDeleteExpense";
import { monthlyTotals, summarize } from "@/lib/analytics";
import { downloadCSV } from "@/lib/csv";
import { SummaryCards } from "@/components/SummaryCards";
import { MonthlyChart } from "@/components/MonthlyChart";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { ExpenseList } from "@/components/ExpenseList";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/States";

export default function DashboardPage() {
  const { expenses, isLoading, error } = useExpenses();
  const { openEdit } = useExpenseModal();
  const { requestDelete, dialog } = useDeleteExpense();

  const summary = useMemo(() => summarize(expenses), [expenses]);
  const monthly = useMemo(() => monthlyTotals(expenses, 6), [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">An overview of where your money goes.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => downloadCSV(expenses)}
          disabled={isLoading || expenses.length === 0}
        >
          Export Data
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <DashboardSkeleton />
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" message="Start tracking by adding an expense, or load sample data to explore the dashboard." />
      ) : (
        <>
          <SummaryCards s={summary} />
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="card p-5 lg:col-span-3">
              <h2 className="text-sm font-semibold text-slate-900">Monthly spending</h2>
              <p className="text-xs text-slate-500">Last 6 months · current month highlighted</p>
              <div className="mt-4">
                <MonthlyChart data={monthly} />
              </div>
            </section>
            <section className="card p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-900">Spending by category</h2>
              <p className="text-xs text-slate-500">All time</p>
              <div className="mt-4">
                <CategoryBreakdown data={summary.byCategory} />
              </div>
            </section>
          </div>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent expenses</h2>
              <Link href="/expenses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                View all →
              </Link>
            </div>
            <ExpenseList expenses={expenses.slice(0, 5)} onEdit={openEdit} onDelete={requestDelete} />
          </section>
        </>
      )}
      {dialog}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
