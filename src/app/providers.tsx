"use client";

import type { ReactNode } from "react";
import { ExpensesProvider } from "@/hooks/useExpenses";
import { ToastProvider } from "@/hooks/useToast";
import { ExpenseModalProvider } from "@/hooks/useExpenseModal";
import { CloudProvider } from "@/hooks/useCloud";
import { ActivityTray } from "@/components/cloud/ActivityTray";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <CloudProvider>
          <ExpenseModalProvider>{children}</ExpenseModalProvider>
          <ActivityTray />
        </CloudProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}
