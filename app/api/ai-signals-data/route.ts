import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// ai_signals table in "My First Project" database — has District, Domain, State, Campaign
const DB_ID    = 67;
const TABLE_ID = 390;

interface SignalCache { rows: Record<string, unknown>[]; columns: string[]; customerIdCol?: string | null; totalBeforeFilter?: number; }
let memCache: SignalCache | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchSignals(): Promise<SignalCache> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "query",
      query: { "source-table": TABLE_ID },
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const data = await res.json();

  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rawRows: unknown[][] = data.data?.rows ?? [];

  // Find the customer_id column — handles "Customer ID" and legacy variants
  const CUSTOMER_ID_KEYWORDS = ["customer_id", "customerid", "internal_customer_id"];
  const customerIdCol = cols.find((c: string) =>
    CUSTOMER_ID_KEYWORDS.some((k) => c.toLowerCase().replace(/[\s-]/g, "_") === k)
  ) ?? null;

  const allRows: Record<string, unknown>[] = rawRows.map((row) =>
    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
  );

  // Filter to ASSA ABLOY — Customer ID = 12095
  const rows = customerIdCol
    ? allRows.filter((r) => String(r[customerIdCol] ?? "").trim() === "12095")
    : allRows;

  memCache = { rows, columns: cols, customerIdCol, totalBeforeFilter: allRows.length };
  memCacheAt = Date.now();
  return memCache;
}

export async function GET() {
  try {
    const { rows, columns, customerIdCol, totalBeforeFilter } = await fetchSignals();
    return NextResponse.json({ rows, columns, _debug: { customerIdCol, totalBeforeFilter } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [], columns: [] }, { status: 500 });
  }
}
