import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  ACCOUNT_INTELLIGENCE_EXPORT, ENGAGED_USERS_EXPORT, LEADS_EXPORT, PERSONA_EXPORT, TOPIC_EXPORT,
  campaignCode, type ExportColumn, type ExportKind,
} from "@/lib/exportColumns";
import {
  loadAccountIntelligence, loadEngagedUsers, loadLeads, loadPersona, loadTopic, type ExportFilters,
} from "@/lib/exportDatasets";

export const maxDuration = 300;

// Export All: one worksheet per dataset, each a normal flat table (its own
// single set of columns, one row per record) — plus a Master sheet that
// rolls every dataset up to one row per Organization + Domain. Earlier this
// laid all five datasets side by side on one sheet, which duplicated the
// Organization | Domain | State | Campaign columns once per section and —
// since sections have very different row counts — left most of the sheet
// looking empty below whichever section ran out of rows first. Separate
// sheets keep every row's columns lined up with that row's own district.

interface SectionSpec {
  title: string;
  columns: ExportColumn<never>[];
  load: (f: ExportFilters) => Promise<unknown[]>;
  fill: string; // ARGB tint for the sheet's header row
}

const SECTIONS: SectionSpec[] = [
  { title: "Engaged Users by Organization", columns: ENGAGED_USERS_EXPORT as ExportColumn<never>[],        load: loadEngagedUsers,        fill: "FFDBEAFE" },
  { title: "Account Intelligence",      columns: ACCOUNT_INTELLIGENCE_EXPORT as ExportColumn<never>[], load: loadAccountIntelligence, fill: "FFDCFCE7" },
  { title: "Persona Insights",          columns: PERSONA_EXPORT as ExportColumn<never>[],              load: loadPersona,             fill: "FFFEF3C7" },
  { title: "Topic Insights",            columns: TOPIC_EXPORT as ExportColumn<never>[],                load: loadTopic,               fill: "FFF3E8FF" },
  { title: "Leads Insights",            columns: LEADS_EXPORT as ExportColumn<never>[],                load: loadLeads,               fill: "FFFFE4E6" },
];

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Cell values ──────────────────────────────────────────────────────────────

// Characters XML 1.0 forbids — they make Excel report the file as corrupt.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const MAX_CELL_CHARS = 32_767;

function cleanText(v: unknown): string {
  return String(v).replace(INVALID_XML, "").slice(0, MAX_CELL_CHARS);
}

function toCell(v: unknown, kind: ExportKind | undefined): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (kind === "number") {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : cleanText(v);
  }
  if (kind === "date") {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : cleanText(v);
  }
  if (kind === "url") {
    const url = String(v).trim();
    return /^https?:\/\//i.test(url) ? { text: cleanText(url), hyperlink: url } : cleanText(url);
  }
  return typeof v === "number" ? v : cleanText(v);
}

// ── Filename ─────────────────────────────────────────────────────────────────

function exportFilename(campaigns: string[]): string {
  const codes = campaigns.map(campaignCode).filter(Boolean);
  const label =
    codes.length === 0 ? "All-Campaigns"
    : codes.length <= 3 ? codes.join("-")
    : `${codes.length}-Campaigns`;
  const stamp = new Date().toISOString().slice(0, 10);
  return `ABMxi_Export_All_${label}_${stamp}.xlsx`;
}

// ── Master tab: roll every dataset up to one row per Organization + Domain ──
//
// Each dataset has its own grain (Persona/Topic/Leads/Account Intelligence
// all have several rows per district — one per job function, topic, signal,
// etc.), so a straight join would either blank out or duplicate rows. Instead
// each non-identifying column is folded into a single Master cell per
// district: numbers are summed, Y/N flags are "Y" if any row was "Y", dates
// take the latest, and text/category columns collect the distinct values
// joined with "; " (the same convention Account Intelligence's own Category
// column already uses for multi-value signals).
//
// A few headers exist in more than one dataset (e.g. "Engagements" in both
// Engaged Users and Persona) — those are suffixed with their source dataset
// so the Master sheet never has two columns with the same name.

