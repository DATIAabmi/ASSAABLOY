// SQL and card parameters shared by the dashboard data routes and Export All,
// so both read each dataset with exactly the same query and campaign logic.

import { campaignCode } from "@/lib/exportColumns";

export const SCORING_DB_ID = 34;
export const SCORING_TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_assaabloy_202602_scoring`";

export const AI_SIGNALS_DB_ID = 67;
const AI_SIGNALS_TABLE = "`project-d5919e8b-bf9c-4f4d-883.analytics.ai_signals`";
const AI_SIGNALS_CLIENT_ID = "12095"; // ASSA ABLOY

export const TOPIC_CARD_ID = 548; // ASSA ABLOY clone of RAS card 181
export const LEADS_CARD_ID = 541; // ASSA ABLOY clone of RAS card 174

export function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInList(values: string[]): string {
  return `(${values.map(sqlStr).join(", ")})`;
}


// ── Engaged Users by Organization ────────────────────────────────────────────

export function engagedUsersSql(f: { campaigns: string[]; districts?: string[]; domains?: string[]; states?: string[] }): string {
  const where: string[] = [
    "topic_district IS NOT NULL",
    "topic_district != ''",
  ];

  // Campaign filter applied BEFORE GROUP BY so aggregates are correct.
  // The ASSA ABLOY scoring table's `abm_campaign` column holds the short code
  // ("C1"). Normalize any full label ("C1: March - April 2026") down to its code.
  if (f.campaigns.length) where.push(`abm_campaign IN ${sqlInList(f.campaigns.map(campaignCode))}`);
  if (f.districts?.length) where.push(`topic_district IN ${sqlInList(f.districts)}`);
  if (f.domains?.length)   where.push(`email_domain IN ${sqlInList(f.domains)}`);
  if (f.states?.length)    where.push(`state IN ${sqlInList(f.states)}`);

  return `
SELECT
  topic_district AS District,
  email_domain AS Domain,
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
FROM ${SCORING_TABLE}
WHERE ${where.join("\n  AND ")}
GROUP BY topic_district, email_domain
ORDER BY \`Intent Score\` DESC`;
}

// ── Persona Insights (matches card 168) ──────────────────────────────────────

export function personaSql(f: {
  campaigns?: string[]; dateStart?: string; dateEnd?: string;
  districts?: string[]; states?: string[]; jobFunctions?: string[];
}): string {
  const where: string[] = [
    "sc.topic_district IS NOT NULL", "sc.topic_district != ''",
    "sc.email_domain IS NOT NULL",   "sc.email_domain != ''",
    "sc.state IS NOT NULL",          "sc.state != ''", "sc.state != 'cState'",
    "sc.job_title IS NOT NULL",      "sc.job_title != ''",
    "sc.abm_campaign IS NOT NULL",   "sc.abm_campaign != ''",
  ];

  // Card 168 has no campaign template tag, so the full-name column is filtered directly.
  if (f.campaigns?.length)      where.push(`sc.Abmi_Campaign IN ${sqlInList(f.campaigns)}`);
  if (f.dateStart && f.dateEnd) where.push(`DATE(sc.last_updated) BETWEEN ${sqlStr(f.dateStart)} AND ${sqlStr(f.dateEnd)}`);
  if (f.districts?.length)      where.push(`STRPOS(LOWER(sc.topic_district), LOWER(${sqlStr(f.districts[0])})) > 0`);
  if (f.states?.length)         where.push(`sc.state IN ${sqlInList(f.states)}`);
  if (f.jobFunctions?.length)   where.push(`sc.job_title IN ${sqlInList(f.jobFunctions)}`);

  return `
SELECT
  sc.topic_district  AS District,
  sc.email_domain    AS District_Domain,
  sc.state           AS State,
  sc.job_title       AS Job_Function,
  sc.abm_campaign    AS Campaign,
  SUM(sc.engagements)  AS Engagements,
  COUNT(sc.leads)      AS Leads
FROM ${SCORING_TABLE} sc
WHERE ${where.join("\n  AND ")}
GROUP BY sc.topic_district, sc.email_domain, sc.state, sc.job_title, sc.abm_campaign
ORDER BY Engagements DESC`;
}

