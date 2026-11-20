/**
 * Export templates turn raw expenses into a purpose-built report (a "table model"),
 * which every destination then serialises: CSV/TSV/Markdown/JSON files, share links,
 * spreadsheet previews, email attachments.
 */
import { CATEGORIES, type Category, type Expense } from "../../types/expense";
import { formatCurrency, formatDate, formatMonthKey, monthKey, toISODate } from "../format";

export type TemplateId = "tax-report" | "monthly-summary" | "category-analysis" | "full-backup";
export type PeriodKind = "year" | "month" | "range";

export type CellKind = "text" | "money" | "percent" | "date" | "count" | "delta";
export interface Column {
  key: string;
  label: string;
  kind: CellKind;
}
export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface ReportModel {
  templateId: TemplateId;
  title: string;
  subtitle: string;
  columns: Column[];
  rows: Row[];
  totals?: Row;
  highlights: { label: string; value: string }[];
  recordCount: number;
  notes?: string;
}

export interface Period {
  kind: PeriodKind;
  /** year: "2026"; month: "2026-11"; range: number of months back, or "all". */
  value: string;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accent: string;
  periodKind: PeriodKind;
  defaultFormat: FileFormat;
  includes: string[];
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  "tax-report": {
    id: "tax-report",
    name: "Tax Report",
    tagline: "Year-end, grouped by category",
    description: "Every expense in a tax year, grouped by category with subtotals — hand it to your accountant.",
    emoji: "🧾",
    accent: "from-emerald-500 to-teal-500",
    periodKind: "year",
    defaultFormat: "csv",
    includes: ["Itemised transactions", "Category subtotals", "Annual total"],
  },
  "monthly-summary": {
    id: "monthly-summary",
    name: "Monthly Summary",
    tagline: "One month vs. the month before",
    description: "Category totals for a month compared with the previous one, plus the biggest expenses.",
    emoji: "📅",
    accent: "from-brand-500 to-violet-500",
    periodKind: "month",
    defaultFormat: "csv",
    includes: ["Totals per category", "Month-over-month change", "Top 5 expenses"],
  },
  "category-analysis": {
    id: "category-analysis",
    name: "Category Analysis",
    tagline: "Where the money goes, and how often",
    description: "Share, frequency, averages and the largest purchase for each category over a period.",
    emoji: "📊",
    accent: "from-amber-500 to-orange-500",
    periodKind: "range",
    defaultFormat: "csv",
    includes: ["Share of spend", "Average & monthly average", "Largest purchase"],
  },
  "full-backup": {
    id: "full-backup",
    name: "Full Backup",
    tagline: "Everything, machine-readable",
    description: "A lossless JSON copy of every expense, including IDs and timestamps — ideal for scheduled backups.",
    emoji: "🗄️",
    accent: "from-slate-600 to-slate-800",
    periodKind: "range",
    defaultFormat: "json",
    includes: ["All fields incl. IDs", "Created/updated timestamps", "Restorable format"],
  },
};
export const TEMPLATE_ORDER: TemplateId[] = ["tax-report", "monthly-summary", "category-analysis", "full-backup"];

// ---------------------------------------------------------------------------
// Periods

export function defaultPeriod(kind: PeriodKind, now = new Date()): Period {
  if (kind === "year") return { kind, value: String(now.getFullYear()) };
  if (kind === "month") return { kind, value: toISODate(now).slice(0, 7) };
  return { kind, value: "all" };
}

export function periodBounds(p: Period): { from: string; to: string } {
  if (p.kind === "year") return { from: `${p.value}-01-01`, to: `${p.value}-12-31` };
  if (p.kind === "month") {
    const [y, m] = p.value.split("-").map(Number);
    return { from: `${p.value}-01`, to: toISODate(new Date(y, m, 0)) };
  }
  if (p.value === "all") return { from: "", to: "" };
  const now = new Date();
  return { from: toISODate(new Date(now.getFullYear(), now.getMonth() - Number(p.value) + 1, 1)), to: toISODate(now) };
}

