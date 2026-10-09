// Full (uncapped) dataset loaders for Export All. Each returns rows in the same
// shape its dashboard route returns, and applies the same campaign/date logic
// as that dashboard tab, so lib/exportColumns.ts definitions apply unchanged.

import {
  AI_SIGNALS_DB_ID, AI_SIGNALS_SQL, LEADS_CARD_ID, SCORING_DB_ID, TOPIC_CARD_ID,
  engagedUsersSql, geoInsightsSql, leadsCardParams, personaSql, queryCardAll, queryNativeAll,
  topicCardParams,
} from "@/lib/metabaseQueries";
import { campaignCode } from "@/lib/exportColumns";

export interface ExportFilters {
  campaigns: string[]; // full labels from the global Campaign filter; [] = all campaigns
  dateStart: string;
  dateEnd: string;
}

type Row = unknown[];

const pick = (keys: string[]) => (o: Record<string, unknown>): Row => keys.map((k) => o[k]);

function inCampaigns(campaigns: string[]) {
  const codes = new Set(campaigns.map(campaignCode));
  return (value: unknown) => codes.size === 0 || codes.has(campaignCode(value));
}

/** Engaged Users by Organization — campaign applied in SQL (no date filter on this tab). */
export async function loadEngagedUsers(f: ExportFilters): Promise<Row[]> {
  const rows = await queryNativeAll(SCORING_DB_ID, engagedUsersSql({ campaigns: f.campaigns }));
  return rows.map(pick(["District", "Domain", "ST", "Camp", "SBM", "Topic", "Engagements", "EngagedUser", "UniqueLeads", "Down", "Intent Score", "Score Trend"]));
}

/** Account Intelligence — every ai_signals row for the client, campaign
 *  filtered by code like the tab does (signals are tagged with their own
 *  "Campaign #", currently all "C5"). */
export async function loadAccountIntelligence(f: ExportFilters): Promise<Record<string, unknown>[]> {
  const rows = await queryNativeAll(AI_SIGNALS_DB_ID, AI_SIGNALS_SQL);
  const keep = inCampaigns(f.campaigns);
  return rows.filter((r) => keep(r["Campaign #"]));
}

/** Persona Insights — date in SQL, campaign filtered by code like the tab does. */
export async function loadPersona(f: ExportFilters): Promise<Row[]> {
  const rows = await queryNativeAll(SCORING_DB_ID, personaSql({ dateStart: f.dateStart, dateEnd: f.dateEnd }));
  const keep = inCampaigns(f.campaigns);
  return rows
    .map(pick(["District", "District_Domain", "State", "Job_Function", "Campaign", "Engagements", "Leads"]))
    .filter((r) => keep(r[4]));
}

/** Topic Insights — card 548 (date as a card parameter), campaign filtered by code. */
export async function loadTopic(f: ExportFilters): Promise<Row[]> {
  const rows = await queryCardAll(TOPIC_CARD_ID, topicCardParams(f.dateStart, f.dateEnd));
  const keep = inCampaigns(f.campaigns);
  return rows
    .map(pick(["District", "Domain", "Campaign", "ST", "Topic", "Topic_Score", "Date"]))
    .filter((r) => keep(r[2]));
}

/** Geo Insights — matches card 169 (state-level only, no district breakdown). */
export async function loadGeoInsights(f: ExportFilters): Promise<Record<string, unknown>[]> {
  return queryNativeAll(SCORING_DB_ID, geoInsightsSql({ campaigns: f.campaigns, dateStart: f.dateStart, dateEnd: f.dateEnd }));
}

/** Leads Insights — card 541 once per campaign. No Intel/SBM column: that's a
 *  district-level lookup from the scoring table, not data card 541 itself has. */
export async function loadLeads(f: ExportFilters): Promise<Row[]> {
  const campaignList = f.campaigns.length ? f.campaigns : [""];
  const perCampaign = await Promise.all(campaignList.map(async (c) => {
    const rows = await queryCardAll(LEADS_CARD_ID, leadsCardParams(c, f.dateStart, f.dateEnd));
    const campaignVal = c ? campaignCode(c) : "All";
    return rows.map((o) => [o["District"], o["Domain"], campaignVal, o["State"], o["Job_Function"], o["Total_Downloads"]]);
  }));
  return perCampaign.flat();
}
