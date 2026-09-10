import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

// Maps SQL alias → display name shown in the UI
const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Camp:        "Campaign",
  Down:        "Downloads",
  EngagedUser: "Engaged Users",
  UniqueLeads: "Leads",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

// Cache keyed on all filter params — campaign filter changes the aggregated Score Trend
const CACHE_TTL_MS = 30 * 60 * 1000;
const memCache = new Map<string, { data: { cols: unknown[]; rows: unknown[][] }; ts: number }>();
const inflight = new Map<string, Promise<{ cols: unknown[]; rows: unknown[][] }>>();

async function fetchData(
  campaigns: string[],
  districts: string[],
  domains: string[],
  states: string[],
): Promise<{ cols: unknown[]; rows: unknown[][] }> {
  const where: string[] = [
    "topic_district IS NOT NULL",
    "topic_district != ''",
  ];

  // Campaign filter applied BEFORE GROUP BY so aggregates are correct.
  // The ASSA ABLOY scoring table stores the full campaign label
  // ("C1: March - April 2026") in `abmi_campaign`; `abm_campaign` only holds
  // the short code ("C1"). The app sends full labels, so match `abmi_campaign`.
  if (campaigns.length) {
    const exprs = campaigns.map((c) => `abmi_campaign = ${sqlStr(c)}`);
    where.push(`(${exprs.join(" OR ")})`);
  }
  if (districts.length) where.push(`topic_district IN (${districts.map(sqlStr).join(", ")})`);
  if (domains.length)   where.push(`email_domain IN (${domains.map(sqlStr).join(", ")})`);
  if (states.length)    where.push(`state IN (${states.map(sqlStr).join(", ")})`);

  const sql = `
SELECT
  topic_district AS District,
  ANY_VALUE(email_domain) AS Domain,
  ANY_VALUE(state) AS ST,
  ANY_VALUE(abm_campaign) AS Camp,
  IF(MAX(CASE WHEN SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS SBM,
  IF(MAX(CASE WHEN topic_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS Topic,
  SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(user_engagement_score_trend) AS EngagedUser,
  COUNT(NULLIF(CAST(leads AS STRING), '')) AS UniqueLeads,
  SUM(IFNULL(SAFE_CAST(downloads AS FLOAT64), 0)) AS Down,
  SUM(IFNULL(SAFE_CAST(cumulative_score AS FLOAT64), 0)) AS \`Intent Score\`,
  SUM(IFNULL(SAFE_CAST(cumulative_score_trend AS FLOAT64), 0)) AS \`Score Trend\`
FROM ${TABLE}
WHERE ${where.join("\n  AND ")}
GROUP BY topic_district
ORDER BY \`Intent Score\` DESC`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  let res: Response;
  try {
    res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: "native",
        native: { query: sql },
        middleware: { "js-int-to-string?": true },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Metabase ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Query error: ${data.error}`);

  const cols = (data.data?.cols ?? []).map(
    (c: { display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.display_name] ?? c.display_name,
      base_type: c.base_type,
    }),
  );
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts = parseList(searchParams.get("district"));
    const domains   = parseList(searchParams.get("domain"));
    const states    = parseList(searchParams.get("state"));

    const cacheKey = JSON.stringify({ campaigns, districts, domains, states });
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cachedJson(cached.data);
    }

    if (!inflight.has(cacheKey)) {
      const p = fetchData(campaigns, districts, domains, states)
        .then((result) => {
          memCache.set(cacheKey, { data: result, ts: Date.now() });
          inflight.delete(cacheKey);
          return result;
        })
        .catch((err) => {
          inflight.delete(cacheKey);
          throw err;
        });
      inflight.set(cacheKey, p);
    }

    const { cols, rows } = await inflight.get(cacheKey)!;
    return cachedJson({ cols, rows });
  } catch (err) {
    return NextResponse.json({ cols: [], rows: [], error: String(err) });
  }
}
