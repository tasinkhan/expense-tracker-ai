"use client";

import type { Expense } from "@/types/expense";
import { CategoryBadge } from "./CategoryBadge";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  expenses: Expense[];
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}

export function ExpenseList({ expenses, onEdit, onDelete }: Props) {
  return (
    <div className="card overflow-hidden">
      {/* Desktop table */}
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Description</th>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="w-24 px-5 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {expenses.map((e) => (
            <tr key={e.id} className="group transition hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(e.date)}</td>
              <td className="max-w-xs px-5 py-3.5">
                <p className="truncate font-medium text-slate-900">{e.description}</p>
                {e.vendor && <p className="truncate text-xs text-slate-500">{e.vendor}</p>}
              </td>
              <td className="px-5 py-3.5"><CategoryBadge category={e.category} /></td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(e.amount)}</td>
              <td className="px-5 py-3.5">
                <RowActions expense={e} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile list */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{e.description}</p>
              {e.vendor && <p className="truncate text-xs text-slate-500">{e.vendor}</p>}
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <CategoryBadge category={e.category} />
                <span>{formatDate(e.date)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums text-slate-900">{formatCurrency(e.amount)}</p>
              <RowActions expense={e} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RowActions({ expense, onEdit, onDelete }: { expense: Expense } & Omit<Props, "expenses">) {
  return (
    <div className="flex justify-end gap-1 md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <button onClick={() => onEdit(expense)} className="icon-btn hover:text-brand-600" aria-label={`Edit ${expense.description}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
      </button>
      <button onClick={() => onDelete(expense)} className="icon-btn hover:text-rose-600" aria-label={`Delete ${expense.description}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
