/**
 * Robust parsing + self-healing for AI-generated report JSON.
 *
 * The report-generation prompt asks the model to return a single JSON object
 * (optionally inside a ```json fence). LLM output is frequently *almost* valid
 * JSON — wrapped in a markdown fence, containing raw newlines/tabs inside string
 * values, or carrying a trailing comma. A naive `JSON.parse` throws on these and
 * previously caused the entire raw JSON blob to be stored into `aiAnalysis`,
 * which then rendered verbatim on screen and in the PDF export.
 *
 * `parseAiJson` recovers from those common defects. `extractReportFields` maps a
 * parsed object onto the typed report columns. `recoverReportFields` heals report
 * rows that already have a raw JSON blob stored in `aiAnalysis` (read-time, no DB
 * mutation) so existing broken reports display correctly.
 */

export type Finding = {
  domain: string;
  severity: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  title: string;
  description: string;
  recommendation: string;
};

export type WeeklyActionPlan = Array<{ week: number; title: string; tasks: string[] }>;

export interface ExtractedReportFields {
  aiAnalysis: string;
  recommendations: string[];
  estimatedBreachCostMin: number | null;
  estimatedBreachCostMax: number | null;
  riskReductionPercent: number | null;
  weeklyActionPlan: WeeklyActionPlan;
  kvkkPenaltyMin: number | null;
  kvkkPenaltyMax: number | null;
  kvkkRiskLevel: string | null;
  kvkkRiskArticles: string[];
  kvkkRiskSummary: string | null;
  sectorBenchmarkPercent: number | null;
  sectorBenchmarkComment: string | null;
  verbisRequired: boolean | null;
  verbisRiskLevel: string | null;
  verbisSteps: string[];
  insuranceReadinessPercent: number | null;
  insuranceGaps: string[];
  maturityLevel: string | null;
  findings: Finding[];
}

export const AI_ANALYSIS_FALLBACK = "AI analizi yüklenemedi.";

/** Escape raw control characters (newline/carriage-return/tab) that appear *inside* JSON string literals. */
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inStr = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

/**
 * Robustly extract the first JSON object from a (possibly fenced / lightly
 * malformed) AI response. Returns `null` if no recoverable object is found.
 */
export function parseAiJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const raw = candidate.slice(start, end + 1);
  const repaired = escapeControlCharsInStrings(raw);
  const attempts = [raw, repaired, repaired.replace(/,(\s*[}\]])/g, "$1")];
  for (const attempt of attempts) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try the next repair strategy */
    }
  }
  return null;
}

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === "number" ? v : null);
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const VALID_SEVERITIES: ReadonlySet<string> = new Set(["Kritik", "Yüksek", "Orta", "Düşük"]);

function asFindings(v: unknown): Finding[] {
  if (!Array.isArray(v)) return [];
  return v.filter((f): f is Finding => {
    if (!f || typeof f !== "object") return false;
    const o = f as Record<string, unknown>;
    return (
      typeof o["domain"] === "string" &&
      typeof o["severity"] === "string" &&
      VALID_SEVERITIES.has(o["severity"]) &&
      typeof o["title"] === "string" &&
      typeof o["description"] === "string" &&
      typeof o["recommendation"] === "string"
    );
  });
}

function asWeeklyActionPlan(v: unknown): WeeklyActionPlan {
  if (!Array.isArray(v)) return [];
  return v.filter((w): w is WeeklyActionPlan[number] => {
    if (!w || typeof w !== "object") return false;
    const o = w as Record<string, unknown>;
    return (
      typeof o["week"] === "number" &&
      typeof o["title"] === "string" &&
      Array.isArray(o["tasks"]) &&
      o["tasks"].every((t) => typeof t === "string")
    );
  });
}

/** Map a parsed AI JSON object onto the typed report columns, applying defaults for missing/invalid fields. */
export function extractReportFields(parsed: Record<string, unknown>): ExtractedReportFields {
  return {
    aiAnalysis: asString(parsed["aiAnalysis"]) ?? AI_ANALYSIS_FALLBACK,
    recommendations: asStringArray(parsed["recommendations"]),
    estimatedBreachCostMin: asNumber(parsed["estimatedBreachCostMin"]),
    estimatedBreachCostMax: asNumber(parsed["estimatedBreachCostMax"]),
    riskReductionPercent: asNumber(parsed["riskReductionPercent"]),
    weeklyActionPlan: asWeeklyActionPlan(parsed["weeklyActionPlan"]),
    kvkkPenaltyMin: asNumber(parsed["kvkkPenaltyMin"]),
    kvkkPenaltyMax: asNumber(parsed["kvkkPenaltyMax"]),
    kvkkRiskLevel: asString(parsed["kvkkRiskLevel"]),
    kvkkRiskArticles: asStringArray(parsed["kvkkRiskArticles"]),
    kvkkRiskSummary: asString(parsed["kvkkRiskSummary"]),
    sectorBenchmarkPercent: asNumber(parsed["sectorBenchmarkPercent"]),
    sectorBenchmarkComment: asString(parsed["sectorBenchmarkComment"]),
    verbisRequired: typeof parsed["verbisRequired"] === "boolean" ? parsed["verbisRequired"] : null,
    verbisRiskLevel: asString(parsed["verbisRiskLevel"]),
    verbisSteps: asStringArray(parsed["verbisSteps"]),
    insuranceReadinessPercent: asNumber(parsed["insuranceReadinessPercent"]),
    insuranceGaps: asStringArray(parsed["insuranceGaps"]),
    maturityLevel: asString(parsed["maturityLevel"]),
    findings: asFindings(parsed["findings"]),
  };
}

/** True if a stored `aiAnalysis` value is actually a raw JSON report blob (the bug we heal on read). */
function looksLikeRawReportJson(aiAnalysis: string | null | undefined): boolean {
  if (!aiAnalysis) return false;
  const t = aiAnalysis.trimStart();
  if (!t.startsWith("```") && !t.startsWith("{")) return false;
  return /"aiAnalysis"\s*:/.test(aiAnalysis);
}

/**
 * Heal a report row whose `aiAnalysis` accidentally contains the raw AI JSON
 * blob. Returns the report unchanged when no healing is needed (the common
 * case). Does NOT mutate the database — recovery is applied at read time so both
 * the on-screen report and the PDF/email exports render parsed content.
 */
export function recoverReportFields<
  T extends {
    aiAnalysis?: string | null;
    recommendations?: unknown;
    maturityLevel?: string | null;
    findings?: unknown;
  },
>(report: T): T {
  if (!looksLikeRawReportJson(report.aiAnalysis)) return report;
  const parsed = parseAiJson(report.aiAnalysis ?? "");
  if (!parsed) return report;
  const fields = extractReportFields(parsed);
  if (!fields.aiAnalysis || fields.aiAnalysis === AI_ANALYSIS_FALLBACK) return report;
  return { ...report, ...fields };
}
