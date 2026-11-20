"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { CategoryBadge } from "@/components/CategoryBadge";
import { CATEGORY_STYLES } from "@/lib/categories";
import type { ExportDataset, ExportFormat } from "@/lib/export";
import type { ExportController } from "./useExportController";

const TABLE_LIMIT = 100;
const SOURCE_LIMIT = 40;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function ExportSummary({ ds }: { ds: ExportDataset }) {
  const span = ds.firstDate && ds.lastDate ? (ds.firstDate === ds.lastDate ? formatDate(ds.firstDate) : `${formatDate(ds.firstDate)} – ${formatDate(ds.lastDate)}`) : "—";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat label="Records" value={ds.count.toLocaleString("en-US")} sub={`${ds.byCategory.length} categor${ds.byCategory.length === 1 ? "y" : "ies"}`} />
        <Stat label="Total" value={formatCurrency(ds.total)} sub={ds.count ? `avg ${formatCurrency(ds.total / ds.count)}` : undefined} />
        <div className="col-span-2 xl:col-span-1">
          <Stat label="Date span" value={span} />
        </div>
      </div>
      {ds.byCategory.length > 0 && ds.total > 0 && (
        <div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of total by category">
            {ds.byCategory.map((c) => (
              <div key={c.category} className="h-full" style={{ width: `${(c.total / ds.total) * 100}%`, backgroundColor: CATEGORY_STYLES[c.category].color }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {ds.byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_STYLES[c.category].color }} />
                {c.category} <span className="tabular-nums text-slate-400">{Math.round((c.total / ds.total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ ds }: { ds: ExportDataset }) {
  const rows = ds.records.slice(0, TABLE_LIMIT);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0] shadow-slate-200">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Category</th>
              <th scope="col" className="px-3 py-2 text-right">Amount</th>
              <th scope="col" className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{formatDate(r.date)}</td>
                <td className="px-3 py-2"><CategoryBadge category={r.category} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-900">{formatCurrency(r.amount)}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-slate-700" title={r.description}>{r.description || <span className="text-slate-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0] shadow-slate-200">
            <tr>
              <td className="px-3 py-2" colSpan={2}>Total</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatCurrency(ds.total)}</td>
              <td className="px-3 py-2 text-xs font-normal text-slate-500">{ds.count > TABLE_LIMIT ? `Showing first ${TABLE_LIMIT} of ${ds.count} rows` : `${ds.count} row${ds.count === 1 ? "" : "s"}`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SourcePreview({ ds, format }: { ds: ExportDataset; format: ExportFormat }) {
  const text = useMemo(() => {
    const sample = { ...ds, records: ds.records.slice(0, SOURCE_LIMIT) };
    const out = format.serialize(sample, { generatedAt: new Date() });
    return typeof out === "string" ? out.replace(/^﻿/, "") : "";
  }, [ds, format]);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <pre className="max-h-[420px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-100">{text}</pre>
      {ds.count > SOURCE_LIMIT && <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400">Showing the first {SOURCE_LIMIT} of {ds.count} records</div>}
    </div>
  );
}

function PdfPreview({ ds, format }: { ds: ExportDataset; format: ExportFormat }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    // Debounce so rapid filter changes don't regenerate the document on every click.
    const t = setTimeout(() => {
      const bytes = format.serialize(ds, { generatedAt: new Date() });
      objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: format.mime }));
      setUrl(objectUrl);
    }, 250);
    return () => {
      clearTimeout(t);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ds, format]);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
      {url ? (
        <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title="PDF preview" className="h-[520px] w-full" />
      ) : (
        <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">Rendering preview…</div>
      )}
    </div>
  );
}

type Tab = "table" | "file";

export function ExportPreview({ ctl }: { ctl: ExportController }) {
  const [tab, setTab] = useState<Tab>("table");
  const { dataset: ds, format } = ctl;
  const fileLabel = format.id === "pdf" ? "PDF document" : `${format.label} source`;
  const blocked = ctl.errors.range || ctl.errors.categories;

  return (
    <div className="space-y-4">
      <ExportSummary ds={ds} />
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Preview mode" className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
          {(["table", "file"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t === "table" ? "Data table" : fileLabel}
            </button>
          ))}
        </div>
        <span className="truncate font-mono text-xs text-slate-500" title={ctl.fullFilename}>
          {ctl.fullFilename}
        </span>
      </div>
      <div role="tabpanel">
        {ds.count === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center">
            <p className="text-sm font-medium text-slate-900">Nothing to export</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              {blocked ?? "No expenses match these filters. Try widening the date range or selecting more categories."}
            </p>
          </div>
        ) : tab === "table" ? (
          <PreviewTable ds={ds} />
        ) : format.id === "pdf" ? (
          <PdfPreview ds={ds} format={format} />
        ) : (
          <SourcePreview ds={ds} format={format} />
        )}
      </div>
    </div>
  );
}
