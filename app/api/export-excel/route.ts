import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  ACCOUNT_INTELLIGENCE_EXPORT, ENGAGED_USERS_EXPORT, LEADS_EXPORT, PERSONA_EXPORT, TOPIC_EXPORT,
  campaignCode, type ExportColumn,
} from "@/lib/exportColumns";
import {
  loadAccountIntelligence, loadEngagedUsers, loadLeads, loadPersona, loadTopic, type ExportFilters,
} from "@/lib/exportDatasets";

export const maxDuration = 300;

// Export All: one worksheet per dataset, each a normal flat table (its own
// single set of columns, one row per record). Earlier this laid all five
// datasets side by side on one sheet, which duplicated the Organization |
// Domain | State | Campaign columns once per section and — since sections
// have very different row counts — left most of the sheet looking empty
// below whichever section ran out of rows first. Separate sheets keep every
// row's columns lined up with that row's own district, with no duplication.

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
  { title: "Lead Insights",             columns: LEADS_EXPORT as ExportColumn<never>[],                load: loadLeads,               fill: "FFFFE4E6" },
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

function toCell(v: unknown, kind: ExportColumn<never>["kind"]): ExcelJS.CellValue {
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

// ── Workbook ─────────────────────────────────────────────────────────────────

const formatFor = (col: ExportColumn<never>) => {
  if (col.kind === "date") return "yyyy-mm-dd";
  if (col.kind === "number") return "#,##0.##";
  return undefined;
};

function buildSheet(wb: ExcelJS.Workbook, spec: SectionSpec, rows: unknown[]) {
  const ws = wb.addWorksheet(spec.title, { views: [{ state: "frozen", ySplit: 1 }] });
  const cols = spec.columns;

  // Row 1 — column headers. Every column is defined exactly once on this
  // sheet, so Organization | Domain | State | Campaign appear a single time
  // (as the sheet's leading columns), not once per dataset.
  const headerRow = ws.getRow(1);
  cols.forEach((c, j) => {
    const cell = headerRow.getCell(j + 1);
    cell.value = c.header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: spec.fill } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 20;

  // Data — every row on this sheet belongs to this dataset, so its
  // Organization/Domain/State/Campaign columns always match that same row.
  for (const row of rows as never[]) {
    const values = cols.map((c) => toCell(c.value(row), c.kind));
    ws.addRow(values);
  }

  // Formats and widths per column.
  cols.forEach((col, j) => {
    const column = ws.getColumn(j + 1);
    const fmt = formatFor(col);
    if (fmt) column.numFmt = fmt;
    const long = ["Signal Analysis", "Source Text", "Keywords", "Organization"].includes(col.header);
    column.width = long ? 40 : col.kind === "url" ? 36 : Math.max(12, col.header.length + 4);
    if (col.kind === "url") column.font = { color: { argb: "FF1D4ED8" }, underline: true };
  });
}

async function buildWorkbook(sections: { spec: SectionSpec; rows: unknown[] }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DATIA ABMxi";
  wb.created = new Date();

  for (const { spec, rows } of sections) buildSheet(wb, spec, rows);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
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
    const buf = await buildWorkbook(sections);
    const counts = sections.map((s) => `${s.spec.title}=${s.rows.length}`).join("; ");
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
