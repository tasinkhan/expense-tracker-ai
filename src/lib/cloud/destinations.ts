/**
 * Export destinations. "real" ones do exactly what they say in the browser;
 * "simulated" ones walk through a realistic flow but nothing leaves the device.
 */
export type DestinationId = "download" | "link" | "clipboard" | "email" | "google-sheets" | "google-drive" | "dropbox" | "onedrive" | "spendwise-cloud";

export interface DestinationDef {
  id: DestinationId;
  name: string;
  /** Short monogram shown in the tile (we don't ship third-party logos). */
  mono: string;
  tile: string;
  blurb: string;
  kind: "real" | "simulated";
  /** Needs an account connection before use. */
  requiresConnection: boolean;
  /** Can be the target of a scheduled export. */
  schedulable: boolean;
  /** Simulated OAuth scopes shown on the consent screen. */
  scopes?: string[];
}

export const DESTINATIONS: Record<DestinationId, DestinationDef> = {
  download: { id: "download", name: "Download", mono: "↓", tile: "bg-slate-900 text-white", blurb: "Save a file to this device", kind: "real", requiresConnection: false, schedulable: false },
  link: { id: "link", name: "Share link", mono: "🔗", tile: "bg-brand-600 text-white", blurb: "Read-only link + QR code", kind: "real", requiresConnection: false, schedulable: false },
  clipboard: { id: "clipboard", name: "Copy for apps", mono: "⌘", tile: "bg-slate-700 text-white", blurb: "Markdown for Notion & Slack, or cells for spreadsheets", kind: "real", requiresConnection: false, schedulable: false },
  email: { id: "email", name: "Email", mono: "@", tile: "bg-sky-500 text-white", blurb: "Send a report to anyone", kind: "simulated", requiresConnection: false, schedulable: true },
  "google-sheets": { id: "google-sheets", name: "Google Sheets", mono: "GS", tile: "bg-emerald-600 text-white", blurb: "Live spreadsheet that refreshes on each sync", kind: "simulated", requiresConnection: true, schedulable: true, scopes: ["Create spreadsheets", "Edit spreadsheets created by Spendwise"] },
  "google-drive": { id: "google-drive", name: "Google Drive", mono: "GD", tile: "bg-amber-500 text-white", blurb: "Drop files into a Drive folder", kind: "simulated", requiresConnection: true, schedulable: true, scopes: ["Create files in a Spendwise folder"] },
  dropbox: { id: "dropbox", name: "Dropbox", mono: "DB", tile: "bg-blue-600 text-white", blurb: "Sync to /Apps/Spendwise", kind: "simulated", requiresConnection: true, schedulable: true, scopes: ["Write to /Apps/Spendwise"] },
  onedrive: { id: "onedrive", name: "OneDrive", mono: "OD", tile: "bg-sky-700 text-white", blurb: "Save to your OneDrive", kind: "simulated", requiresConnection: true, schedulable: true, scopes: ["Read and write app folder"] },
  "spendwise-cloud": { id: "spendwise-cloud", name: "Spendwise Cloud", mono: "☁", tile: "bg-gradient-to-br from-brand-500 to-violet-600 text-white", blurb: "Versioned backups, 1 GB included", kind: "simulated", requiresConnection: false, schedulable: true },
};

export const CLOUD_DESTINATIONS: DestinationId[] = ["google-sheets", "google-drive", "dropbox", "onedrive"];
export const SEND_DESTINATIONS: DestinationId[] = ["download", "link", "email", "clipboard", "google-sheets", "google-drive", "dropbox", "onedrive", "spendwise-cloud"];
