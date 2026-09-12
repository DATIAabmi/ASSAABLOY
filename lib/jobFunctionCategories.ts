// Ordered patterns — first match wins, so more-specific entries come first.
export const JOB_FUNCTION_CATEGORIES: { label: string; test: (t: string) => boolean }[] = [
  { label: "Assistant Superintendent", test: (t) => /assistant\s+superintendent|asst\.?\s*superintendent/i.test(t) },
  { label: "Superintendent",           test: (t) => /superintendent/i.test(t) },
  { label: "Assistant Principal",      test: (t) => /assistant\s+principal|vice\s+principal|associate\s+principal|asst\.?\s*principal/i.test(t) },
  { label: "Principal",                test: (t) => /principal/i.test(t) },
  { label: "Finance & Business",       test: (t) => /financ|business|purchasing|procurement|treasurer|controller|budget|chief\s+financial|chief\s+business|chief\s+operating/i.test(t) },
  { label: "Curriculum & Instruction", test: (t) => /curriculum|instruction|chief\s+academic|teaching\s+and\s+learning/i.test(t) },
  { label: "Health & Wellness",        test: (t) => /wellness|mental\s+health/i.test(t) },
  { label: "Human Resources",          test: (t) => /human\s+resources/i.test(t) },
  { label: "Technology",               test: (t) => /technology/i.test(t) },
  { label: "Other",                    test: () => true },
];

export function normalizeJobTitle(raw: string): string {
  for (const { label, test } of JOB_FUNCTION_CATEGORIES) {
    if (test(raw)) return label;
  }
  return "Other";
}
