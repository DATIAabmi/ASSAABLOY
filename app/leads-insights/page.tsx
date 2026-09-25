"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import LeadsSummaryPanel from "@/components/LeadsSummaryPanel";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "state" | "job_function" | "content_name") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// ─── Dashboard Guide modal ────────────────────────────────────────────────────

const DEFINITIONS = [
  { term: "Filtering",          def: "Use the filters at the top of the page to filter by Campaign, Date Range, District, Domain, or State." },
  { term: "Reset",              def: "To reset filters, click the Reset Filters button at the top right of the page." },
  { term: "Sorting",            def: "Sort the table by clicking any column header or using the Sort By menu at the top right of the page." },
  { term: "Export",             def: "Use Export All at the top of the page to export data from all dashboard views. Use Export within an individual dashboard view to export data from that view only." },
  { term: "Intel",              def: "Account Intelligence signals including School Board Minutes, RFPs/Bids, Grants/Bonds, Strategic Initiatives, Leadership Changes, and District News. See the Account Intelligence dashboard for details." },
  { term: "Topic",              def: "Reading Behavior signals indicating above-baseline content consumption on relevant topics. See the Topic Insights dashboard for details." },
  { term: "Engagements",        def: "Total engagement activity, including ad clicks, email opens, and asset downloads." },
  { term: "Engaged Users",      def: "Unique users who engaged with your content or campaign." },
  { term: "Leads",              def: "Unique content downloads by target personas." },
  { term: "Total Downloads",    def: "Total content assets downloaded by contacts." },
  { term: "Intent Score",       def: "A numerical score reflecting a district's overall level of buying activity based on Account Intelligence, Reading Behavior, and engagement signals." },
  { term: "Intent Score Trend", def: "Change in Intent Score compared with the prior campaign, indicating whether account activity has increased or decreased." },
];

function DefinitionsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onMouseDown={onClose} />
      <div
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 440, width: "calc(100% - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Dashboard Guide</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#111", flexShrink: 0, minWidth: 80, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District",        index: 0 },
  { label: "Domain",          index: 1 },
  { label: "Campaign",        index: 2 },
  { label: "State",           index: 3 },
  { label: "Job Function",    index: 4 },
  { label: "Total Downloads", index: 5 },
];

