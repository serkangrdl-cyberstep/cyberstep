import { Router } from "express";
import dns from "dns/promises";
import https from "https";
import http from "http";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const DKIM_SELECTORS = [
  "default", "google", "mail", "dkim", "selector1", "selector2",
  "protonmail", "zoho", "k1", "smtp", "email", "mandrill",
  "sendgrid", "mailchimp", "mimecast", "pm", "s1", "s2",
];

// ─── DNS helpers ─────────────────────────────────────────────────────────────

async function checkSPF(domain: string): Promise<{ pass: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(domain);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=spf1")) return { pass: true, record: joined };
    }
    return { pass: false, record: null };
  } catch {
    return { pass: false, record: null };
  }
}

async function checkDMARC(domain: string): Promise<{ pass: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    for (const r of records) {
      const joined = r.join("");
      if (joined.startsWith("v=DMARC1")) return { pass: true, record: joined };
    }
    return { pass: false, record: null };
  } catch {
    return { pass: false, record: null };
  }
}

async function checkDKIM(domain: string): Promise<{ pass: boolean; selectors: string[] }> {
  const found: string[] = [];
  await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      try {
        const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        for (const r of records) {
          if (r.join("").includes("v=DKIM1")) {
            found.push(selector);
            break;
          }
        }
      } catch {
        // selector not found — expected
      }
    })
  );
  return { pass: found.length > 0, selectors: found };
}

async function checkMX(domain: string): Promise<{ pass: boolean; records: Array<{ exchange: string; priority: number }> }> {
  try {
    const records = await dns.resolveMx(domain);
    return {
      pass: records.length > 0,
      records: records.map((r) => ({ exchange: r.exchange, priority: r.priority })),
    };
  } catch {
    return { pass: false, records: [] };
  }
}

async function checkSSL(domain: string): Promise<{
  pass: boolean;
  expiryDate: string | null;
  issuer: string | null;
  daysUntilExpiry: number | null;
}> {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: domain, port: 443, method: "HEAD", timeout: 8000, rejectUnauthorized: true },
      (res) => {
        try {
          const cert = (res.socket as any).getPeerCertificate?.();
          if (cert?.valid_to) {
            const expiry = new Date(cert.valid_to);
            const daysUntilExpiry = Math.floor((expiry.getTime() - Date.now()) / 86400000);
            resolve({
              pass: daysUntilExpiry > 14,
              expiryDate: expiry.toISOString(),
              issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
              daysUntilExpiry,
            });
          } else {
            resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null });
          }
        } catch {
          resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null });
        }
      }
    );
    req.on("error", () => resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null }));
    req.on("timeout", () => { req.destroy(); resolve({ pass: false, expiryDate: null, issuer: null, daysUntilExpiry: null }); });
    req.end();
  });
}

function calcScore(spf: boolean, dmarc: boolean, dkim: boolean, mx: boolean, ssl: boolean): number {
  return (spf ? 20 : 0) + (dmarc ? 25 : 0) + (dkim ? 20 : 0) + (mx ? 10 : 0) + (ssl ? 25 : 0);
}

// ─── Shadow IT katalog ───────────────────────────────────────────────────────

interface ShadowItService {
  name: string;
  category: string;
  risk: "Düşük" | "Orta" | "Yüksek";
  description: string;
  version?: string;
}

