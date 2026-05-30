---
name: AI Security Assessment
description: Yapay Zeka Güvenlik Değerlendirmesi module — DB schema, API routes, scoring, Claude AI report generation, and frontend flow.
---

## Overview
Full AI security assessment module for KOBIs. Analyzes AI tool usage (ChatGPT, Gemini etc.) for KVKK compliance and data exposure risks.

## DB Tables (created via raw SQL — drizzle push requires TTY)
- `ai_tools_registry` — 20 tools seeded; fields: tool_name, provider, category, tier, risk_level, data_retention_days, trains_on_user_data, kvkk_compatible, dpa_available, risk_summary, recommendation
- `ai_assessments` — assessment sessions; fields: company info + status + declared_tool_ids (jsonb) + 4 area scores + report_json (jsonb) + policy_document
- `ai_assessment_answers` — per-question answers; fields: ai_assessment_id, question_number, answer

## API Routes (all under /api/)
- GET /api/ai-tools — public tool list
- POST /api/ai-assessment/start — creates session, adds to req.session["ownedAiAssessmentIds"]
- GET /api/ai-assessment/:id — get assessment (ownership check)
- POST /api/ai-assessment/:id/tools — save declared tool IDs
- POST /api/ai-assessment/:id/answers — batch save all 25 answers
- POST /api/ai-assessment/:id/complete — calculate scores, fire-and-forget Claude AI report
- GET /api/ai-assessment/:id/report — poll until status="report_ready"; returns assessment + declaredTools[]
- Admin: GET /admin/ai-assessments, GET/PUT /admin/ai-tools/:id

## Scoring Logic
- 25 questions, 4 areas (AI1-AI4)
- Area 1 (AI Araç Yönetimi, Q1-5): weights [3,2,2,1,2] → max 50
- Area 2 (Veri Maruz Kalma, Q6-13): weights [3,3,3,3,3,2,2,3] → max 110; REVERSE scored (evet=0, hayir=5) because questions are "is risky behavior happening?"
- Area 3 (Araç Konfigürasyonu, Q14-19): weights [2,2,2,1,1,1] → max 45
- Area 4 (KVKK Uyum, Q20-25): weights [2,2,1,1,2,2] → max 50
- Total max = 255; risk levels: ≥86%=IYI, ≥71%=DUSUK, ≥51%=ORTA, ≥31%=YUKSEK, else KRITIK

## Session Ownership
Uses `ownedAiAssessmentIds` in session (inline in route file, NOT in auth.ts to avoid pre-existing TS errors there).

## Claude AI Report Generation
- `AiGenerateFn` takes ONLY 1 string argument — concatenate system+user prompt into one string
- Returns JSON report with: risk_headline, executive_summary, tool_risk_cards[], data_exposure_summary, priority_actions[], kvkk_compliance_gap
- Also generates policyDocument (600-800 word AI usage policy)
- Fire-and-forget pattern; frontend polls /report every 2s

## Frontend Routes (full-page, no shared Layout)
- /ai-guvenlik-degerlendirmesi — landing page (with Layout)
- /ai-guvenlik/start — company info form
- /ai-guvenlik/:id/araclar — tool checklist
- /ai-guvenlik/:id/sorular — 25-question wizard
- /ai-guvenlik/:id/rapor — tabbed report (Genel Bakış, Araç Risk Skorkartı, Veri Maruz Kalma, KVKK, Aksiyon Planı, Politika Belgesi)

**Why:** AiGenerateFn signature must be checked before any AI route; pre-existing TS errors in auth.ts/isr-imap.ts/referral/index.ts are pre-existing, don't try to fix them.
