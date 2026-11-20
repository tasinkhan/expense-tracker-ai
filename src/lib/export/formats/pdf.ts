/**
 * A small, dependency-free PDF writer tailored to the expense report.
 *
 * It emits PDF 1.4 using the standard Helvetica fonts (no embedding needed) with
 * WinAnsi encoding. Layout is a single-pass flow with page breaks; footers are
 * stamped afterwards once the total page count is known.
 */
import { CATEGORIES } from "../../../types/expense";
import { CATEGORY_STYLES } from "../../categories";
import { formatCurrency, formatDate } from "../../format";
import type { ExportDataset, ExportFormat } from "../types";

type RGB = readonly [number, number, number];

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_SPACE = 36;
const ROW_H = 18;
const CELL_PAD = 6;
const BODY_SIZE = 8.5;

const INK: RGB = [0.06, 0.09, 0.16];
const MUTED: RGB = [0.39, 0.45, 0.55];
const WHITE: RGB = [1, 1, 1];
const BRAND: RGB = [0.31, 0.27, 0.9];
const HEADER_BG: RGB = [0.12, 0.16, 0.23];
const ZEBRA: RGB = [0.965, 0.973, 0.984];
const TILE_BG: RGB = [0.945, 0.953, 0.973];
const RULE: RGB = [0.8, 0.83, 0.88];

const COLUMNS = [
  { label: "Date", x: MARGIN, w: 84, align: "left" },
  { label: "Category", x: MARGIN + 84, w: 104, align: "left" },
  { label: "Description", x: MARGIN + 188, w: 244, align: "left" },
  { label: "Amount", x: MARGIN + 432, w: 84, align: "right" },
] as const;

// ---------------------------------------------------------------------------
// Text metrics & encoding

/** Helvetica advance widths (per 1000 em) for characters that differ from the defaults below. */
const WIDTHS: Record<string, number> = {
  " ": 278, ".": 278, ",": 278, ":": 278, ";": 278, "!": 278, "/": 278, "'": 191, '"': 355,
  "-": 333, "(": 333, ")": 333, "$": 556, "%": 889, "&": 667, "@": 1015, "#": 556,
  i: 222, j: 222, l: 222, f: 278, t: 278, r: 333, m: 833, w: 722, k: 500, s: 500, v: 500, x: 500, y: 500, z: 500, c: 500,
  I: 278, J: 500, M: 833, W: 944, C: 722, D: 722, G: 778, H: 722, N: 722, O: 778, Q: 778, R: 722, U: 722,
};

function charWidth(ch: string, bold: boolean): number {
  const w = WIDTHS[ch];
  if (w !== undefined) return bold && ch >= "a" && ch <= "z" ? w + 50 : w;
  if (ch >= "0" && ch <= "9") return 556;
  if (ch >= "A" && ch <= "Z") return bold ? 722 : 667;
  return 556;
}

function textWidth(s: string, size: number, bold = false): number {
  let total = 0;
  for (const ch of s) total += charWidth(ch, bold);
  return (total * size) / 1000;
}

function fitText(s: string, maxWidth: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= maxWidth) return s;
  const chars = Array.from(s);
  while (chars.length && textWidth(chars.join("") + "…", size, bold) > maxWidth) chars.pop();
  return chars.join("").trimEnd() + "…";
}

/** Characters outside Latin-1 that WinAnsiEncoding still supports. */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99,
};

/** Encode to a PDF literal string body: one byte per char, escaped. Unsupported glyphs become "?"; emoji are dropped. */
function pdfText(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    let byte: number;
    if (WIN_ANSI_EXTRAS[ch] !== undefined) byte = WIN_ANSI_EXTRAS[ch];
    else if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) byte = cp;
    else if (cp === 0x09 || cp === 0x0a || cp === 0x0d) byte = 0x20;
    else if (cp > 0xffff || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x200d) continue;
    else byte = 0x3f;
    const c = String.fromCharCode(byte);
    out += c === "\\" || c === "(" || c === ")" ? `\\${c}` : c;
  }
  return out;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const rgb = (c: RGB) => c.map((v) => v.toFixed(3)).join(" ");

