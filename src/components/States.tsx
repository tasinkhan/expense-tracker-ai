"use client";

import { useExpenseModal } from "@/hooks/useExpenseModal";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/useToast";

export function EmptyState({ title, message, showActions = true }: { title: string; message: string; showActions?: boolean }) {
  const { openAdd } = useExpenseModal();
  const { loadSampleData } = useExpenses();
  const toast = useToast();
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">💸</div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {showActions && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={openAdd} className="btn-primary">Add your first expense</button>
          <button
            onClick={() => {
              loadSampleData();
              toast("Sample data loaded", "info");
            }}
            className="btn-secondary"
          >
            Load sample data
          </button>
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span aria-hidden>⚠️</span>
      <span>{message}</span>
    </div>
  );
}
