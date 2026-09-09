"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";

// Dashboard 166 ("ASSA ABLOY - Ecosystem Insights", a deep copy of RAS
// dashboard 69), tab 232 = Ecosystem Insights
export default function EcosystemInsights() {
  return (
    <div className="h-[calc(100vh-4rem)] -m-8">
      <InteractiveDashboard
        dashboardId={166}
        dashboardTabId={232}
        style={{ height: "100%" }}
      />
    </div>
  );
}
