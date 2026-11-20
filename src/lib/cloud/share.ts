/**
 * Serverless share links: the report snapshot is compressed and stored in the URL
 * *fragment* (after "#"), which browsers never send to a server. Anyone with the
 * link can open the read-only /shared page and the data is decoded locally.
 */
import type { Column, ReportModel, Row } from "./report";

export interface SharedSnapshot {
  v: 1;
  title: string;
  subtitle: string;
  columns: Column[];
  rows: Row[];
  totals?: Row;
  highlights: ReportModel["highlights"];
  recordCount: number;
  notes?: string;
  sharedAt: string;
  expiresAt: string | null;
  from?: string;
}

// Compact wire format: rows as arrays (keys come from columns) to keep links short.
type Wire = [1, string, string, [string, string, string][], (string | number | null)[][], (string | number | null)[] | 0, [string, string][], number, string, string | 0, string, string];

function toWire(s: SharedSnapshot): Wire {
  const keys = s.columns.map((c) => c.key);
  return [
    1,
    s.title,
    s.subtitle,
    s.columns.map((c) => [c.key, c.label, c.kind]),
    s.rows.map((r) => keys.map((k) => r[k] ?? null)),
    s.totals ? keys.map((k) => s.totals![k] ?? null) : 0,
    s.highlights.map((h) => [h.label, h.value]),
    s.recordCount,
    s.sharedAt,
    s.expiresAt ?? 0,
    s.notes ?? "",
    s.from ?? "",
  ];
}

function fromWire(w: Wire): SharedSnapshot {
  if (!Array.isArray(w) || w[0] !== 1) throw new Error("Unsupported link version");
  const columns = w[3].map(([key, label, kind]) => ({ key, label, kind })) as Column[];
  const toRow = (cells: (string | number | null)[]): Row => Object.fromEntries(columns.map((c, i) => [c.key, cells[i] ?? null]));
  return {
    v: 1,
    title: w[1],
    subtitle: w[2],
    columns,
    rows: w[4].map(toRow),
    totals: w[5] ? toRow(w[5]) : undefined,
    highlights: w[6].map(([label, value]) => ({ label, value })),
    recordCount: w[7],
    sharedAt: w[8],
    expiresAt: w[9] || null,
    notes: w[10] || undefined,
    from: w[11] || undefined,
  };
}

// --- base64url

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/** Payload prefix: "z" = deflate-raw compressed JSON, "j" = plain JSON. */
export async function encodeSnapshot(s: SharedSnapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(s)));
  if (canCompress()) return "z" + bytesToB64url(await pipe(json, new CompressionStream("deflate-raw")));
  return "j" + bytesToB64url(json);
}

export async function decodeSnapshot(payload: string): Promise<SharedSnapshot> {
  const kind = payload[0];
  let bytes = b64urlToBytes(payload.slice(1));
  if (kind === "z") {
    if (!canCompress()) throw new Error("This browser can't open compressed share links.");
    bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  } else if (kind !== "j") throw new Error("Malformed link");
  return fromWire(JSON.parse(new TextDecoder().decode(bytes)) as Wire);
}

export function snapshotFromReport(model: ReportModel, opts: { expiresInDays: number | null; from?: string; now?: Date }): SharedSnapshot {
  const now = opts.now ?? new Date();
  return {
    v: 1,
    title: model.title,
    subtitle: model.subtitle,
    columns: model.columns,
    rows: model.rows,
    totals: model.totals,
    highlights: model.highlights,
    recordCount: model.recordCount,
    notes: model.notes,
    sharedAt: now.toISOString(),
    expiresAt: opts.expiresInDays ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString() : null,
    from: opts.from,
  };
}

export const buildShareUrl = (origin: string, payload: string) => `${origin}/shared#${payload}`;
