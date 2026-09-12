import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInList(values: string[]): string {
  return `(${values.map(sqlStr).join(", ")})`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns    = parseList(searchParams.get("campaign"));
  const districts    = parseList(searchParams.get("district"));
  const states       = parseList(searchParams.get("state"));
  const jobFunctions = parseList(searchParams.get("jobFunction"));
  const dateStart    = searchParams.get("dateStart") ?? "";
  const dateEnd      = searchParams.get("dateEnd") ?? "";

  // Matches card 168 SQL exactly. Campaign filter uses Abmi_Campaign (full names)
  // because card 168 has no campaign template tag — we inject it directly.
  const where: string[] = [
    "sc.topic_district IS NOT NULL", "sc.topic_district != ''",
    "sc.email_domain IS NOT NULL",   "sc.email_domain != ''",
    "sc.state IS NOT NULL",          "sc.state != ''", "sc.state != 'cState'",
    "sc.job_title IS NOT NULL",      "sc.job_title != ''",
    "sc.abm_campaign IS NOT NULL",   "sc.abm_campaign != ''",
  ];

  if (campaigns.length)     where.push(`sc.Abmi_Campaign IN ${sqlInList(campaigns)}`);
  if (dateStart && dateEnd) where.push(`DATE(sc.last_updated) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);
  if (districts.length)     where.push(`STRPOS(LOWER(sc.topic_district), LOWER(${sqlStr(districts[0])})) > 0`);
  if (states.length)        where.push(`sc.state IN ${sqlInList(states)}`);
  if (jobFunctions.length)  where.push(`sc.job_title IN ${sqlInList(jobFunctions)}`);

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
ORDER BY Engagements DESC`;

  try {
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });

    const data = await res.json();
    const COL_NAMES = ["District", "Domain", "State", "Job Function", "Campaign", "Engagements", "Leads"];
    const cols = (data.data?.cols ?? []).map((c: { base_type: string }, i: number) => ({
      display_name: COL_NAMES[i] ?? c,
      base_type: c.base_type,
    }));
    const rows: unknown[][] = data.data?.rows ?? [];

    return NextResponse.json({ cols, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
