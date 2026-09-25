"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { normalizeJobTitle } from "@/lib/jobFunctionCategories";
function fetchFieldOptions(field: "district" | "state" | "job_function") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}



// ─── Definitions modal ────────────────────────────────────────────────────────

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

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "State", index: 2 },
  { label: "Job Function", index: 3 },
  { label: "Campaign", index: 4 },
  { label: "Engagements", index: 5 },
  { label: "Leads", index: 6 },
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-blue-400 transition-colors"
      >
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-semibold text-[13px]">{current?.label ?? "Engagements"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_COLUMNS.map((c) => {
            const active = sort.col === c.index;
            return (
              <button key={c.index}
                onClick={() => {
                  onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" });
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}
              >
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

// ─── Data table ───────────────────────────────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];

// Raw: 0=District 1=Domain 2=State 3=Job Function 4=Campaign 5=Engagements 6=Leads
// Visual: # | District | Domain | State | Campaign | Job Function | Engagements | Leads
const PI_COLS = [
  { label: "#",            width: 36,  align: "center" as const, colIdx: -1 },
  { label: "District",     width: 360, align: "left"   as const, colIdx: 0  },
  { label: "Domain",       width: 230, align: "left"   as const, colIdx: 1  },
  { label: "State",        width: 48,  align: "center" as const, colIdx: 2  },
  { label: "Campaign",     width: 80,  align: "center" as const, colIdx: 4  },
  { label: "Job Function", width: 240, align: "left"   as const, colIdx: 3  },
  { label: "Engagements",  width: 88,  align: "center" as const, colIdx: 5  },
  { label: "Leads",        width: 70,  align: "center" as const, colIdx: 6  },
];
const PI_GRID = PI_COLS.map(c => `${c.width}px`).join(" ");

function DataTable({ rows, sort, onSort }: {
  rows: Row[];
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
             style={{ display: "grid", gridTemplateColumns: PI_GRID }}>
          <span className="px-2 py-1.5 text-center text-gray-400 font-medium">{i + 1}</span>
          {PI_COLS.slice(1).map((cd) => {
            const j = cd.colIdx;
            const cell = row[j];
            return (
              <span key={j} className="px-3 py-1.5 text-gray-800"
                    style={{ textAlign: cd.align }}>
                {cell === null || cell === undefined ? "" : String(cell)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PersonaInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });
  const [showDefs, setShowDefs] = useState(false);

  const [allRows, setAllRows] = useState<Row[]>([]);

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

  // Only date and state are server-side filters; district and job function are
  // client-side so allRows stays stable and the district dropdown always shows
  // the full set of available districts regardless of current selection.
  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (dateStart)          params.set("dateStart", dateStart);
    if (dateEnd)            params.set("dateEnd",   dateEnd);
    if (filterState.length) params.set("state",     filterState.join(","));

    fetch(`/api/q168-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [dateStart, dateEnd, filterState]);

  // Client-side filters: campaign (index 4), district (index 0), job function (index 3).
  useEffect(() => {
    const prefixes = campaign.map((c) => c.split(":")[0].trim());
    let filtered = allRows;
    if (prefixes.length > 0) {
      filtered = filtered.filter((row) => prefixes.includes(String(row[4] ?? "")));
    }
    if (filterDistrict.length > 0) {
      filtered = filtered.filter((row) => filterDistrict.includes(String(row[0] ?? "")));
    }
    if (filterDomain.length > 0) {
      filtered = filtered.filter((row) => filterDomain.includes(String(row[1] ?? "")));
    }
    if (filterJobFunction.length > 0) {
      filtered = filtered.filter((row) => filterJobFunction.includes(normalizeJobTitle(String(row[3] ?? ""))));
    }
    setRows(filtered);
  }, [campaign, allRows, filterDistrict, filterDomain, filterJobFunction]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterJobFunction([]);
  }, [resetSignal]);

  // Derive district options from loaded data so the dropdown only shows
  // districts that actually appear in the persona insights results.
  const districtOptions = [...new Set(allRows.map((r) => String(r[0] ?? "")).filter(Boolean))].sort();
  const searchDomains = (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(allRows.map((r) => String(r[1] ?? "")).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    options={districtOptions} />
            <MultiSelectDropdown label="Domain"       value={filterDomain}      onChange={setFilterDomain}      search={searchDomains} />
            <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} />
            <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
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
        <div style={{ minWidth: 992, width: "100%" }}>
        {/* Section title */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Engagements By Persona Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => {
                // Desired export order: District, Domain, State, Campaign, Job Function, Engagements, Leads
                // API returns: 0=District 1=Domain 2=State 3=Job Function 4=Campaign 5=Engagements 6=Leads
                const ORDER = [0, 1, 2, 4, 3, 5, 6];
                const exportCols = ORDER.map((i) => cols[i]).filter(Boolean);
                const exportRows = rows.map((r) => ORDER.map((i) => r[i]));
                exportToCsv("persona-insights", exportCols, exportRows);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
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
            <div className="sticky z-10 bg-white border-b border-l border-r border-gray-200 text-[11px] font-semibold text-gray-700"
                 style={{ top: titleBarHeight, display: "grid", gridTemplateColumns: PI_GRID }}>
              {PI_COLS.map((cd, i) => (
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
              <DataTable rows={rows} sort={sort} onSort={setSort} />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <PersonaInsightsContent />;
}
