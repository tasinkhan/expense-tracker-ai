import type { ExportFormat } from "../types";

export const jsonFormat: ExportFormat = {
  id: "json",
  label: "JSON",
  extension: "json",
  mime: "application/json",
  tagline: "Structured data for scripts, APIs and integrations",
  serialize(ds, { generatedAt }) {
    const { criteria } = ds;
    return JSON.stringify(
      {
        meta: {
          generatedAt: generatedAt.toISOString(),
          filters: {
            from: criteria.from || null,
            to: criteria.to || null,
            categories: criteria.categories,
          },
          recordCount: ds.count,
          total: ds.total,
          currency: "USD",
        },
        summary: ds.byCategory,
        expenses: ds.records,
      },
      null,
      2,
    );
  },
};
