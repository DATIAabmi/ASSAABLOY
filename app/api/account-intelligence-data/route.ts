import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
// ASSA ABLOY - Account Intelligence - AI Signals. The customer_id template
// tag defaults to 12095 (ASSA ABLOY's id in the shared ai_signals table), so
// no parameter override is needed for the normal case.
const CARD_ID = 695;

let memCache: unknown[] | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchSignals(): Promise<unknown[]> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  const res = await fetch(`${METABASE_URL}/api/card/${CARD_ID}/query/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: [] }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const rows = await res.json();
  memCache = rows;
  memCacheAt = Date.now();
  return rows;
}

export async function GET() {
  try {
    const rows = await fetchSignals();
    return cachedJson({ rows });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [] }, { status: 500 });
  }
}