const SHADOW_IT_CATALOG: Array<{
  name: string;
  category: string;
  pattern: RegExp;
  risk: "Düşük" | "Orta" | "Yüksek";
  desc: string;
  versionExtract?: RegExp;
}> = [
  { name: "Google Analytics / Tag Manager", category: "Analitik", pattern: /google-analytics\.com|googletagmanager\.com|gtag\/js/i, risk: "Düşük", desc: "Web sitesi ziyaretçi analizi. KVKK kapsamında veri işleme sözleşmesi (DPA) gerektirir." },
  { name: "Hotjar", category: "Analitik", pattern: /hotjar\.com/i, risk: "Orta", desc: "Kullanıcı oturum kaydı ve ısı haritaları. Ziyaretçi davranışlarını kaydeder — KVKK uyumu kritik, gizlilik politikasında belirtilmeli." },
  { name: "Microsoft Clarity", category: "Analitik", pattern: /clarity\.ms/i, risk: "Orta", desc: "Microsoft oturum kaydı. Kullanıcı tıklamaları ve kaydırmalarını kaydeder, KVKK bildirimi gerekli." },
  { name: "Mixpanel", category: "Analitik", pattern: /mixpanel\.com/i, risk: "Düşük", desc: "Kullanıcı davranışı analiz platformu. ABD sunucularında veri işler." },
  { name: "Facebook / Meta Pixel", category: "Pazarlama", pattern: /connect\.facebook\.net|fbevents\.js|facebook\.net\/tr/i, risk: "Yüksek", desc: "Facebook reklam izleme pikseli. Ziyaretçi verilerini Meta'ya iletir. KVKK'da açık rıza ve bildirim zorunlu." },
  { name: "Google Ads", category: "Pazarlama", pattern: /googleadservices\.com|googlesyndication\.com|google_conversion/i, risk: "Düşük", desc: "Google reklam dönüşüm takibi." },
  { name: "HubSpot", category: "Pazarlama / CRM", pattern: /hs-scripts\.com|hubspot\.com|hubapi\.com|hs-analytics\.net/i, risk: "Düşük", desc: "CRM ve inbound marketing platformu. Form verileri HubSpot sunucularına gönderilir." },
  { name: "Mailchimp", category: "Pazarlama", pattern: /list-manage\.com|mailchimp\.com|chimpstatic\.com/i, risk: "Düşük", desc: "E-posta pazarlama servisi. Abone listesi ABD'de saklanır." },
  { name: "Intercom", category: "Canlı Destek", pattern: /intercom\.io|intercomcdn\.com|widget\.intercom\.io/i, risk: "Orta", desc: "Müşteri mesajlaşma platformu. Ziyaretçi kimliği ve davranış verilerini toplar." },
  { name: "Zendesk", category: "Canlı Destek", pattern: /zendesk\.com|zdassets\.com|ekr\.zdassets\.com/i, risk: "Düşük", desc: "Müşteri destek yönetimi. Destek talepleri Zendesk bulutunda saklanır." },
  { name: "Tawk.to", category: "Canlı Destek", pattern: /tawk\.to/i, risk: "Orta", desc: "Ücretsiz canlı destek widget'ı. Sohbet verileri üçüncü taraf sunucularda saklanır; ücretsiz planlarda veri gizliliği sınırlı." },
  { name: "Crisp Chat", category: "Canlı Destek", pattern: /crisp\.chat/i, risk: "Düşük", desc: "Canlı destek ve chatbot platformu." },
  { name: "WordPress", category: "CMS", pattern: /wp-content\/|wp-includes\/|wordpress/i, risk: "Yüksek", desc: "WordPress CMS tespit edildi. Güncel tutulmayan WordPress, eklenti ve temalar en yaygın web saldırısı hedefidir. Tüm güncellemelerin yapıldığından emin olun." },
  { name: "Wix", category: "CMS", pattern: /wix\.com|wixstatic\.com/i, risk: "Düşük", desc: "Wix bulut web sitesi oluşturucu. Altyapı Wix tarafından yönetilir." },
  { name: "Shopify", category: "E-ticaret", pattern: /cdn\.shopify\.com|shopifycdn\.com/i, risk: "Düşük", desc: "Shopify e-ticaret platformu. PCI DSS Level 1 uyumlu, güvenli ödeme altyapısı." },
  { name: "WooCommerce", category: "E-ticaret", pattern: /woocommerce/i, risk: "Orta", desc: "WordPress üzerine kurulu e-ticaret eklentisi. Ödeme verilerinin güvenliği kritik — PCI DSS uyumunu ve SSL'i doğrulayın." },
  { name: "Cloudflare", category: "Güvenlik / CDN", pattern: /cloudflare\.com|cloudflareinsights\.com|__cf_bm/i, risk: "Düşük", desc: "CDN ve DDoS koruma servisi. Siteniz Cloudflare arkasında — bu güvenlik açısından olumlu." },
  { name: "Google reCAPTCHA", category: "Güvenlik", pattern: /google\.com\/recaptcha|recaptcha\/api\.js/i, risk: "Düşük", desc: "Bot ve spam koruması." },
  { name: "Stripe", category: "Ödeme", pattern: /js\.stripe\.com|stripe\.com\/v3/i, risk: "Düşük", desc: "Stripe ödeme altyapısı. PCI DSS Level 1 uyumlu." },
  { name: "PayPal", category: "Ödeme", pattern: /paypal\.com\/sdk|paypalobjects\.com/i, risk: "Düşük", desc: "PayPal ödeme entegrasyonu." },
  { name: "iyzico", category: "Ödeme", pattern: /iyzico\.com/i, risk: "Düşük", desc: "Türkiye'nin yaygın ödeme altyapısı. PCI DSS uyumlu." },
  { name: "jQuery", category: "Kütüphane", pattern: /jquery[\.\-]\d+\.\d+|jquery\.min\.js/i, risk: "Orta", desc: "jQuery JavaScript kütüphanesi. Eski sürümler bilinen açıklar içerebilir — sürümü güncel tutun.", versionExtract: /jquery[\.\-](\d+\.\d+(?:\.\d+)?)/i },
  { name: "Google Fonts", category: "Tasarım", pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i, risk: "Düşük", desc: "Google Fonts servisi. Ziyaretçi IP adresleri Google'a iletilir — KVKK kapsamında değerlendirin." },
  { name: "YouTube Embed", category: "Medya", pattern: /youtube\.com\/embed|youtube-nocookie\.com/i, risk: "Düşük", desc: "YouTube video gömme. Ziyaretçi izleme verisi Google'a iletilir." },
  { name: "Typeform", category: "Form", pattern: /typeform\.com/i, risk: "Orta", desc: "Typeform form servisi. Form verileri Typeform sunucularında işlenir — hassas veriler için dikkatli kullanın." },
  { name: "Calendly", category: "Randevu", pattern: /calendly\.com/i, risk: "Düşük", desc: "Online randevu alma aracı. Toplantı verileri Calendly'de saklanır." },
];

