"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { encodeQR } from "@/lib/cloud/qr";
import { formatCell, type ReportModel } from "@/lib/cloud/report";

export function DestinationTile({ id, size = "md" }: { id: DestinationId; size?: "sm" | "md" | "lg" }) {
  const d = DESTINATIONS[id];
  const dims = size === "sm" ? "h-7 w-7 text-[10px] rounded-md" : size === "lg" ? "h-11 w-11 text-sm rounded-xl" : "h-9 w-9 text-xs rounded-lg";
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center font-bold shadow-sm ${dims} ${d.tile}`}>
      {d.mono}
    </span>
  );
}

export function SimulatedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Simulated integration — no data leaves your browser"
      className={`inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20 ${className}`}
    >
      Demo
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: "green" | "blue" | "slate" | "amber" | "rose"; pulse?: boolean }) {
  const color = { green: "bg-emerald-500", blue: "bg-sky-500", slate: "bg-slate-300", amber: "bg-amber-500", rose: "bg-rose-500" }[tone];
  return (
    <span className="relative flex h-2 w-2">
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className = "btn-secondary", onCopied }: { text: string | (() => string); label?: ReactNode; copiedLabel?: string; className?: string; onCopied?: () => void }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setState("copied");
          onCopied?.();
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1600);
      }}
    >
      {state === "copied" ? `✓ ${copiedLabel}` : state === "error" ? "Copy blocked" : label}
    </button>
  );
}

export function QRCode({ value, size = 176, className = "" }: { value: string; size?: number; className?: string }) {
  const result = useMemo(() => {
    try {
      return { matrix: encodeQR(value) };
    } catch {
      return { matrix: null };
    }
  }, [value]);
  if (!result.matrix) {
    return (
      <div style={{ width: size, height: size }} className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 ${className}`}>
        Too much data for a QR code — share the link instead, or enable “Hide descriptions”.
      </div>
    );
  }
  const n = result.matrix.length;
  const quiet = 4;
  const dim = n + quiet * 2;
  let path = "";
  result.matrix.forEach((row, y) => row.forEach((dark, x) => dark && (path += `M${x + quiet} ${y + quiet}h1v1h-1z`)));
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR code for the share link" className={`rounded-xl bg-white ${className}`}>
      <rect width={dim} height={dim} fill="#fff" />
      <path d={path} fill="#0f172a" />
    </svg>
  );
}

export function qrSvgMarkup(value: string): string | null {
  try {
    const m = encodeQR(value);
    const dim = m.length + 8;
    let path = "";
    m.forEach((row, y) => row.forEach((dark, x) => dark && (path += `M${x + 4} ${y + 4}h1v1h-1z`)));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="512" height="512" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${path}" fill="#0f172a"/></svg>`;
  } catch {
    return null;
  }
}

const numeric = (kind: string) => kind === "money" || kind === "percent" || kind === "count" || kind === "delta";

export function ReportTable({ model, maxRows = 8, dense = false }: { model: Pick<ReportModel, "columns" | "rows" | "totals">; maxRows?: number; dense?: boolean }) {
  const rows = model.rows.slice(0, maxRows);
  const pad = dense ? "px-2.5 py-1.5" : "px-3 py-2";
  const isSubtotal = (r: Record<string, unknown>) => typeof r.category === "string" && r.category.endsWith("subtotal");
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {model.columns.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap ${pad} ${numeric(c.kind) ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((r, i) => (
              <tr key={i} className={isSubtotal(r) ? "bg-slate-50/70 font-medium text-slate-900" : ""}>
                {model.columns.map((c) => {
                  const v = r[c.key];
                  const delta = c.kind === "delta" && typeof v === "number" ? (v > 0 ? "text-rose-600" : v < 0 ? "text-emerald-600" : "") : "";
                  return (
                    <td key={c.key} className={`max-w-[14rem] truncate ${pad} ${numeric(c.kind) ? "text-right tabular-nums" : ""} ${delta}`}>
                      {formatCell(v, c.kind) || <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {model.rows.length > maxRows && (
              <tr>
                <td colSpan={model.columns.length} className={`${pad} text-center text-slate-400`}>
                  + {model.rows.length - maxRows} more rows
                </td>
              </tr>
            )}
          </tbody>
          {model.totals && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                {model.columns.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap ${pad} ${numeric(c.kind) ? "text-right tabular-nums" : ""}`}>
                    {formatCell(model.totals![c.key] ?? null, c.kind)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** A generic spreadsheet-style preview (column letters, row numbers, frozen header). */
export function SpreadsheetMock({ model, sheetName }: { model: ReportModel; sheetName: string }) {
  const letters = model.columns.map((_, i) => String.fromCharCode(65 + i));
  const rows = [...model.rows.slice(0, 7), ...(model.totals ? [model.totals] : [])];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white text-[11px] shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50 px-3 py-1.5">
        <span className="h-3 w-3 rounded-sm bg-emerald-600" />
        <span className="truncate font-medium text-slate-800">{sheetName}</span>
        <span className="ml-auto text-[10px] text-emerald-700">Auto-updates on sync</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono">
          <thead>
            <tr className="bg-slate-100 text-slate-500">
              <th className="w-8 border border-slate-200" />
              {letters.map((l) => (
                <th key={l} className="border border-slate-200 px-2 py-0.5 font-normal">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-emerald-600/10 font-semibold text-slate-800">
              <td className="border border-slate-200 bg-slate-100 text-center text-slate-500">1</td>
              {model.columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap border border-slate-200 px-2 py-0.5">
                  {c.label}
                </td>
              ))}
            </tr>
            {rows.map((r, i) => (
              <tr key={i} className={i === rows.length - 1 && model.totals ? "font-semibold" : ""}>
                <td className="border border-slate-200 bg-slate-100 text-center text-slate-500">{i + 2}</td>
                {model.columns.map((c) => {
                  const v = r[c.key];
                  return (
                    <td key={c.key} className={`max-w-[10rem] truncate whitespace-nowrap border border-slate-200 px-2 py-0.5 ${typeof v === "number" ? "text-right" : ""}`}>
                      {v === null || v === undefined ? "" : typeof v === "number" && c.kind === "money" ? v.toFixed(2) : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, hideLabel = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; hideLabel?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className={hideLabel ? "sr-only" : undefined}>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function downloadText(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
