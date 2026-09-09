"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";

type Signal = {
  Organization: string | null;
  Domain: string | null;
  State: string | null;
  Campaign: string | null;
  Category: string | null;
  Source: string | null;
  Signal_Analysis: string | null;
  Source_Text: string | null;
  Source_Link: string | null;
  Strength: number | null;
  Date: string | null;
  Amount: string | null;
  Keywords: string | null;
  Enrollment: number | null;
  NCES_ID: number | null;
  IO_Number: number | null;
  Market: string | null;
};

function strengthColor(s: number | null): { bg: string; text: string } {
  const v = s ?? 0;
  if (v >= 8) return { bg: "#D4EFDF", text: "#145A32" };
  if (v >= 5) return { bg: "#FEF3CD", text: "#7A5800" };
  return { bg: "#F4E8E6", text: "#8A2010" };
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AccountIntelligence() {
  const [rows, setRows] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);

  const titleBarRef = useRef<HTMLDivElement>(null);
  const [titleBarHeight, setTitleBarHeight] = useState(0);

  useLayoutEffect(() => {
    const el = titleBarRef.current;
    if (!el) return;
    const measure = () => { const h = el.offsetHeight; if (h > 0) setTitleBarHeight(h); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/account-intelligence-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message ?? "Failed to load"); setLoading(false); });
  }, []);

  const categories = [...new Set(rows.map((r) => r.Category).filter(Boolean))] as string[];
  const states = [...new Set(rows.map((r) => r.State).filter(Boolean))] as string[];

  const filtered = rows.filter((r) => {
    if (filterCategory.length && !filterCategory.includes(r.Category ?? "")) return false;
    if (filterState.length && !filterState.includes(r.State ?? "")) return false;
    return true;
  });

  // Clean, human-readable headers matching this tab's own data — not the raw
  // internal field/alias names (e.g. "Signal_Analysis", "NCES_ID").
  const CSV_COLUMNS: { key: keyof Signal; label: string }[] = [
    { key: "Organization", label: "Organization" },
    { key: "Domain", label: "Domain" },
    { key: "State", label: "State" },
    { key: "Category", label: "Category" },
    { key: "Signal_Analysis", label: "Signal Analysis" },
    { key: "Source_Text", label: "Source Text" },
    { key: "Source", label: "Source" },
    { key: "Source_Link", label: "Source Link" },
    { key: "Strength", label: "Strength" },
    { key: "Date", label: "Date" },
    { key: "Amount", label: "Amount" },
    { key: "Keywords", label: "Keywords" },
    { key: "Campaign", label: "Campaign" },
    { key: "Market", label: "Market" },
    { key: "Enrollment", label: "Enrollment" },
    { key: "NCES_ID", label: "NCES ID" },
    { key: "IO_Number", label: "IO #" },
  ];
  const csvCols = CSV_COLUMNS.map((c) => ({ display_name: c.label, base_type: "type/Text" }));
  const csvRows = filtered.map((r) => CSV_COLUMNS.map((c) => r[c.key]));

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <MultiSelectDropdown label="Category" value={filterCategory} onChange={setFilterCategory} options={categories} />
          <MultiSelectDropdown label="State" value={filterState} onChange={setFilterState} options={states} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {/* Title bar */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Account Intelligence</span>
            <span className="text-gray-400 text-xs">Customer 12095</span>
            {!loading && (
              <span className="text-gray-400 text-xs">{filtered.length.toLocaleString()} signals</span>
            )}
          </div>
          {!loading && filtered.length > 0 && (
            <button
              onClick={() => exportToCsv("account-intelligence", csvCols as never, csvRows as never)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
            <Loader2 size={18} className="animate-spin" /> Loading account intelligence…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden bg-white">
            {/* Table header */}
            <div
              className="sticky z-10 bg-white border-b border-gray-200 grid text-xs font-semibold px-4"
              style={{
                top: titleBarHeight,
                color: "#111827",
                gridTemplateColumns: "48px 100px 90px minmax(0,1fr) 100px 90px 100px 40px",
                gap: "0 12px",
                padding: "10px 20px",
              }}
            >
              <span>Strength</span>
              <span>Organization</span>
              <span>Category</span>
              <span>Signal Analysis</span>
              <span>Location</span>
              <span>Amount</span>
              <span>Date</span>
              <span></span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No signals match filters</div>
            ) : (
              filtered.map((row, i) => {
                const sc = strengthColor(row.Strength);
                const location = [row.Domain, row.State].filter(Boolean).join(", ");
                return (
                  <div
                    key={i}
                    className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
                    style={{
                      gridTemplateColumns: "48px 100px 90px minmax(0,1fr) 100px 90px 100px 40px",
                      gap: "0 12px",
                      padding: "12px 20px",
                    }}
                  >
                    {/* Strength */}
                    <div style={{ paddingTop: 1 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: 6,
                        background: sc.bg, color: sc.text,
                        fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                      }}>
                        {row.Strength ?? "—"}
                      </span>
                    </div>

                    {/* Organization */}
                    <div className="text-xs font-semibold text-gray-800 leading-snug" style={{ paddingTop: 4 }}>
                      {row.Organization ?? "—"}
                    </div>

                    {/* Category */}
                    <div className="text-xs text-gray-600 leading-snug" style={{ paddingTop: 4 }}>
                      {row.Category ?? "—"}
                    </div>

                    {/* Signal Analysis */}
                    <div className="text-xs text-gray-800 leading-relaxed" style={{ paddingTop: 3 }}>
                      {row.Signal_Analysis ?? "—"}
                    </div>

                    {/* Location */}
                    <div className="text-xs text-gray-500" style={{ paddingTop: 4 }}>
                      {location || "—"}
                    </div>

                    {/* Amount */}
                    <div className="text-xs font-semibold text-gray-800" style={{ paddingTop: 4 }}>
                      {row.Amount ?? "—"}
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-500 tabular-nums" style={{ paddingTop: 4 }}>
                      {fmtDate(row.Date)}
                    </div>

                    {/* Source link */}
                    <div style={{ paddingTop: 3 }}>
                      {row.Source_Link ? (
                        <a href={row.Source_Link} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="View source">
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
