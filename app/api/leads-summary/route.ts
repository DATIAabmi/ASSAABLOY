import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

const CACHE_TTL_MS = 30 * 60 * 1000;
type SummaryResult = {
  totalDownloads: unknown;
  totalUniqueLeads: unknown;
  uniqueLeadDistrict: unknown;
  byContentType: [string, number][];
  byContentName: [string, number][];
};
const memCache = new Map<string, { data: SummaryResult; ts: number }>();
const inflight = new Map<string, Promise<SummaryResult>>();

/** Escape a value for safe inline SQL string substitution. */
function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/** Build the shared WHERE clause for a given filter combination. */
function buildWhere(campaign: string, dateStart: string, dateEnd: string, district: string, state: string): string {
  const parts: string[] = [
    "sc.leads IS NOT NULL",
    "sc.leads != ''",
    "sc.topic_district IS NOT NULL",
    "sc.topic_district != ''",
    "sc.state IS NOT NULL",
    "sc.state != ''",
    "sc.job_title IS NOT NULL",
    "sc.job_title != ''",
  ];
  if (campaign)            parts.push(`sc.abmi_campaign = ${sqlStr(campaign)}`);
  if (dateStart && dateEnd) parts.push(`DATE(sc.last_updated) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);
  if (district)            parts.push(`sc.topic_district = ${sqlStr(district)}`);
  if (state)               parts.push(`sc.state = ${sqlStr(state)}`);
  return "WHERE " + parts.join("\n  AND ");
}

async function runSQL(sql: string): Promise<unknown[][] | null> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.rows ?? null;
}

async function fetchSummaryForFilters(
  campaign: string,
  dateStart: string,
  dateEnd: string,
  district: string,
  state: string,
): Promise<SummaryResult> {
  const where = buildWhere(campaign, dateStart, dateEnd, district, state);

  const [r175, r176, r177, r178, r179] = await Promise.all([
    runSQL(`SELECT COUNT(sc.downloads) AS Total_Downloads FROM ${TABLE} sc ${where}`),
    runSQL(`SELECT COUNT(DISTINCT sc.leads) AS Total_Unique_Leads FROM ${TABLE} sc ${where}`),
    runSQL(`SELECT COUNT(DISTINCT sc.topic_district) AS Unique_Lead_Districts FROM ${TABLE} sc ${where}`),
    runSQL(`SELECT item.asset_type, COUNT(DISTINCT sc.leads) FROM ${TABLE} sc, UNNEST(sc.engagement) AS item ${where} AND item.asset_name != 'null' AND item.asset_type IS NOT NULL GROUP BY item.asset_type ORDER BY 2 DESC`),
    runSQL(`SELECT item.asset_name, COUNT(DISTINCT sc.leads) FROM ${TABLE} sc, UNNEST(sc.engagement) AS item ${where} AND item.asset_name != 'null' AND item.asset_name IS NOT NULL GROUP BY item.asset_name ORDER BY 2 DESC`),
  ]);

  return {
    totalDownloads:     r175?.[0]?.[0] ?? null,
    totalUniqueLeads:   r176?.[0]?.[0] ?? null,
    uniqueLeadDistrict: r177?.[0]?.[0] ?? null,
    byContentType: (r178 ?? []) as [string, number][],
    byContentName: (r179 ?? []) as [string, number][],
  };
}

function sum(values: (string | number | null | undefined)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function mergeLabeledCounts(rowSets: [string, number][][]): [string, number][] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const [label, count] of rows) {
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

async function getResult(
  campaigns: string[],
  dateStart: string,
  dateEnd: string,
  districts: string[],
  states: string[],
): Promise<SummaryResult> {
  const campaignList = campaigns.length ? campaigns : [""];
  const districtList = districts.length ? districts : [""];
  const stateList    = states.length    ? states    : [""];
  const useCache     = districts.length === 0 && states.length === 0;

  // One call per (campaign × district × state) combination so each value is
  // a single SQL string literal — no template tag or IN-list quoting issues.
  const combos: [string, string, string][] = campaignList.flatMap((c) =>
    districtList.flatMap((d) =>
      stateList.map((s): [string, string, string] => [c, d, s])
    )
  );

  if (!useCache) {
    const perCombo = await Promise.all(
      combos.map(([c, d, s]) => fetchSummaryForFilters(c, dateStart, dateEnd, d, s))
    );
    if (perCombo.length === 1) return perCombo[0];
    return {
      totalDownloads:     sum(perCombo.map((r) => r.totalDownloads)),
      totalUniqueLeads:   sum(perCombo.map((r) => r.totalUniqueLeads)),
      uniqueLeadDistrict: sum(perCombo.map((r) => r.uniqueLeadDistrict)),
      byContentType: mergeLabeledCounts(perCombo.map((r) => r.byContentType)),
      byContentName: mergeLabeledCounts(perCombo.map((r) => r.byContentName)),
    };
  }

  const key = `${campaignList.join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      const perCombo = await Promise.all(
        combos.map(([c, d, s]) => fetchSummaryForFilters(c, dateStart, dateEnd, d, s))
      );
      const result: SummaryResult = perCombo.length === 1
        ? perCombo[0]
        : {
            totalDownloads:     sum(perCombo.map((r) => r.totalDownloads)),
            totalUniqueLeads:   sum(perCombo.map((r) => r.totalUniqueLeads)),
            uniqueLeadDistrict: sum(perCombo.map((r) => r.uniqueLeadDistrict)),
            byContentType: mergeLabeledCounts(perCombo.map((r) => r.byContentType)),
            byContentName: mergeLabeledCounts(perCombo.map((r) => r.byContentName)),
          };
      memCache.set(key, { data: result, ts: Date.now() });
      inflight.delete(key);
      return result;
    })();
    p.catch(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";
  const districts = (searchParams.get("district") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const states    = (searchParams.get("state")    ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return cachedJson(await getResult(campaigns, dateStart, dateEnd, districts, states));
}
