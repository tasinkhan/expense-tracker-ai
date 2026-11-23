"use client";

import { useExpenses } from "@/hooks/useExpenses";
import { MonthlyInsights } from "@/components/MonthlyInsights";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/States";

export default function InsightsPage() {
  const { expenses, isLoading, error } = useExpenses();

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}
      {isLoading ? (
        <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-12" />
          <Skeleton className="h-96" />
          <Skeleton className="h-40" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add an expense, or load sample data, to see your monthly insights." />
      ) : (
        <MonthlyInsights expenses={expenses} />
      )}
    </div>
  );
}