type AggKind = "sum" | "max" | "maxDate" | "or" | "join";

interface FieldConfig {
  sourceHeader: string; // header as defined in that dataset's ExportColumn list
  outHeader: string;    // header shown on the Master sheet
  agg: AggKind;
  kind?: ExportKind;    // formatting hint for the Master cell
}

const MASTER_FIELDS: { spec: SectionSpec; fields: FieldConfig[] }[] = [
  {
    spec: SECTIONS[0], // Engaged Users by Organization
    fields: [
      { sourceHeader: "SBM",             outHeader: "SBM",                             agg: "or" },
      { sourceHeader: "Topic",           outHeader: "Topic (Engaged Users)",           agg: "or" },
      { sourceHeader: "Engagements",     outHeader: "Engagements (Engaged Users)",     agg: "sum", kind: "number" },
      { sourceHeader: "Engaged Users",   outHeader: "Engaged Users",                   agg: "sum", kind: "number" },
      { sourceHeader: "Leads",           outHeader: "Leads (Engaged Users)",           agg: "sum", kind: "number" },
      { sourceHeader: "Total Downloads", outHeader: "Total Downloads (Engaged Users)", agg: "sum", kind: "number" },
      { sourceHeader: "Intent Score",    outHeader: "Intent Score",                    agg: "sum", kind: "number" },
      { sourceHeader: "Intent Score Trend", outHeader: "Intent Score Trend",           agg: "sum", kind: "number" },
    ],
  },
  {
    spec: SECTIONS[1], // Account Intelligence
    fields: [
      { sourceHeader: "Keywords",        outHeader: "Keywords",                     agg: "join" },
      { sourceHeader: "Category",        outHeader: "Category",                     agg: "join" },
      { sourceHeader: "Date",            outHeader: "Date (Account Intelligence)",  agg: "maxDate", kind: "date" },
      { sourceHeader: "Source",          outHeader: "Source",                       agg: "join" },
      { sourceHeader: "Link",            outHeader: "Link",                         agg: "join" },
      { sourceHeader: "Strength",        outHeader: "Strength",                     agg: "max", kind: "number" },
      { sourceHeader: "Signal Analysis", outHeader: "Signal Analysis",              agg: "join" },
      { sourceHeader: "Source Text",     outHeader: "Source Text",                  agg: "join" },
      { sourceHeader: "Market",          outHeader: "Market",                       agg: "join" },
    ],
  },
  {
    spec: SECTIONS[2], // Persona Insights
    fields: [
      { sourceHeader: "Job Function", outHeader: "Job Function (Persona)", agg: "join" },
      { sourceHeader: "Engagements",  outHeader: "Engagements (Persona)",  agg: "sum", kind: "number" },
      { sourceHeader: "Leads",        outHeader: "Leads (Persona)",        agg: "sum", kind: "number" },
    ],
  },
  {
    spec: SECTIONS[3], // Topic Insights
    fields: [
      { sourceHeader: "Date",        outHeader: "Date (Topic Insights)",  agg: "maxDate", kind: "date" },
      { sourceHeader: "Topic",       outHeader: "Topic (Topic Insights)", agg: "join" },
      { sourceHeader: "Topic Score", outHeader: "Topic Score",            agg: "sum", kind: "number" },
    ],
  },
  {
    spec: SECTIONS[4], // Leads Insights
    fields: [
      { sourceHeader: "Job Function",    outHeader: "Job Function (Leads Insights)",   agg: "join" },
      { sourceHeader: "Total Downloads", outHeader: "Total Downloads (Leads Insights)", agg: "sum", kind: "number" },
    ],
  },
];

interface MasterRecord {
  organization: string;
  domain: string;
  state: string;
  campaigns: Set<string>;
  values: Map<string, unknown>; // outHeader -> Set<string> (join) | number (sum/max) | string (maxDate/or)
}

function keyFor(organization: string, domain: string): string {
  return `${organization.trim().toLowerCase()}||${domain.trim().toLowerCase()}`;
}

