---
name: CISO Haftalık Bülten
description: Weekly newsletter system — DB schema, Claude content generation, email delivery, admin panel, public pages, Friday cron
---

## Tables
- `weekly_bulletins` — one row per week; status: draft→review→sent→skipped; week_slug: `tr-YYYY-wNN`
- `bulletin_subscribers` — unique email, source tracking, engagement_score 0-100, isr_customer_id FK
- `bulletin_clicks` — link section tracking per subscriber per bulletin

## Services
- `weeklyDataCollector.ts` — derives top finding type from domain_scans boolean columns (no_dmarc/no_spf/ssl_issue etc), joins lead_candidates for sector scores
- `bulletinWriter.ts` — 7 parallel Claude calls (claude-sonnet-4-6), all using same SYSTEM_PROMPT; returns headline/introText/threatRadar/turkeyData/regulationSection/weeklyTip/toolResource + emailHtml + linkedinMiniPost
- `bulletinSender.ts` — sendWeeklyBulletin (must be status=review), sendTestBulletin, subscribeToBulletin, unsubscribeFromBulletin

## Routes
- Admin: /api/admin-panel/bulletin/list, /stats, /subscribers, /generate (POST fire-and-forget), /:id (GET/PUT), /:id/send, /:id/send-test
- Public: /api/bulletin/subscribe (POST), /api/bulletin/unsubscribe/:id (POST), /api/bulletin/archive (GET), /api/bulletin/:slug (GET)
- Static routes (/list, /stats, /subscribers, /archive) MUST be registered before /:id and /:slug

## Frontend
- Admin: /panel/bulletin — BulletinDetailEditor modal with iframe HTML preview + test email send
- Public: /bulten/arsiv (archive list + subscribe form), /bulten/:slug (web view of single bulletin)

## Cron
- Every Friday 08:00 Istanbul — auto-generates bulletin for current week, inserts with status=review

## Key gotcha
- Cyrillic 'е' (U+0435) was accidentally used in `weeklyBullетinsTable` during initial write. Perl sed couldn't fix it — had to rewrite files. Use plain ASCII in all identifiers.
- AdminLayout requires `title` prop — new admin pages must include it
