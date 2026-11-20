"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeSnapshot, type SharedSnapshot } from "@/lib/cloud/share";
import { toCSV, reportFilename, type ReportModel } from "@/lib/cloud/report";
import { ReportTable, downloadText } from "@/components/cloud/ui";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "expired"; snap: SharedSnapshot } | { status: "ok"; snap: SharedSnapshot };

/** Read-only viewer for share links. The report lives in the URL fragment and is decoded locally. */
export default function SharedReportPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const load = async () => {
      const payload = window.location.hash.slice(1);
      if (!payload) return setState({ status: "error", message: "This link is missing its report data. Ask the sender for a fresh link." });
      try {
        const snap = await decodeSnapshot(payload);
        setState(snap.expiresAt && new Date(snap.expiresAt) < new Date() ? { status: "expired", snap } : { status: "ok", snap });
      } catch {
        setState({ status: "error", message: "This link looks incomplete or damaged — it may have been cut off when copied." });
      }
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  if (state.status === "loading") return <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" aria-busy="true" />;

  if (state.status !== "ok") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-4xl">{state.status === "expired" ? "⌛" : "🔗"}</p>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{state.status === "expired" ? "This link has expired" : "Can’t open this link"}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {state.status === "expired" ? `“${state.snap.title}” was shared until ${new Date(state.snap.expiresAt!).toLocaleString()}. Ask ${state.snap.from ?? "the sender"} for a new link.` : state.message}
        </p>
        <Link href="/" className="btn-secondary mt-6">
          Go to Spendwise
        </Link>
      </div>
    );
  }

  const { snap } = state;
  const model: ReportModel = { templateId: "category-analysis", ...snap };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">🔒 Read-only snapshot</span>
        <span>
          Shared {snap.from ? `by ${snap.from} ` : ""}on {new Date(snap.sharedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
        </span>
        {snap.expiresAt && <span>· available until {new Date(snap.expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span>}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{snap.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{snap.subtitle}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => downloadText(toCSV(model), "text/csv;charset=utf-8", reportFilename(model, "csv"))}>
          Download CSV
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {snap.highlights.slice(0, 3).map((h) => (
          <div key={h.label} className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-900" title={h.value}>
              {h.value}
            </p>
          </div>
        ))}
      </div>
      <ReportTable model={snap} maxRows={500} />
      {snap.notes && <p className="text-xs text-slate-500">{snap.notes}</p>}
      <p className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        This report was decoded in your browser from the link itself — it was never stored on a server. Made with{" "}
        <Link href="/" className="font-medium text-brand-600">
          Spendwise
        </Link>
        .
      </p>
    </div>
  );
}
