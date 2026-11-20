"use client";

import { useEffect, useMemo, useState } from "react";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/useToast";
import { toISODate } from "@/lib/format";
import { DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { TEMPLATES, TEMPLATE_ORDER, buildReport, defaultPeriod, formatBytes, type Period, type TemplateId } from "@/lib/cloud/report";
import { formatRelative, nextRun } from "@/lib/cloud/schedule";
import { ExportComposer } from "@/components/cloud/ExportComposer";
import { ConnectionsPanel, HistoryPanel, SchedulesPanel, SharesPanel } from "@/components/cloud/HubPanels";
import { DestinationTile, StatusDot } from "@/components/cloud/ui";
import { EmptyState, Skeleton } from "@/components/States";

type Tab = "connections" | "schedules" | "history" | "shared";
const TABS: { id: Tab; label: string }[] = [
  { id: "connections", label: "Connections" },
  { id: "schedules", label: "Schedules" },
  { id: "history", label: "History" },
  { id: "shared", label: "Shared links" },
];

const CLOUD_QUOTA = 1024 * 1024 * 1024;

interface ComposerState {
  template?: TemplateId;
  destination?: DestinationId;
  period?: Period;
}

interface Suggestion {
  icon: string;
  title: string;
  body: string;
  cta: string;
  action: () => void;
}

export default function ExportHubPage() {
  const cloud = useCloud();
  const { expenses, isLoading } = useExpenses();
  const toast = useToast();
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [tab, setTab] = useState<Tab>("connections");

  // Deep-link tabs via #history etc. (the activity tray links here).
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const selectTab = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const now = new Date(cloud.now);
  const cloudBytes = cloud.history.filter((h) => h.destination === "spendwise-cloud").reduce((s, h) => s + h.bytes, 0);
  const connectedCount = Object.keys(cloud.connections).length;
  const activeSchedules = cloud.schedules.filter((s) => s.enabled && cloud.isConnected(s.destination));
  const upcoming = activeSchedules.map((s) => ({ s, at: nextRun(s.timing, now) })).sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const d = new Date();
    const lastMonth = toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)).slice(0, 7);
    const lastMonthName = new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("en-US", { month: "long" });
    if (d.getMonth() <= 3) {
      const y = String(d.getFullYear() - 1);
      const n = buildReport(expenses, "tax-report", { kind: "year", value: y }).recordCount;
      if (n) out.push({ icon: "🧾", title: `Tax season: your ${y} report is ready`, body: `${n} expenses grouped by category with subtotals.`, cta: "Prepare report", action: () => setComposer({ template: "tax-report", period: { kind: "year", value: y } }) });
    }
    if (d.getDate() <= 10) {
      const n = buildReport(expenses, "monthly-summary", { kind: "month", value: lastMonth }).recordCount;
      if (n) out.push({ icon: "📅", title: `${lastMonthName} is closed`, body: `Send its summary while it’s fresh — ${n} expenses to review.`, cta: "Send summary", action: () => setComposer({ template: "monthly-summary", period: { kind: "month", value: lastMonth }, destination: "email" }) });
    }
    const hasBackupSchedule = cloud.schedules.some((s) => s.templateId === "full-backup" && s.enabled);
    const lastBackup = cloud.history.find((h) => h.templateId === "full-backup");
    if (!hasBackupSchedule && (!lastBackup || Date.now() - new Date(lastBackup.at).getTime() > 7 * 86_400_000)) {
      out.push({
        icon: "🛟",
        title: lastBackup ? `Last backup was ${formatRelative(lastBackup.at)}` : "Your data isn’t backed up",
        body: "Turn on automatic weekly backups to Spendwise Cloud — one click, versioned, restorable.",
        cta: "Turn on backups",
        action: () => {
          cloud.saveSchedule({ name: "Automatic weekly backup", templateId: "full-backup", destination: "spendwise-cloud", format: "json", enabled: true, timing: { frequency: "weekly", weekday: 0, monthDay: 1, time: "21:00" } });
          toast("Automatic weekly backups are on");
        },
      });
    }
    if (!cloud.connections["google-sheets"]) {
      out.push({ icon: "📈", title: "A spreadsheet that updates itself", body: "Connect Google Sheets and Spendwise keeps a live copy of your category analysis in sync.", cta: "Set it up", action: () => setComposer({ template: "category-analysis", destination: "google-sheets" }) });
    }
    out.push({ icon: "🤝", title: "Splitting costs with someone?", body: "Share this month’s summary as a private link or QR code — descriptions hidden if you like.", cta: "Share", action: () => setComposer({ template: "monthly-summary", destination: "link", period: defaultPeriod("month") }) });
    return out.slice(0, 3);
  }, [expenses, cloud, toast]);

  if (isLoading) {
    // Render nothing time- or data-dependent until the client has loaded, so prerendered HTML always hydrates cleanly.
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading">
        <HubTitle onNew={() => {}} disabled />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="space-y-6">
        <HubTitle onNew={() => setComposer({})} disabled />
        <EmptyState title="Nothing to export yet" message="Add a few expenses (or load sample data from the dashboard) and come back to share, sync and schedule them." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <HubTitle onNew={() => setComposer({})} />

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        <span aria-hidden>🧪</span>
        <p>
          <span className="font-semibold">Preview build.</span> Cloud services, email and Spendwise Cloud are simulated (marked <em>Demo</em>) — nothing leaves your browser. Downloads, share links, QR codes, clipboard copy
          and “open in email app” are real.
        </p>
      </div>

      {/* Status overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Sync status">
          <div className="flex items-center gap-2">
            <StatusDot tone={cloud.jobs.length ? "blue" : cloud.lastSyncAt ? "green" : "slate"} pulse={cloud.jobs.length > 0} />
            <span className="text-lg font-semibold text-slate-900">{cloud.jobs.length ? `${cloud.jobs.length} running` : cloud.lastSyncAt ? "Up to date" : "Idle"}</span>
          </div>
          <p className="text-xs text-slate-500">{cloud.lastSyncAt ? `Last export ${formatRelative(cloud.lastSyncAt, now)}` : "No exports yet"}</p>
        </StatusCard>
        <StatusCard label="Spendwise Cloud">
          <p className="text-lg font-semibold tabular-nums text-slate-900">{formatBytes(cloudBytes)}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(cloudBytes ? 1 : 0, (cloudBytes / CLOUD_QUOTA) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">of 1 GB · {cloud.history.filter((h) => h.destination === "spendwise-cloud").length} versions</p>
        </StatusCard>
        <StatusCard label="Connected apps">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">{connectedCount}</span>
            <div className="flex -space-x-1.5">
              {(Object.keys(cloud.connections) as DestinationId[]).map((id) => (
                <span key={id} className="rounded-md ring-2 ring-white">
                  <DestinationTile id={id} size="sm" />
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">{connectedCount ? Object.keys(cloud.connections).map((id) => DESTINATIONS[id as DestinationId].name).join(", ") : "None yet"}</p>
        </StatusCard>
        <StatusCard label="Next scheduled run">
          <p className="text-lg font-semibold text-slate-900">{upcoming ? formatRelative(upcoming.at, now) : "—"}</p>
          <p className="truncate text-xs text-slate-500">{upcoming ? upcoming.s.name : `${activeSchedules.length} active schedules`}</p>
        </StatusCard>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Suggested for you</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => (
              <div key={s.title} className="card flex flex-col gap-2 p-4">
                <span className="text-xl" aria-hidden>
                  {s.icon}
                </span>
                <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                <p className="flex-1 text-xs text-slate-500">{s.body}</p>
                <button type="button" className="self-start text-xs font-semibold text-brand-600 hover:text-brand-700" onClick={s.action}>
                  {s.cta} →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Templates */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Templates</h2>
            <p className="text-xs text-slate-500">Purpose-built reports — pick one, choose where it goes.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_ORDER.map((id) => {
            const t = TEMPLATES[id];
            const n = buildReport(expenses, id, defaultPeriod(t.periodKind)).recordCount;
            return (
              <button key={id} type="button" onClick={() => setComposer({ template: id })} className="card group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={`flex h-20 items-end bg-gradient-to-br p-4 ${t.accent}`}>
                  <span className="text-3xl drop-shadow-sm">{t.emoji}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.description}</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-600">
                    {t.includes.map((inc) => (
                      <li key={inc} className="flex gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        {inc}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto pt-2 text-xs font-semibold text-brand-600 group-hover:text-brand-700">
                    Use template · {n} expense{n === 1 ? "" : "s"} →
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tabs */}
      <section className="space-y-4">
        <div role="tablist" aria-label="Export hub sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map((t) => {
            const count = t.id === "schedules" ? cloud.schedules.length : t.id === "history" ? cloud.history.length : t.id === "shared" ? cloud.shares.length : connectedCount;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t.label}
                {count > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600">{count}</span>}
              </button>
            );
          })}
        </div>
        <div role="tabpanel">
          {tab === "connections" && <ConnectionsPanel onUse={(d) => setComposer({ destination: d })} />}
          {tab === "schedules" && <SchedulesPanel />}
          {tab === "history" && <HistoryPanel />}
          {tab === "shared" && <SharesPanel onCreate={() => setComposer({ destination: "link" })} />}
        </div>
      </section>

      <ExportComposer
        open={composer !== null}
        onClose={() => setComposer(null)}
        initialTemplate={composer?.template ?? "monthly-summary"}
        initialDestination={composer?.destination}
        initialPeriod={composer?.period}
      />
    </div>
  );
}

function HubTitle({ onNew, disabled = false }: { onNew: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Export Hub</h1>
        <p className="mt-1 text-sm text-slate-500">Share, sync and schedule your expense data across the tools you already use.</p>
      </div>
      <button type="button" className="btn-primary" onClick={onNew} disabled={disabled}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm5.25-9.25a.75.75 0 00-1.5 0v4.59l-1.95-2.1a.75.75 0 10-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V7.75z" />
        </svg>
        New export
      </button>
    </div>
  );
}

function StatusCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-1 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}
