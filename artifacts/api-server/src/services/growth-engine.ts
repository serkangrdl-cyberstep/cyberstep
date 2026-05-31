import tls from "tls";
import { db } from "@workspace/db";
import {
  growthTriggersTable,
  competitorChecksTable,
  benchmarkDownloadsTable,
  leadScanQueueTable,
  domainScansTable,
  growthEngineSettingsTable,
} from "@workspace/db";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerParams {
  type: string;
  domain: string;
  companyName?: string;
  customerId?: number;
  email?: string;
  data: Record<string, unknown>;
}

// ─── Suppress Days per Trigger Type ──────────────────────────────────────────

const DEFAULT_SUPPRESS_DAYS: Record<string, number> = {
  ssl_expiry:       7,
  new_cve:         30,
  sector_breach:   30,
  kvk_penalty:     30,
  score_drop:      14,
  competitor_check: 0,
  port_change:     14,
  supplier_chain:  90,
  ekap_tender:      0,
  new_company:      0,
  benchmark_dl:     0,
};

async function getSuppressDays(triggerType: string): Promise<number> {
  try {
    const [setting] = await db.select({ suppressDays: growthEngineSettingsTable.suppressDays })
      .from(growthEngineSettingsTable)
      .where(eq(growthEngineSettingsTable.triggerType, triggerType))
      .limit(1);
    return setting?.suppressDays ?? DEFAULT_SUPPRESS_DAYS[triggerType] ?? 30;
  } catch {
    return DEFAULT_SUPPRESS_DAYS[triggerType] ?? 30;
  }
}

async function isActive(triggerType: string): Promise<boolean> {
  try {
    const [setting] = await db.select({ isActive: growthEngineSettingsTable.isActive })
      .from(growthEngineSettingsTable)
      .where(eq(growthEngineSettingsTable.triggerType, triggerType))
      .limit(1);
    return setting?.isActive ?? true;
  } catch {
    return true;
  }
}

// ─── Central fireTrigger ──────────────────────────────────────────────────────

export async function fireTrigger(params: TriggerParams): Promise<boolean> {
  try {
    // 1. Active check
    if (!(await isActive(params.type))) return false;

    // 2. Duplicate suppression
    const suppressDays = await getSuppressDays(params.type);
    if (suppressDays > 0) {
      const since = new Date(Date.now() - suppressDays * 24 * 60 * 60 * 1000);
      const [recent] = await db.select({ id: growthTriggersTable.id })
        .from(growthTriggersTable)
        .where(
          and(
            eq(growthTriggersTable.triggerType, params.type),
            eq(growthTriggersTable.domain, params.domain),
            gte(growthTriggersTable.createdAt, since)
          )
        )
        .limit(1);
      if (recent) return false;
    }

    // 3. Email address
    const emailAddr = params.email ?? await findEmailForDomain(params.domain, params.customerId);
    if (!emailAddr) {
      // Queue for enrichment
      await db.insert(growthTriggersTable).values({
        triggerType: params.type,
        domain: params.domain,
        companyName: params.companyName ?? null,
        customerId: params.customerId ?? null,
        triggerData: params.data,
        status: "pending",
      });
      return false;
    }

    // 4. Generate email via Claude
    const emailContent = await generateTriggerEmail(params, emailAddr);

    // 5. Send
    await sendMail({
      to: emailAddr,
      subject: emailContent.subject,
      html: buildTriggerEmailHtml(emailContent.body, params),
    });

    // 6. Record
    await db.insert(growthTriggersTable).values({
      triggerType: params.type,
      domain: params.domain,
      companyName: params.companyName ?? null,
      customerId: params.customerId ?? null,
      triggerData: params.data,
      emailTo: emailAddr,
      emailSubject: emailContent.subject,
      emailSentAt: new Date(),
      status: "sent",
    });

    // 7. Ensure in lead scan queue if no customer
    if (!params.customerId) {
      const existing = await db.select({ id: leadScanQueueTable.id })
        .from(leadScanQueueTable)
        .where(eq(leadScanQueueTable.domain, params.domain))
        .limit(1);
      if (!existing.length) {
        await db.insert(leadScanQueueTable).values({
          domain: params.domain,
          companyName: params.companyName ?? null,
          source: params.type,
          scanStatus: "pending",
        });
      }
    }

    logger.info({ type: params.type, domain: params.domain, to: emailAddr }, "Growth trigger fired");
    return true;
  } catch (err) {
    logger.error({ err, type: params.type, domain: params.domain }, "fireTrigger failed");
    return false;
  }
}

