# Data Export: Code Analysis of v1, v2 and v3

**Scope:** `feature-data-export-v1`, `feature-data-export-v2` and `feature-data-export-v3`, each compared against `master` (`1b7455a`, "Initial expense tracker implementation").
**Method:** I checked out each branch, read every file it adds or changes, and ran `tsc --noEmit` and `next lint` on it. I also ran the export code for v2 (PDF/CSV) and v3 (CSV escaping, share-link size, QR limits) outside the browser to check the claims below.
**Date:** 2026-11-21

---

## 0. Baseline context (what all three branches start from)

These facts about `master` matter for how each branch should be judged:

- **Stack:** Next.js 14.2 (App Router), React 18.3, TypeScript 5.7, Tailwind 3.4. **No runtime dependencies beyond `next`/`react`/`react-dom`.** None of the three branches adds a dependency. Every format writer (CSV, JSON, PDF, QR, compression) is written by hand or uses a built-in browser API.
- **Data:** `Expense { id, date (YYYY-MM-DD), amount (float), category (6 fixed values), description, createdAt, updatedAt }`, held in a React context (`useExpenses`) and saved to `localStorage["expense-tracker:v1"]`. There is no backend.
- **An export already exists.** `src/lib/csv.ts` provides `expensesToCSV`/`downloadCSV`, with formula-injection escaping (`escapeCell`), a UTF-8 BOM and CRLF line endings. `/expenses` already has an **"Export CSV"** button that exports the *currently filtered* list and shows a toast. Every branch adds its export *on the dashboard*, and **none of them removes or merges with this existing button.**

| | v1 | v2 | v3 |
|---|---|---|---|
| Files changed | 2 | 16 (13 new) | 20 (16 new) |
| Lines added / removed | +16 / −5 | +1,264 / −5 | +3,194 / −7 |
| New npm dependencies | 0 | 0 | 0 |
| `tsc` errors (src) | 0 | 0 | 0 |
| ESLint warnings | 0 | 0 | 0 |
| Automated tests added | 0 | 0 | 0 |
| Formats | CSV | CSV, JSON, PDF | CSV, JSON, TSV, Markdown (+ share link, QR, clipboard, mailto) |
| Filtering | none (exports everything) | date range + presets, categories | fixed report templates + period picker |
| Real vs simulated | real | real | partly real (download/link/clipboard/mailto); **email, Drive, Dropbox, OneDrive, Sheets, "Spendwise Cloud" and schedules are simulated** |

---

## 1. Version 1: one-button CSV export

### 1.1 Files created/modified
| File | Change |
|---|---|
| `src/app/page.tsx` | Adds an "Export Data" button to the dashboard header; imports `downloadCSV` |
| `src/lib/csv.ts` | **Reorders the CSV columns** from `Date, Category, Description, Amount` to `Date, Category, Amount, Description` |

### 1.2 Architecture overview
There is no new architecture. The button calls the existing `downloadCSV(expenses)` directly:

```
DashboardPage ──onClick──▶ downloadCSV(expenses)  (src/lib/csv.ts, pre-existing)
                             ├─ expensesToCSV → escapeCell per cell
                             └─ Blob → object URL → <a download> click → revoke
```

### 1.3 Key components
- **Dashboard header button:** `disabled={isLoading || expenses.length === 0}`, styled with `btn-secondary`.
- **`lib/csv.ts`:** serialisation and download, unchanged apart from the column order.

### 1.4 Libraries and dependencies
None. It uses `Blob`, `URL.createObjectURL` and a synthetic anchor click.

### 1.5 Implementation patterns
Direct function call from an event handler. No state, no abstraction, and it reuses existing code.

### 1.6 Complexity
Trivial. Cyclomatic complexity about 1 and 11 net lines.

### 1.7 Error handling
- Inherits `downloadCSV`'s behaviour, which has **no try/catch**. A failure (for example, a blocked download) throws inside the click handler and the user gets no message.
- **No success feedback.** The `/expenses` export shows a toast ("Exported N expenses to CSV"); the dashboard one is silent.
- The empty/loading state is handled by disabling the button.

### 1.8 Security
- Formula-injection protection is kept: `escapeCell` prefixes `= + - @ \t \r` with `'`.
- The UTF-8 BOM and RFC 4180 quoting are kept.
- Internal fields (`id`, timestamps) are not exported.

### 1.9 Performance
O(n) string building on the main thread. This is fine for any realistic personal dataset (10k rows is well under 100 ms).

