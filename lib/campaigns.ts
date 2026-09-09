/** Ordered newest → oldest. Sourced from ASSA ABLOY's actual campaign values
 *  (distinct abmi_campaign in prod_cbl_assaabloy_202602_scoring) — do not
 *  reuse Right At School's C1-C7 labels/dates here, they're a different schedule. */
export const CAMPAIGNS = [
  "C4: August 2026",
  "C3: July 2026",
  "C2: May 2026-June 2026",
  "C1: March - April 2026",
] as const;

// C2 is the most recently completed campaign with ad-performance data as of
// this writing — C3/C4 have engagement/scoring data but ad_performance hasn't
// caught up yet, so defaulting further would show empty funnel metrics.
export const DEFAULT_CAMPAIGN = "C2: May 2026-June 2026";

/** Strips the "C#: " prefix to get a display-friendly date range. */
export function campaignDateRange(campaign: string): string {
  return campaign.replace(/^C\d+:\s*/, "");
}

interface Goals {
  impressions: number;
  leads: number;
}

// Per-campaign impression/lead goals — campaigns run for different lengths
// of time so a single fixed goal doesn't apply across all of them.
// TODO: confirm real goals for ASSA ABLOY's C1-C4; every campaign currently
// falls back to DEFAULT_GOALS below until goals are provided.
const CAMPAIGN_GOALS: Record<string, Goals> = {};

const DEFAULT_GOALS: Goals = { impressions: 300_000, leads: 300 };

/**
 * Goals for the selected campaign(s), summed when multiple are selected.
 * An empty selection ("All campaigns") sums every known campaign's goal.
 */
export function campaignGoals(selected: string[]): Goals {
  const campaigns = selected.length > 0 ? selected : [...CAMPAIGNS];
  return campaigns.reduce(
    (acc, c) => {
      const g = CAMPAIGN_GOALS[c] ?? DEFAULT_GOALS;
      return { impressions: acc.impressions + g.impressions, leads: acc.leads + g.leads };
    },
    { impressions: 0, leads: 0 }
  );
}