// ─── Find email for domain ────────────────────────────────────────────────────

async function findEmailForDomain(domain: string, customerId?: number): Promise<string | null> {
  // 1. Check customers table
  if (customerId) {
    const { customersTable } = await import("@workspace/db");
    const [c] = await db.select({ email: customersTable.email }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (c?.email) return c.email;
  }
  // 2. Check domain scan email
  const [scan] = await db.select({ email: domainScansTable.email })
    .from(domainScansTable)
    .where(eq(domainScansTable.domain, domain))
    .orderBy(desc(domainScansTable.id))
    .limit(1);
  if (scan?.email) return scan.email;
  // 3. Check lead scan queue contacts
  const [lead] = await db.select({ contacts: leadScanQueueTable.contacts })
    .from(leadScanQueueTable)
    .where(eq(leadScanQueueTable.domain, domain))
    .limit(1);
  if (lead?.contacts) {
    const contacts = lead.contacts as Array<{ email?: string }>;
    const first = contacts.find(c => c.email);
    if (first?.email) return first.email;
  }
  return null;
}

// ─── Claude Email Generator ───────────────────────────────────────────────────

async function generateTriggerEmail(params: TriggerParams, toEmail: string): Promise<{ subject: string; body: string }> {
  const prompts: Record<string, string> = {
    ssl_expiry: `SSL sertifikası dolmak üzere olan bir firmaya kısa outreach e-postası yaz.
Domain: ${params.domain}
Kalan gün: ${params.data["daysRemaining"]}
Bitiş tarihi: ${params.data["expiryDate"]}

4-5 cümle, Türkçe, patron dili. Teknik jargon yok. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,

    new_cve: `Yeni CVE güvenlik açığından etkilenebilecek bir firmaya kısa outreach e-postası yaz.
Domain: ${params.domain}
CVE: ${params.data["cveId"]} — CVSS: ${params.data["cvss"]}
Etkilenen teknoloji: ${params.data["affectedTech"]}

4-5 cümle, Türkçe, acil ama panik yaratmadan. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,

    sector_breach: `Aynı sektörde bir firma saldırıya uğradı. Bu firmaya FOMO yaratan kısa outreach e-postası yaz.
Domain: ${params.domain}
Sektör: ${params.data["sector"]}
Haber: ${params.data["newsTitle"]}

4-5 cümle, Türkçe, FOMO yarat ama abartma. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,

    kvk_penalty: `KVK Kurulu bu sektörde bir firmaya ceza verdi. Aynı sektördeki firmaya kısa outreach e-postası yaz.
Domain: ${params.domain}
Sektör: ${params.data["sector"]}
Ceza: ${params.data["penaltyTl"]} TL

4-5 cümle, Türkçe, yasal zorunluluk vurgusu. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,

    score_drop: `Bir müşterinin güvenlik skoru düştü. Upsell e-postası yaz.
Domain: ${params.domain}
Önceki skor: ${params.data["oldScore"]}
Yeni skor: ${params.data["newScore"]}
Önerilen plan: ${params.data["suggestedUpgrade"]}

4-5 cümle, Türkçe, endişe yarat ama çözüm sun. Planı yükselt öner.
Format JSON: {"subject":"...","body":"..."}`,

    port_change: `Bir firmada kritik port değişikliği tespit edildi. Kısa outreach e-postası yaz.
Domain: ${params.domain}
Yeni açılan portlar: ${JSON.stringify(params.data["portNames"])}

4-5 cümle, Türkçe, teknik ama anlaşılır. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,

    ekap_tender: `Bir firma kamu ihalesi kazandı. Siber güvenlik yükümlülükleri hakkında kısa outreach e-postası yaz.
Firma: ${params.companyName ?? params.domain}
İhale konusu: ${params.data["tenderSubject"]}
Kamu kurumu: ${params.data["contractingAuthority"]}

4-5 cümle, Türkçe, kamu sözleşmesi vurgusu. CyberStep'i doğal bağla.
Format JSON: {"subject":"...","body":"..."}`,
  };

  const prompt = prompts[params.type] ?? `${params.domain} için siber güvenlik outreach e-postası yaz. 4-5 cümle Türkçe. Format JSON: {"subject":"...","body":"..."}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject && parsed.body) return parsed;
    }
  } catch (err) {
    logger.warn({ err }, "Claude email generation failed, using fallback");
  }

  // Fallback emails
  return getFallbackEmail(params);
}