### 1.10 Extensibility and maintainability
- Very easy to read. There is almost nothing to maintain.
- **Side effect to watch:** the column reorder lives in the *shared* `expensesToCSV`, so it **silently changes the format of the existing `/expenses` "Export CSV" button too**. Anyone with a spreadsheet or script that reads that file by column position would break. It is a small change, but it is a breaking change to an existing output.
- Functionally it **duplicates** the `/expenses` export but with *less* capability: it ignores filters, gives no toast, and shows no record count.

### 1.11 Technical deep dive
| Question | Answer |
|---|---|
| How does export work? | Synchronous `expensesToCSV` → `Blob` (with BOM) → object URL → anchor click → `revokeObjectURL` on the next tick |
| File generation | String concatenation, CRLF, BOM, quoting and escaping per cell |
| User interaction | One click, no options, no confirmation, no feedback |
| State management | None (reads `expenses` from `useExpenses`) |
| Edge cases | Empty list → button disabled. Loading → disabled. Commas, quotes and newlines in descriptions → quoted. Formula prefixes → neutralised. `revokeObjectURL` runs after `setTimeout(0)`, which has occasionally been reported to cancel downloads in older Safari (v2 and v3 use 1000 ms) |

---

## 2. Version 2: advanced export drawer (CSV / JSON / PDF + filtering)

### 2.1 Files created/modified
| File | Lines | Role |
|---|---|---|
| `src/app/page.tsx` | ~23 | "Export…" button + `<ExportDrawer>` mount, `exportOpen` state |
| `src/components/Drawer.tsx` | 89 | **New generic** slide-over: focus trap, Escape, scroll lock, ARIA dialog |
| `src/components/export/ExportDrawer.tsx` | 113 | Composes drawer, options, preview and footer; export button state machine |
| `src/components/export/ExportOptions.tsx` | 215 | Four-step form: format, date range (with presets), categories, file name |
| `src/components/export/ExportPreview.tsx` | 180 | Summary stats, category share bar, table preview, source/PDF preview |
| `src/components/export/useExportController.ts` | 127 | `useReducer` draft, validation, derived dataset, async `runExport` |
| `src/lib/export/types.ts` | 51 | `ExportCriteria`, `ExportRecord`, `ExportDataset`, `ExportFormat` interface |
| `src/lib/export/index.ts` | 17 | Format registry (`EXPORT_FORMATS`, `FORMAT_ORDER`) and re-exports |
| `src/lib/export/dataset.ts` | 55 | Filtering, sorting, totals summed in integer cents, per-category counts |
| `src/lib/export/download.ts` | 14 | Blob/anchor download helper |
| `src/lib/export/filename.ts` | 22 | Filename validation, extension handling, suggestion from range |
| `src/lib/export/formats/csv.ts` | 17 | CSV writer (reuses `escapeCell`) |
| `src/lib/export/formats/json.ts` | 31 | JSON with `meta`, `summary` and `expenses` |
| `src/lib/export/formats/pdf.ts` | 311 | **Hand-written PDF 1.4 writer** with layout engine |
| `src/lib/csv.ts` | 1 | `escapeCell` is now exported |
| `tailwind.config.ts` | 2 | `drawer-in` keyframe/animation |

### 2.2 Architecture overview
This is a clean **layered design** with a pure domain core and a thin UI:

```
UI layer (components/export)
  ExportDrawer ── uses ──▶ useExportController (reducer + derived state + side effect)
     ├─ ExportOptions  (dispatches actions)
     └─ ExportPreview  (reads dataset/format)
                │
Domain layer (lib/export) — pure, framework-free, testable
  buildDataset(expenses, criteria) ─▶ ExportDataset (records + aggregates)
  EXPORT_FORMATS[id].serialize(dataset, ctx) ─▶ string | Uint8Array
  downloadFile(data, mime, filename)
```

The key abstraction is the **`ExportFormat` strategy interface** (`id, label, extension, mime, tagline, serialize`). Adding a format means writing one file and adding one registry entry. The UI picks up label, tagline, extension and preview automatically.

### 2.3 Key components and responsibilities
- **`useExportController`:** the single source of truth for the drawer.
  - Draft state through `useReducer`, with actions `format | range | toggleCategory | categories | filename | reset`.
  - The filename is suggested automatically from the date range until the user edits it (`filenameEdited` flag).
  - Categories always stay in canonical order.
  - Derived, memoised `dataset` and `categoryCounts`.
  - `errors` object (range, categories, filename) and a `canExport` gate.
  - `runExport`: `idle → preparing → success → idle` (or `error`), with a 450 ms minimum busy time so the spinner doesn't flicker, `requestAnimationFrame` so the spinner paints before synchronous work, and an `isMounted` guard.
