# CSV Export: Implementation

> **Type:** Frontend  ·  **Last updated:** 2026-11-22  ·  **Introduced in:** `1b7455a` Initial expense tracker implementation
> **User guide:** [How to export expenses to CSV](../user/how-to-export-expenses-to-csv.md)

## Overview
The **Export CSV** button on `/expenses` downloads the expenses currently shown in the list, after search, category, date-range filters and sort order are applied, as a `.csv` file. It runs entirely in the browser: the list is serialised to a string, wrapped in a `Blob` and downloaded through a temporary `<a download>` link. There is no server involved. The main design choice is that it exports **what you see, not everything you have**. Clear the filters to export the full dataset.

## Files
| File | Role |
|---|---|
| `src/lib/csv.ts` | Serialisation (`expensesToCSV`), cell escaping (`escapeCell`) and the browser download (`downloadCSV`) |
| `src/app/expenses/page.tsx` | The **Export CSV** button, its disabled state, `handleExport` and the result toasts |
| `src/lib/analytics.ts` | `filterExpenses`, which produces the list that gets exported |
| `src/hooks/useExpenses.tsx` | Owns the expense list and `isLoading`; keeps it sorted newest first |
| `src/hooks/useToast.tsx` | Success/error toasts shown after export |
| `src/types/expense.ts` | `Expense` and `ExpenseFilters` types |

## Architecture
```
ExpensesPage
  filters (useState) + sort (useState) + expenses (useExpenses)
      └─ useMemo ─▶ filtered = sort(filterExpenses(expenses, filters))     src/app/expenses/page.tsx:28
                                                                          
"Export CSV" ──onClick──▶ handleExport()                                  src/app/expenses/page.tsx:37
                            ├─ filtered.length === 0 → toast "Nothing to export" (error)
                            └─ try downloadCSV(filtered)                  src/lib/csv.ts:16
                                 ├─ expensesToCSV(filtered)               src/lib/csv.ts:10
                                 │    └─ escapeCell per cell              src/lib/csv.ts:3
                                 ├─ Blob(["﻿" + csv], text/csv;charset=utf-8)
                                 ├─ URL.createObjectURL → <a download> click → remove
                                 └─ setTimeout(revokeObjectURL, 0)
                               ├─ ok    → toast "Exported N expense(s) to CSV" (success)
                               └─ throw → toast "Export failed. Please try again." (error)
```

## Component tree
```
RootLayout → Providers (ExpensesProvider, ToastProvider, ExpenseModalProvider)
  └─ ExpensesPage                      src/app/expenses/page.tsx
       ├─ header: "Clear all" button, "Export CSV" button
       ├─ FilterBar                    src/components/FilterBar.tsx   (feeds `filters`)
       ├─ sort <select>                                               (feeds `sort`)
       └─ ExpenseList                                                 (renders the same `filtered` list)
```
The export has no component of its own. It is a button in the page header.

## State & data flow
- **Source data:** `useExpenses().expenses`, held in React context and persisted to `localStorage["expense-tracker:v1"]`. The provider always stores it sorted newest first (`sortExpenses`, `src/hooks/useExpenses.tsx:34`).
- **Filter and sort state:** local `useState` in `ExpensesPage` (`src/app/expenses/page.tsx:24-25`). It is not in the URL and not persisted, so it resets when you leave the page.
- **Exported list:** `filtered` (`src/app/expenses/page.tsx:28-35`) is the same memoised array that `ExpenseList` renders, so the file always matches the screen, row order included. "Oldest first" works by `reverse()` on the already newest-first list.
- Exporting changes no state. It only triggers a download and a toast.

## Props / hook API
`src/lib/csv.ts` exports:

| Name | Signature | Description |
|---|---|---|
| `expensesToCSV` | `(expenses: Expense[]) => string` | Header row plus one row per expense, joined with `\r\n`. No BOM. |
| `downloadCSV` | `(expenses: Expense[], filename?: string) => void` | Builds the CSV, prepends a UTF-8 BOM and starts a browser download. Default filename `expenses-YYYY-MM-DD.csv`. Throws if the browser APIs throw; the caller handles it. |

`escapeCell(value: string): string` is module-private.

## Data model
Output columns, in order (`src/lib/csv.ts:11-12`):

| Column | Source | Format |
|---|---|---|
| `Date` | `expense.date` | `YYYY-MM-DD` as stored |
| `Category` | `expense.category` | One of `Food`, `Transportation`, `Entertainment`, `Shopping`, `Bills`, `Other` |
| `Description` | `expense.description` | Free text (max 120 chars per form validation), escaped |
| `Amount` | `expense.amount.toFixed(2)` | Plain decimal, no currency symbol or thousands separator |

