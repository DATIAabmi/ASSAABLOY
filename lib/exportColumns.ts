// One definition per dataset of the columns its export contains — header,
// order and value. Both the per-page CSV export and the Export All workbook
// read these, so the two formats can't drift apart.
//
// Every definition starts with Organization | Domain | State | Campaign, so each
// Export All section begins with those four columns.

import { exportToCsv } from "@/lib/exportCsv";

export type ExportKind = "text" | "number" | "date" | "url";

export interface ExportColumn<R> {
  header: string;
  value: (row: R) => unknown;
  kind?: ExportKind;
}

type ArrayRow = unknown[];
type ObjectRow = Record<string, unknown>;

/** "C1: March - April 2026" → "C1"; short codes pass through unchanged. */
export function campaignCode(c: unknown): string {
  return String(c ?? "").split(":")[0].trim();
}

const at = (i: number) => (r: ArrayRow) => r[i];
const key = (k: string) => (r: ObjectRow) => r[k];

// Row shape (q405-data): District, Domain, State, Campaign, SBM, Topic,
// Engagements, Engaged Users, Leads, Downloads, Intent Score, Score Trend
export const ENGAGED_USERS_EXPORT: ExportColumn<ArrayRow>[] = [
  { header: "Organization",        value: at(0) },
  { header: "Domain",          value: at(1) },
  { header: "State",           value: at(2) },
  { header: "Campaign",        value: at(3) },
  { header: "SBM",             value: at(4) },
  { header: "Topic",           value: at(5) },
  { header: "Engagements",     value: at(6),  kind: "number" },
  { header: "Engaged Users",   value: at(7),  kind: "number" },
  { header: "Leads",           value: at(8),  kind: "number" },
  { header: "Total Downloads", value: at(9),  kind: "number" },
  { header: "Intent Score",    value: at(10), kind: "number" },
  { header: "Intent Score Trend", value: at(11), kind: "number" },
];

// Row shape (ai-signals-data): one object per signal, keyed by ai_signals column.
export const ACCOUNT_INTELLIGENCE_EXPORT: ExportColumn<ObjectRow>[] = [
  { header: "Organization",        value: key("Organization") },
  { header: "Domain",          value: key("Domain") },
  { header: "State",           value: key("State") },
  { header: "Campaign",        value: key("Campaign #") },
  { header: "Keywords",        value: key("Keywords") },
  { header: "Category",        value: key("Category") },
  { header: "Date",            value: key("Date"), kind: "date" },
  { header: "Source",          value: key("Source") },
  { header: "Link",            value: key("Source Link"), kind: "url" },
  { header: "Strength",        value: key("Strength"), kind: "number" },
  { header: "Signal Analysis", value: key("Signal Analysis") },
  { header: "Source Text",     value: key("Source Text") },
  { header: "Market",          value: key("Market") },
];

// Row shape (q168-data): District, Domain, State, Job Function, Campaign, Engagements, Leads
export const PERSONA_EXPORT: ExportColumn<ArrayRow>[] = [
  { header: "Organization",     value: at(0) },
  { header: "Domain",       value: at(1) },
  { header: "State",        value: at(2) },
  { header: "Campaign",     value: at(4) },
  { header: "Job Function", value: at(3) },
  { header: "Engagements",  value: at(5), kind: "number" },
  { header: "Leads",        value: at(6), kind: "number" },
];

// Row shape (q181-data / card 548): District, Domain, Campaign, State, Topic, Topic Score, Date
export const TOPIC_EXPORT: ExportColumn<ArrayRow>[] = [
  { header: "Organization",    value: at(0) },
  { header: "Domain",      value: at(1) },
  { header: "State",       value: at(3) },
  { header: "Campaign",    value: (r) => campaignCode(r[2]) },
  { header: "Date",        value: at(6), kind: "date" },
  { header: "Topic",       value: at(4) },
  { header: "Topic Score", value: at(5), kind: "number" },
];

// Row shape (geoInsightsSql): State, Engagements, Engaged Users, Leads — state-level
// only, no per-district breakdown, so this isn't part of the Master roll-up.
export const GEO_EXPORT: ExportColumn<ObjectRow>[] = [
  { header: "State",         value: key("State") },
  { header: "Engagements",   value: key("Engagements"),    kind: "number" },
  { header: "Engaged Users", value: key("Engaged Users"),  kind: "number" },
  { header: "Leads",         value: key("Leads"),          kind: "number" },
];

// Row shape (q174-data): District, Domain, Campaign, State, Job Function, Total Downloads
export const LEADS_EXPORT: ExportColumn<ArrayRow>[] = [
  { header: "Organization",        value: at(0) },
  { header: "Domain",          value: at(1) },
  { header: "State",           value: at(3) },
  { header: "Campaign",        value: at(2) },
  { header: "Job Function",    value: at(4) },
  { header: "Total Downloads", value: at(5), kind: "number" },
];

/** Per-page CSV export driven by a shared column definition. */
export function exportDatasetCsv<R>(filename: string, columns: ExportColumn<R>[], rows: R[]) {
  const cols = columns.map((c) => ({ display_name: c.header }));
  const out = rows.map((r) => columns.map((c) => {
    const v = c.value(r);
    return v === null || v === undefined ? null : typeof v === "number" ? v : String(v);
  }));
  exportToCsv(filename, cols, out);
}