- **`Drawer`:** reusable accessible modal panel with `role="dialog"`, `aria-modal`, `aria-labelledby`/`describedby`, a Tab/Shift-Tab focus trap, Escape, focus restore and body scroll lock. This is better accessibility than the existing `Modal` (which has no focus trap).
- **`ExportOptions`:** fieldset/legend sections. Formats are a radio group of styled cards. Six date presets (All time, This month, Last month, Last 90 days, YTD, Last year). Category toggles use `role="checkbox"` and show live counts that respect the date range.
- **`ExportPreview`:** stat tiles, a stacked share bar, a **table preview** (first 100 rows, sticky header and footer total) and a **file preview**. The file preview shows the real serialised output for CSV/JSON (first 40 records) and a **live PDF rendered into an `<iframe>`** from a blob URL, debounced by 250 ms.
- **`pdf.ts`:** a small PDF engine:
  - Built-in Helvetica / Helvetica-Bold (no font embedding) with WinAnsi encoding.
  - A width table for text measurement, used for right alignment and ellipsis truncation (`fitText`).
  - A `Page` class that collects content-stream operators (`text`, `rect`, `line`).
  - Flowing layout: title block, three summary tiles, category bar chart, then a striped transactions table that repeats its header on page breaks and ends with a grand total.
  - Footers ("Page i of N") are added in a second pass once the page count is known.
  - Hand-written object table, xref and trailer. Byte offsets are correct because each character is one byte.

### 2.4 Libraries and dependencies
None added. Browser APIs only: `Blob`, `URL.createObjectURL`, `<iframe>` PDF viewer, `requestAnimationFrame`, `performance.now`. The PDF writer replaces what would usually be `jspdf`/`pdf-lib` (about 100–300 KB). That is a deliberate trade: smaller bundle, more code to own.

### 2.5 Implementation patterns
- Strategy pattern plus registry for formats.
- Reducer plus a "controller" custom hook (a headless UI pattern). Components receive a single `ctl` object.
- Pure domain functions, separate from React. The domain layer imports with relative paths, not `@/`, so it can run in plain Node or tests.
- Derived state with `useMemo` instead of duplicated state.
- Money summed in **integer cents** to avoid float drift (`0.1 + 0.2`).
- Export record allow-list (`ExportRecord` excludes `id`, `createdAt`, `updatedAt`).

### 2.6 Complexity
Moderate and well contained. The only file with real complexity is `pdf.ts` (311 lines, low-level). Everything else is short, single-purpose and easy to follow. The UI files are long mainly because of Tailwind markup.

### 2.7 Error handling
- **Validation before export:** invalid range (from > to), no categories, and filename rules (empty, illegal characters `\ / : * ? " < > |` plus control characters, more than 120 characters, dots only). Errors show inline with `role="alert"`, and the button is disabled through `canExport`.
- `dataset.count === 0` → "Nothing to export" empty state with a reason, and the button is disabled.
- `runExport` wraps serialisation and download in try/catch, logs to the console, shows an error toast and sets status `error`.
- An unmount guard prevents `setState` after the drawer closes.
- Gaps:
  - Escape and backdrop-click close the drawer *during* `preparing`. The guard makes this harmless, but the download still fires after close.
  - The `error` status is never visibly distinguished in the button (it falls back to the default label).

