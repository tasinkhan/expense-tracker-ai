"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCloud, type HistoryEntry } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/useToast";
import { CLOUD_DESTINATIONS, DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { FILE_FORMATS, TEMPLATES, buildReport, formatBytes, reportFilename } from "@/lib/cloud/report";
import { describeSchedule, formatRelative, nextRun } from "@/lib/cloud/schedule";
import { ConnectDialog } from "./ConnectDialog";
import { BLANK_SCHEDULE, ScheduleEditor, scheduleToDraft, type ScheduleDraft } from "./ScheduleEditor";
import { CopyButton, DestinationTile, QRCode, SimulatedBadge, StatusDot, Toggle, downloadText } from "./ui";

// ---------------------------------------------------------------------------
// Connections

export function ConnectionsPanel({ onUse }: { onUse: (d: DestinationId) => void }) {
  const cloud = useCloud();
  const [connecting, setConnecting] = useState<DestinationId | null>(null);
  const [confirm, setConfirm] = useState<DestinationId | null>(null);
  const items: DestinationId[] = [...CLOUD_DESTINATIONS, "email", "spendwise-cloud"];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((id) => {
        const d = DESTINATIONS[id];
        const conn = cloud.connections[id];
        const running = cloud.jobs.some((j) => j.destination === id);
        const ready = !d.requiresConnection || conn;
        const status = running ? { tone: "blue" as const, text: "Syncing…" } : conn ? { tone: "green" as const, text: conn.lastSyncAt ? `Synced ${formatRelative(conn.lastSyncAt, new Date(cloud.now))}` : "Connected · not synced yet" } : d.requiresConnection ? { tone: "slate" as const, text: "Not connected" } : { tone: "green" as const, text: "Ready" };
        return (
          <div key={id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <DestinationTile id={id} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {d.name} <SimulatedBadge />
                </p>
                <p className="text-xs text-slate-500">{d.blurb}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <StatusDot tone={status.tone} pulse={running} />
              <span className="truncate">{status.text}</span>
            </div>
            {conn && <p className="-mt-1 truncate text-xs text-slate-400">{conn.account}</p>}
            <div className="mt-auto flex gap-2">
              {ready ? (
                <>
                  <button type="button" className="btn-secondary flex-1 py-1.5 text-xs" onClick={() => onUse(id)}>
                    Export here
                  </button>
                  {conn && (
                    <button type="button" className="btn py-1.5 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setConfirm(id)}>
                      Disconnect
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="btn-primary flex-1 py-1.5 text-xs" onClick={() => setConnecting(id)}>
                  Connect
                </button>
              )}
            </div>
          </div>
        );
      })}
      <ConnectDialog id={connecting} onClose={() => setConnecting(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title={`Disconnect ${confirm ? DESTINATIONS[confirm].name : ""}?`}
        message="Schedules that deliver here will be paused. Files already exported stay where they are."
        confirmLabel="Disconnect"
        onConfirm={() => {
          if (confirm) cloud.disconnect(confirm);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedules

export function SchedulesPanel() {
  const cloud = useCloud();
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const now = new Date(cloud.now);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Recurring exports run in the background while Spendwise is open.</p>
        <button type="button" className="btn-primary" onClick={() => setDraft(BLANK_SCHEDULE)}>
          New schedule
        </button>
      </div>
      {cloud.schedules.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="text-3xl">⏰</span>
          <p className="text-sm font-medium text-slate-900">No scheduled exports yet</p>
          <p className="max-w-sm text-xs text-slate-500">Automate a weekly backup, a monthly summary to your partner, or a year-end tax report to your accountant.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setDraft(BLANK_SCHEDULE)}>
              🗄️ Weekly backup
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => setDraft({ name: "Monthly summary email", templateId: "monthly-summary", destination: "email", format: "csv", timing: { frequency: "monthly", weekday: 1, monthDay: 1, time: "09:00" }, recipients: "" })}>
              📅 Monthly email
            </button>
          </div>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {cloud.schedules.map((s) => {
            const t = TEMPLATES[s.templateId];
            const blocked = !cloud.isConnected(s.destination);
            return (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 p-4 ${s.enabled ? "" : "opacity-60"}`}>
                <DestinationTile id={s.destination} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {t.emoji} {t.name} · {FILE_FORMATS[s.format].label} → {DESTINATIONS[s.destination].name}
                    {s.recipients ? ` (${s.recipients})` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {describeSchedule(s.timing)}
                    {s.enabled && !blocked && (
                      <>
                        {" "}
                        · next <span className="font-medium text-slate-900">{formatRelative(nextRun(s.timing, now), now)}</span>
                      </>
                    )}
                    {s.lastRunAt && <span className="text-slate-400"> · last {formatRelative(s.lastRunAt, now)}</span>}
                  </p>
                  {blocked && <p className="text-xs font-medium text-amber-700">Paused — reconnect {DESTINATIONS[s.destination].name} to resume</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="btn py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={() => cloud.runScheduleNow(s.id)} disabled={blocked}>
                    Run now
                  </button>
                  <button type="button" className="btn py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={() => setDraft(scheduleToDraft(s))}>
                    Edit
                  </button>
                  <button type="button" className="btn py-1 text-xs text-rose-600 hover:bg-rose-50" onClick={() => setConfirmId(s.id)}>
                    Delete
                  </button>
                  <div className="pl-2">
                    <Toggle checked={s.enabled && !blocked} onChange={() => !blocked && cloud.toggleSchedule(s.id)} label={`Enable ${s.name}`} hideLabel />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ScheduleEditor draft={draft} onClose={() => setDraft(null)} />
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete schedule?"
        message="Future runs will stop. Past exports stay in your history."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) cloud.deleteSchedule(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// History

function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function HistoryPanel() {
  const cloud = useCloud();
  const { expenses } = useExpenses();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "manual" | "schedule">("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const now = new Date(cloud.now);

  const items = cloud.history.filter((h) => filter === "all" || h.trigger === filter);
  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const h of items) {
      const k = dayLabel(h.at, now);
      map.set(k, [...(map.get(k) ?? []), h]);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cloud.now]);

  const redownload = (h: HistoryEntry) => {
    const model = buildReport(expenses, h.templateId, h.period);
    const fmt = h.format === "json" || h.format === "csv" || h.format === "markdown" || h.format === "xlsx-tsv" ? h.format : "csv";
    downloadText(FILE_FORMATS[fmt].serialize(model), FILE_FORMATS[fmt].mime, reportFilename(model, fmt));
    cloud.recordExport({ templateId: h.templateId, period: h.period, destination: "download", format: fmt, detail: "Re-downloaded from history" });
    toast("Downloaded with your latest data");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "manual", "schedule"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${filter === f ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
            {f === "all" ? "All" : f === "manual" ? "Manual" : "Scheduled"}
          </button>
        ))}
        <span className="text-xs text-slate-400">{cloud.history.length} total</span>
        {cloud.history.length > 0 && (
          <button type="button" className="ml-auto text-xs font-medium text-slate-500 hover:text-rose-600" onClick={() => setConfirmClear(true)}>
            Clear history
          </button>
        )}
      </div>
      {groups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">Nothing here yet — your exports, shares and syncs will appear as a timeline.</div>
      ) : (
        groups.map(([day, entries]) => (
          <section key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</h3>
            <ol className="card divide-y divide-slate-100">
              {entries.map((h) => {
                const t = TEMPLATES[h.templateId];
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 p-3">
                    <DestinationTile id={h.destination} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {t.name} <span className="font-normal text-slate-500">· {h.periodLabel}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {DESTINATIONS[h.destination].name}
                        {h.detail ? ` · ${h.detail}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {h.trigger === "schedule" && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">Scheduled</span>}
                      <span className="tabular-nums">{h.records} rec</span>
                      <span className="hidden tabular-nums sm:inline">{formatBytes(h.bytes)}</span>
                      <time dateTime={h.at} title={new Date(h.at).toLocaleString()} className="w-16 text-right tabular-nums">
                        {new Date(h.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </time>
                      {h.shareUrl ? (
                        <CopyButton text={h.shareUrl} label="Copy link" className="btn py-1 text-xs text-brand-600 hover:bg-brand-50" />
                      ) : (
                        <button type="button" className="btn py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={() => redownload(h)} title="Regenerates with your current data">
                          Download
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
      <ConfirmDialog
        open={confirmClear}
        title="Clear export history?"
        message="This removes the timeline only. Share links keep working until they expire."
        confirmLabel="Clear"
        onConfirm={() => {
          cloud.clearHistory();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared links

export function SharesPanel({ onCreate }: { onCreate: () => void }) {
  const cloud = useCloud();
  const [qrFor, setQrFor] = useState<string | null>(null);
  const now = new Date(cloud.now);

  if (!cloud.shares.length) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-3xl">🔗</span>
        <p className="text-sm font-medium text-slate-900">No share links yet</p>
        <p className="max-w-sm text-xs text-slate-500">Share a read-only report with a partner, roommate or accountant — as a link or a QR code they can scan from your screen.</p>
        <button type="button" className="btn-primary" onClick={onCreate}>
          Create a share link
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Links carry the report inside them, so removing one here hides it from this list but can’t recall copies already sent. Expiry is enforced when the link is opened.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {cloud.shares.map((s) => {
          const expired = s.expiresAt !== null && new Date(s.expiresAt) < now;
          return (
            <li key={s.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.title}</p>
                  <p className="truncate text-xs text-slate-500">{s.subtitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${expired ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                  {expired ? "Expired" : s.expiresAt ? `Expires ${formatRelative(s.expiresAt, now)}` : "No expiry"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {s.privacy.hideDescriptions && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Descriptions hidden</span>}
                {s.privacy.roundAmounts && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Rounded</span>}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Created {formatRelative(s.createdAt, now)}</span>
              </div>
              {qrFor === s.id && (
                <div className="flex justify-center">
                  <QRCode value={s.url} size={180} className="border border-slate-200 p-1" />
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                <CopyButton text={s.url} label="Copy link" className="btn-secondary py-1.5 text-xs" />
                <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => setQrFor(qrFor === s.id ? null : s.id)}>
                  {qrFor === s.id ? "Hide QR" : "Show QR"}
                </button>
                <a href={s.url} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 text-xs">
                  Open ↗
                </a>
                <button type="button" className="btn ml-auto py-1.5 text-xs text-slate-500 hover:bg-slate-100" onClick={() => cloud.removeShare(s.id)}>
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
