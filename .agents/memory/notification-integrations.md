---
name: Notification integrations
description: Generic Webhook (HMAC), Telegram Bot, NetGSM SMS — SOC alarm delivery
---

## Architecture

All 3 integrations follow the same fire-and-forget pattern via `setImmediate(() => import(...).then(...).catch(logger.warn))`.

## DB tables

- `webhook_configs` — multi-webhook per customer (ARRAY events, secret_enc, headers_json)
- `webhook_deliveries` — per-delivery log (status, attempts, response_code)
- `telegram_configs` — UNIQUE(customer_id), bot_token_enc, chat_id
- `netgsm_configs` — UNIQUE(customer_id), username_enc, password_enc, header, phone_numbers[]

## SOC hook points (3 locations)

1. `soc-triage.ts` → `openCase()` — after KVKK block, before `return created.id` → fires `soc.case.opened` or `soc.case.critical`
2. `routes/soc/index.ts` — PATCH case status, inside `["resolved","closed","false_positive"]` guard → fires `soc.case.closed`
3. `soc-escalation.ts` → SLA breach loop → fires `soc.sla.breached`

## Services

- `webhookDispatcher.ts` — `dispatchWebhook(customerId, event, payload)`, `retryFailedWebhooks()` (cron */10), `validateWebhookUrl()` (SSRF guard), HMAC-SHA256 via `X-CyberStep-Signature`
- `telegramNotifier.ts` — `sendTelegramAlert()`, MarkdownV2 format, `getTelegramBotInfo()` for token validation on save
- `netgsmNotifier.ts` — `sendNetgsmAlert()`, XML body to `https://api.netgsm.com.tr/sms/send/xml`, response "00" = success

## Routes

All under `/api/integrations/webhook|telegram|netgsm` (portal-facing, requireCustomer).
- Webhook: GET list, POST create, PUT update, DELETE, POST /:id/test, GET /deliveries
- Telegram/NetGSM: ON CONFLICT (customer_id) DO UPDATE upsert pattern (one config per customer)

## Admin catalog

- Category: "Bildirim & Alarm" added to PLATFORM_CATEGORIES + CATEGORY_ICONS (Bell icon)
- 3 entries: webhook (free), telegram (free), netgsm (paid/usage-based)

**Why:** envKey is intentionally "" for all 3 — credentials stored per-customer in DB, not in env vars.