### 2.8 Security
- CSV keeps `escapeCell` (formula-injection safe) and reuses the same function instead of copying it.
- Filenames are validated and the extension is enforced, which prevents odd names. The browser sanitises download names anyway.
- Internal IDs and timestamps are deliberately left out.
- The PDF writer escapes `\`, `(`, `)` in literal strings, so user text cannot inject PDF operators.
- The `<iframe>` only loads a same-origin `blob:` URL created by the app.
- All processing happens on the device. No data leaves the browser.

### 2.9 Performance
- `buildDataset` and `countByCategory` run on every `expenses` change **even while the drawer is closed**. `ExportDrawer` is always mounted; only `Drawer` returns `null`. The cost is O(n), so this is negligible at personal scale but wasted work.
- **The PDF preview regenerates the *whole* document** (all rows) 250 ms after each filter change. In a quick check, 120 rows produced a 4-page PDF with no noticeable delay. At thousands of rows it becomes a main-thread cost on every click; the debounce helps but there is no row cap for the preview.
- The table preview is capped at 100 rows and the source preview at 40 records, which is sensible.
- All serialisation is synchronous on the main thread. There is no Web Worker.

### 2.10 Extensibility and maintainability
- **Strongest of the three.** New formats (XLSX, TSV, Markdown) slot into the registry. `ExportDataset` is a reusable "what to export" model that v3's destinations could use directly.
- `Drawer` is a reusable component.
- Risks:
  - The **hand-written PDF writer** is owned code: font metrics are approximate, there is no Unicode support (below) and there are no tests.
  - It leaves **two CSV paths with different column orders**: `/expenses` still uses `lib/csv.ts` (`Date, Category, Description, Amount`), while the drawer uses `Date, Category, Amount, Description`. The same app produces two CSV layouts.
  - `currency: "USD"` is hard-coded in the JSON.
  - The PDF footer says "Expense Tracker" while the app is branded "Spendwise".

### 2.11 Technical deep dive
| Question | Answer |
|---|---|
| How does export work? | Draft (reducer) → memoised `buildDataset` (filter by category set and inclusive ISO date strings, map to an allow-listed record, sort ascending, aggregate in cents) → `format.serialize` → `downloadFile` |
| File generation | **CSV:** BOM + CRLF + `escapeCell`. **JSON:** pretty-printed `{ meta: { generatedAt, filters, recordCount, total, currency }, summary: byCategory[], expenses[] }`. **PDF:** custom layout engine → content streams → objects/xref/trailer → `Uint8Array`. Checked: a 120-row export produced a valid 4-page PDF; all 13 xref offsets and every stream `/Length` were correct |
| User interaction | Button → right-side drawer with a four-step form beside a live preview. The footer shows a live "N records · $total · FORMAT" summary, "Reset options", and a stateful Export button (spinner → "Downloaded" ✓). A success toast is shown |
| State management | Local `useReducer` inside a controller hook. The draft persists across open/close because the hook stays mounted. Derived data via `useMemo`. Ephemeral `status` via `useState`. No global state |
| Edge cases | from > to → error, and the dataset is forced empty. Zero categories → error. Zero matches → empty state. Filename with typed extension → not doubled. Description empty → "—" in the PDF. Long text → ellipsis in the PDF. Page breaks repeat the table header. **Non-Latin text in the PDF becomes `?` and emoji are dropped.** Verified: `"Café (lunch) \ ১০০ টাকা 🍔"` renders as `Café (lunch) \ ??? ????`. CSV/JSON are UTF-8 and unaffected |

---

## 3. Version 3: cloud "Export Hub" (sharing, schedules, integrations)

### 3.1 Files created/modified
| File | Lines | Role |
|---|---|---|
| `src/app/exports/page.tsx` + `layout.tsx` | 294 + 7 | New **/exports** route: status cards, suggestions, template gallery, tabbed panels |
| `src/app/shared/page.tsx` + `layout.tsx` | 90 + 7 | New **/shared** read-only viewer that decodes the report from the URL fragment (`noindex`) |
| `src/app/providers.tsx` | 7 | Wraps the app in `CloudProvider`; mounts the global `ActivityTray` |
| `src/app/page.tsx` | 14 | Dashboard "Export & share" link to `/exports` |
| `src/components/Navbar.tsx` | 7 | "Export Hub" nav link + `SyncPill` status indicator |
| `src/components/Modal.tsx` | 4 | Adds `size="lg"` |
| `src/hooks/useCloud.tsx` | 369 | **Global cloud context:** connections, history, schedules, shares, background jobs, scheduler |
| `src/components/cloud/ExportComposer.tsx` | 543 | Three-step wizard (Report → Destination → Send) with per-destination forms |
| `src/components/cloud/HubPanels.tsx` | 356 | Connections, Schedules, History and Shared-links panels |
| `src/components/cloud/ScheduleEditor.tsx` | 191 | Create/edit recurring exports |
| `src/components/cloud/ConnectDialog.tsx` | 103 | **Mock OAuth consent screen** (email field, scopes) |
| `src/components/cloud/ActivityTray.tsx` | 68 | Floating job-progress tray + navbar `SyncPill` |
| `src/components/cloud/ui.tsx` | 241 | Shared UI: tiles, badges, `CopyButton`, `QRCode`, `ReportTable`, `SpreadsheetMock`, `Toggle`, `downloadText` |
| `src/lib/cloud/report.ts` | 400 | Templates → `ReportModel` (a table model), privacy transforms, CSV/TSV/Markdown/JSON serialisers |
| `src/lib/cloud/share.ts` | 121 | Snapshot ↔ compact wire format ↔ deflate-raw ↔ base64url for share URLs |
| `src/lib/cloud/qr.ts` | 283 | **Hand-written QR encoder** (byte mode, ECC level L, versions 1–40, Reed–Solomon, masking) |
| `src/lib/cloud/schedule.ts` | 60 | Schedule timing, `nextRun`, `isDue`, relative-time formatting |
| `src/lib/cloud/destinations.ts` | 36 | Destination registry with `kind: "real" | "simulated"` |

### 3.2 Architecture overview
This is a **product-scale feature**. It adds a new route, a global provider, a persisted store and a simulated job runner:

```
Providers
 └─ CloudProvider (useCloud) ── persisted to localStorage["spendwise-cloud:v1"]
      state: connections · history(≤60) · schedules · shares
      runtime: jobs[] (in-memory), `now` ticker (150 ms while jobs run, 30 s idle)
      scheduler: setInterval 30 s → isDue() → queueExport()
      │
      ├─ /exports  ExportHubPage
      │     ├─ StatusCards, Suggestions, Template gallery
      │     ├─ Tabs: ConnectionsPanel · SchedulesPanel(+ScheduleEditor) · HistoryPanel · SharesPanel
      │     └─ ExportComposer (wizard) ─▶ ConnectDialog
      ├─ ActivityTray (global, bottom-left)  ·  SyncPill (navbar)
      └─ /shared  SharedReportPage (stand-alone; decodes location.hash)

