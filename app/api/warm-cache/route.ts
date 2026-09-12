import { NextResponse } from "next/server";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

export const maxDuration = 60;

export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const DEFAULT = encodeURIComponent(DEFAULT_CAMPAIGN);

  try {
    const [funnel, q363, q405, q425, leads, q174, q181, q180, content, q168, q169] = await Promise.all([
      fetch(`${base}/api/funnel-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q363-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q405-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q425-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/leads-summary?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q174-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q181-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q180-data`, { cache: "no-store" }),
      fetch(`${base}/api/content-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q168-data?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q169-data?campaign=${DEFAULT}`, { cache: "no-store" }),
    ]);

    return NextResponse.json({
      funnel: { ok: funnel.ok }, q363: { ok: q363.ok },
      q405: { ok: q405.ok }, q425: { ok: q425.ok },
      leads: { ok: leads.ok }, q174: { ok: q174.ok },
      q181: { ok: q181.ok }, q180: { ok: q180.ok },
      content: { ok: content.ok }, q168: { ok: q168.ok }, q169: { ok: q169.ok },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