function hexToRgb(hex: string): RGB {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// ---------------------------------------------------------------------------
// Drawing

interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: RGB;
  align?: "left" | "right";
}

class Page {
  readonly ops: string[] = [];

  text(x: number, y: number, s: string, { size = BODY_SIZE, bold = false, color = INK, align = "left" }: TextOpts = {}) {
    const left = align === "right" ? x - textWidth(s, size, bold) : x;
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${rgb(color)} rg ${num(left)} ${num(y)} Td (${pdfText(s)}) Tj ET`);
  }

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.ops.push(`${rgb(color)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB = RULE, width = 0.5) {
    this.ops.push(`${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }
}

function describePeriod(from: string, to: string): string {
  if (!from && !to) return "All dates";
  return `${from ? formatDate(from) : "Earliest"} – ${to ? formatDate(to) : "Latest"}`;
}

function describeCategories(selected: readonly string[]): string {
  return selected.length === CATEGORIES.length ? "All categories" : selected.join(", ");
}

function layoutReport(ds: ExportDataset, generatedAt: Date): Page[] {
  const pages: Page[] = [];
  let page!: Page;
  let y = 0;
  const newPage = () => {
    page = new Page();
    pages.push(page);
    page.rect(0, PAGE_H - 5, PAGE_W, 5, BRAND);
    y = PAGE_H - MARGIN;
  };
  const ensureSpace = (needed: number, onBreak?: () => void) => {
    if (y - needed < MARGIN + FOOTER_SPACE) {
      newPage();
      onBreak?.();
    }
  };

  newPage();

  // Title block
  y -= 18;
  page.text(MARGIN, y, "Expense Report", { size: 20, bold: true });
  const stamp = generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  page.text(PAGE_W - MARGIN, y, `Generated ${stamp}`, { size: 8.5, color: MUTED, align: "right" });
  y -= 20;
  page.text(MARGIN, y, "Period", { size: 8.5, bold: true, color: MUTED });
  page.text(MARGIN + 62, y, describePeriod(ds.criteria.from, ds.criteria.to), { size: 8.5 });
  y -= 13;
  page.text(MARGIN, y, "Categories", { size: 8.5, bold: true, color: MUTED });
  page.text(MARGIN + 62, y, fitText(describeCategories(ds.criteria.categories), CONTENT_W - 62, 8.5), { size: 8.5 });

  // Summary tiles
  y -= 18;
  const tiles: [string, string][] = [
    ["Records", ds.count.toLocaleString("en-US")],
    ["Total spent", formatCurrency(ds.total)],
    ["Average per record", ds.count ? formatCurrency(ds.total / ds.count) : "—"],
  ];
  const gap = 12;
  const tileW = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 46;
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (tileW + gap);
    page.rect(x, y - tileH, tileW, tileH, TILE_BG);
    page.text(x + 10, y - 15, label.toUpperCase(), { size: 7, bold: true, color: MUTED });
    page.text(x + 10, y - 35, fitText(value, tileW - 20, 15, true), { size: 15, bold: true });
  });
  y -= tileH + 24;

  // Category breakdown with proportional bars
  if (ds.byCategory.length) {
    page.text(MARGIN, y, "By category", { size: 10, bold: true });
    y -= 8;
    const max = Math.max(...ds.byCategory.map((c) => c.total));
    const barX = MARGIN + 200;
    const barMax = CONTENT_W - 200 - 60;
    for (const c of ds.byCategory) {
      y -= 15;
      page.rect(MARGIN, y + 1, 7, 7, hexToRgb(CATEGORY_STYLES[c.category].color));
      page.text(MARGIN + 13, y + 1.5, c.category);
      page.text(MARGIN + 190, y + 1.5, `${c.count} × `, { color: MUTED, align: "right" });
      page.rect(barX, y + 1, Math.max(2, (c.total / max) * barMax), 7, hexToRgb(CATEGORY_STYLES[c.category].color));
      page.text(PAGE_W - MARGIN, y + 1.5, formatCurrency(c.total), { bold: true, align: "right" });
    }
    y -= 26;
  }

  // Transactions table
  ensureSpace(ROW_H * 3 + 20);
  page.text(MARGIN, y, "Transactions", { size: 10, bold: true });
  y -= 8;

  const drawHeader = () => {
    page.rect(MARGIN, y - ROW_H, CONTENT_W, ROW_H, HEADER_BG);
    for (const col of COLUMNS) {
      const x = col.align === "right" ? col.x + col.w - CELL_PAD : col.x + CELL_PAD;
      page.text(x, y - ROW_H + 6, col.label.toUpperCase(), { size: 7.5, bold: true, color: WHITE, align: col.align });
    }
    y -= ROW_H;
  };
  drawHeader();

  if (!ds.records.length) {
    y -= ROW_H;
    page.text(MARGIN + CELL_PAD, y + 6, "No records match the selected filters.", { color: MUTED });
  }

  ds.records.forEach((r, i) => {
    ensureSpace(ROW_H, drawHeader);
    if (i % 2 === 1) page.rect(MARGIN, y - ROW_H, CONTENT_W, ROW_H, ZEBRA);
    const cells = [formatDate(r.date), r.category, r.description || "—", formatCurrency(r.amount)];
    const baseline = y - ROW_H + 6;
    COLUMNS.forEach((col, ci) => {
      const value = fitText(cells[ci], col.w - CELL_PAD * 2, BODY_SIZE);
      const x = col.align === "right" ? col.x + col.w - CELL_PAD : col.x + CELL_PAD;
      page.text(x, baseline, value, { align: col.align, color: ci === 2 && !r.description ? MUTED : INK });
    });
    y -= ROW_H;
  });

  // Grand total
  ensureSpace(ROW_H + 4);
  page.line(MARGIN, y, PAGE_W - MARGIN, y, INK, 0.8);
  y -= ROW_H;
  page.text(MARGIN + CELL_PAD, y + 6, `Total · ${ds.count} record${ds.count === 1 ? "" : "s"}`, { bold: true });
  page.text(PAGE_W - MARGIN - CELL_PAD, y + 6, formatCurrency(ds.total), { bold: true, align: "right" });

  // Footers
  pages.forEach((p, i) => {
    p.line(MARGIN, MARGIN - 6, PAGE_W - MARGIN, MARGIN - 6);
    p.text(MARGIN, MARGIN - 20, "Expense Tracker · Expense Report", { size: 7.5, color: MUTED });
    p.text(PAGE_W - MARGIN, MARGIN - 20, `Page ${i + 1} of ${pages.length}`, { size: 7.5, color: MUTED, align: "right" });
  });

  return pages;
}

// ---------------------------------------------------------------------------
// File assembly

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Serialise pages into a PDF. Every char in the body is a single byte (≤ 0xFF), so string length === byte length. */
function assemblePdf(pages: Page[], generatedAt: Date): Uint8Array {
  const objects: string[] = [];
  const CATALOG = 1, PAGES = 2, FONT = 3, FONT_BOLD = 4, INFO = 5;
  const firstPageId = 6;
  const pageIds = pages.map((_, i) => firstPageId + i * 2);

  objects[CATALOG] = `<< /Type /Catalog /Pages ${PAGES} 0 R >>`;
  objects[PAGES] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[FONT] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[FONT_BOLD] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[INFO] = `<< /Title (Expense Report) /Producer (Expense Tracker) /CreationDate (${pdfDate(generatedAt)}) >>`;

  pages.forEach((page, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const stream = page.ops.join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent ${PAGES} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${FONT} 0 R /F2 ${FONT_BOLD} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root ${CATALOG} 0 R /Info ${INFO} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
  return bytes;
}

export const pdfFormat: ExportFormat = {
  id: "pdf",
  label: "PDF",
  extension: "pdf",
  mime: "application/pdf",
  tagline: "Formatted report with totals, ready to print or share",
  serialize(ds, { generatedAt }) {
    return assemblePdf(layoutReport(ds, generatedAt), generatedAt);
  },
};