Domain (lib/cloud)
  buildReport(expenses, template, period) ─▶ ReportModel {columns, rows, totals, highlights}
  applyPrivacy(model, {hideDescriptions, roundAmounts})
  FILE_FORMATS[fmt].serialize(model) ─▶ string
  encodeSnapshot(model) ─▶ "z" + base64url(deflate-raw(JSON(wire)))  → /shared#…
  encodeQR(url) ─▶ boolean[][]
```

The central abstraction is the **`ReportModel` table model**: typed columns (`text | money | percent | date | count | delta`), rows, totals and highlights. Every output (file, table preview, spreadsheet mock, share link, Markdown, email summary) renders from this one model. That design works well and is more flexible than v2's flat record list for *reports*.

### 3.3 Key components and responsibilities
- **Templates** (`report.ts`) are purpose-built reports rather than raw exports:
  - *Tax Report:* yearly, itemised and grouped by category with interleaved subtotal rows and an annual total.
  - *Monthly Summary:* category totals vs. the previous month, % change, top 5.
  - *Category Analysis:* share, count, average, per-month average, largest purchase.
  - *Full Backup:* every field, including IDs and timestamps.
- **Destinations** (`destinations.ts`), each explicitly tagged:
  - **Real:** Download, Share link (+QR), Copy for apps (Markdown/TSV to clipboard), and "Open in my email app" (`mailto:`).
  - **Simulated:** Email, Google Sheets, Google Drive, Dropbox, OneDrive and Spendwise Cloud. These show a fake progress job, write a history entry and fire a toast. **No data goes anywhere.**
- **`useCloud`:**
  - Persistence and cross-tab sync. The storage key is deliberately not prefixed `expense-tracker:` so it doesn't trigger the expenses reload; the code comments on this.
  - Background job simulation (duration scales with payload, 2.4–6 s; stages queued → preparing → transferring → done).
  - Scheduler that catches up once on load.
  - Disconnecting a destination pauses its schedules.
  - Editing or enabling a schedule restarts its clock so it doesn't fire immediately for a missed slot.
- **`ExportComposer`:** a three-step wizard. Its forms change per destination: privacy toggles, expiry and "from" for links; recipients, subject, message and attachment format for email; sheet name and "keep in sync" for Sheets; folder for drives.
- **Share links** (`share.ts`): "serverless" sharing. The snapshot is compressed into the **URL fragment**, which is never sent to a server, and decoded on `/shared`. It has optional expiry, an optional "shared by" name, and privacy transforms (drop descriptions/IDs/"largest", round amounts).
- **`qr.ts`:** an ISO/IEC 18004 encoder modelled on Project Nayuki's reference implementation. It renders as SVG and can be downloaded as SVG.

### 3.4 Libraries and dependencies
None added. Browser APIs: `CompressionStream`/`DecompressionStream("deflate-raw")` (with an uncompressed `"j"` fallback), `TextEncoder`, `btoa`/`atob`, `navigator.clipboard`, `Intl.RelativeTimeFormat`, `mailto:`, `history.replaceState`, `localStorage` and `storage` events. QR generation replaces `qrcode` (about 30 KB) with 283 lines of owned code.

### 3.5 Implementation patterns
- Global context store with `useState` and many `useCallback` actions (a hand-rolled Redux-like store).
- Registry objects for templates, destinations and formats.
- Table model + renderers (one model, many views).
- Simulated async jobs driven by a polling interval and a time-based progress function (`jobProgress`).
- A compact positional wire format for URL payloads.
- **Honesty markers:** a "Demo" badge on simulated destinations, a "Preview build" banner on `/exports`, and copy explaining that removing a share link cannot recall copies already sent.

### 3.6 Complexity
High. This is about 2.5× v2's code and 200× v1's. There is much more cross-component coupling through `useCloud` (the hub page, composer, panels, tray, navbar and schedule editor all read the same context). `ExportComposer` alone is 543 lines with roughly 20 `useState` hooks and a large destination `switch`. Two low-level algorithm files (`qr.ts`, the share codec) need specialist knowledge to maintain, and neither has tests.

### 3.7 Error handling
Done well:
- `load()` from localStorage is wrapped in try/catch and falls back to empty.
- Saving swallows quota errors ("hub still works for this session").
- The share page handles missing payloads, bad base64/deflate/JSON (caught → "link looks incomplete or damaged"), an unsupported version and expired links (with a friendly message naming the sender).
- `QRCode` catches "data too long" and suggests "Hide descriptions".
- `CopyButton` handles a blocked clipboard ("Copy blocked").
- Email and schedule inputs are validated, and connections are required before export or scheduling.

Gaps:
- **No schema validation of persisted cloud state.** Arrays are checked with `Array.isArray`, but item shapes are trusted. Compare `storage.ts`'s `isExpense` guard on master. A corrupted entry with an unknown `templateId` or `destination` would crash render (`TEMPLATES[undefined].name`).
- `fromWire` validates only the version and array structure. A crafted link with object-valued cells passes decoding and then throws during render ("Objects are not valid as a React child"), which reaches `error.tsx` instead of the friendly error state.
- In the `email` path, `await makeLink()` has no try/catch (unlike the `link` path).
- Job completion runs from a 150 ms interval whose closure holds `jobs`. If a re-render is slower than one tick, a finished job could be recorded twice (duplicate history entry and toast). The risk is low but the design is fragile.

### 3.8 Security and privacy
This is the area that needs the most attention before adopting v3.

1. **Share links are bearer tokens that cannot be revoked and carry the full data.**
   - Anyone holding the URL can read the report.
   - "Remove" only deletes it from the local list. The UI says this honestly.
   - **Expiry is checked only in the viewer** (`snap.expiresAt < now`). A recipient can decode the fragment, or just edit `expiresAt`, and read expired data. Treat expiry as a hint, not access control.
   - URLs end up in browser history, chat-app link previews, email archives and screenshots of QR codes.
   - "Full Backup" shared without "Hide descriptions" includes every description, ID and timestamp.
2. **Spoofable "official-looking" pages.** `/shared` shows any payload under the app's branding with "🔒 Read-only snapshot" and "Shared by {from}". Anyone can craft a link with arbitrary title, notes, figures and sender name. Rendering is safe (React escapes everything, so this is not XSS), but this content could be used for social engineering.
3. **CSV formula-injection regression.** v3 writes its own `csvEscape` instead of reusing `escapeCell`, and adds an exemption: `&& !/^-?\d/.test(value)`. The exemption is meant to leave negative numbers alone, but it applies to *all* cells, including descriptions. **Verified:** a description `-2+3+cmd|' /C calc'!A0` is escaped by master's `escapeCell` but **passes through unescaped** in v3's CSV.
4. **TSV / "Copy as cells" has no formula neutralisation at all.** A description such as `=IMPORTXML(...)` pasted into Google Sheets becomes a live formula.
5. **Misleading data-safety claims.** The "Your data isn't backed up → Turn on backups" suggestion creates a weekly schedule to the *simulated* Spendwise Cloud. History then shows "completed" backups and a storage meter ("x KB of 1 GB · N versions"), but **nothing is stored anywhere**. Despite the Demo badge and banner, this could give users false confidence that their data is backed up. The same applies to "Email queued" and "Sheet created" toasts for simulated destinations.
6. **The mock OAuth dialog asks for an account email.** It is only stored locally, but the screen imitates third-party consent flows (Google, Dropbox, Microsoft). Any real implementation must use real OAuth (PKCE) and a backend for token storage. None of that plumbing exists.
7. Positives: the URL fragment really is never sent to the server; `/shared` is `noindex`; no third-party scripts; links use `rel="noreferrer"`.

### 3.9 Performance
- **Re-render pressure:** `now` is part of the context value and ticks **every 150 ms while any job runs** (and every 30 s when idle). Every `useCloud()` consumer re-renders at about 7 Hz during jobs: the hub page, all panels, the composer, the tray and the navbar pill. On each hub-page render:
  - `buildReport` runs **once per template** (4×) for the gallery counts.
  - The `suggestions` memo depends on the whole `cloud` object, so it rebuilds (up to 2 more `buildReport` calls) every tick.
  - Each is O(n) over all expenses, and the tax report is O(n × categories).
- `measure()` serialises the full report just to compute byte size for each queued job.
- **Share-link size grows with the data** (measured with the real code, deflate-raw compressed):

  | Expenses | Tax Report URL | Full Backup URL | QR possible? |
  |---|---|---|---|
  | 20 | 864 chars | 1,387 chars | yes |
  | 100 | 1,932 | 5,252 | Tax yes; Backup **no** |
  | 500 | 6,371 | 23,316 | **no** |
  | 2,000 | 19,862 | 90,667 | **no** |

  URLs over about 2,000 characters are unreliable in `mailto:` bodies (Outlook/Windows truncate), SMS and some chat apps. The share page even predicts this ("may have been cut off when copied").
- **localStorage pressure:** each share URL is saved twice (in `shares[]` and in the history entry's `shareUrl`). A few large links can use a significant part of the roughly 5 MB origin quota, which is **shared with the expenses store**. When it fills, the *expenses* save fails ("Couldn't save changes"), while the cloud store fails silently.
- The scheduler only runs while a tab is open, and runs in *every* open tab. Two tabs can both queue the same due schedule. `lastRunAt` syncs between tabs through the `storage` event, but only after the first tab has written it.

### 3.10 Extensibility and maintainability
- **Good:** the `ReportModel` + `FILE_FORMATS` + `DESTINATIONS` registries are cleanly extensible. Templates are pure functions. The privacy transform is a single pure function.
- **Harder:**
  - `ExportComposer` is a monolith (per-destination UI and behaviour in one component). It would be better split into one component per destination.
  - `useCloud` mixes persistence, a job runner, a scheduler and domain actions in one provider.
  - Two algorithm files to own (QR, share codec) with no tests.
  - A third CSV implementation and a second download helper (`downloadText`, a near-copy of v2's `downloadFile` and master's `downloadCSV`).
- **Strategic issue:** about 60% of the user-visible surface (cloud destinations, email, Spendwise Cloud, schedules, OAuth) is **UI over simulated behaviour**. Making it real needs things this repo doesn't have: a backend, an auth system, OAuth apps with Google, Dropbox and Microsoft, server-side storage for "Spendwise Cloud", an email provider and a server-side scheduler. The front-end shapes (`ExportRequest`, `Schedule`, `HistoryEntry`) are reasonable contracts for that backend, but the effort is mostly ahead.
- It has no PDF output (v2's main strength).

### 3.11 Technical deep dive
| Question | Answer |
|---|---|
| How does export work? | The composer builds a `ReportModel` from (template, period). Then, by destination: **download** → `FILE_FORMATS[fmt].serialize` → `downloadText` + `recordExport`. **Link** → `applyPrivacy` → `snapshotFromReport` → `encodeSnapshot` (wire tuple → JSON → deflate-raw → base64url) → `/shared#z…`, saved in `shares` and history, QR rendered. **Clipboard** → Markdown/TSV → `navigator.clipboard`. **Simulated destinations** → `queueExport` → in-memory `Job`, progress driven by interval → history entry + toast on completion |
| File generation | String serialisers over the table model. **CSV:** BOM, CRLF, custom `csvEscape`, subtotal and total rows *included as data rows* (convenient for people, awkward to re-import). **TSV:** strips tabs and newlines. **Markdown:** GFM table with alignment and a bold totals row. **JSON:** `{title, period, generatedAt, recordCount, columns, rows, totals}`. No PDF. QR as SVG path |
| User interaction | Hub page (status cards, time-based suggestions such as "Tax season" in Jan–Apr and "Last month closed" on days 1–10, template gallery, tabs) → three-step modal wizard → per-destination form → action. Background jobs appear in a floating tray and a navbar "Syncing…" pill. History can be re-downloaded (regenerated from *current* data, which the UI labels) |
| State management | **Global** `CloudProvider` context, persisted to localStorage with cross-tab `storage` sync. Wizard state is local `useState` (about 20 hooks). Jobs and `now` are in memory |
| Edge cases | Empty dataset → hub empty state. Empty period → "No expenses in this period" and Continue disabled. Monthly "change" when the previous month is 0 → `null`, shown as "new". Months capped at day 28 for schedules. Catch-up after long absence → **one** run, not N. Disconnect → schedules paused. Editing a schedule → clock restarts. `CompressionStream` missing → uncompressed fallback. QR too large → message. Expired link → friendly page. **Not handled:** long URLs truncated by mail clients, multi-tab scheduler races, malformed persisted entries, crafted share payloads with object-valued cells |