export function describePeriod(p: Period): string {
  if (p.kind === "year") return `Tax year ${p.value}`;
  if (p.kind === "month") return formatMonthKey(p.value, "long");
  return p.value === "all" ? "All time" : `Last ${p.value} months`;
}

const inPeriod = (e: Expense, p: Period) => {
  const { from, to } = periodBounds(p);
  return (!from || e.date >= from) && (!to || e.date <= to);
};

// ---------------------------------------------------------------------------
// Builders

const cents = (n: number) => Math.round(n * 100);
const sum = (list: Expense[]) => list.reduce((s, e) => s + cents(e.amount), 0) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

function taxReport(expenses: Expense[], p: Period): ReportModel {
  const list = expenses.filter((e) => inPeriod(e, p));
  const rows: Row[] = [];
  const highlights: ReportModel["highlights"] = [];
  for (const c of CATEGORIES) {
    const items = list.filter((e) => e.category === c).sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length) continue;
    for (const e of items) rows.push({ date: e.date, category: c, description: e.description, amount: e.amount });
    rows.push({ date: null, category: `${c} subtotal`, description: `${items.length} item${items.length === 1 ? "" : "s"}`, amount: sum(items) });
  }
  const total = sum(list);
  highlights.push({ label: "Total", value: formatCurrency(total) }, { label: "Transactions", value: String(list.length) });
  const biggest = [...list].sort((a, b) => b.amount - a.amount)[0];
  if (biggest) highlights.push({ label: "Largest", value: `${formatCurrency(biggest.amount)} · ${biggest.description || biggest.category}` });
  return {
    templateId: "tax-report",
    title: `Tax Report ${p.value}`,
    subtitle: describePeriod(p),
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "category", label: "Category", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    rows,
    totals: { date: null, category: "Annual total", description: `${list.length} items`, amount: total },
    highlights,
    recordCount: list.length,
    notes: "Categories are as recorded in Spendwise. Check deductibility with a tax professional.",
  };
}

function monthlySummary(expenses: Expense[], p: Period): ReportModel {
  const [y, m] = p.value.split("-").map(Number);
  const prevKey = toISODate(new Date(y, m - 2, 1)).slice(0, 7);
  const cur = expenses.filter((e) => monthKey(e.date) === p.value);
  const prev = expenses.filter((e) => monthKey(e.date) === prevKey);
  const rows: Row[] = CATEGORIES.map((c) => {
    const a = sum(cur.filter((e) => e.category === c));
    const b = sum(prev.filter((e) => e.category === c));
    return { category: c, current: a, previous: b, change: b ? round2(((a - b) / b) * 100) : a ? null : 0 };
  }).filter((r) => r.current || r.previous);
  const total = sum(cur);
  const prevTotal = sum(prev);
  const top = [...cur].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return {
    templateId: "monthly-summary",
    title: `Monthly Summary · ${formatMonthKey(p.value, "long")}`,
    subtitle: `Compared with ${formatMonthKey(prevKey, "long")}`,
    columns: [
      { key: "category", label: "Category", kind: "text" },
      { key: "current", label: formatMonthKey(p.value, "short"), kind: "money" },
      { key: "previous", label: formatMonthKey(prevKey, "short"), kind: "money" },
      { key: "change", label: "Change", kind: "delta" },
    ],
    rows,
    totals: { category: "Total", current: total, previous: prevTotal, change: prevTotal ? round2(((total - prevTotal) / prevTotal) * 100) : null },
    highlights: [
      { label: "Spent", value: formatCurrency(total) },
      { label: "Transactions", value: String(cur.length) },
      ...top.slice(0, 3).map((e, i) => ({ label: `Top ${i + 1}`, value: `${formatCurrency(e.amount)} · ${e.description || e.category}` })),
    ],
    recordCount: cur.length,
  };
}

