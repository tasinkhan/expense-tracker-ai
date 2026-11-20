"use client";

import Link from "next/link";
import { useState } from "react";
import { STAGE_LABEL, jobProgress, useCloud } from "@/hooks/useCloud";
import { formatRelative } from "@/lib/cloud/schedule";
import { DestinationTile, StatusDot } from "./ui";

/** Floating background-jobs tray (bottom-left, so it never collides with toasts). */
export function ActivityTray() {
  const { jobs, now } = useCloud();
  const [collapsed, setCollapsed] = useState(false);
  if (!jobs.length) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[55] w-[min(22rem,calc(100vw-2rem))] animate-slide-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" role="status" aria-live="polite">
      <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center gap-2 bg-slate-900 px-3 py-2 text-left text-xs font-medium text-white">
        <StatusDot tone="blue" pulse />
        {jobs.length} export{jobs.length === 1 ? "" : "s"} in progress
        <span className="ml-auto text-slate-400">{collapsed ? "▴" : "▾"}</span>
      </button>
      {!collapsed && (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
          {jobs.map((j) => {
            const { stage, pct } = jobProgress(j, now);
            return (
              <li key={j.id} className="flex items-center gap-3 px-3 py-2.5">
                <DestinationTile id={j.destination} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900">{j.title}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>
                      {STAGE_LABEL(stage, j.destination)}
                      {j.trigger === "schedule" && " · scheduled"}
                    </span>
                    <span className="tabular-nums">{pct}%</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/exports#history" className="block border-t border-slate-100 px-3 py-1.5 text-center text-[11px] font-medium text-brand-600 hover:bg-slate-50">
        View export history
      </Link>
    </div>
  );
}

/** Compact sync indicator for the navbar. */
export function SyncPill() {
  const { jobs, lastSyncAt, now } = useCloud();
  const syncing = jobs.length > 0;
  return (
    <Link
      href="/exports"
      title={syncing ? "Exports running in the background" : lastSyncAt ? `Last export ${new Date(lastSyncAt).toLocaleString()}` : "No exports yet"}
      className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:inline-flex"
    >
      <StatusDot tone={syncing ? "blue" : lastSyncAt ? "green" : "slate"} pulse={syncing} />
      {syncing ? `Syncing ${jobs.length}…` : lastSyncAt ? `Synced ${formatRelative(lastSyncAt, new Date(now))}` : "Not synced"}
    </Link>
  );
}