---

## 4. Side-by-side comparison

| Dimension | v1 | v2 | v3 |
|---|---|---|---|
| **Value delivered today** | Low: duplicates the existing `/expenses` export, with less capability | **High:** real CSV/JSON/PDF, filtering, preview | Medium-high in its real parts (share link/QR, clipboard, templates); the rest is a demo |
| **Architecture quality** | n/a | **Excellent:** pure domain core, strategy registry, controller hook | Good domain model (`ReportModel`); heavy, coupled UI and global store |
| **Code size / complexity** | 16 lines | 1.26k lines, moderate | 3.2k lines, high |
| **Owned "hard" code** | none | PDF writer (311) | QR encoder (283), share codec (121) |
| **Accessibility** | native button | **Strong:** focus-trapped dialog, ARIA roles, live region | Reasonable (roles, aria-pressed, switches); relies on the existing `Modal`, which has no focus trap |
| **Error handling** | none | Strong validation + try/catch | Broad and user-friendly, but trusts persisted and decoded data |
| **CSV injection safety** | ✅ (shared `escapeCell`) | ✅ (reuses `escapeCell`) | ⚠️ regression (`-digit` bypass); TSV unprotected |
| **Privacy posture** | local file | local file | Bearer links with client-side-only expiry; spoofable share page; simulated "backups" |
| **Performance risk** | none | Full-PDF preview regeneration on filter change | 150 ms context ticks re-running report builds; URL/localStorage growth |
| **Path to production** | Ready (but pointless as is) | **Ready**, after unifying with `/expenses` and adding tests | Needs a backend, auth, OAuth, mail and a scheduler for most features |
| **Breaking changes** | Changes `/expenses` CSV column order | Introduces a second, inconsistent CSV column order | Third CSV implementation, inconsistent with both |
| **Tests** | none | none | none |