async function fetchHomepage(domain: string): Promise<string> {
  return new Promise((resolve) => {
    const makeRequest = (url: string, redirectCount = 0) => {
      if (redirectCount > 5) { resolve(""); return; }
      const isHttps = url.startsWith("https");
      const mod = isHttps ? https : http;
      const req = mod.request(
        url,
        { method: "GET", timeout: 8000, headers: { "User-Agent": "Mozilla/5.0 (compatible; CyberStep.io Scanner)", "Accept": "text/html" } },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
            const loc = res.headers.location;
            const next = loc.startsWith("http") ? loc : `${isHttps ? "https" : "http"}://${domain}${loc}`;
            res.destroy();
            makeRequest(next, redirectCount + 1);
            return;
          }
          let data = "";
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 512 * 1024) { res.destroy(); resolve(data); return; }
            data += chunk.toString();
          });
          res.on("end", () => resolve(data));
        }
      );
      req.on("error", () => resolve(""));
      req.on("timeout", () => { req.destroy(); resolve(""); });
      req.end();
    };
    makeRequest(`https://${domain}`);
  });
}

async function checkShadowIT(domain: string): Promise<{ services: ShadowItService[] }> {
  try {
    const html = await fetchHomepage(domain);
    if (!html) return { services: [] };
    const detected: ShadowItService[] = [];
    for (const svc of SHADOW_IT_CATALOG) {
      if (svc.pattern.test(html)) {
        const entry: ShadowItService = { name: svc.name, category: svc.category, risk: svc.risk, description: svc.desc };
        if (svc.versionExtract) {
          const m = html.match(svc.versionExtract);
          if (m?.[1]) entry.version = m[1];
        }
        detected.push(entry);
      }
    }
    return { services: detected };
  } catch {
    return { services: [] };
  }
}

