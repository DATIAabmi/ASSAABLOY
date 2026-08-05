"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useFilter } from "./FilterContext";

interface SummaryData {
  totalDownloads: number | null;
  totalUniqueLeads: number | null;
  uniqueLeadDistrict: number | null;
  byContentType: [string, number][];
  byContentName: [string, number][];
}

function fmt(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString();
}

function KPICard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-3 pb-3 flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-black text-gray-900 tabular-nums leading-none">{fmt(value)}</span>
    </div>
  );
}

function HBarChart({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(...rows.map(([, v]) => v), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="bg-gray-950 px-4 py-2.5">
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      <div className="flex-1 px-4 py-4 flex flex-col justify-center gap-4">
        {rows.length === 0 ? (
          <div className="text-center text-gray-400 text-sm">No data</div>
        ) : rows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-3">
            <span
              className="text-xs text-gray-600 shrink-0 leading-tight break-words"
              style={{ width: 200 }}
            >
              {label}
            </span>
            <div className="flex-1 flex items-center gap-2 pt-0.5">
              <div className="flex-1 bg-gray-100 rounded-full overflow-hidden" style={{ height: 22 }}>
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.max((value / max) * 100, 4)}%`, background: "#2D6DB5" }}
                >
                  <span className="text-white text-xs font-bold tabular-nums">{value.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadsSummaryPanel() {
  const { campaign, dateStart, dateEnd } = useFilter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaign.length) params.set("campaign", campaign.join(","));
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd) params.set("dateEnd", dateEnd);
    fetch(`/api/leads-summary${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((d: SummaryData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [campaign, dateStart, dateEnd]);

  if (loading) {
    return (
      <div className="mb-4 flex items-center justify-center h-32 text-gray-400 gap-2 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading summary…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* Row 1: 3 KPI scalars */}
      <div className="flex gap-3">
        <KPICard label="Total Downloads"       value={data.totalDownloads}     />
        <KPICard label="Total Unique Leads"    value={data.totalUniqueLeads}   />
        <KPICard label="Unique Lead Districts" value={data.uniqueLeadDistrict} />
      </div>

      {/* Row 2: 2 horizontal bar charts at full width */}
      <div className="flex gap-3">
        <HBarChart title="Leads by Content Type" rows={data.byContentType} />
        <HBarChart title="Leads by Content Name" rows={data.byContentName} />
      </div>
    </div>
  );
}