---

## 5. Recommendation: adopt v2 as the foundation and pull in v3's real features

**Adopt v2's architecture as the core**, then add the parts of v3 that actually work in the browser. Drop v1 and v3's simulated layer for now.

1. **Base: v2 `lib/export`**, meaning the `ExportFormat` registry, `buildDataset`, the cents-based totals, filename validation and the accessible `Drawer`.
2. **Unify the CSV paths.** Point the `/expenses` "Export CSV" button at the v2 pipeline (or open the drawer pre-filled with the page's current filters). Pick **one** column order and one escaper (`escapeCell`). Delete `downloadCSV`, `downloadText` and the v3 `csvEscape`.
3. **Add v3's formats as v2 strategies:** TSV and Markdown are simple `ExportFormat` entries. Make sure TSV gets formula neutralisation too.
4. **Optionally add v3's templates** as "presets" that produce a richer model. Generalising v2's `ExportDataset` toward v3's `ReportModel` (typed columns + rows + totals) would let the PDF writer render any template.
5. **Add v3's real sharing features with guardrails, only if wanted:**
   - Copy-to-clipboard (Markdown/TSV).
   - Share link + QR, with the size limit enforced up front (for example, block or warn above about 2,000 characters, offer "Hide descriptions", and exclude Full Backup).
   - Explicit copy: "Anyone with this link can see this data; expiry isn't enforced and links can't be revoked."
   - Strict validation in `fromWire` (cell types, column kinds, lengths).
6. **Do not ship the simulated destinations, "Spendwise Cloud" or schedules to end users.** Keep them behind a feature flag or in a design-prototype branch until there is a backend. The "Turn on backups" flow in particular should not ship as is.
7. **Fix before merging, whichever path you choose:**
   - Add unit tests for `buildDataset`, the escapers, the PDF xref and offsets, `encodeQR` against known vectors, and the share round-trip plus malformed input.
   - Cap the PDF preview (for example, the first N rows, or render only on demand).
   - Make the drawer's dataset computation lazy while it's closed.
   - Decide on PDF Unicode support: embed a font subset or accept Latin-only. This matters if users write descriptions in non-Latin scripts.

### Effort estimate (relative)
| Path | Effort | Risk |
|---|---|---|
| Ship v2 + unify CSV | S | Low |
| v2 + v3 formats/templates/clipboard | M | Low |
| v2 + v3 share link/QR with guardrails | M | Medium (privacy wording, link length) |
| Make v3's cloud features real | XL (backend, auth, OAuth apps, mail, scheduler, storage) | High |