// ── Account Intelligence ─────────────────────────────────────────────────────
// Native SQL (not an MBQL source-table query): Metabase caches the table's
// field names, and when the upstream schema renamed "Customer ID" ->
// "Client ID" every MBQL query failed with "Name Customer ID not found".

export const AI_SIGNALS_SQL = `SELECT * FROM ${AI_SIGNALS_TABLE} WHERE CAST(\`Client ID\` AS STRING) = '${AI_SIGNALS_CLIENT_ID}'`;

// ── Lead Insights ────────────────────────────────────────────────────────────

/** District → SBM ("Y"/"N"), shown as the Intel column. */
export function sbmByDistrictSql(campaigns: string[]): string {
  const where = ["topic_district IS NOT NULL", "topic_district != ''"];
  if (campaigns.length) {
    // Match the full-label column (abmi_campaign) — abm_campaign only holds
    // the short code ("C1"), which can't LIKE-match a full campaign label.
    const likeExprs = campaigns.map((c) => `LOWER(abmi_campaign) LIKE LOWER('%${c.replace(/'/g, "''")}%')`);
    where.push(`(${likeExprs.join(" OR ")})`);
  }
  return `
SELECT
  topic_district,
  IF(MAX(CASE WHEN SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS SBM
FROM ${SCORING_TABLE}
WHERE ${where.join(" AND ")}
GROUP BY topic_district`;
}

// Values are passed without manual quoting — Metabase auto-quotes string/=
// template tag values on substitution, so manual quotes cause double-quoting.
export function leadsCardParams(campaign: string, dateStart: string, dateEnd: string, contentName = ""): object[] {
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
  if (contentName) parameters.push({
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    type: "string/=",
    value: contentName,
    target: ["variable", ["template-tag", "Content_Name"]],
  });
  return parameters;
}

// ── Topic Insights ───────────────────────────────────────────────────────────

export function topicCardParams(dateStart: string, dateEnd: string): object[] {
  if (!(dateStart && dateEnd)) return [];
  return [{ id: "date", type: "date/range", value: `${dateStart}~${dateEnd}`, target: ["dimension", ["template-tag", "Last_Updated"]] }];
}

// ── Uncapped Metabase reads ──────────────────────────────────────────────────
// /api/dataset and /api/card/:id/query stop at 10,000 rows. The export
// endpoints below return every row, and with format_rows:false keep numbers
// as numbers and dates as ISO strings.

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

type JsonRow = Record<string, unknown>;

async function postJson(path: string, body: object, timeoutMs: number): Promise<JsonRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${METABASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ ...body, format_rows: false }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(controller.signal.aborted ? "Metabase request timed out" : `Could not reach Metabase: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Metabase ${res.status}: ${text.slice(0, 200)}`);
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error(`Unexpected Metabase response: ${text.slice(0, 200)}`); }
  if (!Array.isArray(data)) {
    const err = (data as { error?: unknown })?.error;
    throw new Error(`Metabase query failed: ${String(err ?? text).slice(0, 200)}`);
  }
  return data as JsonRow[];
}

/** Every row of a native SQL query, as objects keyed by column alias. */
export function queryNativeAll(databaseId: number, sql: string, timeoutMs = 120_000): Promise<JsonRow[]> {
  return postJson("/api/dataset/json", { query: { database: databaseId, type: "native", native: { query: sql } } }, timeoutMs);
}

/** Every row of a saved card, as objects keyed by column name. */
export function queryCardAll(cardId: number, parameters: object[] = [], timeoutMs = 120_000): Promise<JsonRow[]> {
  return postJson(`/api/card/${cardId}/query/json`, { parameters }, timeoutMs);
}