function SortDropdown({ sort, onSort }: { sort: SortState; onSort: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_COLUMNS.find((c) => c.index === sort.col);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-semibold" style={{ fontSize: 13 }}>{current?.label ?? "Total Downloads"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_COLUMNS.map((c) => {
            const active = sort.col === c.index;
            return (
              <button key={c.index}
                onClick={() => { onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c.label}
                {active && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);

// Raw: 0=District 1=Domain 2=Campaign 3=State 4=Job Function 5=Total Downloads 6=Intel
const LI_COLS = [
  { label: "#",               width: 36,  align: "center" as const, colIdx: -1 },
  { label: "District",        width: 360, align: "left"   as const, colIdx: 0  },
  { label: "Domain",          width: 220, align: "left"   as const, colIdx: 1  },
  { label: "State",           width: 70,  align: "center" as const, colIdx: 3  },
  { label: "Campaign",        width: 80,  align: "center" as const, colIdx: 2  },
  { label: "Job Function",    width: 300, align: "left"   as const, colIdx: 4  },
  { label: "Total Downloads", width: 110, align: "center" as const, colIdx: 5  },
];
const LI_GRID = LI_COLS.map(c => `${c.width}px`).join(" ");

function DataTable({ cols, rows, sort, onSort }: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
}) {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No results</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="bg-white">
      {sorted.map((row, i) => (
        <div key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-xs"
             style={{ display: "grid", gridTemplateColumns: LI_GRID }}>
          <span className="px-3 py-1.5 text-center text-gray-400 font-medium">{i + 1}</span>
          {LI_COLS.slice(1).map((cd) => {
            const j = cd.colIdx;
            const cell = row[j];
            const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
            return (
              <span key={j} className={`px-4 py-1.5 text-gray-800 ${isNum ? "tabular-nums" : ""}`}
                    style={{ textAlign: cd.align, overflowWrap: "anywhere" }}>
                {cell === null || cell === undefined ? "" : String(cell)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LeadsInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();
  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [showDefs, setShowDefs] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);
  const [filterContentName, setFilterContentName] = useState<string[]>([]);
  const [cols, setCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const rows = useMemo(
    () => (filterDomain.length ? allRows.filter((r) => filterDomain.includes(String(r[1] ?? ""))) : allRows),
    [allRows, filterDomain],
  );
  const searchDomains = (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(allRows.map((r) => String(r[1] ?? "")).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

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

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)          params.set("campaign",    campaign.join(","));
    if (dateStart)                params.set("dateStart",   dateStart);
    if (dateEnd)                  params.set("dateEnd",     dateEnd);
    if (filterDistrict.length)    params.set("district",    filterDistrict.join(","));
    if (filterState.length)       params.set("state",       filterState.join(","));
    filterJobFunction.forEach((v) => params.append("jobFunction", v));
    filterContentName.forEach((v) => params.append("contentName", v));

    fetch(`/api/q174-data?${params.toString()}`)
      .then(async (r) => {
        const text = await r.text();
        if (!text.trim()) return { cols: [], rows: [] };
        try { return JSON.parse(text); }
        catch { throw new Error("Server error — please try again or reduce the number of filters selected"); }
      })
      .then((d: { cols?: unknown[]; rows?: unknown[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setCols((d.cols ?? []) as Col[]);
        setAllRows((d.rows ?? []) as Row[]);
        setLoading(false);
      })
      .catch((err: Error) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterJobFunction, filterContentName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterJobFunction([]);
    setFilterContentName([]);
  }, [resetSignal]);

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="Domain"       value={filterDomain}      onChange={setFilterDomain}      search={searchDomains} />
            <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} minWidth={110} />
            <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
            <MultiSelectDropdown label="Content"      value={filterContentName} onChange={setFilterContentName} search={fetchFieldOptions("content_name")} />
            <button
              type="button"
              onClick={() => setShowDefs(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg bg-white transition-colors shrink-0"
            >
              <Info size={13} />
              Dashboard Guide
            </button>
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {showDefs && <DefinitionsModal onClose={() => setShowDefs(false)} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", padding: "0 24px 24px" }}>
        <div style={{ minWidth: 1130, width: "100%" }}>
        <LeadsSummaryPanel districts={filterDistrict} states={filterState} />
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Leads Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button onClick={() => {
                // Raw order: 0=District 1=Domain 2=Campaign 3=State 4=Job Function 5=Total Downloads 6=SBM
                // Desired: District, Domain, State, Campaign, SBM, Job Function, Total Downloads
                const ORDER = [0, 1, 3, 2, 6, 4, 5];
                const exportCols = ORDER.map((i) => cols[i]).filter(Boolean);
                const exportRows = rows.map((r) => ORDER.map((i) => r[i]));
                exportToCsv("leads-insights", exportCols, exportRows);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
              <Download size={13} /> Export
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <>
            <div className="sticky z-10 bg-white border-b border-l border-r border-gray-200 font-semibold text-gray-700"
                 style={{ fontSize: 10, top: titleBarHeight, display: "grid", gridTemplateColumns: LI_GRID }}>
              {LI_COLS.map((cd, i) => (
                <span key={i}
                  className={`px-3 py-2 inline-flex items-center gap-0.5 select-none ${cd.colIdx >= 0 ? "cursor-pointer hover:opacity-70" : ""} ${cd.align === "center" ? "justify-center" : "justify-start"}`}
                  onClick={cd.colIdx >= 0 ? () => setSort({ col: cd.colIdx, dir: sort.col === cd.colIdx && sort.dir === "desc" ? "asc" : "desc" }) : undefined}>
                  {cd.label}
                  {cd.colIdx >= 0 && (sort.col === cd.colIdx
                    ? (sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />)
                    : <ArrowUpDown size={10} className="opacity-30 shrink-0" />)}
                </span>
              ))}
            </div>
            <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ overflow: "clip" }}>
              <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <LeadsInsightsContent />
    </MetabaseProviderWrapper>
  );
}
