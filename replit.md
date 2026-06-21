# CyberStep.io

KOBİ'ler için Türkçe siber güvenlik risk analizi platformu. Şirketler ücretsiz 20 soruluk Mini Assessment ile başlar, cevaplar Gemini AI ile analiz edilir ve kişiselleştirilmiş rapor oluşturulur.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — auto-provisioned by Replit AI Integrations
- Required secret: `ENCRYPTION_KEY` (64 hex chars) — AES-256-GCM key for FortiManager credentials; must be a Secret, never a shared env var (shared env vars land in git-tracked `.replit`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Gemini 2.5 Flash via Replit AI Integrations (`@workspace/integrations-gemini-ai`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **Frontend**: `artifacts/cyberstep/src/`
  - Pages: `src/pages/` (landing, assessment-start, assessment-runner, report, dashboard)
  - App router: `src/App.tsx`
- **API Server**: `artifacts/api-server/src/routes/`
  - Assessment routes: `src/routes/assessments/` (scoring logic + CRUD + AI report)
  - Gemini routes: `src/routes/gemini/` (SSE chat)
- **DB Schema**: `lib/db/src/schema/` (assessments, assessment_answers, reports, conversations, messages)
- **OpenAPI spec**: `lib/api-spec/openapi.yaml`
- **Generated hooks**: `lib/api-client-react/src/generated/api.ts`
- **Generated Zod schemas**: `lib/api-zod/src/generated/api.ts`

## Architecture decisions

- Assessment answers are stored in local React state during the wizard, then batch-submitted in one API call at the end (better UX, simpler backend)
- AI report generation is async/fire-and-forget — `POST /assessments/:id/complete` triggers Gemini in the background, frontend polls `/assessments/:id/report` every 2s until ready
- Scoring: Evet=5, Kısmen=3, Bilmiyorum=1, Hayır=0; Normal weight=1x, Kritik weight=2x; max score 140
- Red alarm questions: 3, 5, 6, 7, 11, 12, 14, 17, 18 — if answered "Hayır" these trigger a special warning in report
- Full Assessment (55 questions) is planned/marked "Yakında" — Mini (20 questions) is free

## Product

- **Landing page**: Value proposition for KOBİs, 3-step how-it-works, "Ücretsiz Değerlendirme Başla" CTA
- **Assessment Start**: Company info form (name, contact, email, sector, employee count)
- **Mini Assessment**: 20-question wizard across 5 domains (A-E), with visual answer buttons
- **Report**: AI-generated risk analysis, score gauge, domain breakdown chart, action recommendations
- **Dashboard**: Stats overview, risk distribution chart, recent assessments table

## User preferences

- Turkish language throughout
- No emojis in UI
- App name: CyberStep.io

## Completed — do not re-implement, do not re-check, do not touch

- T001 (CVE landing widget), T002 (ASN orphaned assets), T003 (typecheck cleanup)
- Faz A/B/C (model router merkezi hook mimarisi)
- Haiku fiyat düzeltmesi
- Faz D Öncelik 1 Adım 0 (merkezi hook), cve-content + kvkk-assess doğrulaması
- Nitelendirme A-fix (isQualifying deadlock + 15 dk timeout, discoveryPipeline.ts)
- Nitelendirme B-fix (lead-teaser maliyet log — setAiCostLogger hook, kanıt: ai_cost_log id=55)
- Nitelendirme C-fix (scanning stuck cleanup — index.ts:3272, startup-only)
- Nitelendirme D-fix: production DB sorgusu bekliyor, başka işlem yok

## Gotchas

- After schema changes, run `pnpm run typecheck:libs` to rebuild the lib/db composite package before running API server typecheck
- The `stats/summary` route MUST be registered before `/:id` in Express to avoid route conflicts
- Gemini AI integration: `AI_INTEGRATIONS_GEMINI_BASE_URL` and `AI_INTEGRATIONS_GEMINI_API_KEY` are auto-set by Replit — do not ask user for them

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
