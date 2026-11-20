"use client";

import type { ReactNode } from "react";
import { ExpensesProvider } from "@/hooks/useExpenses";
import { ToastProvider } from "@/hooks/useToast";
import { ExpenseModalProvider } from "@/hooks/useExpenseModal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseModalProvider>{children}</ExpenseModalProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}
