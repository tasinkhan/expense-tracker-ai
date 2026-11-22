import type { Category, Expense } from "@/types/expense";
import { generateId } from "./storage";
import { toISODate } from "./format";

/** `vendors` rotate per pass through the list; `null` leaves the expense without a vendor. */
const TEMPLATES: { category: Category; description: string; min: number; max: number; vendors: (string | null)[] }[] = [
  { category: "Food", description: "Groceries", min: 35, max: 140, vendors: ["Whole Foods", "Trader Joe's", "Costco"] },
  { category: "Food", description: "Lunch with team", min: 12, max: 40, vendors: ["Chipotle", "Sweetgreen", null] },
  { category: "Food", description: "Coffee", min: 3, max: 7, vendors: ["Starbucks", "Blue Bottle Coffee", "Starbucks"] },
  { category: "Transportation", description: "Fuel", min: 30, max: 70, vendors: ["Shell", "Chevron", "Costco"] },
  { category: "Transportation", description: "Ride share", min: 9, max: 35, vendors: ["Uber", "Lyft", "Uber"] },
  { category: "Entertainment", description: "Movie tickets", min: 18, max: 40, vendors: ["AMC Theatres", "Regal"] },
  { category: "Entertainment", description: "Streaming subscription", min: 10, max: 16, vendors: ["Netflix", "Spotify", "Disney+"] },
  { category: "Shopping", description: "Clothing", min: 25, max: 120, vendors: ["Uniqlo", "Target", "Amazon"] },
  { category: "Shopping", description: "Household supplies", min: 15, max: 60, vendors: ["Target", "Amazon", "Costco"] },
  { category: "Bills", description: "Electricity bill", min: 60, max: 130, vendors: ["PG&E"] },
  { category: "Bills", description: "Internet", min: 50, max: 70, vendors: ["Comcast"] },
  { category: "Other", description: "Gift", min: 20, max: 80, vendors: ["Amazon", "Etsy", null] },
];

/** Deterministic-ish sample data spread over the last ~5 months. */
export function buildSampleExpenses(count = 45): Expense[] {
  const now = new Date();
  const out: Expense[] = [];
  for (let i = 0; i < count; i++) {
    const t = TEMPLATES[i % TEMPLATES.length];
    const daysAgo = (i * 37) % 150;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const amount = Math.round((t.min + Math.random() * (t.max - t.min)) * 100) / 100;
    const vendor = t.vendors[Math.floor(i / TEMPLATES.length) % t.vendors.length] ?? undefined;
    const ts = new Date().toISOString();
    out.push({ id: generateId(), date: toISODate(d), amount, category: t.category, description: t.description, vendor, createdAt: ts, updatedAt: ts });
  }
  return out;
}
