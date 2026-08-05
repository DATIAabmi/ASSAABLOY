import { NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel cron every 4 minutes to keep q405-data in-memory cache warm.
// Uses VERCEL_URL (set automatically by Vercel) for internal routing.
export async function GET() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const DEFAULT = "C6%3A%20April%20-%20May%202026"; // URL-encoded DEFAULT_CAMPAIGN
    const [funnel, q363, q405, q425, leads, q181, q180] = await Promise.all([
      fetch(`${base}/api/funnel-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q363-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q405-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q425-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/leads-summary?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q181-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q180-data`, { cache: "no-store" }),
    ]);
    return NextResponse.json({
      funnel: { ok: funnel.ok }, q363: { ok: q363.ok },
      q405: { ok: q405.ok }, q425: { ok: q425.ok },
      leads: { ok: leads.ok }, q181: { ok: q181.ok }, q180: { ok: q180.ok },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