`id`, `createdAt` and `updatedAt` are not exported. File encoding: UTF-8 with BOM, CRLF line endings, comma delimiter, MIME type `text/csv;charset=utf-8`. No storage keys or schema are changed.

## Validation & error handling
- The button is `disabled` while loading or when `filtered` is empty (`src/app/expenses/page.tsx:60`).
- `handleExport` also guards empty lists with a "Nothing to export" error toast (`:38`). Because the button is disabled in that case, this branch is a defensive fallback that normal clicks can't reach.
- Any exception from `downloadCSV` is caught and shown as "Export failed. Please try again." (`:42-43`).
- A browser that silently blocks the download (no exception) will still show the success toast.

## Browser APIs & storage
`Blob`, `URL.createObjectURL` / `URL.revokeObjectURL`, `document.createElement("a")` with the `download` attribute. The object URL is revoked on the next tick after the click. It reads the in-memory list only and never touches `localStorage` directly.

## Accessibility & responsive behaviour
- The button is a native `<button>` with the visible text "Export CSV", so it is keyboard-focusable and named for screen readers. The download icon `<svg>` has no `aria-hidden`; adding it would keep screen readers from trying to announce the icon.
- Toasts render in an `aria-live="polite"` region with `role="status"` (`src/hooks/useToast.tsx:44,50`), so the result is announced.
- Header actions sit in a `flex flex-wrap` row, so on narrow screens the buttons wrap under the title. The export works the same whether the list shows as a table (≥ `md`) or as cards (mobile).

## Security considerations
- **CSV/formula injection:** any cell starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `'` (`src/lib/csv.ts:5`), so spreadsheets treat it as text instead of running a formula.
- **Quoting:** cells containing `"`, `,`, `\n` or `\r` are wrapped in double quotes, with inner quotes doubled (RFC 4180 style, `:6`).
- Data never leaves the device. The file is generated locally.

## Testing
Automated tests: **none**. The project has no test runner configured.

Manual check:
1. `npm install && npm run dev`, then open `http://localhost:3000/expenses`.
2. With no data, confirm **Export CSV** is disabled.
3. Click **Load sample data**, then **Export CSV**. Expect a toast "Exported 45 expenses to CSV" and a file `expenses-<date>.csv`.
4. Open the file in Excel or a text editor. Check the header `Date,Category,Description,Amount`, that row order matches the screen, and that amounts have 2 decimals.
5. Choose a category filter and **Oldest first**, then export again. The file should contain only that category in ascending date order.
6. Add an expense with description `=1+1, "quoted"` and export. The cell should read `'=1+1, "quoted"` as text.

Static checks: `npm run typecheck`, `npm run lint`.

## Extending it
- **Add or reorder a column:** edit `header` and the row array in `expensesToCSV` (`src/lib/csv.ts:11-12`). This changes the file format for anyone parsing exports by column position.
- **Change the filename:** pass a `filename` to `downloadCSV` from `handleExport`, e.g. one that includes the active filters.
- **Another format (JSON, TSV…):** add a sibling serialiser and reuse `escapeCell` (export it) for any delimiter-based format.
- **Export from another page:** call `downloadCSV(list)` and wrap it in the same try/catch plus toast pattern as `handleExport`.

## Open questions / known limitations
- **Filename date is UTC.** `new Date().toISOString().slice(0, 10)` (`src/lib/csv.ts:16`) can be a day ahead of or behind the user's local date near midnight. It is unclear whether that is intended.
- **Amounts have no currency.** The UI formats amounts with `formatCurrency`, but the CSV has bare numbers. The currency is not recorded in the file.
- **Success toast can be wrong.** If the browser blocks the download without throwing, the user still sees "Exported N expenses…".
- **"Nothing to export" toast can't be reached** through the UI (see Validation). Keep it as a guard or remove it.
- **The export only exists on `/expenses`.** The dashboard has none. `code-analysis.md` reviews three branches that each add a dashboard export alongside this one.

## Related
- [How to export expenses to CSV](../user/how-to-export-expenses-to-csv.md): end-user guide for this feature
- [README](../../README.md): project overview, features and scripts
- [Data Export: Code Analysis of v1, v2 and v3](../../code-analysis.md): review of three proposed export branches that build on `src/lib/csv.ts`, including a column-order change that would affect this export
