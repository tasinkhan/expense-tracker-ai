"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useCloud, type Schedule } from "@/hooks/useCloud";
import { useToast } from "@/hooks/useToast";
import { DESTINATIONS, SEND_DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { FILE_FORMATS, TEMPLATES, TEMPLATE_ORDER, type FileFormat, type TemplateId } from "@/lib/cloud/report";
import { WEEKDAYS, describeSchedule, formatRelative, nextRun, type Frequency, type ScheduleTiming } from "@/lib/cloud/schedule";
import { ConnectDialog } from "./ConnectDialog";
import { DestinationTile } from "./ui";

const SCHEDULABLE = SEND_DESTINATIONS.filter((d) => DESTINATIONS[d].schedulable);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ScheduleDraft {
  id?: string;
  name: string;
  templateId: TemplateId;
  destination: DestinationId;
  format: FileFormat;
  timing: ScheduleTiming;
  recipients?: string;
}

export const BLANK_SCHEDULE: ScheduleDraft = {
  name: "Weekly backup",
  templateId: "full-backup",
  destination: "spendwise-cloud",
  format: "json",
  timing: { frequency: "weekly", weekday: 0, monthDay: 1, time: "21:00" },
};

export function scheduleToDraft(s: Schedule): ScheduleDraft {
  return { id: s.id, name: s.name, templateId: s.templateId, destination: s.destination, format: s.format, timing: s.timing, recipients: s.recipients };
}

export function ScheduleEditor({ draft, onClose }: { draft: ScheduleDraft | null; onClose: () => void }) {
  const cloud = useCloud();
  const toast = useToast();
  const [d, setD] = useState<ScheduleDraft>(BLANK_SCHEDULE);
  const [connecting, setConnecting] = useState<DestinationId | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (draft) {
      setD(draft);
      setTouched(false);
    }
  }, [draft]);

  if (!draft) return null;
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setTiming = <K extends keyof ScheduleTiming>(k: K, v: ScheduleTiming[K]) => setD((x) => ({ ...x, timing: { ...x.timing, [k]: v } }));

  const recipients = (d.recipients ?? "").split(/[,;\s]+/).filter(Boolean);
  const errors = {
    name: d.name.trim() ? null : "Give the schedule a name.",
    recipients: d.destination === "email" && (!recipients.length || recipients.some((r) => !EMAIL_RE.test(r))) ? "Enter valid recipient emails." : null,
    connection: !cloud.isConnected(d.destination) ? `Connect ${DESTINATIONS[d.destination].name} first.` : null,
  };
  const valid = !errors.name && !errors.recipients && !errors.connection;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    cloud.saveSchedule({ ...d, name: d.name.trim(), recipients: d.destination === "email" ? recipients.join(", ") : undefined, enabled: true });
    toast(d.id ? "Schedule updated" : `Scheduled · next run ${formatRelative(nextRun(d.timing, new Date()))}`);
    onClose();
  };

  return (
    <>
      <Modal open={!connecting} onClose={onClose} title={d.id ? "Edit schedule" : "New scheduled export"} size="md">
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input className={`input ${touched && errors.name ? "input-error" : ""}`} value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Template</span>
              <select
                className="input"
                value={d.templateId}
                onChange={(e) => {
                  const t = e.target.value as TemplateId;
                  setD((x) => ({ ...x, templateId: t, format: TEMPLATES[t].defaultFormat }));
                }}
              >
                {TEMPLATE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATES[t].emoji} {TEMPLATES[t].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Format</span>
              <select className="input" value={d.format} onChange={(e) => set("format", e.target.value as FileFormat)}>
                {(Object.keys(FILE_FORMATS) as FileFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FILE_FORMATS[f].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Deliver to</span>
            <div className="grid grid-cols-3 gap-2">
              {SCHEDULABLE.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("destination", id)}
                  aria-pressed={d.destination === id}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs font-medium transition ${d.destination === id ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <DestinationTile id={id} size="sm" />
                  <span className="min-w-0 truncate">{DESTINATIONS[id].name}</span>
                </button>
              ))}
            </div>
            {errors.connection && (
              <p className="pt-1 text-xs text-amber-700">
                {errors.connection}{" "}
                <button type="button" className="font-semibold underline" onClick={() => setConnecting(d.destination)}>
                  Connect now
                </button>
              </p>
            )}
          </div>

          {d.destination === "email" && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Recipients</span>
              <input className={`input ${touched && errors.recipients ? "input-error" : ""}`} placeholder="accountant@example.com" value={d.recipients ?? ""} onChange={(e) => set("recipients", e.target.value)} />
              {touched && errors.recipients && <span className="text-xs text-rose-600">{errors.recipients}</span>}
            </label>
          )}

          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
              {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => (
                <button key={f} type="button" onClick={() => setTiming("frequency", f)} aria-pressed={d.timing.frequency === f} className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${d.timing.frequency === f ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {d.timing.frequency === "weekly" && (
                <select aria-label="Day of week" className="input" value={d.timing.weekday} onChange={(e) => setTiming("weekday", Number(e.target.value))}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              )}
              {d.timing.frequency === "monthly" && (
                <select aria-label="Day of month" className="input" value={d.timing.monthDay} onChange={(e) => setTiming("monthDay", Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Day {n}
                    </option>
                  ))}
                </select>
              )}
              <input aria-label="Time" type="time" className="input" value={d.timing.time} onChange={(e) => e.target.value && setTiming("time", e.target.value)} />
            </div>
            <p className="text-xs text-slate-600">
              {describeSchedule(d.timing)} · next run <span className="font-medium text-slate-900">{nextRun(d.timing, new Date()).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={touched && !valid}>
              {d.id ? "Save changes" : "Create schedule"}
            </button>
          </div>
        </div>
      </Modal>
      <ConnectDialog id={connecting} onClose={() => setConnecting(null)} />
    </>
  );
}
