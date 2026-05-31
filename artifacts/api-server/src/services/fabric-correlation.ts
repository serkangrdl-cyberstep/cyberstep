import { db } from "@workspace/db";
import {
  fortinetIntegrationsTable,
  fabricEventsTable,
  fabricCorrelationsTable,
  fortimanagerBlockActionsTable,
  domainScansTable,
  customersTable,
  assessmentsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, gte } from "drizzle-orm";
import { getClaudeAiFn } from "./ai-client";
import { decryptSecret } from "./fabric-crypto";
import { fmBlockIp } from "./fabric-fortimanager";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

type Integration = typeof fortinetIntegrationsTable.$inferSelect;
type FabricEvent = typeof fabricEventsTable.$inferSelect;

interface AiCorrelation {
  title: string;
  narrative: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  killChainStage: string;
  mitreTactics: Array<{ id: string; name: string }>;
  recommendedAction: string;
  suspectIps: string[];
  shouldBlock: boolean;
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

async function getContext(customerId: number): Promise<{ companyName: string; sector: string; scanSummary: string }> {
  const [customer] = await db.select({ companyName: customersTable.companyName, email: customersTable.email })
    .from(customersTable).where(eq(customersTable.id, customerId));

  let sector = "belirtilmemiş";
  if (customer?.email) {
    const [assessment] = await db.select({ sector: assessmentsTable.sector })
      .from(assessmentsTable)
      .where(eq(assessmentsTable.email, customer.email))
      .orderBy(desc(assessmentsTable.createdAt))
      .limit(1);
    if (assessment?.sector) sector = assessment.sector;
  }

  // Latest domain scan as external-signal source — scoped to this customer's email
  // to prevent another tenant's scan leaking into the AI prompt.
  const scan = customer?.email
    ? (await db.select().from(domainScansTable)
        .where(eq(domainScansTable.email, customer.email))
        .orderBy(desc(domainScansTable.createdAt)).limit(1))[0]
    : undefined;

  const signals: string[] = [];
  if (scan) {
    if (scan.blacklisted) signals.push(`Domain ${scan.blacklistCount} kara listede`);
    if (scan.urlhausListed) signals.push("URLhaus zararlı listesinde");
    if (scan.usomListed) signals.push("USOM tehdit listesinde");
    if (scan.virusTotalMalicious > 0) signals.push(`VirusTotal: ${scan.virusTotalMalicious} motor zararlı`);
    if ((scan.cveSummary?.length ?? 0) > 0) signals.push(`${scan.cveSummary.length} açık CVE`);
    if (scan.hibpBreachCount > 0) signals.push(`${scan.hibpBreachCount} veri ihlali geçmişi`);
    if (!scan.spfPass || !scan.dmarcPass) signals.push("E-posta koruması (SPF/DMARC) eksik");
  }

  return {
    companyName: customer?.companyName ?? "Müşteri",
    sector,
    scanSummary: signals.length ? signals.join("; ") : "Bilinen dış tehdit sinyali yok",
  };
}

function buildPrompt(ctx: { companyName: string; sector: string; scanSummary: string }, events: FabricEvent[]): string {
  const eventLines = events.map((e, i) =>
    `${i + 1}. [${e.severity}] tip=${e.eventType} aksiyon=${e.action ?? "-"} kaynak=${e.srcIp ?? "-"} hedef=${e.dstIp ?? "-"}:${e.dstPort ?? "-"} saldırı=${e.attackName ?? "-"} cihaz=${e.deviceName ?? "-"} mesaj=${(e.message ?? "").slice(0, 160)}`
  ).join("\n");

  return `Sen kıdemli bir SOC (Güvenlik Operasyon Merkezi) analistisin. Bir KOBİ'nin Fortinet güvenlik duvarından (FortiGate/FortiAnalyzer) gelen olayları analiz edip tek bir korelasyon (saldırı senaryosu) çıkaracaksın.

ŞİRKET: ${ctx.companyName} (sektör: ${ctx.sector})
DIŞ TEHDİT SİNYALLERİ (alan adı taramasından): ${ctx.scanSummary}

GELEN OLAYLAR (${events.length} adet):
${eventLines}

GÖREV: Bu olayları birbiriyle ilişkilendir. Tutarlı bir saldırı hikayesi (kill-chain) oluştur. Türkçe, sade "patron dili" ile yaz (teknik jargondan kaçın, yöneticinin anlayacağı netlikte). MITRE ATT&CK taktiklerini eşle.

SADECE şu JSON formatında yanıt ver (başka metin yok):
{
  "title": "kısa başlık (örn: 'RDP Üzerinden Kaba Kuvvet Saldırısı')",
  "narrative": "2-4 cümlelik, yöneticinin anlayacağı sade Türkçe anlatım: ne oluyor, neden önemli",
  "severity": "critical|high|medium|low",
  "confidence": 0-100 arası sayı,
  "killChainStage": "örn: 'İlk Erişim Denemesi' / 'Komuta-Kontrol' / 'Yayılma'",
  "mitreTactics": [{"id":"T1110","name":"Brute Force"}],
  "recommendedAction": "tek cümle, atılması gereken en kritik aksiyon (Türkçe)",
  "suspectIps": ["engellenmesi önerilen şüpheli IP'ler"],
  "shouldBlock": true/false (saldırgan IP otomatik engellenmeli mi)
}`;
}

export async function correlateForIntegration(integration: Integration, opts?: { eventLimit?: number }): Promise<number | null> {
  const limit = opts?.eventLimit ?? 50;
  const events = await db.select().from(fabricEventsTable)
    .where(and(eq(fabricEventsTable.integrationId, integration.id), eq(fabricEventsTable.processed, false)))
    .orderBy(desc(fabricEventsTable.createdAt))
    .limit(limit);

  if (events.length === 0) return null;

  const ctx = await getContext(integration.customerId);
  const prompt = buildPrompt(ctx, events);

  let parsed: AiCorrelation | null = null;
  try {
    const ai = getClaudeAiFn();
    const text = await ai(prompt);
    const json = extractJson(text) as Partial<AiCorrelation> | null;
    if (json && json.title && json.narrative) {
      parsed = {
        title: String(json.title),
        narrative: String(json.narrative),
        severity: (["critical", "high", "medium", "low"].includes(String(json.severity)) ? json.severity : "medium") as AiCorrelation["severity"],
        confidence: Math.max(0, Math.min(100, Number(json.confidence) || 50)),
        killChainStage: String(json.killChainStage ?? ""),
        mitreTactics: Array.isArray(json.mitreTactics) ? json.mitreTactics.slice(0, 10).map((t) => ({ id: String(t.id ?? ""), name: String(t.name ?? "") })) : [],
        recommendedAction: String(json.recommendedAction ?? ""),
        suspectIps: Array.isArray(json.suspectIps) ? json.suspectIps.map(String).slice(0, 20) : [],
        shouldBlock: Boolean(json.shouldBlock),
      };
    }
  } catch (err) {
    logger.error({ err, integrationId: integration.id }, "Fabric correlation AI call failed");
  }

  // Fallback heuristic correlation if AI unavailable / unparseable
  if (!parsed) {
    const worst = events.reduce((acc, e) => Math.max(acc, SEVERITY_RANK[e.severity] ?? 0), 0);
    const sev = (worst >= 4 ? "critical" : worst >= 3 ? "high" : worst >= 2 ? "medium" : "low") as AiCorrelation["severity"];
    const ips = [...new Set(events.map((e) => e.srcIp).filter((x): x is string => !!x))];
    parsed = {
      title: `${events.length} güvenlik olayı tespit edildi`,
      narrative: `Fortinet güvenlik duvarınız son dönemde ${events.length} olay raporladı. En yüksek önem seviyesi: ${sev}. Otomatik korelasyon motoru geçici olarak yanıt veremedi, olaylar manuel incelenmeli.`,
      severity: sev,
      confidence: 40,
      killChainStage: "Belirsiz",
      mitreTactics: [],
      recommendedAction: "Olayları güvenlik ekibinizle inceleyin.",
      suspectIps: ips.slice(0, 20),
      shouldBlock: false,
    };
  }

  const [correlation] = await db.insert(fabricCorrelationsTable).values({
    integrationId: integration.id,
    customerId: integration.customerId,
    title: parsed.title,
    narrative: parsed.narrative,
    severity: parsed.severity,
    confidence: parsed.confidence,
    killChainStage: parsed.killChainStage || null,
    mitreTactics: parsed.mitreTactics,
    recommendedAction: parsed.recommendedAction || null,
    suspectIps: parsed.suspectIps,
    eventIds: events.map((e) => e.id),
  }).returning();

  // Mark events processed
  await db.update(fabricEventsTable)
    .set({ processed: true })
    .where(inArray(fabricEventsTable.id, events.map((e) => e.id)));

  await db.update(fortinetIntegrationsTable)
    .set({ correlationsCount: (integration.correlationsCount ?? 0) + 1, updatedAt: new Date() })
    .where(eq(fortinetIntegrationsTable.id, integration.id));

  if (!correlation) return null;

  // Auto-block qualifying IPs
  if (parsed.shouldBlock && integration.autoBlockEnabled && parsed.suspectIps.length > 0) {
    await runAutoBlock(integration, correlation.id, parsed.suspectIps, parsed.title);
  }

  // Critical/high → email alert
  if ((parsed.severity === "critical" || parsed.severity === "high")) {
    await sendCorrelationAlert(integration, parsed);
    await db.update(fabricCorrelationsTable).set({ alertSent: true }).where(eq(fabricCorrelationsTable.id, correlation.id));
  }

  logger.info({ integrationId: integration.id, correlationId: correlation.id, severity: parsed.severity }, "Fabric correlation created");
  return correlation.id;
}

async function runAutoBlock(integration: Integration, correlationId: number, ips: string[], reason: string): Promise<void> {
  const password = decryptSecret(integration.fmPasswordEnc);
  if (!integration.fmUrl || !integration.fmUsername || !password) {
    logger.warn({ integrationId: integration.id }, "Auto-block requested but FortiManager creds incomplete");
    return;
  }
  const creds = {
    url: integration.fmUrl, username: integration.fmUsername, password,
    adom: integration.fmAdom ?? "root", blockGroup: integration.fmBlockGroup ?? "CyberStep-BlockList",
  };
  let blocked = 0;
  for (const ip of ips.slice(0, 20)) {
    const [action] = await db.insert(fortimanagerBlockActionsTable).values({
      integrationId: integration.id, customerId: integration.customerId, correlationId, ip, reason,
    }).returning();
    const r = await fmBlockIp(creds, ip, reason);
    if (action) {
      await db.update(fortimanagerBlockActionsTable)
        .set({ status: r.ok ? "success" : "error", message: r.message })
        .where(eq(fortimanagerBlockActionsTable.id, action.id));
    }
    if (r.ok) blocked++;
  }
  if (blocked > 0) {
    await db.update(fabricCorrelationsTable).set({ autoBlocked: true }).where(eq(fabricCorrelationsTable.id, correlationId));
    await db.update(fortinetIntegrationsTable)
      .set({ blocksCount: (integration.blocksCount ?? 0) + blocked })
      .where(eq(fortinetIntegrationsTable.id, integration.id));
  }
}

async function sendCorrelationAlert(integration: Integration, c: AiCorrelation): Promise<void> {
  const to = integration.alertEmail;
  if (!to) return;
  const sevColor = c.severity === "critical" ? "#dc2626" : "#ea580c";
  const sevLabel = c.severity === "critical" ? "Kritik" : "Yüksek";
  const html = `
<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:${sevColor};color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">${sevLabel} Tehdit</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:19px;color:#0f172a">${c.title}</h2>
      <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.7">${c.narrative}</p>
      <div style="background:#fef2f2;border-left:4px solid ${sevColor};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#991b1b"><strong>Önerilen Aksiyon:</strong> ${c.recommendedAction}</p>
      </div>
      ${c.suspectIps.length ? `<p style="margin:0;font-size:13px;color:#64748b">Şüpheli IP'ler: ${c.suspectIps.join(", ")}</p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Fortinet Security Fabric · Güven skoru %${c.confidence}</p>
    </div>
  </div>
</body></html>`;
  try {
    await sendMail({ to, subject: `[CyberStep] ${sevLabel} Tehdit: ${c.title}`, html });
  } catch (err) {
    logger.error({ err, integrationId: integration.id }, "Failed to send fabric correlation alert");
  }
}

// Batch correlation across all active integrations (cron entry point)
export async function runBatchCorrelation(): Promise<void> {
  const integrations = await db.select().from(fortinetIntegrationsTable)
    .where(eq(fortinetIntegrationsTable.status, "connected"));
  for (const integration of integrations) {
    try { await correlateForIntegration(integration); }
    catch (err) { logger.warn({ err, integrationId: integration.id }, "Batch correlation failed for integration"); }
  }
}

// Weekly fabric summary report e-mailed to each integration's alert address.
export async function runWeeklyFabricReport(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const integrations = await db.select().from(fortinetIntegrationsTable)
    .where(eq(fortinetIntegrationsTable.status, "connected"));
  for (const integration of integrations) {
    try {
      const to = integration.alertEmail;
      if (!to) continue;

      const events = await db.select().from(fabricEventsTable)
        .where(and(eq(fabricEventsTable.integrationId, integration.id), gte(fabricEventsTable.createdAt, since)));
      const correlations = await db.select().from(fabricCorrelationsTable)
        .where(and(eq(fabricCorrelationsTable.integrationId, integration.id), gte(fabricCorrelationsTable.createdAt, since)))
        .orderBy(desc(fabricCorrelationsTable.createdAt));
      const blocks = await db.select().from(fortimanagerBlockActionsTable)
        .where(and(eq(fortimanagerBlockActionsTable.integrationId, integration.id), gte(fortimanagerBlockActionsTable.createdAt, since)));

      const critical = correlations.filter((c) => c.severity === "critical").length;
      const high = correlations.filter((c) => c.severity === "high").length;
      const topRows = correlations.slice(0, 5).map((c) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a">${c.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b">${SEV_TR[c.severity] ?? c.severity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b">%${c.confidence}</td>
        </tr>`).join("");

