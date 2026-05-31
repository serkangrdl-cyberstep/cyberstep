---
name: AI report JSON parsing
description: How AI-generated assessment report JSON must be parsed/stored so raw JSON never leaks to the report UI/PDF/email.
---

# AI report JSON parsing & self-heal

The assessment report has SEPARATE report columns (`aiAnalysis` text, `maturityLevel` text, `findings` jsonb, plus kvkk/verbis/insurance/etc.). The AI returns ONE JSON object (often inside a ```json fence) that must be parsed and fanned out into those columns.

**Rule:** never store the raw model/JSON response into the `aiAnalysis` display column. On parse failure, store the placeholder (`AI analizi yüklenemedi.`) — the report UI hides the analysis section on that sentinel.

**Why:** LLM JSON is frequently *almost* valid (markdown fence, raw newlines/tabs inside string values, trailing commas). A naive `JSON.parse` throws, and the old fallback dumped the entire fenced blob into `aiAnalysis`, which then rendered verbatim on screen, in the PDF, and in email.

**How to apply:**
- Parse via the shared robust helper (`lib/report-json.ts`): strips fences, escapes raw control chars inside string literals, drops trailing commas, retries.
- Every report-read surface (on-screen report, report PDF, insurance PDF, admin review GET, admin approve/email) must heal legacy rows at read time with `recoverReportFields` (non-mutating) — broken rows predate the generation fix and stay broken in the DB otherwise.
- When adding a new report-read endpoint, apply `recoverReportFields` too.