function categoryAnalysis(expenses: Expense[], p: Period): ReportModel {
  const list = expenses.filter((e) => inPeriod(e, p));
  const total = sum(list);
  const months = Math.max(1, new Set(list.map((e) => monthKey(e.date))).size);
  const rows: Row[] = CATEGORIES.map((c) => {
    const items = list.filter((e) => e.category === c);
    const t = sum(items);
    const largest = items.reduce<Expense | null>((best, e) => (!best || e.amount > best.amount ? e : best), null);
    return {
      category: c,
      total: t,
      share: total ? round2((t / total) * 100) : 0,
      count: items.length,
      average: items.length ? round2(t / items.length) : 0,
      monthly: round2(t / months),
      largest: largest ? `${formatCurrency(largest.amount)} ${largest.description}`.trim() : "—",
    };
  })
    .filter((r) => r.count)
    .sort((a, b) => (b.total as number) - (a.total as number));
  return {
    templateId: "category-analysis",
    title: "Category Analysis",
    subtitle: describePeriod(p),
    columns: [
      { key: "category", label: "Category", kind: "text" },
      { key: "total", label: "Total", kind: "money" },
      { key: "share", label: "Share", kind: "percent" },
      { key: "count", label: "Count", kind: "count" },
      { key: "average", label: "Average", kind: "money" },
      { key: "monthly", label: "Per month", kind: "money" },
      { key: "largest", label: "Largest purchase", kind: "text" },
    ],
    rows,
    totals: { category: "All categories", total, share: total ? 100 : 0, count: list.length, average: list.length ? round2(total / list.length) : 0, monthly: round2(total / months), largest: null },
    highlights: [
      { label: "Total", value: formatCurrency(total) },
      { label: "Top category", value: rows[0] ? `${rows[0].category} (${rows[0].share}%)` : "—" },
      { label: "Months covered", value: String(list.length ? months : 0) },
    ],
    recordCount: list.length,
  };
}

function fullBackup(expenses: Expense[], p: Period): ReportModel {
  const list = expenses.filter((e) => inPeriod(e, p));
  return {
    templateId: "full-backup",
    title: "Spendwise Backup",
    subtitle: describePeriod(p),
    columns: [
      { key: "id", label: "ID", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "category", label: "Category", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "createdAt", label: "Created", kind: "text" },
      { key: "updatedAt", label: "Updated", kind: "text" },
    ],
    rows: list.map((e) => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount, createdAt: e.createdAt, updatedAt: e.updatedAt })),
    highlights: [
      { label: "Records", value: String(list.length) },
      { label: "Total", value: formatCurrency(sum(list)) },
    ],
    recordCount: list.length,
  };
}

const BUILDERS: Record<TemplateId, (e: Expense[], p: Period) => ReportModel> = {
  "tax-report": taxReport,
  "monthly-summary": monthlySummary,
  "category-analysis": categoryAnalysis,
  "full-backup": fullBackup,
};

export function buildReport(expenses: Expense[], templateId: TemplateId, period: Period): ReportModel {
  return BUILDERS[templateId](expenses, period);
}

// ---------------------------------------------------------------------------
// Privacy transforms (applied before sharing)

export interface PrivacyOptions {
  hideDescriptions: boolean;
  roundAmounts: boolean;
}

export function applyPrivacy(model: ReportModel, opts: PrivacyOptions): ReportModel {
  if (!opts.hideDescriptions && !opts.roundAmounts) return model;
  const dropKeys = new Set(opts.hideDescriptions ? ["description", "largest", "id"] : []);
  const columns = model.columns.filter((c) => !dropKeys.has(c.key));
  const fix = (r: Row): Row => {
    const out: Row = {};
    for (const c of columns) {
      const v = r[c.key];
      out[c.key] = opts.roundAmounts && c.kind === "money" && typeof v === "number" ? Math.round(v) : v;
    }
    return out;
  };
  return {
    ...model,
    columns,
    rows: model.rows.map(fix),
    totals: model.totals && fix(model.totals),
    highlights: opts.hideDescriptions ? model.highlights.map((h) => ({ ...h, value: h.value.split(" · ")[0] })) : model.highlights,
  };
}

