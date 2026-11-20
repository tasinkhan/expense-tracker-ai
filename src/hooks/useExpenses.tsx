"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Expense, ExpenseInput } from "@/types/expense";
import { generateId, loadExpenses, saveExpenses } from "@/lib/storage";
import { buildSampleExpenses } from "@/lib/sample-data";

interface ExpensesContextValue {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  addExpense: (input: ExpenseInput) => Expense;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => Expense | undefined;
  restoreExpense: (expense: Expense) => void;
  loadSampleData: () => void;
  clearAll: () => void;
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

const sortExpenses = (list: Expense[]) =>
  [...list].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Skip persisting the state we just loaded (and never overwrite unreadable data until the user edits).
  const skipNextSave = useRef(true);

  useEffect(() => {
    try {
      setExpenses(sortExpenses(loadExpenses()));
    } catch {
      setError("We couldn't read your saved expenses. Stored data may be corrupted.");
    } finally {
      skipNextSave.current = true;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveExpenses(expenses);
      setError(null);
    } catch {
      setError("Couldn't save changes — your browser storage may be full or disabled.");
    }
  }, [expenses, isLoading]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("expense-tracker:")) {
        try {
          skipNextSave.current = true;
          setExpenses(sortExpenses(loadExpenses()));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addExpense = useCallback((input: ExpenseInput) => {
    const now = new Date().toISOString();
    const expense: Expense = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    setExpenses((prev) => sortExpenses([expense, ...prev]));
    return expense;
  }, []);

  const updateExpense = useCallback((id: string, input: ExpenseInput) => {
    setExpenses((prev) =>
      sortExpenses(prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e))),
    );
  }, []);

  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  const deleteExpense = useCallback((id: string) => {
    const removed = expensesRef.current.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    return removed;
  }, []);

  const restoreExpense = useCallback((expense: Expense) => {
    setExpenses((prev) => (prev.some((e) => e.id === expense.id) ? prev : sortExpenses([expense, ...prev])));
  }, []);

  const loadSampleData = useCallback(() => {
    setExpenses((prev) => sortExpenses([...prev, ...buildSampleExpenses()]));
  }, []);

  const clearAll = useCallback(() => setExpenses([]), []);

  const value = useMemo(
    () => ({ expenses, isLoading, error, addExpense, updateExpense, deleteExpense, restoreExpense, loadSampleData, clearAll }),
    [expenses, isLoading, error, addExpense, updateExpense, deleteExpense, restoreExpense, loadSampleData, clearAll],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpensesProvider");
  return ctx;
}
