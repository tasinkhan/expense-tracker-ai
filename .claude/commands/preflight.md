---
description: Check uncommitted changes before committing
argument-hint: [--skip-build]
allowed-tools: Read, Grep, Bash(git status:*), Bash(git diff:*), Bash(npm run typecheck:*), Bash(npm run lint:*), Bash(npm run build:*), Bash(npm test:*)
---

Check the uncommitted changes (`git status`, `git diff`). Options: $ARGUMENTS

1. Run `npm run typecheck`, `npm run lint`, `npm test` (if there is a test script) and `npm run build` (unless `--skip-build`).
2. In the changed files, look for:
   - changes to `Expense` or `CATEGORIES` that would make `src/lib/storage.ts` drop saved data
   - client code missing `"use client"`
   - new pages without a `layout.tsx` title or a Navbar link
   - `localStorage` used outside `storage.ts`
   - leftover `console.log`
   - `*.work.txt` or `.env*` files that are about to be committed
3. Reply with **Ready** or **Not ready**, then each problem as `file:line` with a one-line fix. Do not change or commit anything.
