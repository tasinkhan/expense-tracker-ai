import { CATEGORIES, type Expense } from "@/types/expense";

const STORAGE_KEY = "expense-tracker:v1";

function isExpense(x: unknown): x is Expense {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    typeof e.category === "string" &&
    (CATEGORIES as readonly string[]).includes(e.category) &&
    typeof e.description === "string"
  );
}

/** `vendor` is optional (older data has none). Keep a non-blank string, drop anything else rather than the expense. */
function normalizeVendor(e: Expense): Expense {
  const { vendor, ...rest } = e;
  const v = typeof vendor === "string" ? vendor.trim() : "";
  return v ? { ...rest, vendor: v } : rest;
}

/** Parse the raw stored JSON. Throws if the data is unreadable; silently skips malformed entries. */
export function parseStoredExpenses(raw: string | null): Expense[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Stored data is not a list");
  return parsed.filter(isExpense).map(normalizeVendor);
}

export function loadExpenses(): Expense[] {
  return parseStoredExpenses(window.localStorage.getItem(STORAGE_KEY));
}

export function saveExpenses(expenses: Expense[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
