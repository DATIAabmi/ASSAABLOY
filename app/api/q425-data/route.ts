import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DISPLAY_NAMES: Record<string, string> = { ST: "State" };

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// In-memory cache — same strategy as q405-data. Full dataset is always fetched
// (all campaigns), so all filter combinations share one cached copy.
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memCache: { cols: { display_name: string; base_type: string }[]; rows: unknown[][] } | null = null;
let memCacheAt = 0;
let inflightPromise: Promise<{ cols: { display_name: string; base_type: string }[]; rows: unknown[][] }> | null = null;

async function fetchFullDataset() {
  const parameters = [
    {
      type: "string/=",
      value: [...CAMPAIGNS],
      target: ["variable", ["template-tag", "abmi_campaign"]],
    },
  ];

  const res = await fetch(`${METABASE_URL}/api/card/425/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return { cols: [], rows: [] };

  const data = await res.json();
  const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
    display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
    base_type: c.base_type,
  }));
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
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
    const campaigns  = parseList(searchParams.get("campaign"));
    const districts  = parseList(searchParams.get("district"));
    const dateStart  = searchParams.get("dateStart") ?? "";
    const dateEnd    = searchParams.get("dateEnd")   ?? "";

    const { cols, rows: allRows } = await getDataset();

    const districtCol = cols.findIndex((c) => c.display_name === "District");
    const campaignCol = cols.findIndex((c) => c.display_name === "Campaign");
    // SBM Date is the 5th column in raw order (index 4)
    const dateCol     = cols.findIndex((c) => c.display_name === "SBM Date");

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    const rows = allRows
      .filter(matches(campaigns, campaignCol))
      .filter(matches(districts, districtCol))
      .filter((row) => {
        if (!dateStart && !dateEnd) return true;
        if (dateCol < 0) return true;
        const raw = String(row[dateCol] ?? "").slice(0, 10); // "YYYY-MM-DD"
        if (dateStart && raw < dateStart) return false;
        if (dateEnd   && raw > dateEnd)   return false;
        return true;
      });

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
