"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Expense } from "@/types/expense";
import { Modal } from "@/components/Modal";
import { ExpenseForm } from "@/components/ExpenseForm";
import { useExpenses } from "./useExpenses";
import { useToast } from "./useToast";
import { formatCurrency } from "@/lib/format";

interface Ctx {
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
}

const ExpenseModalContext = createContext<Ctx | null>(null);

export function ExpenseModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ mode: "add" } | { mode: "edit"; expense: Expense } | null>(null);
  const { addExpense, updateExpense } = useExpenses();
  const toast = useToast();

  const openAdd = useCallback(() => setState({ mode: "add" }), []);
  const openEdit = useCallback((expense: Expense) => setState({ mode: "edit", expense }), []);
  const close = useCallback(() => setState(null), []);

  return (
    <ExpenseModalContext.Provider value={{ openAdd, openEdit }}>
      {children}
      <Modal open={!!state} onClose={close} title={state?.mode === "edit" ? "Edit expense" : "Add expense"}>
        {state && (
          <ExpenseForm
            key={state.mode === "edit" ? state.expense.id : "new"}
            initial={state.mode === "edit" ? state.expense : undefined}
            submitLabel={state.mode === "edit" ? "Save changes" : "Add expense"}
            onCancel={close}
            onSubmit={(input) => {
              if (state.mode === "edit") {
                updateExpense(state.expense.id, input);
                toast("Expense updated");
              } else {
                addExpense(input);
                toast(`Added ${formatCurrency(input.amount)} · ${input.category}`);
              }
              close();
            }}
          />
        )}
      </Modal>
    </ExpenseModalContext.Provider>
  );
}

export function useExpenseModal() {
  const ctx = useContext(ExpenseModalContext);
  if (!ctx) throw new Error("useExpenseModal must be used within ExpenseModalProvider");
  return ctx;
}
