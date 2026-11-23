---
description: Add, rename or remove an expense category everywhere it is used
argument-hint: <Name> [--icon 🐶] | --rename <Old> <New> | --remove <Name> --into <Target>
allowed-tools: Read, Grep, Edit, Bash(npm run typecheck:*), Bash(npm run lint:*)
---

Change the category list: **$ARGUMENTS**. If empty, ask what to add, rename or remove.

1. Update `CATEGORIES` in `src/types/expense.ts` (keep "Other" last) and `CATEGORY_STYLES` in `src/lib/categories.ts`. A new colour must differ clearly from the others, and badge classes must be written out in full so Tailwind picks them up.
2. Add or update sample rows in `src/lib/sample-data.ts`. Grep `src/` for other uses of the name.
3. For a rename or remove: `isExpense` in `src/lib/storage.ts` drops expenses with unknown categories. Add a `LEGACY_CATEGORIES` map from old name to new and apply it before validation, so no saved expenses are lost.
4. Run `npm run typecheck` and `npm run lint`. Report the files changed and the results. Do not commit.
