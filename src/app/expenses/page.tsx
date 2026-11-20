"use client";

import { useMemo, useState } from "react";
import { EMPTY_FILTERS, type ExpenseFilters } from "@/types/expense";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseModal } from "@/hooks/useExpenseModal";
import { useDeleteExpense } from "@/hooks/useDeleteExpense";
import { useToast } from "@/hooks/useToast";
import { filterExpenses, sumAmounts } from "@/lib/analytics";
import { downloadCSV } from "@/lib/csv";
import { formatCurrency } from "@/lib/format";
import { FilterBar } from "@/components/FilterBar";
import { ExpenseList } from "@/components/ExpenseList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/States";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export default function ExpensesPage() {
  const { expenses, isLoading, error, clearAll } = useExpenses();
  const { openEdit } = useExpenseModal();
  const { requestDelete, dialog } = useDeleteExpense();
  const toast = useToast();
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const list = filterExpenses(expenses, filters);
    const sorted = [...list];
    if (sort === "date-asc") sorted.reverse();
    else if (sort === "amount-desc") sorted.sort((a, b) => b.amount - a.amount);
    else if (sort === "amount-asc") sorted.sort((a, b) => a.amount - b.amount);
    return sorted;
  }, [expenses, filters, sort]);

  const handleExport = () => {
    if (!filtered.length) return toast("Nothing to export", "error");
    try {
      downloadCSV(filtered);
      toast(`Exported ${filtered.length} expense${filtered.length === 1 ? "" : "s"} to CSV`);
    } catch {
      toast("Export failed. Please try again.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Search, filter, edit and export your expenses.</p>
        </div>
        <div className="flex gap-2">
          {expenses.length > 0 && (
            <button onClick={() => setConfirmClear(true)} className="btn-secondary text-rose-600 hover:bg-rose-50">
              Clear all
            </button>
          )}
          <button onClick={handleExport} disabled={isLoading || !filtered.length} className="btn-secondary">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-80" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add an expense to get started, or load sample data to try out search and filters." />
      ) : (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-slate-500">
              Showing <span className="font-medium text-slate-900">{filtered.length}</span> of {expenses.length} ·{" "}
              Total <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(sumAmounts(filtered))}</span>
            </p>
            <select aria-label="Sort expenses" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto py-1.5">
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
          {filtered.length ? (
            <ExpenseList expenses={filtered} onEdit={openEdit} onDelete={requestDelete} />
          ) : (
            <EmptyState title="No matching expenses" message="Try adjusting your search or filters." showActions={false} />
          )}
        </>
      )}

      {dialog}
      <ConfirmDialog
        open={confirmClear}
        title="Delete all expenses?"
        message={`This permanently removes all ${expenses.length} expenses from this browser. Consider exporting a CSV first.`}
        confirmLabel="Delete all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll();
          setConfirmClear(false);
          toast("All expenses deleted", "info");
        }}
      />
    </div>
  );
}
