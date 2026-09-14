"use client";

import DashboardHeader from "@/components/DashboardHeader";

const TAB_LABEL = "Ad Samples";

// Static email creative served from /public. Add further samples here as they arrive.
const EMAIL_SAMPLE = {
  title: "ASSA ABLOY – The Critical Role of Access Control in K-12 School Safety (email)",
  src: "/email-samples/assa-abloy-asset2-critical-role-of-access-control.html",
};

export default function Page() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "12rem",
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f9fafb",
        zIndex: 1,
      }}
    >
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl">
          <span className="font-bold text-sm tracking-wide uppercase">{TAB_LABEL}</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white" style={{ height: "100%" }}>
          <iframe
            src={EMAIL_SAMPLE.src}
            title={EMAIL_SAMPLE.title}
            style={{ display: "block", width: "100%", height: "100%", border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
