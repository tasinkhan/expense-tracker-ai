import type { Expense } from "@/types/expense";

function escapeCell(value: string): string {
  // Neutralise spreadsheet formula injection and quote as needed.
  let v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function expensesToCSV(expenses: Expense[]): string {
  const header = ["Date", "Category", "Description", "Amount"];
  const rows = expenses.map((e) => [e.date, e.category, e.description, e.amount.toFixed(2)].map(escapeCell).join(","));
  return [header.join(","), ...rows].join("\r\n");
}

export function downloadCSV(expenses: Expense[], filename = `expenses-${new Date().toISOString().slice(0, 10)}.csv`) {
  const blob = new Blob(["﻿" + expensesToCSV(expenses)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