function getFallbackEmail(params: TriggerParams): { subject: string; body: string } {
  const fallbacks: Record<string, { subject: string; body: string }> = {
    ssl_expiry: {
      subject: `${params.domain} SSL sertifikanız ${params.data["daysRemaining"]} gün içinde sona eriyor`,
      body: `Merhaba,\n\nCyberStep rutin takibimizde ${params.domain} alan adınızın SSL sertifikasının ${params.data["expiryDate"]} tarihinde sona ereceğini tespit ettik.\n\nSertifika sona erdiğinde web siteniz "Güvenli Değil" uyarısı gösterir ve ziyaretçiler sayfanızı terk eder. KVKK Madde 12 teknik tedbir yükümlülüğü açısından da risk taşımaktadır.\n\nÜcretsiz güvenlik taramanızı görüntülemek için: ${getBaseUrl()}/domain-tarama\n\nCyberStep.io`,
    },
    new_cve: {
      subject: `${params.domain} — ${params.data["cveId"]} güvenlik açığı sisteminizi etkileyebilir`,
      body: `Merhaba,\n\nBugün yayınlanan ${params.data["cveId"]} açığı, ${params.domain} adresinizde tespit ettiğimiz ${params.data["affectedTech"]} bileşenini etkiliyor. CVSS skoru: ${params.data["cvss"]}/10.\n\nBu açığın sisteminizi etkileyip etkilemediğini doğrulamak için ücretsiz kontrol sunuyoruz.\n\n${getBaseUrl()}/domain-tarama\n\nCyberStep.io`,
    },
    sector_breach: {
      subject: `${params.data["sector"]} sektöründe siber saldırı — ${params.domain} hazır mı?`,
      body: `Merhaba,\n\n${params.data["newsTitle"]} — ${params.data["sector"]} sektöründe bu saldırı gerçekleşti. Aynı sektördeki firmalar hedef olmaya devam ediyor.\n\n${params.domain} adresinizin mevcut güvenlik durumunu ücretsiz kontrol edin: ${getBaseUrl()}/domain-tarama\n\nCyberStep.io`,
    },
    kvk_penalty: {
      subject: `${params.data["sector"]} sektörüne ${params.data["penaltyTl"]} TL KVKK cezası — Siz hazır mısınız?`,
      body: `Merhaba,\n\nKVK Kurulu bu hafta ${params.data["sector"]} alanında faaliyet gösteren bir firmaya ${params.data["penaltyTl"]} TL idari para cezası verdi.\n\nCyberStep'in ${params.domain} üzerindeki taramasında KVKK teknik tedbir uyumunuzla ilgili eksiklikler tespit edildi. Ücretsiz KVKK Risk Skoru: ${getBaseUrl()}/domain-tarama\n\nCyberStep.io`,
    },
    score_drop: {
      subject: `${params.domain} güvenlik skorunuz ${params.data["diff"] as number > 0 ? params.data["diff"] : ""}  puan geriledi`,
      body: `Merhaba,\n\n${params.domain} alanındaki son tarama sonuçlarına göre güvenlik skorunuz ${params.data["oldScore"]}'dan ${params.data["newScore"]}'a geriledi.\n\nMevcut planınızda bu bulguların otomatik takibi yer almıyor. ${params.data["suggestedUpgrade"]} planı ile bu bulgular otomatik izlenir.\n\n${getBaseUrl()}/fiyatlar\n\nCyberStep.io`,
    },
  };
  return fallbacks[params.type] ?? {
    subject: `${params.domain} — Siber güvenlik önerisi`,
    body: `Merhaba,\n\nCyberStep olarak ${params.domain} için önemli bir güvenlik tespitimiz var. Detaylar için: ${getBaseUrl()}/domain-tarama\n\nCyberStep.io`,
  };
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "http://localhost:80";
}

