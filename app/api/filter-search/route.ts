import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { JOB_FUNCTION_CATEGORIES, normalizeJobTitle } from "@/lib/jobFunctionCategories";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

const FIELD_MAP: Record<string, string> = {
  district: "topic_district",
  domain: "email_domain",
  state: "state",
  job_function: "job_title",
};

const UNNEST_FIELD_MAP: Record<string, { unnest: string; col: string }> = {
  content_name: { unnest: "sc.engagement", col: "eng.asset_name" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field = searchParams.get("field") ?? "";
  const q = (searchParams.get("q") ?? "").trim();

  // Job function uses normalized categories derived from raw job_title values.
  if (field === "job_function") {
    const allLabels = JOB_FUNCTION_CATEGORIES.map((c) => c.label);
    const values = q
      ? allLabels.filter((l) => l.toLowerCase().includes(q.toLowerCase()))
      : allLabels;
    return cachedJson({ values });
  }

  // Content name queries from UNNEST(sc.engagement)
  if (field in UNNEST_FIELD_MAP) {
    const { unnest, col: unnestCol } = UNNEST_FIELD_MAP[field];
    const safeQ = q.replace(/"/g, "");
    const whereClause = safeQ
      ? `WHERE ${unnestCol} IS NOT NULL AND ${unnestCol} != 'null' AND LOWER(${unnestCol}) LIKE LOWER("%${safeQ}%")`
      : `WHERE ${unnestCol} IS NOT NULL AND ${unnestCol} != 'null'`;
    const sql = `SELECT DISTINCT ${unnestCol} FROM ${TABLE} sc, UNNEST(${unnest}) AS eng ${whereClause} ORDER BY ${unnestCol} LIMIT 200`;
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
    });
    const data = await res.json();
    const values: string[] = (data?.data?.rows ?? []).map((r: string[]) => r[0]).filter(Boolean);
    return cachedJson({ values });
  }

  const col = FIELD_MAP[field];
  if (!col) return NextResponse.json({ values: [] });

  // A real search term gets a much higher cap so "select all shown" in the
  // UI doesn't silently miss matches past the limit — an empty query (just
  // browsing on open) stays capped low since that list is only a preview.
  const limit = q ? 1000 : 50;
  const sql = q
    ? `SELECT DISTINCT ${col} FROM ${TABLE} WHERE LOWER(${col}) LIKE LOWER("%${q.replace(/"/g, "")}%") AND ${col} IS NOT NULL AND ${col} != "" ORDER BY ${col} LIMIT ${limit}`
    : `SELECT DISTINCT ${col} FROM ${TABLE} WHERE ${col} IS NOT NULL AND ${col} != "" ORDER BY ${col} LIMIT ${limit}`;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
      middleware: { "js-int-to-string?": true },
    }),
  });

  const data = await res.json();
  const values: string[] = (data?.data?.rows ?? []).map((r: string[]) => r[0]).filter(Boolean);
  return cachedJson({ values });
}
