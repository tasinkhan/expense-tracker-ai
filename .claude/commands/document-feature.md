---
description: Generate developer docs and an end-user guide for a feature, cross-linked, with screenshots when possible
argument-hint: <feature name> [--no-screenshots] [--base-url http://localhost:3000]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git ls-files:*), Bash(ls:*), Bash(node .claude/scripts/capture-screenshots.cjs:*), Bash(curl -s -o /dev/null -w:*), Bash(npm run dev:*)
---

# Document a feature

Feature to document: **$ARGUMENTS**

If `$ARGUMENTS` is empty, stop and ask: "Which feature should I document? (for example: `CSV export`, `delete with undo`, `date range filter`)". Do nothing else until you get an answer.

Parse flags out of `$ARGUMENTS`: `--no-screenshots` skips step 5; `--base-url <url>` overrides `http://localhost:3000`. Everything else is the feature name.

You will produce exactly two files, then report. Work through the steps in order.

---

## Step 1 — Learn the project's documentation conventions

1. Read `README.md` and any `CLAUDE.md`.
2. List existing docs: `docs/**/*.md`, plus any top-level `*.md` (for example `code-analysis.md`). Skim two or three to pick up:
   - heading style, use of tables, code fences, tone (this repo's docs are plain, direct, first-person-plural-free, use tables for file lists, and cite `path/to/file.ts` in backticks)
   - how they refer to the product (this project calls itself **Spendwise**)
3. If `docs/dev/` or `docs/user/` already contain files, copy their front matter, section order and naming pattern. Existing patterns win over the templates below.

## Step 2 — Find the feature's code

Turn the feature name into search terms (synonyms, camelCase, kebab-case, UI label text). Then:

1. `Grep` for the terms across `src/` (component names, function names, button labels, route names, storage keys).
2. `git log --oneline -i --grep "<term>"` and `git log --oneline -- <matched files>` to find the commits that introduced it; `git diff <commit>^ <commit> --stat` to see what changed together.
3. Read every file that implements it, and follow imports one level out (hooks, lib helpers, types, the page that renders it).

Build a list of **feature files**, each with a one-line role. If nothing matches, tell the user what you searched for, show the closest candidates, and ask which they meant. Do not invent a feature.

## Step 3 — Classify the feature: frontend, backend or full-stack

Classify from the feature files, using these signals:

| Signal | Points to |
|---|---|
| `src/app/**/page.tsx`, `layout.tsx`, `src/components/**`, client hooks, `"use client"`, Tailwind classes, `localStorage`, browser APIs (`Blob`, `URL.createObjectURL`, `navigator.*`) | **frontend** |
| `src/app/api/**/route.ts`, `"use server"` / server actions, `middleware.ts`, database/ORM clients, `process.env` secrets, `fetch` to external services from server code | **backend** |
| Both of the above in the same feature | **full-stack** |

State the classification and the two or three files that decided it. Note: this app currently has no backend (data lives in `localStorage["expense-tracker:v1"]`), so most features will be frontend; only say backend or full-stack if you actually found server code.

Adjust the developer doc by type:

- **frontend** → include *Component tree*, *State & data flow* (which context/hook owns the state), *Props / hook API*, *Browser APIs & storage*, *Accessibility*, *Responsive behaviour*. Omit *API reference*.
- **backend** → include *API reference* (method, path, request/response schema, status codes, errors), *Data model*, *Auth & validation*, *Side effects*. Omit component sections.
- **full-stack** → include both, plus a *Request lifecycle* diagram from UI event to server and back.

Adjust the user guide by type: frontend/full-stack guides are click-by-click with screenshots; a backend-only feature gets a short user guide describing the visible effect (or, if there is no user-visible effect at all, say so to the user and write a minimal guide noting it is an internal change).

## Step 4 — Choose file names and find related docs

**Slug** the feature name: lowercase, kebab-case, drop filler words.

- Developer doc: `docs/dev/<slug>-implementation.md`
- User guide: `docs/user/how-to-<task-verb-phrase>.md` — phrase it as the task the user performs, not the feature name (`password reset` → `how-to-reset-password.md`; `CSV export` → `how-to-export-expenses-to-csv.md`; `category filter` → `how-to-filter-expenses-by-category.md`).

If either file already exists, read it and **update it in place** (keep any hand-written sections, refresh the generated ones) rather than overwriting blindly. Tell the user it was an update.

**Related docs (auto-linking).** Search `docs/` and top-level `*.md` for:
- any doc that mentions one of the feature files by path,
- any doc that shares key terms (component names, hook names, UI labels),
- user guides for features this one depends on or that appear on the same screen.

Keep the 3–6 most relevant. You will link them under "Related" in both files, using relative paths that resolve from each file's own folder (from `docs/dev/` the README is `../../README.md`). Never link a file you have not confirmed exists. Always include `README.md`.

## Step 5 — Screenshots (user guide)

Skip this step if `--no-screenshots` was passed or the feature has no UI.

1. Plan the shots: one per meaningful screen state in the user steps (starting screen, the control to click, the form/dialog, the result, any error/empty state). Name them `01-…`, `02-…` in step order.
2. Check whether the app is running: `curl -s -o /dev/null -w "%{http_code}" <base-url>`. If it is not, start it with `npm run dev` **in the background**, then poll the same curl until it returns 200 (give up after ~60 s).
3. Write a spec file to your scratchpad directory (not the repo) in the format documented at the top of `.claude/scripts/capture-screenshots.cjs`:
   - `outDir`: `docs/user/images/<user-guide-basename-without-.md>`
   - `seedSampleData: true` for any feature that needs expenses on screen (the app starts empty; the script clicks **Load sample data**)
   - prefer accessible selectors: `role=button[name=/export csv/i]`, `role=dialog`, `text=…`. Read the component source for exact labels.
   - use `selector` to crop to a dialog/card when the whole page would be noise
4. Run `node .claude/scripts/capture-screenshots.cjs <spec>`.
   - Exit 0/1: use each shot with `"ok": true`. For failed shots, fall back to a placeholder.
   - Exit 3 (Playwright or browser not installed): do not install anything. Use placeholders for every shot and tell the user at the end: `npm i -g playwright && npx playwright install chromium` enables automatic capture.
5. If you started the dev server, stop it when done.

**Captured screenshot** markup:
```markdown
![Expenses page with the Export CSV button highlighted](images/how-to-export-expenses-to-csv/02-export-button.png)
```

**Placeholder** markup (when capture failed or was skipped) — keep the same path so dropping in a file later just works:
```markdown
<!-- SCREENSHOT: 02-export-button.png — Expenses page, desktop width, sample data loaded, cursor on "Export CSV" in the header. -->
![Screenshot placeholder: Expenses page with the Export CSV button](images/how-to-export-expenses-to-csv/02-export-button.png)
```
The comment must describe exactly what to capture (page, state, viewport, what to highlight) so anyone can take it later.

## Step 6 — Write the developer doc

Path: `docs/dev/<slug>-implementation.md`. Use this skeleton, dropping sections that do not apply per Step 3. Everything must come from the code you read; cite files as `src/…:line`. No speculation — if something is unclear, put it under *Open questions*.

~~~markdown
# <Feature name>: Implementation

> **Type:** Frontend | Backend | Full-stack  ·  **Last updated:** <today, YYYY-MM-DD>  ·  **Introduced in:** <short SHA + commit subject, if found>
> **User guide:** [How to <task>](../user/how-to-<task>.md)

## Overview
Two or three sentences: what it does, where it lives in the UI/API, and the main design choice.

## Files
| File | Role |
|---|---|
| `src/...` | ... |

## Architecture
ASCII diagram from trigger (click / request) to effect, naming the real functions:
```
ExpensesPage ──onClick──▶ downloadCSV(filtered)  (src/lib/csv.ts)
                             ├─ expensesToCSV → escapeCell per cell
                             └─ Blob → object URL → <a download>
```

## Component tree            <!-- frontend / full-stack -->
## State & data flow         <!-- frontend / full-stack: which context/hook owns state, what triggers re-render, persistence -->
## Props / hook API          <!-- frontend / full-stack: table of name | type | required | description, taken from the TS types -->
## API reference             <!-- backend / full-stack: per endpoint: method, path, request, response, status codes, errors -->
## Data model                <!-- types/interfaces touched, storage keys, schema changes -->
## Validation & error handling
## Browser APIs & storage    <!-- frontend -->
## Accessibility & responsive behaviour   <!-- frontend -->
## Security considerations   <!-- e.g. CSV formula injection, XSS, input limits -->
## Testing
How to verify it manually (exact steps) and which automated tests exist (say "none" if none). Commands: `npm run typecheck`, `npm run lint`.
## Extending it
Where to make the most likely changes (add a field, a format, a category…), with file pointers.
## Open questions / known limitations
## Related
- [How to <task>](../user/how-to-<task>.md) — end-user guide for this feature
- [README](../../README.md) — project overview
- <other related docs from Step 4>
~~~

## Step 7 — Write the user guide

Path: `docs/user/how-to-<task>.md`. Audience: someone who has never seen the code. Rules: second person, plain words, no file paths, no jargon (say "the list of expenses", not "the filtered array"), UI labels in **bold** exactly as they appear on screen, one action per numbered step, a screenshot (or placeholder) after any step that changes what the user sees.

```markdown
# How to <task>

<One sentence: what this lets you do and why you'd want to.>

**Where:** <page name and how to get there>  ·  **Time:** about <n> minute(s)

![...](images/how-to-<task>/01-....png)

## Before you start
- <prerequisites, e.g. "You need at least one expense. No expenses yet? Click **Load sample data** on the dashboard.">

## Steps
1. Go to **<Page>** using the top navigation bar.
2. Click **<Button>**.
   ![...](images/how-to-<task>/02-....png)
3. ...

## What happens next
<Visible result: toast text, where the file goes, what changes on screen.>

## Tips
- <shortcuts, related options, mobile differences (cards instead of table, etc.)>

## Troubleshooting
| Problem | What to do |
|---|---|
| <button greyed out> | <reason in user terms + fix> |

## Related
- <links to other user guides from Step 4>
- *For developers:* [<Feature name> implementation](../dev/<slug>-implementation.md)
```

Derive Troubleshooting rows from the real code: disabled conditions, validation messages (quote them exactly), error banners, empty states, storage failures.

## Step 8 — Cross-reference check

Before finishing, verify:
- [ ] Dev doc header and *Related* link to the user guide; user guide *Related* links to the dev doc.
- [ ] Every relative link resolves (check each target with `ls`).
- [ ] Every image path either exists or has a `<!-- SCREENSHOT: … -->` placeholder comment directly above it.
- [ ] Every UI label in the user guide matches the source exactly (grep for it).
- [ ] Every `src/…:line` reference in the dev doc points at the right code.
- [ ] Optional: if a `docs/README.md` index exists, add both files to it; if it does not exist and there are now 3+ docs, offer (do not just create) an index.

## Step 9 — Report

Reply briefly with:
- the classification (frontend/backend/full-stack) and why, in one line
- the two files written (or updated), as clickable paths
- screenshots: how many captured, how many left as placeholders, and why
- related docs linked
- anything you could not determine from the code (the *Open questions*)

Do not commit. Leave the files for the user to review.
