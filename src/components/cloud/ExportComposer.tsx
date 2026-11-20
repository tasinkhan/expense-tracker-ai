"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/useToast";
import { toISODate } from "@/lib/format";
import { DESTINATIONS, SEND_DESTINATIONS, type DestinationId } from "@/lib/cloud/destinations";
import {
  FILE_FORMATS,
  TEMPLATES,
  TEMPLATE_ORDER,
  applyPrivacy,
  buildReport,
  byteSize,
  defaultPeriod,
  formatBytes,
  reportFilename,
  toMarkdown,
  toTSV,
  type FileFormat,
  type Period,
  type ReportModel,
  type TemplateId,
} from "@/lib/cloud/report";
import { buildShareUrl, encodeSnapshot, snapshotFromReport } from "@/lib/cloud/share";
import { ConnectDialog } from "./ConnectDialog";
import { CopyButton, DestinationTile, QRCode, ReportTable, SimulatedBadge, SpreadsheetMock, Toggle, downloadText, qrSvgMarkup } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTemplate?: TemplateId;
  initialDestination?: DestinationId;
  initialPeriod?: Period;
}

type Step = 0 | 1 | 2;
const STEPS = ["Report", "Destination", "Send"];

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const now = new Date();
  const options =
    period.kind === "year"
      ? Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i)).map((y) => ({ value: y, label: `Tax year ${y}` }))
      : period.kind === "month"
        ? Array.from({ length: 12 }, (_, i) => toISODate(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7)).map((m) => ({
            value: m,
            label: new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          }))
        : [
            { value: "3", label: "Last 3 months" },
            { value: "6", label: "Last 6 months" },
            { value: "12", label: "Last 12 months" },
            { value: "all", label: "All time" },
          ];
  return (
    <select aria-label="Period" className="input" value={period.value} onChange={(e) => onChange({ kind: period.kind, value: e.target.value })}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

export function ExportComposer({ open, onClose, initialTemplate = "monthly-summary", initialDestination, initialPeriod }: Props) {
  const { expenses } = useExpenses();
  const cloud = useCloud();
  const toast = useToast();

  const [step, setStep] = useState<Step>(0);
  const [templateId, setTemplateId] = useState<TemplateId>(initialTemplate);
  const [period, setPeriod] = useState<Period>(initialPeriod ?? defaultPeriod(TEMPLATES[initialTemplate].periodKind));
  const [destination, setDestination] = useState<DestinationId>(initialDestination ?? "download");
  const [format, setFormat] = useState<FileFormat>(TEMPLATES[initialTemplate].defaultFormat);
  const [connecting, setConnecting] = useState<DestinationId | null>(null);

  // Destination-specific state
  const [hideDescriptions, setHideDescriptions] = useState(false);
  const [roundAmounts, setRoundAmounts] = useState(false);
  const [expiry, setExpiry] = useState<string>("7");
  const [sharedBy, setSharedBy] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Hi — here's the latest expense report from Spendwise.");
  const [includeLink, setIncludeLink] = useState(true);
  const [sheetName, setSheetName] = useState("");
  const [keepInSync, setKeepInSync] = useState(true);
  const [folder, setFolder] = useState("/Spendwise/Exports");
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(initialDestination ? 1 : 0);
    setTemplateId(initialTemplate);
    setPeriod(initialPeriod ?? defaultPeriod(TEMPLATES[initialTemplate].periodKind));
    setDestination(initialDestination ?? "download");
    setFormat(TEMPLATES[initialTemplate].defaultFormat);
    setShareUrl(null);
    setEmailTouched(false);
  }, [open, initialTemplate, initialDestination, initialPeriod]);

  const pickTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setPeriod(defaultPeriod(TEMPLATES[id].periodKind));
    setFormat(TEMPLATES[id].defaultFormat);
    setShareUrl(null);
  };

  const model = useMemo(() => buildReport(expenses, templateId, period), [expenses, templateId, period]);
  const shared = useMemo(() => applyPrivacy(model, { hideDescriptions, roundAmounts }), [model, hideDescriptions, roundAmounts]);
  const fileName = reportFilename(model, format);
  const fileSize = useMemo(() => byteSize(FILE_FORMATS[format].serialize(model)), [model, format]);
  const dest = DESTINATIONS[destination];
  const connected = cloud.isConnected(destination);
  const connection = cloud.connections[destination];

  useEffect(() => setShareUrl(null), [hideDescriptions, roundAmounts, expiry, sharedBy, templateId, period]);
  useEffect(() => {
    setSubject(model.title);
    setSheetName(`Spendwise · ${model.title}`);
  }, [model.title]);

  const request = (extra: { detail?: string; shareUrl?: string; format?: FileFormat } = {}) => ({
    templateId,
    period,
    destination,
    format: extra.format ?? format,
    detail: extra.detail,
    shareUrl: extra.shareUrl,
  });

  const makeLink = async (): Promise<string> => {
    const snap = snapshotFromReport(shared, { expiresInDays: expiry === "never" ? null : Number(expiry), from: sharedBy.trim() || undefined });
    const url = buildShareUrl(window.location.origin, await encodeSnapshot(snap));
    cloud.addShare({ url, title: shared.title, subtitle: shared.subtitle, expiresAt: snap.expiresAt, privacy: { hideDescriptions, roundAmounts }, chars: url.length });
    return url;
  };

  const emails = parseEmails(to);
  const badEmails = emails.filter((e) => !EMAIL_RE.test(e));
  const emailError = !emails.length ? "Add at least one recipient." : badEmails.length ? `Check: ${badEmails.join(", ")}` : null;

  // ---- primary actions
  const finish = (msg?: string) => {
    if (msg) toast(msg);
    onClose();
  };

  const run = async () => {
    if (!model.recordCount) return;
    if (dest.requiresConnection && !connected) return setConnecting(destination);
    switch (destination) {
      case "download":
        downloadText(FILE_FORMATS[format].serialize(model), FILE_FORMATS[format].mime, fileName);
        cloud.recordExport(request({ detail: fileName }));
        return finish(`Downloaded ${fileName}`);
      case "link": {
        setBusy(true);
        try {
          const url = await makeLink();
          setShareUrl(url);
          cloud.recordExport(request({ detail: `Link · ${expiry === "never" ? "no expiry" : `expires in ${expiry}d`}`, shareUrl: url, format: "json" }), { records: shared.recordCount, bytes: url.length });
        } catch {
          toast("Couldn't create the link in this browser.", "error");
        } finally {
          setBusy(false);
        }
        return;
      }
      case "email": {
        setEmailTouched(true);
        if (emailError) return;
        let detail = `to ${emails.join(", ")}`;
        if (includeLink) {
          await makeLink();
          detail += " · with link";
        }
        cloud.queueExport(request({ detail }));
        return finish("Email queued — watch progress in the activity tray");
      }
      case "google-sheets":
        cloud.queueExport(request({ detail: `Sheet “${sheetName}”`, format: "xlsx-tsv" }));
        if (keepInSync) {
          cloud.saveSchedule({ name: sheetName, templateId, destination, format: "xlsx-tsv", enabled: true, timing: { frequency: "weekly", weekday: 1, monthDay: 1, time: "08:00" } });
        }
        return finish(keepInSync ? "Creating sheet · weekly sync scheduled" : "Creating sheet in the background");
      case "google-drive":
      case "dropbox":
      case "onedrive":
        cloud.queueExport(request({ detail: `${folder.replace(/\/$/, "")}/${fileName}` }));
        return finish(`Uploading to ${dest.name} in the background`);
      case "spendwise-cloud":
        cloud.queueExport(request({ detail: "Versioned backup" }));
        return finish("Backup started");
      case "clipboard":
        return;
    }
  };

  const openMailApp = async () => {
    const link = includeLink ? await makeLink() : null;
    const lines = [message, "", `${model.title} — ${model.subtitle}`, ...model.highlights.map((h) => `• ${h.label}: ${h.value}`)];
    if (link) lines.push("", `View the full report: ${link}`);
    const href = `mailto:${encodeURIComponent(emails.join(","))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
    cloud.recordExport(request({ detail: `via mail app${emails.length ? ` to ${emails.join(", ")}` : ""}`, shareUrl: link ?? undefined }));
  };

  const primaryLabel = (() => {
    if (dest.requiresConnection && !connected) return `Connect ${dest.name}`;
    switch (destination) {
      case "download": return `Download ${FILE_FORMATS[format].label}`;
      case "link": return busy ? "Creating link…" : shareUrl ? "Create new link" : "Create share link";
      case "email": return `Send to ${emails.length || ""} recipient${emails.length === 1 ? "" : "s"}`.replace("  ", " ");
      case "google-sheets": return "Create spreadsheet";
      case "spendwise-cloud": return "Back up now";
      default: return `Upload to ${dest.name}`;
    }
  })();

  const hasData = model.recordCount > 0;

  return (
    <>
      <Modal open={open && !connecting} onClose={onClose} title="New export" size="lg">
        <div className="space-y-5">
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-xs font-medium">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(i as Step)}
                  disabled={i > 0 && !hasData}
                  className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition disabled:opacity-50 ${step === i ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step > i ? "bg-emerald-500 text-white" : step === i ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {step > i ? "✓" : i + 1}
                  </span>
                  {label}
                </button>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATE_ORDER.map((id) => {
                  const t = TEMPLATES[id];
                  const on = id === templateId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pickTemplate(id)}
                      aria-pressed={on}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-base ${t.accent}`}>{t.emoji}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                        <span className="block text-xs text-slate-500">{t.tagline}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Period</span>
                  <PeriodPicker period={period} onChange={setPeriod} />
                </label>
                <p className="pb-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{model.recordCount}</span> expenses · {model.rows.length} rows
                </p>
              </div>
              {hasData ? <ReportTable model={model} maxRows={6} dense /> : <EmptyPeriod />}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {SEND_DESTINATIONS.map((id) => {
                const d = DESTINATIONS[id];
                const on = id === destination;
                const conn = cloud.connections[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setDestination(id);
                      setShareUrl(null);
                      if (id === "download" || id === "spendwise-cloud") setFormat(TEMPLATES[templateId].defaultFormat);
                    }}
                    aria-pressed={on}
                    className={`relative flex flex-col gap-2 rounded-xl border p-3 text-left transition ${on ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="flex items-center justify-between">
                      <DestinationTile id={id} />
                      {d.kind === "simulated" && <SimulatedBadge />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{d.name}</span>
                      <span className="block text-xs leading-snug text-slate-500">{d.blurb}</span>
                    </span>
                    {d.requiresConnection && (
                      <span className={`text-[11px] font-medium ${conn ? "text-emerald-600" : "text-slate-400"}`}>{conn ? `● ${conn.account}` : "Not connected"}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <DestinationTile id={destination} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {TEMPLATES[templateId].name} · {model.subtitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    {model.recordCount} expenses → {dest.name}
                    {connection && ` (${connection.account})`}
                  </p>
                </div>
                {dest.kind === "simulated" && <SimulatedBadge />}
              </div>

              {dest.requiresConnection && !connected ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">Connect {dest.name} to continue</p>
                  <p className="mt-1 text-xs text-slate-500">You’ll only need to do this once. Spendwise gets access to its own folder, nothing else.</p>
                  <button type="button" className="btn-primary mt-4" onClick={() => setConnecting(destination)}>
                    Connect {dest.name}
                  </button>
                </div>
              ) : destination === "download" || destination === "spendwise-cloud" || destination === "google-drive" || destination === "dropbox" || destination === "onedrive" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(FILE_FORMATS) as FileFormat[]).map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${format === f ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
                        {FILE_FORMATS[f].label}
                      </button>
                    ))}
                  </div>
                  {(destination === "google-drive" || destination === "dropbox" || destination === "onedrive") && (
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">Folder</span>
                      <input className="input font-mono text-xs" value={folder} onChange={(e) => setFolder(e.target.value)} />
                    </label>
                  )}
                  {destination === "spendwise-cloud" && (
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Backups are versioned — Spendwise Cloud keeps the last 30 copies so you can roll back any time.</p>
                  )}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600">
                    <span className="truncate">{destination === "download" ? fileName : `${destination === "spendwise-cloud" ? "/backups" : folder.replace(/\/$/, "")}/${fileName}`}</span>
                    <span className="shrink-0 pl-3 text-slate-400">{formatBytes(fileSize)}</span>
                  </div>
                  <ReportTable model={model} maxRows={5} dense />
                </div>
              ) : destination === "link" ? (
                <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy</p>
                      <Toggle checked={hideDescriptions} onChange={setHideDescriptions} label="Hide descriptions" description="Share amounts and categories only" />
                      <Toggle checked={roundAmounts} onChange={setRoundAmounts} label="Round to whole dollars" description="Good for rough budgets with roommates" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Link expires</span>
                        <select className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                          <option value="1">After 24 hours</option>
                          <option value="7">After 7 days</option>
                          <option value="30">After 30 days</option>
                          <option value="never">Never</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Shown as from</span>
                        <input className="input" placeholder="Optional name" value={sharedBy} onChange={(e) => setSharedBy(e.target.value)} maxLength={40} />
                      </label>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      🔒 The report is compressed into the link itself (after the <code>#</code>), so it’s never uploaded to a server. Anyone with the link can view it.
                    </p>
                    {shareUrl && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input readOnly value={shareUrl} className="input font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Share link" />
                          <CopyButton text={shareUrl} label="Copy" />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <a href={shareUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:text-brand-700">
                            Open preview ↗
                          </a>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">{shareUrl.length.toLocaleString()} characters</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {shareUrl ? (
                      <>
                        <QRCode value={shareUrl} size={168} className="border border-slate-200 p-1" />
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                          onClick={() => {
                            const svg = qrSvgMarkup(shareUrl);
                            if (svg) downloadText(svg, "image/svg+xml", reportFilename(model, "csv").replace(/\.csv$/, "-qr.svg"));
                          }}
                        >
                          Download QR (SVG)
                        </button>
                      </>
                    ) : (
                      <div className="flex h-[168px] w-[168px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        QR code appears
                        <br />
                        after you create the link
                      </div>
                    )}
                  </div>
                </div>
              ) : destination === "clipboard" ? (
                <ClipboardPanel model={model} onCopied={(f) => cloud.recordExport(request({ format: f, detail: f === "markdown" ? "Copied as Markdown" : "Copied as cells" }))} />
              ) : destination === "email" ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">To</span>
                    <input className={`input ${emailTouched && emailError ? "input-error" : ""}`} placeholder="accountant@example.com, partner@example.com" value={to} onChange={(e) => setTo(e.target.value)} onBlur={() => setEmailTouched(true)} />
                    {emailTouched && emailError && <span className="text-xs text-rose-600">{emailError}</span>}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Subject</span>
                    <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Message</span>
                    <textarea className="input min-h-[72px]" value={message} onChange={(e) => setMessage(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>Attach as</span>
                    {(["csv", "json", "markdown"] as FileFormat[]).map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${format === f ? "bg-slate-900 text-white ring-slate-900" : "ring-slate-200 hover:bg-slate-50"}`}>
                        📎 {reportFilename(model, f)}
                      </button>
                    ))}
                  </div>
                  <Toggle checked={includeLink} onChange={setIncludeLink} label="Include a view-online link" description="Recipients can open the report without downloading anything" />
                  <p className="text-xs text-slate-500">
                    Email delivery is simulated. Prefer to send it yourself?{" "}
                    <button type="button" className="font-medium text-brand-600 hover:text-brand-700" onClick={openMailApp}>
                      Open in my email app
                    </button>{" "}
                    (pre-fills the summary{includeLink ? " and link" : ""}).
                  </p>
                </div>
              ) : destination === "google-sheets" ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Spreadsheet name</span>
                    <input className="input" value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
                  </label>
                  <SpreadsheetMock model={model} sheetName={sheetName} />
                  <Toggle checked={keepInSync} onChange={setKeepInSync} label="Keep in sync" description="Refresh this sheet every Monday at 8:00 AM (creates a schedule)" />
                  <p className="text-xs text-slate-500">
                    Not ready to connect?{" "}
                    <CopyButton text={() => toTSV(model)} label="Copy cells instead" copiedLabel="Copied — paste into any sheet" className="font-medium text-brand-600 hover:text-brand-700" />
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => (s - 1) as Step))}>
              {step === 0 ? "Cancel" : "Back"}
            </button>
            {step < 2 ? (
              <button type="button" className="btn-primary" disabled={!hasData} onClick={() => setStep((s) => (s + 1) as Step)}>
                Continue
              </button>
            ) : destination === "clipboard" ? (
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={!hasData || busy} onClick={run}>
                {primaryLabel}
              </button>
            )}
          </div>
        </div>
      </Modal>
      <ConnectDialog id={connecting} onClose={() => setConnecting(null)} />
    </>
  );
}

function EmptyPeriod() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      No expenses in this period. Pick a different period or template.
    </div>
  );
}

function ClipboardPanel({ model, onCopied }: { model: ReportModel; onCopied: (f: FileFormat) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Docs & chat</p>
        <p className="text-xs text-slate-500">A formatted Markdown table — pastes cleanly into Notion, Slack, Linear, GitHub and Obsidian.</p>
        <pre className="max-h-28 overflow-auto rounded-lg bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-100">{toMarkdown(model).split("\n").slice(0, 7).join("\n")}</pre>
        <CopyButton text={() => toMarkdown(model)} label="Copy as Markdown" className="btn-primary w-full" onCopied={() => onCopied("markdown")} />
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Spreadsheets</p>
        <p className="text-xs text-slate-500">Tab-separated cells — paste into Google Sheets, Excel or Numbers and every value lands in its own cell.</p>
        <pre className="max-h-28 overflow-auto rounded-lg bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-100">{toTSV(model).split("\n").slice(0, 7).join("\n").replace(/\t/g, "  →  ")}</pre>
        <CopyButton text={() => toTSV(model)} label="Copy as cells" className="btn-primary w-full" onCopied={() => onCopied("xlsx-tsv")} />
      </div>
    </div>
  );
}
