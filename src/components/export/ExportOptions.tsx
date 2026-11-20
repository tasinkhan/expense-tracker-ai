"use client";

import type { ReactNode } from "react";
import { CATEGORIES } from "@/types/expense";
import { CATEGORY_STYLES } from "@/lib/categories";
import { toISODate, todayISO } from "@/lib/format";
import { EXPORT_FORMATS, FORMAT_ORDER, type ExportFormatId } from "@/lib/export";
import type { ExportController } from "./useExportController";

function Section({ step, title, hint, error, children }: { step: number; title: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="flex w-full items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{step}</span>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        {hint && <span className="ml-auto text-xs text-slate-500">{hint}</span>}
      </legend>
      {children}
      {error && (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------

const FORMAT_ACCENTS: Record<ExportFormatId, string> = {
  csv: "bg-emerald-100 text-emerald-700",
  json: "bg-amber-100 text-amber-800",
  pdf: "bg-rose-100 text-rose-700",
};

function FormatPicker({ ctl }: { ctl: ExportController }) {
  return (
    <Section step={1} title="Format">
      <div className="grid gap-2" role="radiogroup" aria-label="Export format">
        {FORMAT_ORDER.map((id, i) => {
          const f = EXPORT_FORMATS[id];
          const checked = ctl.draft.format === id;
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 transition focus-within:ring-2 focus-within:ring-brand-500/40 ${
                checked ? "border-brand-500 shadow-sm ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={id}
                checked={checked}
                onChange={() => ctl.dispatch({ type: "format", format: id })}
                className="sr-only"
                data-autofocus={i === 0 ? true : undefined}
              />
              <span className={`flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-wide ${FORMAT_ACCENTS[id]}`}>{f.label}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{f.label === "PDF" ? "PDF report" : `${f.label} file`}</span>
                <span className="block text-xs text-slate-500">{f.tagline}</span>
              </span>
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-brand-600 bg-brand-600" : "border-slate-300"}`}
              >
                {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const RANGE_PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "All time", range: () => ["", ""] },
  { label: "This month", range: () => { const n = new Date(); return [toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), todayISO()]; } },
  { label: "Last month", range: () => { const n = new Date(); return [toISODate(new Date(n.getFullYear(), n.getMonth() - 1, 1)), toISODate(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
  { label: "Last 90 days", range: () => { const n = new Date(); return [toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 89)), todayISO()]; } },
  { label: "Year to date", range: () => [`${new Date().getFullYear()}-01-01`, todayISO()] },
  { label: "Last year", range: () => { const y = new Date().getFullYear() - 1; return [`${y}-01-01`, `${y}-12-31`]; } },
];

function DateRangeSection({ ctl }: { ctl: ExportController }) {
  const { from, to } = ctl.draft;
  const setRange = (f: string, t: string) => ctl.dispatch({ type: "range", from: f, to: t });
  return (
    <Section step={2} title="Date range" error={ctl.errors.range}>
      <div className="flex flex-wrap gap-1.5">
        {RANGE_PRESETS.map((p) => {
          const [pf, pt] = p.range();
          const on = from === pf && to === pt;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => setRange(pf, pt)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
                on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Start date</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setRange(e.target.value, to)} className={`input ${ctl.errors.range ? "input-error" : ""}`} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">End date</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setRange(from, e.target.value)} className={`input ${ctl.errors.range ? "input-error" : ""}`} />
        </label>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function CategorySection({ ctl }: { ctl: ExportController }) {
  const selected = ctl.draft.categories;
  const allOn = selected.length === CATEGORIES.length;
  return (
    <Section
      step={3}
      title="Categories"
      error={ctl.errors.categories}
      hint={
        <button
          type="button"
          onClick={() => ctl.dispatch({ type: "categories", categories: allOn ? [] : [...CATEGORIES] })}
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => {
          const on = selected.includes(c);
          const count = ctl.categoryCounts[c];
          return (
            <button
              key={c}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => ctl.dispatch({ type: "toggleCategory", category: c })}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                on ? "border-slate-300 bg-white text-slate-900 shadow-sm" : "border-dashed border-slate-200 bg-transparent text-slate-400"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white ${on ? "border-transparent" : "border-slate-300 bg-white"}`}
                style={on ? { backgroundColor: CATEGORY_STYLES[c].color } : undefined}
              >
                {on && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{c}</span>
              <span className={`text-xs tabular-nums ${on ? "text-slate-500" : "text-slate-300"}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function FilenameSection({ ctl }: { ctl: ExportController }) {
  const error = ctl.errors.filename;
  const ext = `.${ctl.format.extension}`;
  return (
    <Section step={4} title="File name" error={error}>
      <div className={`flex rounded-lg border bg-white shadow-sm transition focus-within:ring-2 ${error ? "border-rose-400 focus-within:ring-rose-500/20" : "border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-500/20"}`}>
        <input
          type="text"
          aria-label="File name"
          aria-invalid={Boolean(error)}
          spellCheck={false}
          value={ctl.draft.filename}
          onChange={(e) => ctl.dispatch({ type: "filename", filename: e.target.value })}
          className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-sm text-slate-900 outline-none"
        />
        <span className="flex items-center rounded-r-lg border-l border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-500">{ext}</span>
      </div>
    </Section>
  );
}

export function ExportOptions({ ctl }: { ctl: ExportController }) {
  return (
    <div className="space-y-7">
      <FormatPicker ctl={ctl} />
      <DateRangeSection ctl={ctl} />
      <CategorySection ctl={ctl} />
      <FilenameSection ctl={ctl} />
    </div>
  );
}
