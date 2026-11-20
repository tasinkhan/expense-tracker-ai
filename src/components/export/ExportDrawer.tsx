"use client";

import { useCallback } from "react";
import { Drawer } from "@/components/Drawer";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { ExportOptions } from "./ExportOptions";
import { ExportPreview } from "./ExportPreview";
import { useExportController, type ExportController } from "./useExportController";

interface Props {
  open: boolean;
  onClose: () => void;
  expenses: readonly Expense[];
}

export const DownloadIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
  </svg>
);

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

function ExportButton({ ctl }: { ctl: ExportController }) {
  const { status, format, dataset } = ctl;
  const label =
    status === "preparing"
      ? `Generating ${format.label}…`
      : status === "success"
        ? "Downloaded"
        : `Export ${dataset.count.toLocaleString("en-US")} record${dataset.count === 1 ? "" : "s"}`;
  return (
    <button
      type="button"
      onClick={ctl.runExport}
      disabled={!ctl.canExport && status !== "success"}
      aria-busy={status === "preparing"}
      className={`btn min-w-[11rem] shadow-sm ${status === "success" ? "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500" : "btn-primary"}`}
    >
      {status === "preparing" ? (
        <Spinner />
      ) : status === "success" ? (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      ) : (
        <DownloadIcon />
      )}
      {label}
    </button>
  );
}

export function ExportDrawer({ open, onClose, expenses }: Props) {
  const toast = useToast();
  const onExported = useCallback((message: string, ok: boolean) => toast(message, ok ? "success" : "error"), [toast]);
  const ctl = useExportController(expenses, onExported);
  const busy = ctl.status === "preparing";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Export expenses"
      description="Choose a format, narrow down the data and check the preview before downloading."
      icon={<DownloadIcon className="h-5 w-5" />}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-sm" aria-live="polite">
            <span className="truncate text-slate-600">
              <span className="font-semibold text-slate-900">{ctl.dataset.count.toLocaleString("en-US")}</span> records ·{" "}
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(ctl.dataset.total)}</span> · {ctl.format.label}
            </span>
            <button
              type="button"
              onClick={() => ctl.dispatch({ type: "reset" })}
              disabled={busy}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              Reset options
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-none">
              Close
            </button>
            <div className="flex-[2] sm:flex-none [&>button]:w-full">
              <ExportButton ctl={ctl} />
            </div>
          </div>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[360px_1fr]">
        <div className={`border-b border-slate-200 bg-white p-5 sm:p-6 lg:border-b-0 lg:border-r ${busy ? "pointer-events-none opacity-60" : ""}`} aria-disabled={busy}>
          <ExportOptions ctl={ctl} />
        </div>
        <div className="min-w-0 p-5 sm:p-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</h3>
          <ExportPreview ctl={ctl} />
        </div>
      </div>
    </Drawer>
  );
}