function mergeField(rec: MasterRecord, field: FieldConfig, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return;
  switch (field.agg) {
    case "sum": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return;
      const prev = (rec.values.get(field.outHeader) as number | undefined) ?? 0;
      rec.values.set(field.outHeader, prev + n);
      break;
    }
    case "max": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return;
      const prev = rec.values.get(field.outHeader) as number | undefined;
      if (prev === undefined || n > prev) rec.values.set(field.outHeader, n);
      break;
    }
    case "maxDate": {
      const s = String(raw);
      const prev = rec.values.get(field.outHeader) as string | undefined;
      if (!prev || s > prev) rec.values.set(field.outHeader, s);
      break;
    }
    case "or": {
      const s = String(raw).trim().toUpperCase();
      const prev = rec.values.get(field.outHeader) as string | undefined;
      if (prev !== "Y") rec.values.set(field.outHeader, s === "Y" ? "Y" : (prev ?? s));
      break;
    }
    case "join": {
      let set = rec.values.get(field.outHeader) as Set<string> | undefined;
      if (!set) { set = new Set(); rec.values.set(field.outHeader, set); }
      set.add(String(raw).trim());
      break;
    }
  }
}

interface MasterColumn {
  header: string;
  kind?: ExportKind;
  fill?: string; // header tint of the tab this column came from
}

function buildMasterRows(sections: { spec: SectionSpec; rows: unknown[] }[]): {
  columns: MasterColumn[];
  rows: unknown[][];
} {
  const rowsByTitle = new Map(sections.map((s) => [s.spec.title, s.rows]));
  const records = new Map<string, MasterRecord>();

  for (const merge of MASTER_FIELDS) {
    const cols = merge.spec.columns;
    const orgCol   = cols.find((c) => c.header === "Organization")!;
    const domCol   = cols.find((c) => c.header === "Domain")!;
    const stateCol = cols.find((c) => c.header === "State")!;
    const campCol  = cols.find((c) => c.header === "Campaign")!;
    const fieldCols = merge.fields.map((f) => ({ field: f, col: cols.find((c) => c.header === f.sourceHeader)! }));

    for (const row of (rowsByTitle.get(merge.spec.title) ?? []) as never[]) {
      const organization = String(orgCol.value(row) ?? "").trim();
      const domain = String(domCol.value(row) ?? "").trim();
      if (!organization && !domain) continue;

      const key = keyFor(organization, domain);
      let rec = records.get(key);
      if (!rec) {
        rec = { organization, domain, state: "", campaigns: new Set(), values: new Map() };
        records.set(key, rec);
      }
      if (!rec.organization) rec.organization = organization;
      if (!rec.domain) rec.domain = domain;

      const state = String(stateCol.value(row) ?? "").trim();
      if (state && !rec.state) rec.state = state;

      const camp = campaignCode(campCol.value(row));
      if (camp) rec.campaigns.add(camp);

      for (const { field, col } of fieldCols) mergeField(rec, field, col.value(row));
    }
  }

  // Each field's header takes the fill of the tab it came from, so the Master
  // sheet reads as the five tabs side by side. Identifier columns stay gray.
  const columns: MasterColumn[] = [
    { header: "Organization" }, { header: "Domain" }, { header: "State" }, { header: "Campaign" },
    ...MASTER_FIELDS.flatMap((m) => m.fields.map((f) => ({ header: f.outHeader, kind: f.kind, fill: m.spec.fill }))),
  ];

  const rows: unknown[][] = [...records.values()]
    .sort((a, b) => a.organization.localeCompare(b.organization) || a.domain.localeCompare(b.domain))
    .map((rec) => {
      const base: unknown[] = [rec.organization, rec.domain, rec.state, [...rec.campaigns].sort().join("; ") || null];
      const rest = MASTER_FIELDS.flatMap((m) => m.fields.map((f) => {
        const v = rec.values.get(f.outHeader);
        if (v instanceof Set) return [...v].sort().join("; ") || null;
        return v ?? null;
      }));
      return [...base, ...rest];
    });

  return { columns, rows };
}

