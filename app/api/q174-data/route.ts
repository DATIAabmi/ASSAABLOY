import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { normalizeJobTitle } from "@/lib/jobFunctionCategories";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

// Returns a map of lowercase district name → "Y" | "N"
async function fetchSBMByDistrict(campaigns: string[]): Promise<Map<string, string>> {
  const where = ["topic_district IS NOT NULL", "topic_district != ''"];
  if (campaigns.length) {
    // Match the full-label column (abmi_campaign) — abm_campaign only holds
    // the short code ("C1"), which can't LIKE-match a full campaign label.
    const likeExprs = campaigns.map((c) => `LOWER(abmi_campaign) LIKE LOWER('%${c.replace(/'/g, "''")}%')`);
    where.push(`(${likeExprs.join(" OR ")})`);
  }
  const sql = `
SELECT
  topic_district,
  IF(MAX(CASE WHEN SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS SBM
FROM ${TABLE}
WHERE ${where.join(" AND ")}
GROUP BY topic_district`;

  try {
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
      cache: "no-store",
    });
    if (!res.ok) return new Map();
    const data = await res.json();
    const map = new Map<string, string>();
    for (const row of (data.data?.rows ?? []) as [string, string][]) {
      if (row[0]) map.set(String(row[0]).toLowerCase(), row[1] ?? "N");
    }
    return map;
  } catch { return new Map(); }
}

const DISPLAY_NAMES: Record<string, string> = {
  Job_Function:    "Job Function",
  Total_Downloads: "Total Downloads",
  ST:              "State",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Fetch card 541 (ASSA ABLOY clone of RAS card 174) for a single
// (campaign, contentName) combination. Values are passed without manual
// quoting — Metabase auto-quotes string/= template tag values on
// substitution, so manual quotes cause double-quoting.
async function fetchForCampaign(campaign: string, dateStart: string, dateEnd: string, contentName: string) {
  const parameters: object[] = [];

  if (campaign) parameters.push({
    id: "c045eb3b-8728-447b-a1de-9172b6c283f7",
    type: "string/=",
    value: campaign,
    target: ["variable", ["template-tag", "Abmi_Campaign"]],
  });
  if (dateStart && dateEnd) parameters.push({
    id: "date",
    type: "date/range",
    value: `${dateStart}~${dateEnd}`,
    target: ["dimension", ["template-tag", "Last_Updated"]],
  });
  if (contentName) {
    parameters.push({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      type: "string/=",
      value: contentName,
      target: ["variable", ["template-tag", "Content_Name"]],
    });
  }

  const res = await fetch(`${METABASE_URL}/api/card/541/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  const baseCols: { display_name: string; base_type: string }[] = (data.data?.cols ?? []).map(
    (c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    })
  );
  const baseRows: unknown[][] = data.data?.rows ?? [];

  // Inject Campaign column at index 2 (after District, Domain) — this card has
  // no real per-row campaign dimension, so the requested value is echoed back.
  const campaignCol = { display_name: "Campaign", base_type: "type/Text" };
  const campaignVal = campaign ? campaign.split(":")[0].trim() : "All";
  const cols = [baseCols[0], baseCols[1], campaignCol, ...baseCols.slice(2)];
  const rows = baseRows.map((row) => [row[0], row[1], campaignVal, ...row.slice(2)]);

  return { cols, rows };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns    = parseList(searchParams.get("campaign"));
    const districts    = parseList(searchParams.get("district"));
    const states       = parseList(searchParams.get("state"));
    const jobFunctions = searchParams.getAll("jobFunction").map((s) => s.trim()).filter(Boolean);
    const contentNames = searchParams.getAll("contentName").map((s) => s.trim()).filter(Boolean);
    const dateStart    = searchParams.get("dateStart")   ?? "";
    const dateEnd      = searchParams.get("dateEnd")     ?? "";

    // One Metabase call per (campaign × content_name) so each value is passed
    // individually and quoted correctly. Empty string means "no filter".
    const campaignList = campaigns.length > 0 ? campaigns : [""];
    const contentNameList = contentNames.length > 0 ? contentNames : [""];
    const [results, sbmMap] = await Promise.all([
      Promise.all(campaignList.flatMap((c) => contentNameList.map((n) => fetchForCampaign(c, dateStart, dateEnd, n)))),
      fetchSBMByDistrict(campaigns),
    ]);

    const first = results.find((r) => r !== null);
    if (!first) {
      return NextResponse.json({ cols: [], rows: [], error: "Metabase error" });
    }
    // Append SBM as column index 6 (after District, Domain, Campaign, State, Job Function, Downloads)
    const sbmCol = { display_name: "Intel", base_type: "type/Text" };
    const cols = [...first.cols, sbmCol];
    // When multiple content names are selected, multiple result sets may return
    // the same district+domain+state+job row. Merge by summing Total_Downloads.
    // cols: 0=District 1=Domain 2=Campaign 3=State 4=Job Function 5=Total Downloads 6=SBM
    const downloadCol = 5;
    const rowMap = new Map<string, unknown[]>();
    for (const r of results) {
      for (const row of r?.rows ?? []) {
        const districtKey = String(row[0] ?? "").toLowerCase();
        const sbm = sbmMap.get(districtKey) ?? "N";
        const fullRow = [...row, sbm];
        const key = fullRow.slice(0, downloadCol).join("\x00");
        const existing = rowMap.get(key);
        if (existing) {
          existing[downloadCol] = Number(existing[downloadCol] ?? 0) + Number(fullRow[downloadCol] ?? 0);
        } else {
          rowMap.set(key, fullRow);
        }
      }
    }
    let rows = [...rowMap.values()];

    // District/State/Job Function are real per-row columns here, so multiple
    // selections can be applied locally after fetching.
    const districtCol = cols.findIndex((c) => c.display_name === "District");
    const stateCol = cols.findIndex((c) => c.display_name === "State");
    const jobFunctionCol = cols.findIndex((c) => c.display_name === "Job Function");

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    // Job function filter uses normalized categories — match by normalizing the raw job_title.
    const matchesJobFunction = (row: unknown[]) =>
      jobFunctions.length === 0 ||
      (jobFunctionCol >= 0 && jobFunctions.includes(normalizeJobTitle(String(row[jobFunctionCol] ?? ""))));

    rows = rows
      .filter(matches(districts, districtCol))
      .filter(matches(states, stateCol))
      .filter(matchesJobFunction);

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
