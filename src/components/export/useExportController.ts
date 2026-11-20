"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CATEGORIES, type Category, type Expense } from "@/types/expense";
import { todayISO } from "@/lib/format";
import {
  EXPORT_FORMATS,
  buildDataset,
  countByCategory,
  downloadFile,
  isRangeInvalid,
  suggestFilename,
  validateFilename,
  withExtension,
  type ExportFormatId,
} from "@/lib/export";

export type ExportStatus = "idle" | "preparing" | "success" | "error";

interface Draft {
  format: ExportFormatId;
  from: string;
  to: string;
  categories: Category[];
  filename: string;
  /** Once the user edits the name we stop auto-suggesting one from the date range. */
  filenameEdited: boolean;
}

type Action =
  | { type: "format"; format: ExportFormatId }
  | { type: "range"; from: string; to: string }
  | { type: "toggleCategory"; category: Category }
  | { type: "categories"; categories: Category[] }
  | { type: "filename"; filename: string }
  | { type: "reset" };

const initialDraft = (): Draft => ({
  format: "csv",
  from: "",
  to: "",
  categories: [...CATEGORIES],
  filename: suggestFilename("", "", todayISO()),
  filenameEdited: false,
});

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "format":
      return { ...state, format: action.format };
    case "range":
      return {
        ...state,
        from: action.from,
        to: action.to,
        filename: state.filenameEdited ? state.filename : suggestFilename(action.from, action.to, todayISO()),
      };
    case "toggleCategory": {
      const has = state.categories.includes(action.category);
      const next = has ? state.categories.filter((c) => c !== action.category) : [...state.categories, action.category];
      // Keep canonical order so exports and summaries read consistently.
      return { ...state, categories: CATEGORIES.filter((c) => next.includes(c)) };
    }
    case "categories":
      return { ...state, categories: CATEGORIES.filter((c) => action.categories.includes(c)) };
    case "filename":
      return { ...state, filename: action.filename, filenameEdited: true };
    case "reset":
      return initialDraft();
  }
}

/** Minimum time the busy state is shown, so the spinner reads as feedback rather than a flicker. */
const MIN_BUSY_MS = 450;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useExportController(expenses: readonly Expense[], onExported?: (message: string, ok: boolean) => void) {
  const [draft, dispatch] = useReducer(reducer, undefined, initialDraft);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const criteria = useMemo(() => ({ from: draft.from, to: draft.to, categories: draft.categories }), [draft.from, draft.to, draft.categories]);
  const dataset = useMemo(() => buildDataset(expenses, criteria), [expenses, criteria]);
  const categoryCounts = useMemo(() => countByCategory(expenses, criteria), [expenses, criteria]);
  const format = EXPORT_FORMATS[draft.format];

  const errors = {
    range: isRangeInvalid(draft) ? "Start date must be on or before the end date." : null,
    categories: draft.categories.length === 0 ? "Select at least one category." : null,
    filename: validateFilename(draft.filename),
  };
  const fullFilename = withExtension(draft.filename, format.extension);
  const canExport = !errors.range && !errors.categories && !errors.filename && dataset.count > 0 && status !== "preparing";

  const runExport = useCallback(async () => {
    if (!canExport) return;
    setStatus("preparing");
    const started = performance.now();
    try {
      await nextFrame(); // let the busy state paint before the (synchronous) serialisation work
      const data = format.serialize(dataset, { generatedAt: new Date() });
      const elapsed = performance.now() - started;
      if (elapsed < MIN_BUSY_MS) await sleep(MIN_BUSY_MS - elapsed);
      downloadFile(data, format.mime, fullFilename);
      onExported?.(`Exported ${dataset.count} record${dataset.count === 1 ? "" : "s"} to ${fullFilename}`, true);
      if (!mounted.current) return;
      setStatus("success");
      await sleep(1800);
      if (mounted.current) setStatus((s) => (s === "success" ? "idle" : s));
    } catch (err) {
      console.error("Export failed", err);
      onExported?.("Export failed. Please try again.", false);
      if (mounted.current) setStatus("error");
    }
  }, [canExport, dataset, format, fullFilename, onExported]);

  return { draft, dispatch, dataset, categoryCounts, format, errors, fullFilename, canExport, status, runExport };
}

export type ExportController = ReturnType<typeof useExportController>;
