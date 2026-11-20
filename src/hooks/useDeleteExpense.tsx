"use client";

import { useState } from "react";
import type { Expense } from "@/types/expense";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useExpenses } from "./useExpenses";
import { useToast } from "./useToast";
import { formatCurrency } from "@/lib/format";

/** Confirm-then-delete with an Undo toast. Returns a trigger and the dialog element to render. */
export function useDeleteExpense() {
  const [pending, setPending] = useState<Expense | null>(null);
  const { deleteExpense, restoreExpense } = useExpenses();
  const toast = useToast();

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title="Delete expense?"
      message={pending ? `“${pending.description}” (${formatCurrency(pending.amount)}) will be removed.` : ""}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        if (!pending) return;
        const removed = deleteExpense(pending.id);
        setPending(null);
        toast("Expense deleted", "info", removed ? { label: "Undo", onClick: () => restoreExpense(removed) } : undefined);
      }}
    />
  );

  return { requestDelete: setPending, dialog };
}
