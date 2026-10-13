import { NextResponse } from "next/server";
import { SBM_SIGNALS_SQL, SCORING_DB_ID, sbmToSignal } from "@/lib/metabaseQueries";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// ai_signals table in the "My First Project" BigQuery database.
// ASSA ABLOY's Client ID = 12095.
//
// Queried with native SQL (not an MBQL source-table query): Metabase caches the
// table's field names, and when the upstream schema renamed "Customer ID" ->
// "Client ID" every MBQL query failed with "Name Customer ID not found".
// Native SQL is immune to stale field metadata and filters server-side.
const DB_ID = 67;
const TABLE = "`project-d5919e8b-bf9c-4f4d-883.analytics.ai_signals`";
const CLIENT_ID = "12095";

interface SignalCache { rows: Record<string, unknown>[]; columns: string[] }
let memCache: SignalCache | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function runNative(database: number, query: string) {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database, type: "native", native: { query } }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const data = await res.json();
  if (data.error || data.status === "failed") throw new Error(String(data.error ?? "Query failed"));

  const cols: string[] = (data.data?.cols ?? []).map((c: { name: string }) => c.name);
  const rawRows: unknown[][] = data.data?.rows ?? [];
  const rows: Record<string, unknown>[] = rawRows.map((row) =>
    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
  );
  return { rows, cols };
}

async function fetchSignals(): Promise<SignalCache> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  // School board minutes from the scoring tables ride along as extra rows in
  // the ai_signals shape. If that query fails the signals still load.
  const [signals, minutes] = await Promise.all([
    runNative(DB_ID, `SELECT * FROM ${TABLE} WHERE CAST(\`Client ID\` AS STRING) = '${CLIENT_ID}'`),
    runNative(SCORING_DB_ID, SBM_SIGNALS_SQL).catch(() => null),
  ]);
  const rows = [...signals.rows, ...(minutes?.rows ?? []).map(sbmToSignal)];
  const result = { rows, columns: signals.cols };

  // Don't hold a signals-only result for the full TTL when minutes failed.
  if (minutes) { memCache = result; memCacheAt = Date.now(); }
  return result;
}

export async function GET() {
  try {
    const { rows, columns } = await fetchSignals();
    return NextResponse.json({ rows, columns }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [], columns: [] }, { status: 500 });
  }
}
