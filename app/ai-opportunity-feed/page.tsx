"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Loader2, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Info, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtDate } from "@/lib/fmtDate";
import { useFilter } from "@/components/FilterContext";

type Signal = Record<string, unknown>;
type SortDir = "asc" | "desc";
interface SortState { col: string; dir: SortDir }

// ─── Dashboard Guide modal ────────────────────────────────────────────────────

const DEFINITIONS: { term: string; def: React.ReactNode }[] = [
  { term: "Filter",           def: "Filter by Campaign, Date Range, Organization, Domain, State, Market, Keywords, Category, or Source." },
  { term: "Reset",            def: <>Click <strong>Reset Filters</strong> to clear all selected filters.</> },
  { term: "Sort",             def: <>Sort the table by clicking any column header or using the <strong>Sort By</strong> menu.</> },
  { term: "Export",           def: <>Use <strong>Export All</strong> to export data from all dashboard views. Use <strong>Export</strong> within an individual dashboard to export data from that view only.</> },
  { term: "Keywords",         def: "Key terms identifying the topic, activity, or opportunity associated with the signal." },
  { term: "Category",         def: <>Type of Account Intelligence signal, such as <strong>Bids/RFPs, Bonds/Grants, Funding/Capital Projects, Leadership Changes, Initiatives/Strategic Plans,</strong> and <strong>Vendor Selection</strong>.</> },
  { term: "Source & Link",    def: "Source type, such as News & Media or organization website, with a link to the original source." },
  { term: "Strength",         def: "Rating indicating the strength and immediacy of the potential opportunity." },
  { term: "Signal Analysis",  def: "Explains why the information represents a meaningful opportunity signal." },
  { term: "Source Text",      def: "Supporting content from the original source used to identify and analyze the signal." },
  { term: "Market",           def: "K12 or Higher Education (HE)." },
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
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 520, width: "calc(100% - 32px)" }}
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
              <span className="font-bold" style={{ fontSize: 12, color: "#111", flexShrink: 0, minWidth: 140, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// Full column grid — table scrolls horizontally
// # | District | Domain | State | Campaign | Keywords | Category | Date | Source & Link | Strength | Signal Analysis | Source Text | Market
const COLS = [
  { key: "#",               width: 30,  sort: false, flex: false, center: false },
  { key: "District",        width: 240, sort: true,  flex: false, center: false },
  { key: "Domain",          width: 130, sort: true,  flex: false, center: false },
  { key: "State",           width: 50,  sort: true,  flex: false, center: true  },
  { key: "Campaign",        width: 100, sort: true,  flex: false, center: true  },
  { key: "Keywords",        width: 190, sort: true,  flex: false, center: false },
  { key: "Category",        width: 130, sort: true,  flex: false, center: false },
  { key: "Date",            width: 100, sort: true,  flex: false, center: false },
  { key: "Source & Link",   width: 140, sort: true,  flex: false, center: false },
  { key: "Strength",        width: 80,  sort: true,  flex: false, center: true  },
  { key: "Signal Analysis", width: 240, sort: true,  flex: true,  center: false },
  { key: "Source Text",     width: 280, sort: false, flex: true,  center: false },
  { key: "Market",          width: 80,  sort: true,  flex: false, center: false },
];

const SORT_OPTIONS = COLS.filter((c) => c.sort);

// Signal Analysis expands to fill extra horizontal space; all others are fixed
const GRID = COLS.map((c) => c.flex ? `minmax(${c.width}px, 1fr)` : `${c.width}px`).join(" ");
const GAP  = "0 20px";
const MIN_W = COLS.reduce((s, c) => s + c.width, 0) + (COLS.length - 1) * 20 + 40;

// ── Sort dropdown ─────────────────────────────────────────────────────────────
function SortDropdown({ sort, onSort }: { sort: SortState; onSort: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-medium text-xs">{sort.col}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_OPTIONS.map((c) => {
            const active = sort.col === c.key;
            return (
              <button key={c.key}
                onClick={() => { onSort({ col: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c.key}
                {active && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Map column header key → the row field it sorts by
function getRowValue(row: Signal, colKey: string): unknown {
  switch (colKey) {
    case "District":        return row["Organization"];
    case "Domain":          return (row["Domain"] as string) || extractDomain(row["Source Link"] as string);
    case "State":           return row["State"];
    case "Campaign":        return row["Campaign #"];
    case "Keywords":        return row["Keywords"];
    case "Date":            return row["Date"];
    case "Category":        return row["Category"];
    case "Source & Link":   return row["Source"];
    case "Signal Analysis": return row["Signal Analysis"];
    case "Strength":        return row["Strength"];
    case "Market":          return row["Market"];
    default:                return null;
  }
}

function AIOpportunityFeedContent() {
  const { campaign, resetSignal } = useFilter();
  const searchParams = useSearchParams();
  const urlDistrict = searchParams.get("district");
  const [rows, setRows]       = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [sort, setSort]       = useState<SortState>({ col: "Strength", dir: "desc" });
  const [filterDistrict, setFilterDistrict] = useState<string[]>(urlDistrict ? [urlDistrict] : []);
  const [filterDomain,   setFilterDomain]   = useState<string[]>([]);
  const [filterState,    setFilterState]    = useState<string[]>([]);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterSource,   setFilterSource]   = useState<string[]>([]);
  const [filterMarket,   setFilterMarket]   = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  // Clear local filters when the global Reset Filters button is pressed
  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterKeywords([]);
    setFilterCategory([]);
    setFilterSource([]);
    setFilterMarket([]);
    setSort({ col: "Strength", dir: "desc" });
  }, [resetSignal]);

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
    fetch("/api/ai-signals-data?v=2")
      .then((r) => r.json())
      .then((d: { rows?: Signal[]; columns?: string[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message ?? "Failed to load"); setLoading(false); });
  }, []);

  const keywordsOptions = [...new Set(rows.flatMap((r) => String(r["Keywords"] ?? "").split(",").map((k) => k.trim())).filter(Boolean))].sort();
  const categoryOptions = [...new Set(rows.map((r) => String(r["Category"] ?? "")).filter(Boolean))].sort();
  const sourceOptions   = [...new Set(rows.map((r) => String(r["Source"]   ?? "")).filter(Boolean))].sort();
  const marketOptions   = [...new Set(["K12", "HE", ...rows.map((r) => String(r["Market"] ?? "")).filter(Boolean)])];

  const districtOf = (r: Signal) => String(r["Organization"] ?? "");
  const domainOf   = (r: Signal) => String((r["Domain"] as string) || extractDomain(r["Source Link"] as string) || "");
  const stateOf    = (r: Signal) => String(r["State"] ?? "");

  // District name matching: handles exact, case-insensitive, contains, and
  // significant-word overlap so topic_district values like "Portland USD" match
  // Organization values like "Portland Public Schools".
  const STOP_WORDS = new Set(["school", "schools", "district", "unified", "public", "independent", "county", "city", "the", "of", "and", "usd", "isd", "csd", "cusd", "k12"]);
  const sigWords = (s: string) =>
    s.toLowerCase().split(/[\s,.()\-/]+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const districtMatch = (org: string, filter: string): boolean => {
    const orgL = org.toLowerCase().trim();
    const filterL = filter.toLowerCase().trim();
    if (orgL === filterL) return true;
    if (orgL.includes(filterL) || filterL.includes(orgL)) return true;
    const fw = sigWords(filter);
    const ow = sigWords(org);
    return fw.length > 0 && fw.some((w) => ow.includes(w));
  };

  const searchOptions = (get: (r: Signal) => string) => (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(rows.map(get).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };

  const searchKeywords = (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    return Promise.resolve((ql ? keywordsOptions.filter((k) => k.toLowerCase().includes(ql)) : keywordsOptions).slice(0, 200));
  };

  // Global ABMxi Campaign filter (header dropdown) — full labels ("C5: September
  // 2026") reduced to the short code signals are actually tagged with ("C5").
  const campaignCodes = campaign.map((c) => c.split(":")[0].trim());

  const filtered = rows.filter((r) => {
    if (campaignCodes.length    && !campaignCodes.includes(String(r["Campaign #"] ?? "")))  return false;
    if (filterKeywords.length) {
      const rowKws = String(r["Keywords"] ?? "").split(",").map((k) => k.trim());
      if (!filterKeywords.some((kw) => rowKws.includes(kw))) return false;
    }
    if (filterCategory.length && !filterCategory.includes((r["Category"] as string) ?? "")) return false;
    if (filterSource.length   && !filterSource.includes((r["Source"] as string) ?? ""))     return false;
    if (filterMarket.length   && !filterMarket.includes(String(r["Market"] ?? "")))          return false;
    if (filterDistrict.length && !filterDistrict.some((fd) => districtMatch(districtOf(r), fd))) return false;
    if (filterDomain.length   && !filterDomain.includes(domainOf(r)))     return false;
    if (filterState.length    && !filterState.includes(stateOf(r)))       return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getRowValue(a, sort.col);
    const bv = getRowValue(b, sort.col);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const csvCols = [
    "Organization", "Domain", "State", "Campaign #", "Keywords",
    "Category", "Source", "Source Link", "Strength", "Signal Analysis", "Source Text", "Market",
  ].map((k) => ({ display_name: k, base_type: "type/Text" }));
  const csvRows = sorted.map((r) => csvCols.map((c) => r[c.display_name]));

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      {/* Filters */}
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="Market"   value={filterMarket}   onChange={setFilterMarket}   options={marketOptions} minWidth={130} />
            <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={searchOptions(districtOf)} />
            <MultiSelectDropdown label="Domain"   value={filterDomain}   onChange={setFilterDomain}   search={searchOptions(domainOf)} />
            <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={searchOptions(stateOf)} minWidth={110} />
            <MultiSelectDropdown label="Keywords" value={filterKeywords} onChange={setFilterKeywords} search={searchKeywords} />
            <MultiSelectDropdown label="Category" value={filterCategory} onChange={setFilterCategory} options={categoryOptions} />
            <MultiSelectDropdown label="Source"   value={filterSource}   onChange={setFilterSource}   options={sourceOptions} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg bg-white transition-colors"
            >
              <Info size={13} />
              Dashboard Guide
            </button>
            <SortDropdown sort={sort} onSort={setSort} />
          </div>
        </div>
      </div>
      {showGuide && <DefinitionsModal onClose={() => setShowGuide(false)} />}

      {/* Horizontally scrollable content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <div style={{ minWidth: MIN_W, width: "100%" }}>
          {/* Title bar */}
          <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm tracking-wide uppercase">Account Intelligence</span>
              {!loading && <span className="text-gray-400 text-xs">{sorted.length.toLocaleString()} signals</span>}
            </div>
            {!loading && sorted.length > 0 && (
              <button
                onClick={() => exportToCsv("DATIA ABMxi-Account-Intelligence", csvCols as never, csvRows as never)}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
              >
                <Download size={13} /> Export
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
              <Loader2 size={18} className="animate-spin" /> Loading AI signals…
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
          )}
          {!loading && !error && (
            <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm bg-white">
              {/* Column headers */}
              <div
                className="sticky z-10 bg-white border-b border-gray-200 grid font-semibold"
                style={{ fontSize: 10, top: titleBarHeight, color: "#374151", gridTemplateColumns: GRID, gap: GAP, padding: "10px 20px" }}
              >
                {COLS.map((c) => (
                  <span
                    key={c.key}
                    onClick={c.sort ? () => setSort({ col: c.key, dir: sort.col === c.key && sort.dir === "desc" ? "asc" : "desc" }) : undefined}
                    className={`${c.sort ? "cursor-pointer hover:opacity-70" : ""} ${c.center ? "justify-center" : ""} flex items-center gap-0.5`}
                  >
                    {c.key}
                    {c.sort && sort.col === c.key && (
                      sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />
                    )}
                  </span>
                ))}
              </div>

              {sorted.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No signals match filters</div>
              ) : (
                sorted.map((row, i) => {
                  const link   = row["Source Link"] as string | null;
                  const domain = (row["Domain"] as string) || extractDomain(link);

                  return (
                    <div
                      key={i}
                      className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
                      style={{ gridTemplateColumns: GRID, gap: GAP, padding: "11px 20px" }}
                    >
                      {/* # */}
                      <div className="text-xs text-gray-400 tabular-nums pt-0.5">{i + 1}</div>

                      {/* District (Organization in DB) — wraps instead of truncating */}
                      <div className="text-xs text-gray-700 leading-snug pt-0.5 break-words">
                        {(row["Organization"] as string) || "—"}
                      </div>

                      {/* Domain */}
                      <div className="text-xs text-gray-600 leading-snug pt-0.5 break-all">
                        {domain || "—"}
                      </div>

                      {/* State — centered */}
                      <div className="text-xs text-gray-600 pt-0.5 text-center">
                        {(row["State"] as string) || "—"}
                      </div>

                      {/* Campaign — centered */}
                      <div className="text-xs text-gray-600 pt-0.5 text-center">
                        {(row["Campaign #"] as string) || "—"}
                      </div>

                      {/* Keywords */}
                      <div className="text-xs text-gray-800 leading-snug pt-0.5 break-words">
                        {(row["Keywords"] as string) || "—"}
                      </div>

                      {/* Category */}
                      <div className="text-xs text-gray-700 leading-snug pt-0.5 break-words">
                        {(row["Category"] as string) || "—"}
                      </div>

                      {/* Date */}
                      <div className="text-xs text-gray-600 pt-0.5">
                        {row["Date"] ? fmtDate(row["Date"] as string) : "—"}
                      </div>

                      {/* Source & Link — source name on top, clickable URL below */}
                      <div className="text-xs pt-0.5">
                        <div className="text-gray-700 leading-snug" style={{ overflowWrap: "anywhere" }}>
                          {(row["Source"] as string) || "—"}
                        </div>
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 transition-colors mt-0.5"
                            title={link}>
                            <span className="inline-block truncate" style={{ maxWidth: 100 }}>{extractDomain(link) || link}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        )}
                      </div>

                      {/* Strength */}
                      <div className="text-xs text-gray-600 tabular-nums pt-0.5 text-center">
                        {row["Strength"] !== null && row["Strength"] !== undefined && row["Strength"] !== "" ? String(row["Strength"]) : "—"}
                      </div>

                      {/* Signal Analysis */}
                      <div className="text-xs text-gray-800 leading-relaxed pt-0.5 break-words">
                        {(row["Signal Analysis"] as string) || "—"}
                      </div>

                      {/* Source Text — same color as Signal Analysis */}
                      <div className="text-xs text-gray-800 pt-0.5 break-words leading-snug">
                        {(row["Source Text"] as string) || "—"}
                      </div>

                      {/* Market — K12 / HE */}
                      <div className="text-xs text-gray-600 pt-0.5">
                        {(row["Market"] as string) || "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIOpportunityFeed() {
  return (
    <Suspense>
      <AIOpportunityFeedContent />
    </Suspense>
  );
}
