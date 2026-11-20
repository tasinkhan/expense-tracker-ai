"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/useToast";
import { generateId } from "@/lib/storage";
import { DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import { FILE_FORMATS, TEMPLATES, buildReport, byteSize, defaultPeriod, type FileFormat, type Period, type PrivacyOptions, type TemplateId } from "@/lib/cloud/report";
import { isDue, type ScheduleTiming } from "@/lib/cloud/schedule";

// ---------------------------------------------------------------------------
// Persisted model

export interface Connection {
  id: DestinationId;
  account: string;
  connectedAt: string;
  lastSyncAt: string | null;
}

export interface HistoryEntry {
  id: string;
  at: string;
  templateId: TemplateId;
  period: Period;
  periodLabel: string;
  destination: DestinationId;
  format: FileFormat;
  records: number;
  bytes: number;
  trigger: "manual" | "schedule";
  status: "completed" | "failed";
  /** Human detail, e.g. "to sam@example.com" or "Sheets › Spendwise / Tax Report 2026". */
  detail?: string;
  shareUrl?: string;
}

export interface Schedule {
  id: string;
  name: string;
  templateId: TemplateId;
  destination: DestinationId;
  format: FileFormat;
  timing: ScheduleTiming;
  recipients?: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
}

export interface ShareLink {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  createdAt: string;
  expiresAt: string | null;
  privacy: PrivacyOptions;
  chars: number;
}

interface CloudState {
  connections: Partial<Record<DestinationId, Connection>>;
  history: HistoryEntry[];
  schedules: Schedule[];
  shares: ShareLink[];
}

const EMPTY: CloudState = { connections: {}, history: [], schedules: [], shares: [] };
// Deliberately *not* prefixed "expense-tracker:" — that prefix makes the expenses store reload on cross-tab events.
const STORAGE_KEY = "spendwise-cloud:v1";
const HISTORY_LIMIT = 60;

function load(): CloudState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CloudState>;
    return {
      connections: parsed.connections ?? {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      shares: Array.isArray(parsed.shares) ? parsed.shares : [],
    };
  } catch {
    return EMPTY;
  }
}

// ---------------------------------------------------------------------------
// Background jobs (in-memory; simulated processing for remote destinations)

export type JobStage = "queued" | "preparing" | "transferring" | "done";

export interface Job {
  id: string;
  title: string;
  destination: DestinationId;
  detail?: string;
  startedAt: number;
  duration: number;
  trigger: HistoryEntry["trigger"];
  entry: Omit<HistoryEntry, "id" | "at" | "status">;
}

export function jobProgress(job: Job, now: number): { stage: JobStage; pct: number } {
  const t = Math.min(1, (now - job.startedAt) / job.duration);
  const pct = Math.round(t * 100);
  if (t >= 1) return { stage: "done", pct: 100 };
  if (t < 0.12) return { stage: "queued", pct };
  if (t < 0.45) return { stage: "preparing", pct };
  return { stage: "transferring", pct };
}

export const STAGE_LABEL = (stage: JobStage, dest: DestinationId) =>
  stage === "queued"
    ? "Queued"
    : stage === "preparing"
      ? "Building report"
      : stage === "done"
        ? "Done"
        : dest === "email"
          ? "Sending email"
          : dest === "google-sheets"
            ? "Writing rows"
            : "Uploading";

export interface ExportRequest {
  templateId: TemplateId;
  period: Period;
  destination: DestinationId;
  format: FileFormat;
  detail?: string;
  trigger?: HistoryEntry["trigger"];
  shareUrl?: string;
}

interface CloudContextValue extends CloudState {
  jobs: Job[];
  now: number;
  connect: (id: DestinationId, account: string) => void;
  disconnect: (id: DestinationId) => void;
  isConnected: (id: DestinationId) => boolean;
  /** Record a completed, real (in-browser) export. */
  recordExport: (req: ExportRequest, stats?: { records: number; bytes: number }) => void;
  /** Queue a simulated remote export that runs in the background. */
  queueExport: (req: ExportRequest) => void;
  saveSchedule: (s: Omit<Schedule, "id" | "createdAt" | "lastRunAt"> & { id?: string }) => void;
  toggleSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  runScheduleNow: (id: string) => void;
  addShare: (s: Omit<ShareLink, "id" | "createdAt">) => ShareLink;
  removeShare: (id: string) => void;
  clearHistory: () => void;
  lastSyncAt: string | null;
}