function buildTriggerEmailHtml(body: string, params: TriggerParams): string {
  const base = getBaseUrl();
  const lines = body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.7">${lines}</p>
      <a href="${base}/domain-tarama" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;margin-top:8px">
        Ücretsiz Güvenlik Taraması
      </a>
    </div>
    <div style="background:#f8fafc;padding:12px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">CyberStep.io · ${params.domain} · Bu e-postayı almak istemiyorsanız yanıtlayın.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── SSL Expiry Checker ───────────────────────────────────────────────────────

export async function checkSSLExpiry(domain: string): Promise<{ expiryDate: string; daysRemaining: number } | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { servername: domain, rejectUnauthorized: false }, () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert?.valid_to) { resolve(null); return; }
        const expiry = new Date(cert.valid_to);
        const days = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        resolve({ expiryDate: expiry.toISOString().split("T")[0]!, daysRemaining: days });
      } catch { resolve(null); }
    });
    socket.on("error", () => resolve(null));
    socket.setTimeout(6000, () => { socket.destroy(); resolve(null); });
  });
}

// ─── SSL Expiry Cron ──────────────────────────────────────────────────────────

export async function runSSLExpiryCron(): Promise<void> {
  logger.info("SSL expiry trigger cron started");
  const scans = await db.selectDistinct({ domain: domainScansTable.domain, email: domainScansTable.email })
    .from(domainScansTable)
    .where(gte(domainScansTable.id, 1))
    .limit(200);

  let fired = 0;
  for (const item of scans) {
    try {
      const ssl = await checkSSLExpiry(item.domain);
      if (!ssl) continue;
      const thresholds = [30, 14, 7];
      for (const threshold of thresholds) {
        if (Math.abs(ssl.daysRemaining - threshold) <= 1) {
          const ok = await fireTrigger({
            type: "ssl_expiry",
            domain: item.domain,
            email: item.email ?? undefined,
            data: { expiryDate: ssl.expiryDate, daysRemaining: ssl.daysRemaining },
          });
          if (ok) fired++;
        }
      }
    } catch { continue; }
  }
  logger.info({ fired }, "SSL expiry cron done");
}

// ─── CVE Alert Cron ──────────────────────────────────────────────────────────

