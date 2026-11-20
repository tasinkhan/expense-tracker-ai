# Spendwise — Expense Tracker

A personal expense tracker built with Next.js 14 (App Router), TypeScript and Tailwind CSS. Data is stored in your browser's `localStorage`.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
# or a production build
npm run build && npm start
```

Other scripts: `npm run lint`, `npm run typecheck`.

## Features

- **Dashboard** (`/`): summary cards (total, this month vs last month, average, top category), a 6-month spending chart, category breakdown, recent expenses
- **Expenses** (`/expenses`): search, category filter, date range with presets, sorting, running total of filtered results
- **Add / edit**: modal form with validation (amount > 0 with up to 2 decimals, no future dates, description required and at most 120 characters), native date picker, category picker
- **Delete**: confirmation dialog, then an **Undo** toast. "Clear all" asks for confirmation
- **CSV export**: exports the currently filtered list (UTF-8 with a BOM so Excel opens it correctly, and cells are escaped against formula injection)
- Loading skeletons, empty states, error banners for storage failures, sync across open tabs, responsive layout (table on desktop, cards on mobile)

## Project structure

```
src/
  app/          routes: dashboard, expenses, layout, providers, error/404
  components/   UI: form, modal, list, filters, charts, summary cards
  hooks/        state: expenses store (context), toast, add/edit modal, delete flow
  lib/          storage, analytics, CSV, formatting, sample data
  types/        Expense types and categories
```