// ---------------------------------------------------------------------------
// Serialisation

export type FileFormat = "csv" | "json" | "xlsx-tsv" | "markdown";

export function formatCell(v: Cell, kind: CellKind): string {
  if (v === null || v === undefined || v === "") return kind === "delta" ? "new" : "";
  if (typeof v === "string") return kind === "date" ? formatDate(v) : v;
  switch (kind) {
    case "money":
      return formatCurrency(v);
    case "percent":
      return `${v}%`;
    case "delta":
      return `${v > 0 ? "+" : ""}${v}%`;
    default:
      return String(v);
  }
}

const rawCell = (v: Cell, kind: CellKind) => (v === null || v === undefined ? "" : typeof v === "number" && kind === "money" ? v.toFixed(2) : String(v));

function csvEscape(value: string): string {
  let v = /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const allRows = (m: ReportModel) => (m.totals ? [...m.rows, m.totals] : m.rows);

export function toCSV(m: ReportModel): string {
  const lines = [m.columns.map((c) => csvEscape(c.label)).join(",")];
  for (const r of allRows(m)) lines.push(m.columns.map((c) => csvEscape(rawCell(r[c.key], c.kind))).join(","));
  return "﻿" + lines.join("\r\n");
}

/** Tab-separated — pastes straight into Google Sheets / Excel cells. */
export function toTSV(m: ReportModel): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ");
  return [m.columns.map((c) => c.label), ...allRows(m).map((r) => m.columns.map((c) => rawCell(r[c.key], c.kind)))].map((cells) => cells.map(clean).join("\t")).join("\n");
}

/** GitHub-flavoured Markdown — pastes cleanly into Notion, Slack, Linear, GitHub… */
export function toMarkdown(m: ReportModel): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const right = (k: CellKind) => k === "money" || k === "percent" || k === "count" || k === "delta";
  const lines = [
    `### ${m.title}`,
    `_${m.subtitle}_`,
    "",
    `| ${m.columns.map((c) => esc(c.label)).join(" | ")} |`,
    `| ${m.columns.map((c) => (right(c.kind) ? "---:" : "---")).join(" | ")} |`,
    ...m.rows.map((r) => `| ${m.columns.map((c) => esc(formatCell(r[c.key], c.kind))).join(" | ")} |`),
  ];
  if (m.totals) lines.push(`| ${m.columns.map((c) => `**${esc(formatCell(m.totals![c.key], c.kind))}**`.replace("****", "")).join(" | ")} |`);
  return lines.join("\n");
}

export function toJSON(m: ReportModel, generatedAt = new Date()): string {
  return JSON.stringify(
    { title: m.title, period: m.subtitle, generatedAt: generatedAt.toISOString(), recordCount: m.recordCount, columns: m.columns.map((c) => c.key), rows: m.rows, totals: m.totals ?? null },
    null,
    2,
  );
}

export const FILE_FORMATS: Record<FileFormat, { label: string; ext: string; mime: string; serialize: (m: ReportModel) => string }> = {
  csv: { label: "CSV", ext: "csv", mime: "text/csv;charset=utf-8", serialize: toCSV },
  json: { label: "JSON", ext: "json", mime: "application/json", serialize: (m) => toJSON(m) },
  "xlsx-tsv": { label: "Spreadsheet (TSV)", ext: "tsv", mime: "text/tab-separated-values", serialize: toTSV },
  markdown: { label: "Markdown", ext: "md", mime: "text/markdown", serialize: toMarkdown },
};

export function reportFilename(m: ReportModel, format: FileFormat): string {
  const slug = `${m.title} ${m.templateId === "tax-report" || m.templateId === "monthly-summary" ? "" : m.subtitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `spendwise-${slug}.${FILE_FORMATS[format].ext}`;
}

export const byteSize = (s: string) => new TextEncoder().encode(s).length;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export type { Category };
