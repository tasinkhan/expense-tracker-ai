# CLAUDE.md

Guidance for Claude Code when working in this repository. Read this before changing code. When this file and the code disagree, trust the code and update this file.

## What this is

**Spendwise** is a personal expense tracker. It is a **client-only** Next.js 14 (App Router) app written in TypeScript and styled with Tailwind. There is **no backend, no API routes, no database and no auth**. All data lives in the browser's `localStorage`.

- Product name in UI copy, page titles and docs: **Spendwise** (titles use the template `"%s · Spendwise"`).
- Currency is **USD** and the locale is **en-US**, both hard-coded in [src/lib/format.ts](src/lib/format.ts).
- The only runtime dependencies are `next`, `react` and `react-dom`. Charts, CSV export and all other UI are hand-written.

## Commands

```bash
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit (strict mode)
npm run lint        # next lint (next/core-web-vitals)
npm run build       # production build; catches server/client boundary and prerender errors
npm start           # serve the production build
```

**There is no test runner on `main` yet.** (Feature branches add `vitest`; see [Branches and parallel work](#branches-and-parallel-work).) Until it lands, "verified" means all of the following:

1. `npm run typecheck` and `npm run lint` are clean. Both pass on `main` today, so keep it that way.
2. `npm run build` succeeds if you touched routes, layouts, providers or `"use client"` boundaries.
3. For UI changes, you ran the app and checked the change in a browser (the `/run` skill can do this), at desktop width and at **375px** phone width.

Do not report a change as done based on typecheck alone if it changes behaviour you could have watched run.

## Architecture

```
src/
  app/                 routes (App Router)
    layout.tsx         root layout: <Providers>, <Navbar>, <main>
    providers.tsx      ToastProvider > ExpensesProvider > ExpenseModalProvider
    page.tsx           "/"         dashboard
    expenses/          "/expenses" list, filters, sort, CSV export, clear all
    insights/          "/insights" monthly donut, top 3 categories, budget streak (in progress, uncommitted)
    error.tsx, not-found.tsx
  components/          presentational and UI pieces (Modal, ConfirmDialog, States, charts, ...)
  hooks/               client state: useExpenses (store), useToast, useExpenseModal, useDeleteExpense
  lib/                 pure logic: storage, analytics, csv, format, categories, sample-data
  types/expense.ts     Expense, ExpenseInput, Category, CATEGORIES, ExpenseFilters
```

### Data flow

- **`useExpenses`** ([src/hooks/useExpenses.tsx](src/hooks/useExpenses.tsx)) is the single source of truth. It loads from storage on mount, saves on every change, and listens for `storage` events to sync across tabs. **All reads and writes of expenses go through this context.** Never call `loadExpenses`/`saveExpenses` or touch `localStorage` for expenses from a component.
- The context keeps the list **sorted by `date` descending, then `createdAt` descending**. Every mutator passes its result through `sortExpenses`. Keep it that way, because pages rely on it (for example, `/expenses` reverses the list to get oldest-first).
- `deleteExpense(id)` returns the removed expense so the caller can offer **Undo** through `restoreExpense`, which does nothing if the id already exists. To delete from the UI, use **`useDeleteExpense`**, which handles the confirmation dialog, the delete and the undo toast. Don't rebuild that flow.
- To add or edit from anywhere, use **`useExpenseModal().openAdd()` / `openEdit(expense)`**. There is one modal, mounted once by the provider.
- **Provider order matters.** `ExpenseModalProvider` uses both toasts and expenses, so it must stay inside both of them.

### Hydration and loading

- The store starts with `isLoading = true` and an empty list, then reads `localStorage` in an effect. Every page must handle **loading → error → empty → data**, in that order, using the shared `Skeleton`, `ErrorBanner` and `EmptyState` from [src/components/States.tsx](src/components/States.tsx). [src/app/insights/page.tsx](src/app/insights/page.tsx) is a minimal, correct example.
- `skipNextSave` stops the store from writing back data it just loaded. It also means **unreadable stored data is never overwritten until the user makes an edit**. Don't "simplify" this away.
- Never read `localStorage`, `window`, `Date.now()` or `Math.random()` during render in a way that would differ between server and client. Do it in effects or event handlers to avoid hydration mismatches.

### Client and server components

- Anything that uses hooks, context or browser APIs needs `"use client"`. In practice every page and most components are client components.
- **Client pages can't export `metadata`.** To give a route a title, add a sibling `layout.tsx` server component that exports `metadata` and returns `children` (see [src/app/expenses/layout.tsx](src/app/expenses/layout.tsx) and [src/app/insights/layout.tsx](src/app/insights/layout.tsx)).
- Use the `@/` path alias (mapped to `src/`) for imports across folders.

## Data model and invariants

These rules are the easiest to break without noticing. Most of them break silently, and only for users who already have data.

### `Expense` ([src/types/expense.ts](src/types/expense.ts))

| Field | Rule |
|---|---|
| `id` | `crypto.randomUUID()` through `generateId()`, with a fallback |
| `date` | **`YYYY-MM-DD` string**, in local calendar time |
| `amount` | Positive float, **rounded to 2 decimals**, at most 1,000,000 |
| `category` | One of `CATEGORIES` |
| `description` | Trimmed, 1–120 characters |
| `createdAt` / `updatedAt` | ISO timestamps (`toISOString()`) |

### Storage: changing the schema is a data-migration decision

- Expenses are stored as a JSON array under **`localStorage["expense-tracker:v1"]`** ([src/lib/storage.ts](src/lib/storage.ts)).
- `loadExpenses()` runs every record through `isExpense()` and **silently drops records that fail**. This means:
  - **Adding a required field** and checking for it in `isExpense` **drops every existing record.** New fields must be **optional** (`field?: T`) and tolerated when missing, or you must write an explicit migration.
  - **Renaming or removing a category** drops every stored expense in that category. Migrate the data first.
  - Changing the storage format in a way old data can't satisfy means bumping the key (`:v2`) **and** writing a migration from `:v1`. Never just drop old data.
- Validation lives in two places. **Form validation** is `validateExpense` in [src/components/ExpenseForm.tsx](src/components/ExpenseForm.tsx), which produces user-facing messages. **Storage validation** is `isExpense`, the shape check for untrusted stored data. Keep the two consistent when you change a field.
- Other keys: the in-progress Insights feature stores the monthly budget under `"spendwise:monthly-budget"`. The cross-tab listener in `useExpenses` only reacts to keys starting with `expense-tracker:`. Choose a prefix deliberately, and wrap every `localStorage` access in `try/catch`, because storage can be full, disabled or blocked.

### Dates: never use `new Date("YYYY-MM-DD")`

- `new Date("2026-11-01")` is parsed as **UTC midnight**, which is the previous day in timezones west of UTC. Use **`parseISODate`** to read a date and **`toISODate`** to write one ([src/lib/format.ts](src/lib/format.ts)). `todayISO()` gives today's local date.
- Compare and filter dates as **strings**. `YYYY-MM-DD` sorts lexicographically, so `e.date >= from` is correct and is what the codebase does.
- Month keys are `YYYY-MM` (`monthKey(iso)` = `iso.slice(0, 7)`). To step months, build `new Date(y, m - 1 + delta, 1)` and let JavaScript roll over the year.
- Future dates are rejected by the form. Analytics treat "now" as local time.

### Money

- Amounts are floats kept at 2 decimal places. That isn't ideal (see the comment on `Expense.amount`), but it's consistent. **Round at the boundaries**: the form rounds on submit, and `sumAmounts` rounds the total. When you sum in new code, use `sumAmounts` or `Math.round(x * 100) / 100`. Don't show raw float sums.
- Format with `formatCurrency` / `formatCompactCurrency`. Don't create ad-hoc `Intl.NumberFormat` instances unless you need a format that doesn't exist yet. If you do, put it in `lib/format.ts` when it's reusable.

### Categories

- The fixed list is `CATEGORIES` in [src/types/expense.ts](src/types/expense.ts). The `Category` type derives from it.
- Each category needs an entry in `CATEGORY_STYLES` ([src/lib/categories.ts](src/lib/categories.ts)) with a chart `color`, Tailwind `badge` classes and an `icon`. TypeScript enforces this because it's a `Record<Category, ...>`.
- **A chart color follows the category, never its rank or position.** The palette was chosen to be distinguishable with colour-vision deficiency, and every chart also labels categories in text. Keep both properties when adding or changing charts or colours.
- Use `<CategoryBadge category={c} />` to show a category. Don't restyle it inline.

### CSV export ([src/lib/csv.ts](src/lib/csv.ts))

- **The column order `Date, Category, Description, Amount` is a contract.** Users' spreadsheets and scripts may read the file by position. Don't reorder or rename columns without an explicit request, and say in your summary that it's a breaking change.
- Every cell goes through `escapeCell`, which neutralises spreadsheet formula injection (`= + - @ \t \r`) and applies RFC 4180 quoting. Keep the UTF-8 BOM (so Excel opens the file correctly) and the CRLF line endings.
- `id` and the timestamps are intentionally not exported.
- `/expenses` exports the **currently filtered** list and wraps the call in `try/catch` with a toast. A new export entry point should reuse `downloadCSV` and give the same feedback.

## Conventions

### Code

- TypeScript `strict` is on. Don't use `any`, `@ts-ignore` or non-null `!` without a reason you could defend in review. Narrow `unknown` the way `isExpense` does.
- Keep **logic in `src/lib/` as pure functions** and keep components thin. Functions that depend on the current time take a `now = new Date()` parameter (see `summarize`, `monthlyTotals`, `budgetStreak`) so they're deterministic and testable. Follow that pattern.
- Derive values with `useMemo` from `expenses` instead of storing derived state.
- Put a short doc comment on non-obvious lib functions that explains *what the rule is*. `budgetStreak` is the model: it states the edge cases (empty history, today over budget).
- Match the existing style: named exports for components and hooks, default exports only for route files, and double quotes.
- **Don't add dependencies** without asking. The zero-dependency footprint is deliberate. Charts are inline SVG ([src/components/MonthlyChart.tsx](src/components/MonthlyChart.tsx), [src/components/MonthlyInsights.tsx](src/components/MonthlyInsights.tsx)). Dev-only tooling such as a test runner is a separate conversation from runtime dependencies.

### Styling

- Use Tailwind utilities, plus the shared component classes in [src/app/globals.css](src/app/globals.css): `.card`, `.input`, `.input-error`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.icon-btn`. Use those classes instead of re-creating button and input styles.
- The brand colour is `brand-*` (indigo) in [tailwind.config.ts](tailwind.config.ts). Neutral colours are `slate-*` and errors are `rose-*`.
- Layouts are mobile first. **Nothing may cause horizontal page scroll at 375px.** The Navbar is the tightest spot: each added link makes it harder to fit.
- The list switches between a table on desktop and cards on mobile. Keep both in sync when you change what an expense row shows.

### Accessibility (required, not polish)

The codebase already follows these patterns. New UI must too:

- Toggle and segmented buttons are real `<button>`s with `aria-pressed`. Group them with `role="group"` and an `aria-label`.
- Inputs have a `<label htmlFor>`, `aria-invalid` when they're invalid, and the error text next to them.
- Charts are `role="img"` with a descriptive `aria-label`, and their information is also available as text (a legend, list or table).
- Values that change after user input (selected month, period totals) use `aria-live="polite"`.
- Icon-only buttons have an `aria-label`. Loading regions have `aria-busy="true"`.
- Destructive actions go through `ConfirmDialog`. Deletes also offer Undo.

### UX copy and feedback

- Every user action that changes data or exports gives toast feedback (`useToast()(message, "info" | "error", action?)`).
- Error and empty states say what happened and what to do next. Copy is short, sentence case and plain English.

## Documentation

- `docs/dev/<slug>-implementation.md`: developer docs. `docs/user/how-to-<task>.md`: end-user guides, with screenshots in `docs/user/images/<guide-name>/`.
- The **`/document-feature <feature>`** command ([.claude/commands/document-feature.md](.claude/commands/document-feature.md)) generates both, and captures screenshots with [.claude/scripts/capture-screenshots.cjs](.claude/scripts/capture-screenshots.cjs) (Playwright, against a running dev server).
- Doc style: plain and direct, tables for file lists, file paths in backticks, and the product called "Spendwise".
- [code-analysis.md](code-analysis.md) compares three abandoned data-export branches (v1/v2/v3). It's useful background on why the export works as it does, but it isn't a spec.
- Update [README.md](README.md)'s feature list when you add a user-visible feature or route.

## Branches and parallel work

- `main` is the integration branch. Branch before you commit (`feature/<name>`). Don't commit or push unless asked.
- Features are often built in parallel in **git worktrees** next to this repo (for example `../expense-tracker-top-categories`), using the **`/parallel-agents`** command. Each worktree leaves a `<feature>.work.txt` summary at the repo root. These are untracked scratch notes that list merge-conflict expectations. Read them before merging a feature branch, and don't commit them.
- Known conflict hotspots when merging feature branches: `LINKS` in [src/components/Navbar.tsx](src/components/Navbar.tsx) (every new page adds a link, and the phone width needs rechecking after each one), [src/types/expense.ts](src/types/expense.ts), [src/lib/analytics.ts](src/lib/analytics.ts), and `package.json`/`package-lock.json`. Pending branches add `vitest`. If a lockfile conflicts, take one side and run `npm install` to regenerate it.
- After any merge, run `npm install`, typecheck, lint, any tests and `npm run build`.
- **When `vitest` lands on `main`, update the Commands section of this file.** Tests go next to the code as `*.test.ts` under `src/`, use the node environment and target pure `lib/` functions (pass a fixed `now`).

## Don'ts (quick reference)

- Don't add a backend, API route, auth or a remote service without an explicit request. "Your data stays in your browser" is a property of the product.
- Don't write to `localStorage["expense-tracker:v1"]` from anywhere except `lib/storage.ts` through the store.
- Don't make a stored field required, or rename or remove a category, without a migration.
- Don't parse `YYYY-MM-DD` with `new Date(str)`.
- Don't reorder CSV columns or remove `escapeCell` or the BOM.
- Don't colour charts by rank. Don't ship a chart without a text equivalent.
- Don't commit `.next/`, `*.tsbuildinfo`, `*.work.txt` or `.env*.local`.