export async function runCVEAlertCron(): Promise<void> {
  logger.info("CVE alert trigger cron started");
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const start = yesterday.toISOString().split(".")[0] + ".000";
    const end = new Date().toISOString().split(".")[0] + ".000";
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${start}&pubEndDate=${end}&resultsPerPage=50`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return;
    const data = await resp.json() as { vulnerabilities?: Array<{ cve: { id: string; metrics?: { cvssMetricV31?: Array<{ cvssData: { baseScore: number } }> }; descriptions: Array<{ lang: string; value: string }>; configurations?: unknown } }> };
    const cves = data.vulnerabilities ?? [];

    const highRisk = cves.filter(v => {
      const score = v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ?? 0;
      return score >= 7.0;
    });

    if (highRisk.length === 0) return;

    // Get domains with their shadow IT / CVE data
    const scans = await db.select({
      domain: domainScansTable.domain,
      email: domainScansTable.email,
      shadowItServices: domainScansTable.shadowItServices,
    }).from(domainScansTable).limit(300);

    let fired = 0;
    for (const cve of highRisk.slice(0, 10)) {
      const desc = cve.cve.descriptions.find(d => d.lang === "en")?.value ?? "";
      const cvss = cve.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ?? 0;

      // Simple keyword match against shadow IT services
      const keywords = extractTechKeywords(desc);
      for (const scan of scans) {
        const services = (scan.shadowItServices as Array<{ name: string }> | null) ?? [];
        const match = services.find(s => keywords.some(k => s.name.toLowerCase().includes(k)));
        if (!match) continue;

        const ok = await fireTrigger({
          type: "new_cve",
          domain: scan.domain,
          email: scan.email ?? undefined,
          data: { cveId: cve.cve.id, cvss, affectedTech: match.name, description: desc.slice(0, 200) },
        });
        if (ok) { fired++; if (fired >= 20) break; }
      }
      if (fired >= 20) break;
    }
    logger.info({ fired }, "CVE alert cron done");
  } catch (err) {
    logger.warn({ err }, "CVE alert cron failed");
  }
}

function extractTechKeywords(text: string): string[] {
  const known = ["apache", "nginx", "wordpress", "php", "mysql", "redis", "openssh", "openssl", "jquery", "node", "python", "docker", "kubernetes", "iis", "tomcat", "spring", "log4j"];
  const lower = text.toLowerCase();
  return known.filter(k => lower.includes(k));
}

// ─── Sector Breach Trigger (called by news aggregator) ───────────────────────

const SECTOR_KEYWORDS: Record<string, string[]> = {
  finans:    ["banka", "fintech", "ödeme", "kredi", "sigorta", "borsa"],
  saglik:    ["hastane", "sağlık", "eczane", "tıbbi", "klinik"],
  perakende: ["e-ticaret", "alışveriş", "perakende", "mağaza", "market"],
  bilisim:   ["yazılım", "teknoloji", "siber", "bulut", "veri merkezi"],
  imalat:    ["fabrika", "üretim", "sanayi", "imalat"],
  lojistik:  ["lojistik", "kargo", "taşımacılık", "nakliye"],
};

export async function processSectorBreachNews(newsTitle: string, newsContent: string): Promise<void> {
  const lowerTitle = (newsTitle + " " + newsContent).toLowerCase();
  let detectedSector: string | null = null;

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(k => lowerTitle.includes(k))) {
      detectedSector = sector;
      break;
    }
  }
  if (!detectedSector) return;
  if (!lowerTitle.includes("saldır") && !lowerTitle.includes("ihlal") && !lowerTitle.includes("siber") && !lowerTitle.includes("hack") && !lowerTitle.includes("breach") && !lowerTitle.includes("veri sızıntı")) return;

  // Find targets in this sector from domain scans
  const scans = await db.select({ domain: domainScansTable.domain, email: domainScansTable.email })
    .from(domainScansTable).limit(50);

  let fired = 0;
  for (const scan of scans) {
    if (fired >= 30) break;
    const ok = await fireTrigger({
      type: "sector_breach",
      domain: scan.domain,
      email: scan.email ?? undefined,
      data: { newsTitle, sector: detectedSector, attackType: "siber saldırı" },
    });
    if (ok) fired++;
  }
  logger.info({ sector: detectedSector, fired }, "Sector breach trigger processed");
}

// ─── Score Drop Trigger (called after health score calc) ─────────────────────

export async function checkScoreDropTrigger(customerId: number, newScore: number, oldScore: number): Promise<void> {
  const diff = oldScore - newScore;
  if (diff < 5) return;

  try {
    const { customersTable } = await import("@workspace/db");
    const [customer] = await db.select({ email: customersTable.email, subscriptionPlan: customersTable.subscriptionPlan })
      .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (!customer?.email) return;

    const domain = customer.email.includes("@") ? customer.email.split("@")[1]! : "";
    if (!domain) return;

    const suggestedUpgrade = (customer.subscriptionPlan === "baslangic") ? "Büyüme" : "Kurumsal";

    await fireTrigger({
      type: "score_drop",
      domain,
      customerId,
      email: customer.email,
      data: { oldScore, newScore, diff, suggestedUpgrade },
    });
  } catch (err) {
    logger.warn({ err, customerId }, "Score drop trigger failed");
  }
}

// ─── Port Change Cron ─────────────────────────────────────────────────────────

const CRITICAL_PORTS: Record<number, string> = {
  3389: "RDP",
  22: "SSH",
  445: "SMB",
  1433: "SQL Server",
  3306: "MySQL",
  5432: "PostgreSQL",
  27017: "MongoDB",
  6379: "Redis",
};

export async function runPortChangeCron(): Promise<void> {
  logger.info("Port change cron started");
  const scans = await db.select({
    id: domainScansTable.id,
    domain: domainScansTable.domain,
    email: domainScansTable.email,
    shodanOpenPorts: domainScansTable.shodanOpenPorts,
  }).from(domainScansTable).limit(200);

  // Group by domain, compare latest two scans
  const byDomain: Record<string, Array<typeof scans[number]>> = {};
  for (const s of scans) {
    if (!byDomain[s.domain]) byDomain[s.domain] = [];
    byDomain[s.domain].push(s);
  }

  let fired = 0;
  for (const [domain, domainScans] of Object.entries(byDomain)) {
    if (domainScans.length < 2) continue;
    const latest = domainScans[0]!;
    const previous = domainScans[1]!;

    const currentPorts = ((latest.shodanOpenPorts as Array<{ port: number }> | null) ?? []).map(p => p.port);
    const previousPorts = ((previous.shodanOpenPorts as Array<{ port: number }> | null) ?? []).map(p => p.port);

    const newPorts = currentPorts.filter(p => !previousPorts.includes(p));
    const criticalNew = newPorts.filter(p => CRITICAL_PORTS[p]);

    if (criticalNew.length === 0) continue;

    const ok = await fireTrigger({
      type: "port_change",
      domain,
      email: latest.email ?? undefined,
      data: {
        newPorts: criticalNew,
        portNames: criticalNew.map(p => CRITICAL_PORTS[p]),
      },
    });
    if (ok) { fired++; if (fired >= 20) break; }
  }
  logger.info({ fired }, "Port change cron done");
}

// ─── Competitor Check ─────────────────────────────────────────────────────────

export async function handleCompetitorCheck(params: {
  ownDomain: string;
  competitorDomain: string;
  email?: string;
  company?: string;
}): Promise<{
  own: { domain: string; overallScore: number; riskLevel: string; criticalCount: number; hibpBreachCount: number; shodanVulnCount: number };
  competitor: { domain: string; overallScore: number; riskLevel: string; criticalCount: number; hibpBreachCount: number; shodanVulnCount: number };
  diff: number;
}> {
  const getScanBrief = async (domain: string) => {
    const [scan] = await db.select({
      overallScore: domainScansTable.overallScore,
      hibpBreachCount: domainScansTable.hibpBreachCount,
      shodanVulnCount: domainScansTable.shodanVulnCount,
    }).from(domainScansTable).where(eq(domainScansTable.domain, domain)).orderBy(desc(domainScansTable.id)).limit(1);

    const score = scan?.overallScore ?? 0;
    const riskLevel = score >= 70 ? "Düşük" : score >= 50 ? "Orta" : score >= 30 ? "Yüksek" : "Kritik";
    return {
      domain,
      overallScore: score,
      riskLevel,
      criticalCount: 0,
      hibpBreachCount: scan?.hibpBreachCount ?? 0,
      shodanVulnCount: scan?.shodanVulnCount ?? 0,
    };
  };

  const [own, competitor] = await Promise.all([
    getScanBrief(params.ownDomain),
    getScanBrief(params.competitorDomain),
  ]);

  // Record check
  await db.insert(competitorChecksTable).values({
    ownDomain: params.ownDomain,
    competitorDomain: params.competitorDomain,
    ownScore: own.overallScore,
    competitorScore: competitor.overallScore,
    ownRiskLevel: own.riskLevel,
    competitorRiskLevel: competitor.riskLevel,
    visitorEmail: params.email ?? null,
    visitorCompany: params.company ?? null,
    leadCreated: !!params.email,
  });

  // If email provided, add to lead queue
  if (params.email) {
    const existing = await db.select({ id: leadScanQueueTable.id }).from(leadScanQueueTable).where(eq(leadScanQueueTable.domain, params.ownDomain)).limit(1);
    if (!existing.length) {
      await db.insert(leadScanQueueTable).values({
        domain: params.ownDomain,
        companyName: params.company ?? null,
        source: "competitor_check",
        scanStatus: "pending",
      });
    }
  }

  return { own, competitor, diff: own.overallScore - competitor.overallScore };
}

// ─── Benchmark Download ───────────────────────────────────────────────────────

export async function handleBenchmarkDownload(params: {
  sector: string;
  visitorName?: string;
  visitorEmail: string;
  visitorCompany?: string;
  visitorDomain?: string;
  reportPeriod?: string;
}): Promise<void> {
  await db.insert(benchmarkDownloadsTable).values({
    sector: params.sector,
    reportPeriod: params.reportPeriod ?? "Q2-2026",
    visitorName: params.visitorName ?? null,
    visitorEmail: params.visitorEmail,
    visitorCompany: params.visitorCompany ?? null,
    visitorDomain: params.visitorDomain ?? null,
    leadCreated: true,
  });

  // Add to lead queue
  if (params.visitorDomain) {
    const existing = await db.select({ id: leadScanQueueTable.id }).from(leadScanQueueTable).where(eq(leadScanQueueTable.domain, params.visitorDomain)).limit(1);
    if (!existing.length) {
      await db.insert(leadScanQueueTable).values({
        domain: params.visitorDomain,
        companyName: params.visitorCompany ?? null,
        source: "benchmark_download",
        scanStatus: "pending",
      });
    }
  }
}

// ─── Stats for Admin Panel ────────────────────────────────────────────────────

export async function getGrowthEngineStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalTriggers] = await db.select({ count: count() }).from(growthTriggersTable).where(gte(growthTriggersTable.createdAt, thirtyDaysAgo));
  const [sentTriggers] = await db.select({ count: count() }).from(growthTriggersTable).where(and(gte(growthTriggersTable.createdAt, thirtyDaysAgo), eq(growthTriggersTable.status, "sent")));
  const [competitorCount] = await db.select({ count: count() }).from(competitorChecksTable).where(gte(competitorChecksTable.createdAt, thirtyDaysAgo));
  const [benchmarkCount] = await db.select({ count: count() }).from(benchmarkDownloadsTable).where(gte(benchmarkDownloadsTable.createdAt, thirtyDaysAgo));

  return {
    triggersThisMonth: totalTriggers?.count ?? 0,
    triggersSent: sentTriggers?.count ?? 0,
    competitorChecks: competitorCount?.count ?? 0,
    benchmarkDownloads: benchmarkCount?.count ?? 0,
  };
}
