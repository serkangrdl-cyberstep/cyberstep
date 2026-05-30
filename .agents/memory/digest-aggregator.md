---
name: Digest News Aggregator
description: Weekly cybersecurity news aggregator with RSS collection, Claude AI scoring/digest generation, and admin panel at /digest/
---

# Digest News Aggregator

## Architecture
- **DB tables**: `news_sources`, `news_items`, `weekly_digests` — created via `executeSql` (drizzle push requires TTY); schema files in `lib/db/src/schema/`
- **RSS collector**: `artifacts/api-server/src/routes/digest/rss-collector.ts` — uses `rss-parser`, Turkey keyword filter for EN sources, ISO week calc
- **Claude processor**: `artifacts/api-server/src/routes/digest/claude-processor.ts` — scores items 1-10, generates 5 content formats in parallel (summary, LinkedIn, Twitter, Instagram, Story)
- **Router**: `artifacts/api-server/src/routes/digest/index.ts` — mounted at `/api/digest/`
- **Frontend**: `artifacts/digest-admin` artifact at `/digest/` (port 23300) — 4 views: Dashboard, NewsFeed, DigestList, DigestEditor, Sources

## Key decisions
- Claude model: `claude-sonnet-4-5` (NOT claude-sonnet-4-20250514 or claude-sonnet-4-6)
- max_tokens: 8192 for all calls
- All 5 content formats generated in `Promise.all` for speed
- Auto-save on blur (1.5s debounce) in DigestEditor
- Approve → sendMail to ADMIN_EMAIL + optional DIGEST_WEBHOOK_URL POST
- 10 default RSS sources seeded on startup via `seedDefaultSources()`

**Why:** `drizzle push` requires interactive TTY — always use `executeSql` for new tables in non-TTY environments.

## Cron schedule (Istanbul timezone)
- Daily 06:00 → `collectRSSFeeds()`
- Every Friday 07:00 → `generateWeeklyDigest()`

## sendMail signature
`sendMail({ to, subject, html })` — no `text` field, strictly 3 properties.
