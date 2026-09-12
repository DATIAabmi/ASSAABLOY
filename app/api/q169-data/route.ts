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
  const campaigns = parseList(searchParams.get("campaign"));
  const states    = parseList(searchParams.get("state"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd") ?? "";

  // Matches card 169 SQL exactly.
  const where: string[] = [
    "SAFE_CAST(engagements AS INT64) != 0",
    "state IS NOT NULL", "state != 'cState'", "state != ''",
  ];

  if (campaigns.length)     where.push(`Abmi_Campaign IN ${sqlInList(campaigns)}`);
  if (states.length)        where.push(`State IN ${sqlInList(states)}`);
  if (dateStart && dateEnd) where.push(`DATE(Last_Updated) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);

  const sql = `
SELECT
  State,
  SUM(SAFE_CAST(engagements AS INT64))  AS Engagements,
  COUNT(DISTINCT engaged_user)           AS Engaged_Users,
  COUNT(DISTINCT leads)                  AS leads
FROM ${TABLE}
WHERE ${where.join("\n  AND ")}
GROUP BY State
ORDER BY Engagements DESC`;

  try {
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ cols: [], rows: [] });

    const data = await res.json();
    const DISPLAY_NAMES: Record<string, string> = {
      Engagements:   "Engagements",
      Engaged_Users: "Engaged Users",
      leads:         "Leads",
    };
    const cols = (data.data?.cols ?? []).map((c: { display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.display_name] ?? c.display_name,
      base_type: c.base_type,
    }));
    const rows: unknown[][] = data.data?.rows ?? [];

    // No CDN cache — campaign filter changes results, stale cache causes wrong data.
    return NextResponse.json({ cols, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
