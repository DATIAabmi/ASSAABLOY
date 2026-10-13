import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { CAMPAIGNS } from "@/lib/campaigns";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

const STATIC_COLS = [
  { display_name: "District",      base_type: "type/Text" },
  { display_name: "Campaign",      base_type: "type/Text" },
  { display_name: "District Domain", base_type: "type/Text" },
  { display_name: "State",         base_type: "type/Text" },
  { display_name: "SBM Date",      base_type: "type/DateTime" },
  { display_name: "Keyword",       base_type: "type/Text" },
  { display_name: "SBM Context",   base_type: "type/Text" },
  { display_name: "SBM Link",      base_type: "type/Text" },
];

const SQL = `
SELECT
  topic_district        AS District,
  abmi_campaign         AS Campaign,
  email_domain          AS District_Domain,
  state                 AS State,
  e.SBM_Date            AS SBM_Date,
  e.curate_topic        AS Keyword,
  e.SBM_Context         AS SBM_Context,
  e.SBM_Link            AS SBM_Link
FROM \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring\`,
UNNEST(engagement) AS e
WHERE e.SBM_Date IS NOT NULL
  AND e.SBM_Link IS NOT NULL
ORDER BY topic_district, e.SBM_Date DESC
`;

// School board minutes also arrive as AI signals (ai_signals table, same DB/
// Client ID as /api/ai-signals-data). Pulled with native SQL for the same
// stale-field-metadata reason, filtered to board-minutes sources, and mapped
// onto the scoring table's 8 columns so both sources render as one table.
const SIGNALS_DB_ID = 67;
const SIGNALS_SQL = `
SELECT
  Organization          AS District,
  \`Campaign #\`        AS Campaign,
  Domain                AS District_Domain,
  State                 AS State,
  CAST(\`Date\` AS STRING) AS SBM_Date,
  Keywords              AS Keyword,
  COALESCE(NULLIF(\`Source Text\`, ''), \`Signal Analysis\`) AS SBM_Context,
  \`Source Link\`       AS SBM_Link
FROM \`project-d5919e8b-bf9c-4f4d-883.analytics.ai_signals\`
WHERE CAST(\`Client ID\` AS STRING) = '12095'
  AND (LOWER(Source) LIKE '%board%' OR LOWER(Source) LIKE '%minutes%')
  AND \`Source Link\` IS NOT NULL
`;

const CACHE_TTL_MS = 30 * 60 * 1000;
let memCache: { rows: unknown[][] } | null = null;
let memCacheAt = 0;
let inflightPromise: Promise<{ rows: unknown[][] }> | null = null;

async function runNative(database: number, query: string): Promise<unknown[][]> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database, type: "native", native: { query } }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const data = await res.json();
  if (data.error || data.status === "failed") throw new Error(String(data.error ?? "Query failed"));
  return data.data?.rows ?? [];
}

// ai_signals tags campaigns with the short code ("C5"); the scoring table and
// the global Campaign filter use the full label ("C5: September 2026").
function campaignLabel(code: unknown): unknown {
  const c = String(code ?? "").trim();
  if (!c) return code;
  return CAMPAIGNS.find((label) => label.split(":")[0].trim() === c) ?? c;
}

async function fetchFullDataset() {
  const [scoring, signals] = await Promise.allSettled([
    runNative(DB_ID, SQL),
    runNative(SIGNALS_DB_ID, SIGNALS_SQL),
  ]);
  // Either source failing still returns the other's rows.
  const scoringRows = scoring.status === "fulfilled" ? scoring.value : [];
  const signalRows  = signals.status === "fulfilled" ? signals.value : [];

  // Drop signals that duplicate a scoring-table minute (same link + date).
  const key = (r: unknown[]) =>
    `${String(r[7] ?? "").trim().toLowerCase()}|${String(r[4] ?? "").slice(0, 10)}`;
  const seen = new Set(scoringRows.map(key));
  const extra: unknown[][] = [];
  for (const r of signalRows) {
    if (seen.has(key(r))) continue;
    seen.add(key(r));
    const row = [...r];
    row[1] = campaignLabel(row[1]);
    extra.push(row);
  }

  const rows = [...scoringRows, ...extra].sort((a, b) =>
    String(a[0] ?? "").localeCompare(String(b[0] ?? "")) ||
    String(b[4] ?? "").localeCompare(String(a[4] ?? ""))
  );
  return { rows };
}

async function getDataset() {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;
  if (!inflightPromise) {
    inflightPromise = fetchFullDataset().then((result) => {
      memCache = result;
      memCacheAt = Date.now();
      inflightPromise = null;
      return result;
    }).catch((err) => {
      inflightPromise = null;
      throw err;
    });
  }
  return inflightPromise;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts  = parseList(searchParams.get("district"));
    const dateStart  = searchParams.get("dateStart") ?? "";
    const dateEnd    = searchParams.get("dateEnd")   ?? "";

    // col indices: 0=District 1=Campaign 2=District_Domain 3=State 4=SBM_Date 5=Keyword 6=SBM_Context 7=SBM_Link
    const { rows: allRows } = await getDataset();

    const matches = (values: string[], idx: number) => (row: unknown[]) =>
      values.length === 0 || values.some((v) => v.toLowerCase() === String(row[idx] ?? "").toLowerCase());

    const rows = allRows
      .filter(matches(campaigns, 1))
      .filter(matches(districts, 0))
      .filter((row) => {
        if (!dateStart && !dateEnd) return true;
        const raw = String(row[4] ?? "").slice(0, 10);
        if (dateStart && raw < dateStart) return false;
        if (dateEnd   && raw > dateEnd)   return false;
        return true;
      });

    return cachedJson({ cols: STATIC_COLS, rows });
  } catch {
    return NextResponse.json({ cols: STATIC_COLS, rows: [] });
  }
}