// ── Workbook ─────────────────────────────────────────────────────────────────

const formatFor = (kind: ExportKind | undefined) => {
  if (kind === "date") return "yyyy-mm-dd";
  if (kind === "number") return "#,##0";
  return undefined;
};

function writeSheet(
  wb: ExcelJS.Workbook,
  title: string,
  fill: string,
  columns: MasterColumn[],
  rows: unknown[][],
) {
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });

  // Row 1 — column headers. Every column is defined exactly once on this
  // sheet, so Organization | Domain | State | Campaign appear a single time.
  const headerRow = ws.getRow(1);
  columns.forEach((c, j) => {
    const cell = headerRow.getCell(j + 1);
    cell.value = c.header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.fill ?? fill } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 20;

  // Data — every row on this sheet belongs to the same record, so its
  // Organization/Domain/State/Campaign columns always match that same row.
  for (const row of rows) {
    ws.addRow(row.map((v, j) => toCell(v, columns[j].kind)));
  }

  // Formats and widths per column.
  const longHeaders = new Set([
    "Signal Analysis", "Source Text", "Keywords", "Organization", "Category",
    "Job Function (Persona)", "Job Function (Leads Insights)", "Topic (Topic Insights)",
  ]);
  columns.forEach((col, j) => {
    const column = ws.getColumn(j + 1);
    const fmt = formatFor(col.kind);
    if (fmt) column.numFmt = fmt;
    column.width = longHeaders.has(col.header) ? 40 : col.kind === "url" ? 36 : Math.max(12, col.header.length + 4);
    if (col.kind === "url") column.font = { color: { argb: "FF1D4ED8" }, underline: true };
  });
}

async function buildWorkbook(sections: { spec: SectionSpec; rows: unknown[] }[]): Promise<{ buf: Buffer; masterRowCount: number }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DATIA ABMxi";
  wb.created = new Date();

  const master = buildMasterRows(sections);
  writeSheet(wb, "Master", "FFE5E7EB", master.columns, master.rows);

  for (const { spec, rows } of sections) {
    const values = rows.map((row) => spec.columns.map((c) => c.value(row as never)));
    writeSheet(wb, spec.title, spec.fill, spec.columns, values);
  }

  const out = await wb.xlsx.writeBuffer();
  return { buf: Buffer.from(out as ArrayBuffer), masterRowCount: master.rows.length };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: ExportFilters = {
    campaigns: parseList(sp.get("campaign")),
    dateStart: sp.get("dateStart") ?? "",
    dateEnd:   sp.get("dateEnd")   ?? "",
  };

  const results = await Promise.allSettled(SECTIONS.map((s) => s.load(filters)));
  const failed = SECTIONS
    .map((s, i) => ({ title: s.title, result: results[i] }))
    .filter((x): x is { title: string; result: PromiseRejectedResult } => x.result.status === "rejected");

  // Never hand back a workbook that's silently missing a dataset.
  if (failed.length) {
    const names = failed.map((f) => f.title);
    console.error("Export All failed:", failed.map((f) => `${f.title}: ${String(f.result.reason)}`).join(" | "));
    return NextResponse.json(
      { error: `Export failed for ${names.join(", ")}. Please try again.`, failed: names },
      { status: 502 },
    );
  }

  const sections = SECTIONS.map((spec, i) => ({
    spec,
    rows: (results[i] as PromiseFulfilledResult<unknown[]>).value,
  }));

  try {
    const { buf, masterRowCount } = await buildWorkbook(sections);
    const counts = [`Master=${masterRowCount}`, ...sections.map((s) => `${s.spec.title}=${s.rows.length}`)].join("; ");
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename(filters.campaigns)}"`,
        "Cache-Control": "no-store",
        // Row counts per dataset, for checking against each tab.
        "X-Export-Counts": counts,
      },
    });
  } catch (err) {
    console.error("Export All: building workbook failed:", err);
    return NextResponse.json({ error: "Export failed while building the workbook. Please try again." }, { status: 500 });
  }
}
