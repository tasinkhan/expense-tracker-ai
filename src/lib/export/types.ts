import type { Category } from "../../types/expense";

export type ExportFormatId = "csv" | "json" | "pdf";

/** What the user asked for: which slice of the data to export. */
export interface ExportCriteria {
  /** Inclusive ISO date (YYYY-MM-DD); empty string means unbounded. */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD); empty string means unbounded. */
  to: string;
  categories: Category[];
}

/** The exported shape of a single expense — internal fields (id, timestamps) are deliberately left out. */
export interface ExportRecord {
  date: string;
  category: Category;
  amount: number;
  description: string;
}

export interface CategoryTotal {
  category: Category;
  count: number;
  total: number;
}

/** The resolved data set plus pre-computed aggregates, shared by every format and the preview UI. */
export interface ExportDataset {
  criteria: ExportCriteria;
  /** Chronological (oldest first). */
  records: ExportRecord[];
  count: number;
  total: number;
  byCategory: CategoryTotal[];
  firstDate: string | null;
  lastDate: string | null;
}

export interface SerializeContext {
  generatedAt: Date;
}

export interface ExportFormat {
  id: ExportFormatId;
  label: string;
  extension: string;
  mime: string;
  tagline: string;
  serialize: (dataset: ExportDataset, ctx: SerializeContext) => string | Uint8Array;
}
