import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COL_NAMES = ["District", "Domain", "State", "Job Function", "Campaign", "Engagements", "Leads"];

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInList(values: string[]): string {
  return `(${values.map(sqlStr).join(", ")})`;
}

function normaliseCols(rawCols: { base_type: string }[]) {
  return rawCols.map((c, i) => ({
    display_name: COL_NAMES[i] ?? (c as { display_name?: string }).display_name,
    base_type: c.base_type,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const states    = parseList(searchParams.get("state"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";
  const hasDate   = !!(dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd));

  // Matches card 168 SQL exactly. Campaign filter uses Abmi_Campaign (full names)
  // because card 168 has no campaign template tag — we inject it directly.
  const where: string[] = [
    "sc.topic_district IS NOT NULL", "sc.topic_district != ''",
    "sc.email_domain IS NOT NULL",   "sc.email_domain != ''",
    "sc.state IS NOT NULL",          "sc.state != ''",          "sc.state != 'cState'",
    "sc.job_title IS NOT NULL",      "sc.job_title != ''",
    "sc.abm_campaign IS NOT NULL",   "sc.abm_campaign != ''",
  ];

  if (campaigns.length) where.push(`sc.Abmi_Campaign IN ${sqlInList(campaigns)}`);
  if (states.length)    where.push(`sc.state IN ${sqlInList(states)}`);

  // Each row has its own date_max_for_intent_scoring (weekly engagement date);
  // last_updated is a single shared batch-load timestamp and doesn't actually
  // distinguish rows, so date filtering has to use date_max_for_intent_scoring.
  if (hasDate) {
    where.push(`DATE(sc.date_max_for_intent_scoring) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);
  }

  const sql = `
SELECT
  sc.topic_district  AS District,
  sc.email_domain    AS District_Domain,
  sc.state           AS State,
  sc.job_title       AS Job_Function,
  sc.abm_campaign    AS Campaign,
  SUM(sc.engagements)  AS Engagements,
  COUNT(sc.leads)      AS Leads
FROM ${TABLE} sc
WHERE ${where.join("\n  AND ")}
GROUP BY sc.topic_district, sc.email_domain, sc.state, sc.job_title, sc.abm_campaign
HAVING SUM(sc.engagements) > 0
ORDER BY Engagements DESC`;

  try {
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: "native",
        native: { query: sql },
        constraints: { "max-results": 1000000 },
        middleware: { "js-int-to-string?": true },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { cols: [], rows: [], error: `Metabase ${res.status}: ${body.slice(0, 800)}` },
        { status: 500 },
      );
    }

    const data = await res.json();
    if (data.error) return NextResponse.json({ cols: [], rows: [], error: data.error });

    const cols = normaliseCols(data.data?.cols ?? []);
    const rows: unknown[][] = data.data?.rows ?? [];

    return NextResponse.json({ cols, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ cols: [], rows: [], error: String(err) });
  }
}
