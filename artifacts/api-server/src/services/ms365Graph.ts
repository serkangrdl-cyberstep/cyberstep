import { pool } from "@workspace/db";
import { encryptSecret, decryptSecret } from "./fabric-crypto";
import { createCaseWithNumber } from "./soc/soc-cases";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ms365IntegrationRow {
  id: number;
  customer_id: number;
  azure_tenant_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  status: string;
}

interface SignInRaw {
  id: string;
  userPrincipalName?: string;
  ipAddress?: string;
  location?: { city?: string; countryOrRegion?: string; state?: string };
  riskLevelAggregated?: string;
  riskLevelDuringSignIn?: string;
  riskDetail?: string;
  riskState?: string;
  createdDateTime?: string;
}

interface SecurityAlertRaw {
  id: string;
  title?: string;
  severity?: string;
  category?: string;
  description?: string;
  userStates?: Array<{ userPrincipalName?: string }>;
  createdDateTime?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getMs365RedirectUri(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  return domain ? `https://${domain}/api/ms365/callback` : "http://localhost/api/ms365/callback";
}

export function buildMs365AuthUrl(state: string): string {
  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID not configured");
  const redirectUri = encodeURIComponent(getMs365RedirectUri());
  const scopes = encodeURIComponent(
    "AuditLog.Read.All SecurityEvents.Read.All MailboxSettings.Read offline_access openid profile"
  );
  return (
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${scopes}` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=consent`
  );
}

export async function exchangeMs365Code(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantId: string;
} | null> {
  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    logger.error("MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not configured");
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getMs365RedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json() as TokenResponse;
  if (data.error || !data.access_token) {
    logger.error({ error: data.error, desc: data.error_description }, "MS365 token exchange failed");
    return null;
  }

  // Extract tenant ID from the access token JWT (middle segment)
  let tenantId = "common";
  try {
    const payload = JSON.parse(
      Buffer.from(data.access_token.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;
    tenantId = (payload["tid"] as string) ?? "common";
  } catch {
    // fallback
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresIn: data.expires_in,
    tenantId,
  };
}

export async function refreshMs365Token(row: Ms365IntegrationRow): Promise<string | null> {
  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  const refreshToken = decryptSecret(row.refresh_token_enc);
  if (!refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "AuditLog.Read.All SecurityEvents.Read.All MailboxSettings.Read offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${row.azure_tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  const data = await res.json() as TokenResponse;
  if (data.error || !data.access_token) {
    const errMsg = data.error_description ?? data.error ?? "Token refresh failed";
    logger.warn({ integrationId: row.id, error: data.error }, "MS365 token refresh failed — marking error");
    await pool.query(
      `UPDATE ms365_integrations SET status = 'error', sync_error = $1, updated_at = NOW() WHERE id = $2`,
      [errMsg, row.id]
    );
    await sendMs365ErrorEmail(row.id, row.customer_id).catch(err =>
      logger.warn({ err, integrationId: row.id }, "MS365 error email failed")
    );
    return null;
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  const newAccessEnc = encryptSecret(data.access_token);
  const newRefreshEnc = data.refresh_token ? encryptSecret(data.refresh_token) : null;

  // Fail-closed: if ENCRYPTION_KEY is unavailable, refuse to store plaintext tokens
  if (!newAccessEnc || (data.refresh_token && !newRefreshEnc)) {
    logger.error({ integrationId: row.id }, "MS365 token refresh: ENCRYPTION_KEY unavailable — refusing plaintext storage");
    await pool.query(
      `UPDATE ms365_integrations SET status = 'error', sync_error = 'Şifreleme anahtarı eksik (ENCRYPTION_KEY)', updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
    return null;
  }

  await pool.query(
    `UPDATE ms365_integrations
     SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3,
         status = 'active', sync_error = NULL, updated_at = NOW()
     WHERE id = $4`,
    [newAccessEnc, newRefreshEnc ?? row.refresh_token_enc, expiresAt.toISOString(), row.id]
  );

  return data.access_token;
}

// ─── Reconnection notification email ─────────────────────────────────────────

async function sendMs365ErrorEmail(integrationId: number, customerId: number): Promise<void> {
  // Rate-limit: at most 1 email per 24 hours per integration
  const { rows } = await pool.query<{ last_error_email_at: string | null; contact_email: string | null }>(
    `SELECT i.last_error_email_at, c.contact_email
     FROM ms365_integrations i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.id = $1
     LIMIT 1`,
    [integrationId]
  );
  const row = rows[0];
  if (!row?.contact_email) return;

  // Skip if already sent within 24 hours
  if (row.last_error_email_at) {
    const lastSent = new Date(row.last_error_email_at).getTime();
    if (Date.now() - lastSent < 24 * 60 * 60 * 1000) return;
  }

  const { sendMail } = await import("./email");
  const baseUrl = process.env["REPLIT_DOMAINS"]
    ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
    : "http://localhost:80";

  await sendMail({
    to: row.contact_email,
    subject: "CyberStep: Microsoft 365 bağlantınız kesildi — yeniden bağlanın",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:8px;">
        <h2 style="color:#60a5fa;margin-top:0;">Microsoft 365 Bağlantısı Kesildi</h2>
        <p>Azure AD entegrasyonunuzun erişim token'ı yenilenemedi. SOC izleme geçici olarak duraklatıldı.</p>
        <p style="font-size:14px;color:#94a3b8;">Bu durum genellikle Azure AD politika değişikliği veya uygulama izninin kaldırılması durumunda oluşur.</p>
        <a href="${baseUrl}/hesabim/entegrasyonlar"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          Yeniden Bağlan
        </a>
        <p style="margin-top:24px;font-size:12px;color:#64748b;">CyberStep · Bu e-postayı görmezden gelebilirsiniz Microsoft 365 entegrasyonu kullanmıyorsanız.</p>
      </div>
    `,
  });

  await pool.query(
    `UPDATE ms365_integrations SET last_error_email_at = NOW() WHERE id = $1`,
    [integrationId]
  );
  logger.info({ integrationId, customerId }, "MS365 reconnect email sent");
}

// ─── Graph API fetchers ───────────────────────────────────────────────────────

async function getValidAccessToken(row: Ms365IntegrationRow): Promise<string | null> {
  // If token expires within 5 minutes, refresh first
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    return refreshMs365Token(row);
  }
  return decryptSecret(row.access_token_enc);
}

// T26: helper — creates a fetch with AbortController timeout (default 20s)
function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export async function fetchRiskySignIns(accessToken: string): Promise<SignInRaw[]> {
  try {
    const res = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/auditLogs/signIns?$filter=riskLevelDuringSignIn ne 'none' and riskLevelDuringSignIn ne 'unknownFutureValue'&$top=50&$orderby=createdDateTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (!res.ok) {
      logger.warn({ status: res.status }, "fetchRiskySignIns: Graph API error");
      return [];
    }
    const data = await res.json() as { value?: SignInRaw[] };
    return data.value ?? [];
  } catch (err) {
    logger.warn({ err }, "fetchRiskySignIns: request failed or timed out");
    return [];
  }
}

export async function fetchEmailThreats(accessToken: string): Promise<SecurityAlertRaw[]> {
  try {
    const res = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/security/alerts?$filter=category eq 'Email'&$top=50&$orderby=createdDateTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (!res.ok) {
      logger.warn({ status: res.status }, "fetchEmailThreats: Graph API error");
      return [];
    }
    const data = await res.json() as { value?: SecurityAlertRaw[] };
    return data.value ?? [];
  } catch (err) {
    logger.warn({ err }, "fetchEmailThreats: request failed or timed out");
    return [];
  }
}

// ─── Impossible travel detection ─────────────────────────────────────────────

async function detectImpossibleTravel(
  customerId: number,
  integrationId: number,
  signIn: SignInRaw
): Promise<void> {
  if (!signIn.userPrincipalName || !signIn.location?.countryOrRegion) return;

  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const windowDate = new Date(Date.now() - WINDOW_MS);

  const { rows } = await pool.query<{ country: string; event_time: string }>(
    `SELECT location->>'countryOrRegion' AS country, event_time
     FROM ms365_signin_logs
     WHERE customer_id = $1
       AND user_principal_name = $2
       AND event_time >= $3
       AND location->>'countryOrRegion' IS NOT NULL
     ORDER BY event_time DESC
     LIMIT 5`,
    [customerId, signIn.userPrincipalName, windowDate]
  );

  const newCountry = signIn.location.countryOrRegion;
  const differentCountry = rows.find(r => r.country && r.country !== newCountry);
  if (!differentCountry) return;

  const socCase = await createCaseWithNumber({
    customerId,
    severity: "critical",
    category: "impossible_travel",
    title: `Imkansiz Seyahat: ${signIn.userPrincipalName}`,
    description:
      `${signIn.userPrincipalName} kullanicisi 1 saat icinde ${differentCountry.country} ve ` +
      `${newCountry} konumlarindan giris yapti. Bu imkansiz seyahat durumuna isaret ediyor.`,
    attackNarrative:
      `Ayni kullanici hesabi 1 saat icinde birden fazla farkli ulkeden erisim sagladi. ` +
      `Bu durum genellikle ele gecirilmis hesap (ATO - Account Takeover) saldirisina isaret eder. ` +
      `IP: ${signIn.ipAddress ?? "bilinmiyor"}. Microsoft Azure AD kimlik risk alarmlarindan kaynakli.`,
    triggerEventIds: [],
  });

  if (socCase) {
    await pool.query(
      `UPDATE ms365_signin_logs SET correlated_soc_case_id = $1
       WHERE customer_id = $2 AND user_principal_name = $3
         AND event_time >= $4`,
      [socCase.id, customerId, signIn.userPrincipalName, windowDate]
    );
    logger.info(
      { customerId, socCaseId: socCase.id, user: signIn.userPrincipalName },
      "MS365 impossible travel: critical SOC case created"
    );
  }
}

// ─── Cross-correlation with fabric_events ─────────────────────────────────────

async function crossCorrelateWithFabric(
  customerId: number,
  signIn: SignInRaw,
  signinLogId: number
): Promise<void> {
  if (!signIn.ipAddress) return;

  const WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
  const windowDate = new Date(Date.now() - WINDOW_MS);

  const { rows } = await pool.query<{ id: number; event_type: string }>(
    `SELECT id, event_type FROM fabric_events
     WHERE customer_id = $1 AND (src_ip = $2 OR dst_ip = $2) AND created_at >= $3
     LIMIT 5`,
    [customerId, signIn.ipAddress, windowDate]
  );

  if (rows.length === 0) return;

  const socCase = await createCaseWithNumber({
    customerId,
    severity: "high",
    category: "coordinated_attack",
    title: `Koordineli Saldir Tespiti: ${signIn.ipAddress}`,
    description:
      `${signIn.ipAddress} adresi hem Azure AD giris logundan hem de Fortinet fabric olaylarindan tespit edildi. ` +
      `Kullanici: ${signIn.userPrincipalName ?? "bilinmiyor"}.`,
    attackNarrative:
      `Ayni IP adresi (${signIn.ipAddress}) son 2 saat icinde hem Microsoft Azure AD kimlik dogrulamasi ` +
      `hem de ag guvenlik duvarinda goruldu. Bu koordineli saldir belirtisidir — ` +
      `kullanici hesabi ele gecirme ve ag sizmasi ayni anda gerceklestirilmeye calisilabilir.`,
    triggerEventIds: rows.map(r => r.id),
  });

  if (socCase) {
    await pool.query(
      `UPDATE ms365_signin_logs SET correlated_soc_case_id = $1 WHERE id = $2`,
      [socCase.id, signinLogId]
    );
    logger.info(
      { customerId, socCaseId: socCase.id, ip: signIn.ipAddress },
      "MS365+Fabric cross-correlation: coordinated attack SOC case created"
    );
  }
}

// ─── Main poller ──────────────────────────────────────────────────────────────

export async function pollMs365Integration(row: Ms365IntegrationRow): Promise<void> {
  const accessToken = await getValidAccessToken(row);
  if (!accessToken) {
    logger.warn({ integrationId: row.id }, "MS365 poll skipped: no valid access token");
    return;
  }

  // ── Risky sign-ins ──────────────────────────────────────────────────────────
  const signIns = await fetchRiskySignIns(accessToken).catch(err => {
    logger.error({ err, integrationId: row.id }, "fetchRiskySignIns error");
    return [] as SignInRaw[];
  });

  for (const s of signIns) {
    const riskLevel = s.riskLevelAggregated ?? s.riskLevelDuringSignIn ?? "none";
    const eventTime = s.createdDateTime ? new Date(s.createdDateTime) : new Date();

    const existing = await pool.query(
      `SELECT id FROM ms365_signin_logs
       WHERE integration_id = $1 AND user_principal_name = $2 AND event_time = $3
       LIMIT 1`,
      [row.id, s.userPrincipalName ?? "", eventTime]
    );
    if (existing.rows.length > 0) continue;

    const { rows: inserted } = await pool.query<{ id: number }>(
      `INSERT INTO ms365_signin_logs
         (integration_id, customer_id, user_principal_name, ip_address, location,
          risk_level, risk_detail, risk_state, event_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        row.id,
        row.customer_id,
        s.userPrincipalName ?? null,
        s.ipAddress ?? null,
        s.location ? JSON.stringify(s.location) : null,
        riskLevel,
        s.riskDetail ?? null,
        s.riskState ?? null,
        eventTime,
      ]
    );
    const signinLogId = inserted[0]?.id;
    if (!signinLogId) continue;

    // High risk → SOC case
    if (riskLevel === "high") {
      const socCase = await createCaseWithNumber({
        customerId: row.customer_id,
        severity: "high",
        category: "azure_signin_risk",
        title: `Azure AD Yuksek Riskli Giris: ${s.userPrincipalName ?? "Bilinmiyor"}`,
        description: `Microsoft Azure AD yuksek riskli giris tespiti. IP: ${s.ipAddress ?? "bilinmiyor"}, Konum: ${s.location?.countryOrRegion ?? "bilinmiyor"}`,
        attackNarrative: `Microsoft kimlik koruma sistemi bu giris islemini yuksek riskli olarak siniflandirdi. Risk detay: ${s.riskDetail ?? "yok"}. Hesap ele gecirme veya parola spreyi saldirisi olabilir.`,
        triggerEventIds: [],
      });
      if (socCase) {
        await pool.query(
          `UPDATE ms365_signin_logs SET correlated_soc_case_id = $1 WHERE id = $2`,
          [socCase.id, signinLogId]
        );
      }
    }

    // Impossible travel check
    await detectImpossibleTravel(row.customer_id, row.id, s).catch(err =>
      logger.error({ err }, "detectImpossibleTravel error")
    );

    // Cross-correlate with fabric_events
    await crossCorrelateWithFabric(row.customer_id, s, signinLogId).catch(err =>
      logger.error({ err }, "crossCorrelateWithFabric error")
    );
  }

  // ── Email threats ───────────────────────────────────────────────────────────
  const emailAlerts = await fetchEmailThreats(accessToken).catch(err => {
    logger.error({ err, integrationId: row.id }, "fetchEmailThreats error");
    return [] as SecurityAlertRaw[];
  });

  for (const alert of emailAlerts) {
    const existing = await pool.query(
      `SELECT id FROM ms365_email_alerts WHERE integration_id = $1 AND alert_id = $2 LIMIT 1`,
      [row.id, alert.id]
    );
    if (existing.rows.length > 0) continue;

    const affectedUser = alert.userStates?.[0]?.userPrincipalName ?? null;
    const { rows: inserted } = await pool.query<{ id: number }>(
      `INSERT INTO ms365_email_alerts
         (integration_id, customer_id, alert_id, title, severity, category, description, affected_user, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        row.id,
        row.customer_id,
        alert.id,
        alert.title ?? "M365 Email Tehdidi",
        alert.severity ?? "medium",
        alert.category ?? "Email",
        alert.description ?? null,
        affectedUser,
        JSON.stringify(alert),
      ]
    );
    const alertDbId = inserted[0]?.id;

    if (alertDbId && ["high", "medium"].includes(alert.severity ?? "")) {
      const socCase = await createCaseWithNumber({
        customerId: row.customer_id,
        severity: alert.severity === "high" ? "high" : "medium",
        category: "m365_email_threat",
        title: `M365 E-posta Tehdidi: ${alert.title ?? "Bilinmeyen Alert"}`,
        description: alert.description ?? "Microsoft 365 Defender e-posta tehdit uyarisi",
        attackNarrative: `Microsoft 365 Defender tarafindan e-posta karantina alarmi uretildi. ${affectedUser ? `Etkilenen kullanici: ${affectedUser}.` : ""} E-posta bazli saldirilarda (phishing, BEC, malware) kullanicilarin kimlik bilgileri ele gecirilebilir.`,
        triggerEventIds: [],
      });
      if (socCase) {
        await pool.query(
          `UPDATE ms365_email_alerts SET correlated_soc_case_id = $1 WHERE id = $2`,
          [socCase.id, alertDbId]
        );
      }
    }
  }

  await pool.query(
    `UPDATE ms365_integrations SET last_sync_at = NOW(), sync_error = NULL, updated_at = NOW() WHERE id = $1`,
    [row.id]
  );
  logger.info(
    { integrationId: row.id, signIns: signIns.length, emailAlerts: emailAlerts.length },
    "MS365 poll complete"
  );
}

export async function pollAllMs365Integrations(): Promise<void> {
  const { rows } = await pool.query<Ms365IntegrationRow>(
    `SELECT id, customer_id, azure_tenant_id, access_token_enc, refresh_token_enc,
            token_expires_at, status
     FROM ms365_integrations
     WHERE status IN ('active', 'error') AND refresh_token_enc IS NOT NULL`
  );

  if (rows.length === 0) return;
  logger.info({ count: rows.length }, "MS365 poller: polling integrations");

  for (const row of rows) {
    await pollMs365Integration(row).catch(err =>
      logger.error({ err, integrationId: row.id }, "pollMs365Integration error")
    );
    await new Promise(r => setTimeout(r, 2000));
  }
}