// ─── HIBP domain breach check ─────────────────────────────────────────────────
async function checkHIBP(domain: string): Promise<{
  breachCount: number;
  breaches: Array<{ name: string; breachDate: string; pwnCount: number; dataClasses: string[] }>;
}> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "haveibeenpwned.com",
        path: `/api/v3/breaches?domain=${encodeURIComponent(domain)}`,
        method: "GET",
        timeout: 8000,
        headers: {
          "User-Agent": "CyberStep.io Security Scanner",
          "Accept": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode === 200) {
              const raw = JSON.parse(data) as Array<{ Name: string; BreachDate: string; PwnCount: number; DataClasses: string[] }>;
              resolve({
                breachCount: raw.length,
                breaches: raw.slice(0, 10).map((b) => ({
                  name: b.Name,
                  breachDate: b.BreachDate,
                  pwnCount: b.PwnCount,
                  dataClasses: (b.DataClasses ?? []).slice(0, 4),
                })),
              });
            } else {
              resolve({ breachCount: 0, breaches: [] });
            }
          } catch {
            resolve({ breachCount: 0, breaches: [] });
          }
        });
      }
    );
    req.on("error", () => resolve({ breachCount: 0, breaches: [] }));
    req.on("timeout", () => { req.destroy(); resolve({ breachCount: 0, breaches: [] }); });
    req.end();
  });
}

// ─── DNSBL blacklist check ────────────────────────────────────────────────────
const DNSBLS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "dnsbl.sorbs.net",
  "b.barracudacentral.org",
  "dnsbl-1.uceprotect.net",
  "dnsbl.abuse.ch",
  "spam.dnsbl.sorbs.net",
];

async function checkBlacklists(domain: string): Promise<{
  blacklisted: boolean;
  blacklistCount: number;
  results: Array<{ list: string; listed: boolean }>;
}> {
  let ip: string | null = null;
  try {
    const addresses = await dns.resolve4(domain);
    ip = addresses[0] ?? null;
  } catch {
    return { blacklisted: false, blacklistCount: 0, results: [] };
  }
  if (!ip) return { blacklisted: false, blacklistCount: 0, results: [] };

  const reversed = ip.split(".").reverse().join(".");
  const results = await Promise.all(
    DNSBLS.map(async (dnsbl) => {
      try {
        await dns.resolve4(`${reversed}.${dnsbl}`);
        return { list: dnsbl, listed: true };
      } catch {
        return { list: dnsbl, listed: false };
      }
    })
  );
  const listedCount = results.filter((r) => r.listed).length;
  return { blacklisted: listedCount > 0, blacklistCount: listedCount, results };
}

function sanitizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  // strip protocol
  d = d.replace(/^https?:\/\//, "");
  // strip path, port, query
  d = d.split("/")[0]!.split("?")[0]!.split("#")[0]!;
  return d;
}