      const html = `
<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:#10b981;color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">Haftalık Fabric Raporu</span></div>
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#334155;font-size:14px">Son 7 günde Fortinet Security Fabric entegrasyonunuzdan toplanan özet:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#0f172a">${events.length}</div><div style="font-size:12px;color:#64748b">Olay</div></td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#0f172a">${correlations.length}</div><div style="font-size:12px;color:#64748b">Korelasyon</div></td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#dc2626">${critical + high}</div><div style="font-size:12px;color:#64748b">Kritik/Yüksek</div></td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:#0f172a">${blocks.length}</div><div style="font-size:12px;color:#64748b">Engelleme</div></td>
        </tr>
      </table>
      ${topRows ? `<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a">Öne Çıkan Senaryolar</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">${topRows}</table>`
        : `<p style="margin:0;color:#64748b;font-size:13px">Bu hafta önemli bir korelasyon oluşmadı.</p>`}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Fortinet Security Fabric · Haftalık Özet</p>
    </div>
  </div>
</body></html>`;
      await sendMail({ to, subject: "[CyberStep] Haftalık Fortinet Fabric Raporu", html });
    } catch (err) {
      logger.warn({ err, integrationId: integration.id }, "Weekly fabric report failed for integration");
    }
  }
}

const SEV_TR: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
