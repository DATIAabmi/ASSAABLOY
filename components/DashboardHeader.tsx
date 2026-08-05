"use client";

import Image from "next/image";
import { CalendarSearch, X, RotateCcw, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFilter } from "@/components/FilterContext";
import { CAMPAIGNS, campaignDateRange } from "@/lib/campaigns";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

export default function DashboardHeader({ legend }: { legend?: string }) {
  const { campaign, setCampaign, dateStart, dateEnd, setDateStart, setDateEnd, resetAll } = useFilter();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const subtitle =
    campaign.length === 0
      ? "All Campaigns"
      : campaign.length === 1
      ? campaignDateRange(campaign[0])
      : `${campaign.length} Campaigns Selected`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-5 mb-4">
      <div className="relative flex items-center">
        {/* Left: ASSA ABLOY logo */}
        <div className="flex-shrink-0 flex items-center gap-6">
          <Image
            src="/right-at-school-logo.png"
            alt="ASSA ABLOY"
            width={652}
            height={306}
            style={{ height: "96px", width: "auto" }}
            className="object-contain"
          />
          {/* Vertical divider */}
          <div className="self-stretch w-px bg-gray-200 shrink-0" />
        </div>

        {/* Center: absolutely centered in the full card */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <h1
            className="font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: "38px", letterSpacing: "-0.5px" }}
          >
            ASSA ABLOY Analytics
          </h1>
          <p className="mt-1 font-medium" style={{ fontSize: "15px", color: "#6b8cba" }}>
            {subtitle}
          </p>
          <div className="h-0.5 bg-red-500 mt-2 rounded-full" style={{ width: 56 }} />
        </div>
      </div>

      {/* Global filters — Campaign + Date Range */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        <MultiSelectDropdown
          label="ABMi Campaign"
          value={campaign}
          onChange={setCampaign}
          options={[...CAMPAIGNS]}
          minWidth={220}
        />
        <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <CalendarSearch size={14} className="text-orange-400 shrink-0" />
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">Date Range:</span>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
          <span className="text-gray-300 text-xs">–</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
          {(dateStart || dateEnd) && (
            <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="text-gray-300 hover:text-gray-500 ml-0.5">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg bg-white transition-colors shrink-0 ml-auto"
          title="Reset all filters to default"
        >
          <RotateCcw size={13} />
          Reset Filters
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg bg-white transition-colors shrink-0"
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {legend && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-0.5" style={{ fontFamily: "'Lato', sans-serif" }}>
          {legend.split(" | ").map((line, i) => (
            <p key={i} className="text-xs text-gray-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
