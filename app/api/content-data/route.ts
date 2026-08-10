import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchCard(cardId: number, params: object[]) {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: params }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.rows ?? [];
  } catch {
    return null;
  }
}

function sum(values: (string | number | null | undefined)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

// ctr comes back pre-formatted (e.g. "1.36%"), so strip non-numeric
// characters before averaging, then re-format to match that same shape.
function avgPct(values: (string | number | null | undefined)[]): string | null {
  const nums = values
    .map((v) => (typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v)))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return `${avg.toFixed(2)}%`;
}

// Merge [label, count, ...rest][] across campaigns by summing the count column (index 1).
function mergeByLabel(rowSets: unknown[][][]): unknown[][] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const row of rows) {
      const label = String(row[0]);
      const count = Number(row[1]) || 0;
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

async function fetchContentForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const params: object[] = [];
  if (campaign)  params.push({ id: "campaign",   type: "string/=",   value: campaign,  target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart) params.push({ id: "date_start", type: "date/range",  value: dateStart, target: ["variable", ["template-tag", "Date"]] });
  if (dateEnd)   params.push({ id: "date_end",   type: "date/range",  value: dateEnd,   target: ["variable", ["template-tag", "Date"]] });

  const [rows200, rows201, rows202, rows203, rows204] = await Promise.all([
    fetchCard(200, params),
    fetchCard(201, params),
    fetchCard(202, params),
    fetchCard(203, params),
    fetchCard(204, params),
  ]);

  return {
    impressions:      rows200?.[0]?.[0] ?? null,
    clicks:           rows201?.[0]?.[0] ?? null,
    ctr:              rows202?.[0]?.[0] ?? null,
    channelBreakdown: (rows203 ?? []) as unknown[][],
    channelClicks:    (rows204 ?? []) as unknown[][],
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  if (campaigns.length <= 1) {
    const result = await fetchContentForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
    return cachedJson(result);
  }

  const perCampaign = await Promise.all(campaigns.map((c) => fetchContentForCampaign(c, dateStart, dateEnd)));
  return cachedJson({
    impressions:      sum(perCampaign.map((r) => r.impressions)),
    clicks:           sum(perCampaign.map((r) => r.clicks)),
    ctr:              avgPct(perCampaign.map((r) => r.ctr)),
    channelBreakdown: mergeByLabel(perCampaign.map((r) => r.channelBreakdown)),
    channelClicks:    mergeByLabel(perCampaign.map((r) => r.channelClicks)),
  });
}