// ─── POST /api/domain-scan ───────────────────────────────────────────────────
router.post("/domain-scan", async (req, res) => {
  const rawDomain: unknown = req.body?.domain;
  const rawEmail: unknown = req.body?.email;

  if (!rawDomain || typeof rawDomain !== "string" || rawDomain.trim().length < 3) {
    res.status(400).json({ error: "Geçersiz alan adı" });
    return;
  }

  const emailStr = typeof rawEmail === "string" && rawEmail.trim().length > 0 ? rawEmail.trim() : null;
  if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    res.status(400).json({ error: "Geçersiz e-posta adresi" });
    return;
  }

  const domain = sanitizeDomain(rawDomain);
  const email = emailStr;

  // basic domain pattern check
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    res.status(400).json({ error: "Geçersiz alan adı formatı" });
    return;
  }

  logger.info({ domain }, "Starting domain scan");

  try {
    const [spf, dmarc, dkim, mx, ssl, hibp, blacklist, shadowIt] = await Promise.all([
      checkSPF(domain),
      checkDMARC(domain),
      checkDKIM(domain),
      checkMX(domain),
      checkSSL(domain),
      checkHIBP(domain),
      checkBlacklists(domain),
      checkShadowIT(domain),
    ]);

    const overallScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);

    const [scan] = await db
      .insert(domainScansTable)
      .values({
        domain,
        email,
        spfPass: spf.pass,
        spfRecord: spf.record,
        dmarcPass: dmarc.pass,
        dmarcRecord: dmarc.record,
        dkimPass: dkim.pass,
        dkimSelectors: dkim.selectors,
        mxPass: mx.pass,
        mxRecords: mx.records,
        sslPass: ssl.pass,
        sslExpiry: ssl.expiryDate,
        sslIssuer: ssl.issuer,
        sslDaysUntilExpiry: ssl.daysUntilExpiry,
        overallScore,
        hibpBreachCount: hibp.breachCount,
        hibpBreaches: hibp.breaches,
        blacklisted: blacklist.blacklisted,
        blacklistCount: blacklist.blacklistCount,
        blacklistResults: blacklist.results,
        shadowItServices: shadowIt.services,
      })
      .returning();

    logger.info({ domain, overallScore, hibpBreaches: hibp.breachCount, blacklisted: blacklist.blacklisted, scanId: scan?.id }, "Domain scan complete");
    res.json(scan);
  } catch (err) {
    logger.error({ err, domain }, "Domain scan failed");
    res.status(500).json({ error: "Tarama sırasında bir hata oluştu" });
  }
});

// ─── GET /api/domain-scan/:id ────────────────────────────────────────────────
router.get("/domain-scan/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Geçersiz ID" });
    return;
  }
  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, id));
  if (!scan) {
    res.status(404).json({ error: "Tarama bulunamadı" });
    return;
  }
  res.json(scan);
});

// ─── GET /api/domain-scan/history/:domain ────────────────────────────────────
router.get("/domain-scan/history/:domain", async (req, res) => {
  const domain = sanitizeDomain(req.params.domain);
  const scans = await db
    .select()
    .from(domainScansTable)
    .where(eq(domainScansTable.domain, domain))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(10);
  res.json(scans);
});

// ─── GET /api/domain-scan/:id/pdf ────────────────────────────────────────────
router.get("/domain-scan/:id/pdf", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, id));
  if (!scan) { res.status(404).json({ error: "Tarama bulunamadı" }); return; }
  try {
    const { generateDomainScanPDF } = await import("../../services/pdf");
    const buf = await generateDomainScanPDF({
      id: scan.id,
      domain: scan.domain,
      overallScore: scan.overallScore,
      spfPass: scan.spfPass, spfRecord: scan.spfRecord,
      dmarcPass: scan.dmarcPass, dmarcRecord: scan.dmarcRecord,
      dkimPass: scan.dkimPass, dkimSelectors: scan.dkimSelectors as string[],
      mxPass: scan.mxPass, mxRecords: scan.mxRecords as Array<{ exchange: string; priority: number }>,
      sslPass: scan.sslPass, sslExpiry: scan.sslExpiry, sslIssuer: scan.sslIssuer, sslDaysUntilExpiry: scan.sslDaysUntilExpiry,
      hibpBreachCount: scan.hibpBreachCount,
      blacklisted: scan.blacklisted, blacklistCount: scan.blacklistCount,
      shadowItServices: (scan.shadowItServices as Array<{ name: string; category: string; risk: string }>) ?? [],
      createdAt: scan.createdAt.toISOString(),
    });
    const safeDomain = scan.domain.replace(/[^a-zA-Z0-9\.\-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Domain_${safeDomain}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    logger.error({ err, scanId: id }, "Domain scan PDF generation failed");
    res.status(500).json({ error: "PDF oluşturulamadı" });
  }
});

export default router;
export { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, sanitizeDomain, checkHIBP, checkBlacklists, checkShadowIT };