const CloudContext = createContext<CloudContextValue | null>(null);

export function CloudProvider({ children }: { children: ReactNode }) {
  const { expenses, isLoading } = useExpenses();
  const toast = useToast();
  const [state, setState] = useState<CloudState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setState(load());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setState(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or disabled — the hub still works for this session */
    }
  }, [state, hydrated]);

  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  const measure = useCallback((req: ExportRequest) => {
    const model = buildReport(expensesRef.current, req.templateId, req.period);
    return { records: model.recordCount, bytes: byteSize(FILE_FORMATS[req.format].serialize(model)), periodLabel: model.subtitle };
  }, []);

  const pushHistory = useCallback((entry: Omit<HistoryEntry, "id" | "at">) => {
    setState((s) => ({ ...s, history: [{ ...entry, id: generateId(), at: new Date().toISOString() }, ...s.history].slice(0, HISTORY_LIMIT) }));
  }, []);

  const recordExport = useCallback<CloudContextValue["recordExport"]>(
    (req, stats) => {
      const m = measure(req);
      pushHistory({
        templateId: req.templateId,
        period: req.period,
        periodLabel: m.periodLabel,
        destination: req.destination,
        format: req.format,
        records: stats?.records ?? m.records,
        bytes: stats?.bytes ?? m.bytes,
        trigger: req.trigger ?? "manual",
        status: "completed",
        detail: req.detail,
        shareUrl: req.shareUrl,
      });
    },
    [measure, pushHistory],
  );

  const queueExport = useCallback<CloudContextValue["queueExport"]>(
    (req) => {
      const m = measure(req);
      const job: Job = {
        id: generateId(),
        title: `${TEMPLATES[req.templateId].name} → ${DESTINATIONS[req.destination].name}`,
        destination: req.destination,
        detail: req.detail,
        startedAt: Date.now(),
        // Scale with payload so bigger exports visibly take longer (2.4s – 6s).
        duration: Math.min(6000, 2400 + m.bytes / 40),
        trigger: req.trigger ?? "manual",
        entry: { templateId: req.templateId, period: req.period, periodLabel: m.periodLabel, destination: req.destination, format: req.format, records: m.records, bytes: m.bytes, trigger: req.trigger ?? "manual", detail: req.detail },
      };
      setJobs((j) => [...j, job]);
      setNow(Date.now());
    },
    [measure],
  );

  // Drive job progress and completion while anything is running.
  useEffect(() => {
    if (!jobs.length) return;
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const finished = jobs.filter((j) => ts - j.startedAt >= j.duration);
      if (!finished.length) return;
      setJobs((list) => list.filter((j) => !finished.some((f) => f.id === j.id)));
      for (const f of finished) {
        pushHistory({ ...f.entry, status: "completed" });
        setState((s) => {
          const c = s.connections[f.destination];
          return c ? { ...s, connections: { ...s.connections, [f.destination]: { ...c, lastSyncAt: new Date(ts).toISOString() } } } : s;
        });
        toast(`${f.title} complete${f.detail ? ` · ${f.detail}` : ""}`, "success");
      }
    }, 150);
    return () => clearInterval(t);
  }, [jobs, pushHistory, toast]);

  // Scheduler: checks for due schedules while the app is open (a real service would run these server-side).
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!hydrated || isLoading) return;
    const check = () => {
      const current = new Date();
      const due = stateRef.current.schedules.filter((s) => s.enabled && isDue(s.timing, new Date(s.lastRunAt ?? s.createdAt), current));
      if (!due.length) return;
      for (const s of due) {
        queueExport({
          templateId: s.templateId,
          period: defaultPeriod(TEMPLATES[s.templateId].periodKind),
          destination: s.destination,
          format: s.format,
          trigger: "schedule",
          detail: s.recipients ? `to ${s.recipients}` : s.name,
        });
      }
      const ids = new Set(due.map((s) => s.id));
      setState((st) => ({ ...st, schedules: st.schedules.map((s) => (ids.has(s.id) ? { ...s, lastRunAt: current.toISOString() } : s)) }));
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [hydrated, isLoading, queueExport]);

  // Keep relative times ("2 min ago") fresh even when idle.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const connect = useCallback((id: DestinationId, account: string) => {
    setState((s) => ({ ...s, connections: { ...s.connections, [id]: { id, account, connectedAt: new Date().toISOString(), lastSyncAt: null } } }));
  }, []);
  const disconnect = useCallback((id: DestinationId) => {
    setState((s) => {
      const connections = { ...s.connections };
      delete connections[id];
      // Pause schedules that depended on this connection rather than silently failing.
      return { ...s, connections, schedules: s.schedules.map((sc) => (sc.destination === id ? { ...sc, enabled: false } : sc)) };
    });
  }, []);
  const isConnected = useCallback((id: DestinationId) => !DESTINATIONS[id].requiresConnection || Boolean(state.connections[id]), [state.connections]);

  const saveSchedule = useCallback<CloudContextValue["saveSchedule"]>((input) => {
    setState((s) => {
      if (input.id && s.schedules.some((x) => x.id === input.id)) {
        // Editing restarts the clock so a changed time doesn't fire immediately for a missed slot.
        return { ...s, schedules: s.schedules.map((x) => (x.id === input.id ? { ...x, ...input, id: x.id, lastRunAt: new Date().toISOString() } : x)) };
      }
      return { ...s, schedules: [...s.schedules, { ...input, id: generateId(), createdAt: new Date().toISOString(), lastRunAt: null }] };
    });
  }, []);
  const toggleSchedule = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      schedules: s.schedules.map((x) => (x.id === id ? { ...x, enabled: !x.enabled, lastRunAt: !x.enabled ? new Date().toISOString() : x.lastRunAt } : x)),
    }));
  }, []);
  const deleteSchedule = useCallback((id: string) => setState((s) => ({ ...s, schedules: s.schedules.filter((x) => x.id !== id) })), []);
  const runScheduleNow = useCallback(
    (id: string) => {
      const s = stateRef.current.schedules.find((x) => x.id === id);
      if (!s) return;
      queueExport({ templateId: s.templateId, period: defaultPeriod(TEMPLATES[s.templateId].periodKind), destination: s.destination, format: s.format, trigger: "schedule", detail: s.recipients ? `to ${s.recipients}` : s.name });
      setState((st) => ({ ...st, schedules: st.schedules.map((x) => (x.id === id ? { ...x, lastRunAt: new Date().toISOString() } : x)) }));
    },
    [queueExport],
  );

  const addShare = useCallback((input: Omit<ShareLink, "id" | "createdAt">) => {
    const link: ShareLink = { ...input, id: generateId(), createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, shares: [link, ...s.shares] }));
    return link;
  }, []);
  const removeShare = useCallback((id: string) => setState((s) => ({ ...s, shares: s.shares.filter((x) => x.id !== id) })), []);
  const clearHistory = useCallback(() => setState((s) => ({ ...s, history: [] })), []);

  const lastSyncAt = state.history.find((h) => h.status === "completed")?.at ?? null;

  const value = useMemo<CloudContextValue>(
    () => ({
      ...state,
      jobs,
      now,
      connect,
      disconnect,
      isConnected,
      recordExport,
      queueExport,
      saveSchedule,
      toggleSchedule,
      deleteSchedule,
      runScheduleNow,
      addShare,
      removeShare,
      clearHistory,
      lastSyncAt,
    }),
    [state, jobs, now, connect, disconnect, isConnected, recordExport, queueExport, saveSchedule, toggleSchedule, deleteSchedule, runScheduleNow, addShare, removeShare, clearHistory, lastSyncAt],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud() {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used within CloudProvider");
  return ctx;
}
