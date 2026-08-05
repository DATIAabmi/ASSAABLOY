"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import UsStateChoropleth from "@/components/UsStateChoropleth";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "state") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}



// ─── Engagements by Geography ──────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }
type Col = { display_name: string; base_type: string };
type GeoRow = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const GEO_LEFT_ALIGN_COLS = new Set<string>();

function GeographyTable({
  campaign, dateStart, dateEnd, filterDistrict, filterState,
}: {
  campaign: string[]; dateStart: string; dateEnd: string;
  filterDistrict: string[]; filterState: string[];
}) {
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 2, dir: "desc" });

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign", campaign.join(","));
    if (dateStart)             params.set("dateStart", dateStart);
    if (dateEnd)               params.set("dateEnd", dateEnd);
    if (filterDistrict.length) params.set("district", filterDistrict.join(","));
    if (filterState.length)    params.set("state", filterState.join(","));

    fetch(`/api/q169-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setCols(d.cols ?? []); setRows(d.rows ?? []); setLoading(false); })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState]);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const stateCol = cols.findIndex((c) => c.display_name === "State");
  const engagedUsersCol = cols.findIndex((c) => c.display_name === "Engaged Users");
  const valueByState: Record<string, number> = {};
  if (stateCol >= 0 && engagedUsersCol >= 0) {
    for (const row of rows) {
      const state = String(row[stateCol] ?? "");
      const value = Number(row[engagedUsersCol]) || 0;
      if (state) valueByState[state] = value;
    }
  }

  const totals = cols.map((col, j) => {
    if (j === stateCol) return "Grand total";
    if (!NUMBER_TYPES.has(col.base_type)) return "";
    return rows.reduce((sum, row) => sum + (Number(row[j]) || 0), 0);
  });

  const displayName = (name: string) => (name === "Leads" ? "Unique Leads" : name);

  return (
    <div>
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
        <span className="font-bold text-sm tracking-wide uppercase">Engagements By Geography</span>
        {rows.length > 0 && (
          <button
            onClick={() => exportToCsv("engagements-by-geography", cols, rows)}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center h-48 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center justify-center h-48 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
      )}
      {!loading && !error && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white">No results</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 p-4">
              <div className="lg:w-1/2 shrink-0 flex items-center">
                <UsStateChoropleth valueByState={valueByState} />
              </div>
              <div className="lg:w-1/2 min-w-0 overflow-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-center w-10 font-semibold whitespace-nowrap" style={{ color: "#111827" }}>#</th>
                      {cols.map((col, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(col.display_name);
                        const active = sort.col === j;
                        return (
                          <th key={j}
                            onClick={() => setSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                            className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 ${isLeft ? "text-left" : "text-center"}`}
                            style={{ color: "#111827" }}
                          >
                            <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                              {displayName(col.display_name)}
                              {active
                                ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                                : <ArrowUpDown size={11} className="opacity-30" />}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-1.5 text-center text-gray-400 text-xs w-10 shrink-0">{i + 1}</td>
                        {row.map((cell, j) => {
                          const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                          const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                          return (
                            <td key={j} className={`px-4 py-1.5 ${isLeft ? "text-left" : "text-center"} ${isNum ? "tabular-nums" : ""} text-gray-800`}>
                              {cell === null || cell === undefined ? "" : String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="px-3 py-2"></td>
                      {totals.map((val, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                        return (
                          <td key={j} className={`px-4 py-2 ${isLeft ? "text-left" : "text-center tabular-nums"} text-gray-900`}>
                            {typeof val === "number" ? val.toLocaleString() : val}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function GeoInsightsContent() {
  const { campaign, dateStart, dateEnd } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-3">
          <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={fetchFieldOptions("district")} />
          <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <GeographyTable
          campaign={campaign}
          dateStart={dateStart}
          dateEnd={dateEnd}
          filterDistrict={filterDistrict}
          filterState={filterState}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <GeoInsightsContent />
    </MetabaseProviderWrapper>
  );
}
