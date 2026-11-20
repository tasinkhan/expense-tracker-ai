import { escapeCell } from "../../csv";
import type { ExportFormat } from "../types";

const HEADER = ["Date", "Category", "Amount", "Description"];

export const csvFormat: ExportFormat = {
  id: "csv",
  label: "CSV",
  extension: "csv",
  mime: "text/csv;charset=utf-8",
  tagline: "Spreadsheet-ready for Excel, Google Sheets or Numbers",
  serialize(ds) {
    const rows = ds.records.map((r) => [r.date, r.category, r.amount.toFixed(2), r.description].map(escapeCell).join(","));
    // BOM so Excel detects UTF-8; CRLF per RFC 4180.
    return "﻿" + [HEADER.join(","), ...rows].join("\r\n");
  },
};
