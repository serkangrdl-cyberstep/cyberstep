---
name: MS365 Azure AD Integration
description: OAuth2 multi-tenant flow + Graph API polling + SOC correlation for Microsoft 365
---

# MS365 Azure AD Integration

## Architecture
- `ms365_integrations` table: per-customer Azure tenant OAuth tokens (encrypted AES-256-GCM)
- `ms365_signin_logs` table: risky sign-ins from Graph API auditLogs/signIns
- `ms365_email_alerts` table: M365 Defender email threat alerts
- Poller: `artifacts/api-server/src/services/ms365Graph.ts` — every 15 min via cron
- Routes: `artifacts/api-server/src/routes/ms365/index.ts` (OAuth + portal)
- Admin: `artifacts/api-server/src/routes/admin-panel/ms365.ts` + `/panel/ms365` page

## Critical: Required env vars
- `MICROSOFT_CLIENT_ID` — Azure multi-tenant app client ID
- `MICROSOFT_CLIENT_SECRET` — Azure app secret
- Routes fail gracefully (503) when not configured
- Token encryption uses same `ENCRYPTION_KEY` + `encryptSecret/decryptSecret` from `fabric-crypto.ts`

## OAuth2 flow
- `GET /api/ms365/auth` → redirect to Microsoft authorization URL (common tenant)
- `GET /api/ms365/callback` → code exchange, extract tenant ID from JWT `tid` claim, store encrypted tokens
- State stored in session: cast as `req.session as { ms365_oauth_state?: string; ms365_customer_id?: number }`
- Redirect URI uses REPLIT_DOMAINS[0] via `getMs365RedirectUri()`

## SOC Correlation
- `riskLevel=high` → "high" SOC case via `createCaseWithNumber()`
- Impossible travel (same UPN, 2 different countries < 1 hour) → "critical" SOC case
- Same IP in both `fabric_events` AND `ms365_signin_logs` (2h window) → "coordinated_attack" case
- Email threats (M365 Defender) → SOC cases for high/medium severity

## Why: Fail-graceful
All poller errors are caught per-integration; one bad token never blocks others.
Token refresh failure marks integration status='error' without crashing the cron.
