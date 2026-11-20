import { csvFormat } from "./formats/csv";
import { jsonFormat } from "./formats/json";
import { pdfFormat } from "./formats/pdf";
import type { ExportFormat, ExportFormatId } from "./types";

export const EXPORT_FORMATS: Record<ExportFormatId, ExportFormat> = {
  csv: csvFormat,
  json: jsonFormat,
  pdf: pdfFormat,
};

export const FORMAT_ORDER: ExportFormatId[] = ["csv", "json", "pdf"];

export * from "./types";
export { buildDataset, countByCategory, isRangeInvalid } from "./dataset";
export { suggestFilename, validateFilename, withExtension } from "./filename";
export { downloadFile } from "./download";
