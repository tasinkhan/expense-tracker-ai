"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, type Category, type ExpenseInput } from "@/types/expense";
import { CATEGORY_STYLES } from "@/lib/categories";
import { todayISO } from "@/lib/format";

interface Props {
  initial?: ExpenseInput;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => void;
  onCancel: () => void;
}

type Errors = Partial<Record<keyof ExpenseInput, string>>;

const MAX_AMOUNT = 1_000_000;

export function validateExpense(v: { date: string; amount: string; category: string; description: string }): Errors {
  const errors: Errors = {};
  if (!v.date) errors.date = "Please choose a date.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) errors.date = "Enter a valid date.";
  else if (v.date > todayISO()) errors.date = "Date can't be in the future.";
  else if (v.date < "1900-01-01") errors.date = "Date looks too far in the past.";

  const trimmed = v.amount.trim();
  const n = Number(trimmed);
  if (!trimmed) errors.amount = "Amount is required.";
  else if (!/^\d+(\.\d{1,2})?$/.test(trimmed) || !Number.isFinite(n)) errors.amount = "Use a number with up to 2 decimals.";
  else if (n <= 0) errors.amount = "Amount must be greater than zero.";
  else if (n > MAX_AMOUNT) errors.amount = "Amount is too large.";

  if (!(CATEGORIES as readonly string[]).includes(v.category)) errors.category = "Pick a category.";

  const desc = v.description.trim();
  if (!desc) errors.description = "Add a short description.";
  else if (desc.length > 120) errors.description = "Keep it under 120 characters.";
  return errors;
}

export function ExpenseForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState({
    date: initial?.date ?? todayISO(),
    amount: initial ? initial.amount.toFixed(2) : "",
    category: (initial?.category ?? "Food") as string,
    description: initial?.description ?? "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof ExpenseInput, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = validateExpense(values);
  const show = (k: keyof ExpenseInput) => (submitted || touched[k]) && errors[k];

  const set = (k: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  const blur = (k: keyof ExpenseInput) => () => setTouched((t) => ({ ...t, [k]: true }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    onSubmit({
      date: values.date,
      amount: Math.round(Number(values.amount) * 100) / 100,
      category: values.category as Category,
      description: values.description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" error={show("amount")} htmlFor="amount">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">$</span>
            <input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              value={values.amount}
              onChange={(e) => set("amount")(e.target.value.replace(/[^\d.]/g, ""))}
              onBlur={blur("amount")}
              className={`input pl-7 ${show("amount") ? "input-error" : ""}`}
              aria-invalid={!!show("amount")}
            />
          </div>
        </Field>
        <Field label="Date" error={show("date")} htmlFor="date">
          <input
            id="date"
            type="date"
            max={todayISO()}
            value={values.date}
            onChange={(e) => set("date")(e.target.value)}
            onBlur={blur("date")}
            className={`input ${show("date") ? "input-error" : ""}`}
            aria-invalid={!!show("date")}
          />
        </Field>
      </div>

      <Field label="Category" error={show("category")}>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const active = values.category === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => set("category")(c)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg leading-none">{CATEGORY_STYLES[c].icon}</span>
                {c}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Description"
        error={show("description")}
        htmlFor="description"
        hint={`${values.description.trim().length}/120`}
      >
        <input
          id="description"
          placeholder="e.g. Weekly groceries"
          value={values.description}
          maxLength={140}
          onChange={(e) => set("description")(e.target.value)}
          onBlur={blur("description")}
          className={`input ${show("description") ? "input-error" : ""}`}
          aria-invalid={!!show("description")}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | false;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
