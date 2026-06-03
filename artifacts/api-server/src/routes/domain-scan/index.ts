import { Router } from "express";
import dns from "dns/promises";
import https from "https";
import http from "http";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { domainScansTable, scanLeadsTable, customersTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getCustomerId } from "../../middleware/auth";

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

function calcScore(spf: boolean, dmarc: boolean, dkim: boolean, mx: boolean, ssl: boolean, portDeduction = 0): number {
  const base = (spf ? 20 : 0) + (dmarc ? 25 : 0) + (dkim ? 20 : 0) + (mx ? 10 : 0) + (ssl ? 25 : 0);
  return Math.max(0, base - portDeduction);
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
  // ─── Yapay Zeka / AI ─────────────────────────────────────────────────────
  { name: "ChatGPT / OpenAI Widget", category: "Yapay Zeka / AI", pattern: /openai\.com|chatgpt\.com|cdn\.openai\.com/i, risk: "Orta", desc: "OpenAI / ChatGPT entegrasyonu tespit edildi. Kullanıcı sorguları OpenAI sunucularına iletilebilir — KVKK kapsamında veri işleme sözleşmesi ve açık rıza gerektirir." },
  { name: "Tidio AI", category: "Yapay Zeka / AI", pattern: /tidio\.com|tidio\.co/i, risk: "Orta", desc: "Tidio AI chatbot. Ziyaretçi sohbet verileri Tidio sunucularında saklanır ve AI analizi için kullanılır — gizlilik politikanızda belirtilmeli, KVKK bildirimi zorunlu." },
  { name: "Drift", category: "Yapay Zeka / AI", pattern: /drift\.com|js\.driftt\.com|widget\.drift\.com/i, risk: "Orta", desc: "Drift AI satış chatbotu. Ziyaretçi kimliği ve davranış verisi ABD sunucularına iletilir — KVKK bildirimi zorunlu." },
  { name: "LiveChat", category: "Yapay Zeka / AI", pattern: /livechatinc\.com|cdn\.livechat\.com|livechat\.com\/tracking/i, risk: "Düşük", desc: "LiveChat AI destekli canlı destek sistemi. Sohbet geçmişi ve müşteri verileri bulutta saklanır." },
  { name: "ManyChat", category: "Yapay Zeka / AI", pattern: /manychat\.com/i, risk: "Orta", desc: "ManyChat WhatsApp/Instagram AI otomasyon platformu. Müşteri iletişim verileri ManyChat altyapısında işlenir — KVKK kapsamında belirtilmeli." },
  { name: "Botpress", category: "Yapay Zeka / AI", pattern: /botpress\.com|cdn\.botpress\.cloud/i, risk: "Orta", desc: "Botpress AI chatbot platformu. Konuşma verileri bulut altyapısında işlenir — KVKK uyumu için veri işleme sözleşmesi gerektirir." },
  { name: "Landbot", category: "Yapay Zeka / AI", pattern: /landbot\.io|landbot\.com/i, risk: "Orta", desc: "Landbot AI form ve chatbot platformu. Kullanıcı yanıtları Landbot sunucularında saklanır." },
  // ─── Türkiye'ye özgü SaaS ─────────────────────────────────────────────────
  { name: "WhatsApp Business", category: "İletişim / Yerel", pattern: /wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/send/i, risk: "Düşük", desc: "WhatsApp Business yönlendirme butonu. Müşteri iletişim verileri Meta altyapısından geçer — KVKK kapsamında değerlendirin." },
  { name: "ikas E-ticaret", category: "E-ticaret / Yerel", pattern: /ikas\.com|cdn\.ikas\.com|ikas\.co/i, risk: "Düşük", desc: "ikas Türk e-ticaret altyapısı. Müşteri sipariş ve ödeme verileri ikas sisteminde saklanır, Türkiye'de veri işleme." },
  { name: "ideasoft", category: "E-ticaret / Yerel", pattern: /ideasoft\.com\.tr|ideasoft\.net/i, risk: "Düşük", desc: "ideasoft Türk e-ticaret platformu. Müşteri sipariş ve ödeme verileri ideasoft altyapısında saklanır." },
  { name: "Ticimax", category: "E-ticaret / Yerel", pattern: /ticimax\.com/i, risk: "Düşük", desc: "Ticimax Türk e-ticaret altyapısı. Ödeme ve müşteri verileri Ticimax sisteminde işlenir." },
  { name: "Shopier", category: "Ödeme / Yerel", pattern: /shopier\.com/i, risk: "Düşük", desc: "Shopier Türk ödeme ve e-ticaret platformu. PCI DSS uyumlu, Türkiye'de veri işleme." },
  { name: "Paraşüt", category: "Muhasebe / Yerel", pattern: /parasut\.com/i, risk: "Orta", desc: "Paraşüt bulut muhasebe platformu. Şirketin mali verileri Paraşüt bulutunda saklanır — finansal veri güvenliği kritik, erişim yetkilerini düzenli gözden geçirin." },
  { name: "Popupsmart", category: "Pazarlama / Yerel", pattern: /popupsmart\.com/i, risk: "Düşük", desc: "Popupsmart Türk popup ve lead toplama aracı. Ziyaretçi verileri toplanır — KVKK kapsamında açık rıza ve bildirim zorunlu." },
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

// ─── USOM Zararlı Alan Listesi (Ulusal Siber Olaylar Müdahale Merkezi) ─────────
let _usomDomains: Set<string> = new Set();
let _usomLastFetch = 0;

async function checkKEP(domain: string): Promise<{ configured: boolean; relays: string[]; secure: boolean }> {
  const KEP_PATTERNS = ["kep.tr", "kayitlielektronikposta", "hs01.kep", "hs02.kep", "hs03.kep", "hs04.kep", "ptt.kep"];
  try {
    const txtRecords = await dns.resolveTxt(domain).catch(() => [] as string[][]);
    const allTxt = txtRecords.map((r: string[]) => r.join("").toLowerCase());
    const hasKepInTxt = allTxt.some((r: string) => KEP_PATTERNS.some(p => r.includes(p)));

    const mxRecords = await dns.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]);
    const kepRelaysFound = mxRecords
      .map((r: { exchange: string; priority: number }) => r.exchange.toLowerCase())
      .filter((mx: string) => KEP_PATTERNS.some(p => mx.includes(p)));

    const spfTxt = allTxt.find((r: string) => r.startsWith("v=spf1")) ?? "";
    const spfIncludesKep = KEP_PATTERNS.some(p => spfTxt.includes(p));

    const configured = kepRelaysFound.length > 0 || hasKepInTxt || spfIncludesKep;
    const relays = kepRelaysFound.length > 0 ? kepRelaysFound : [];

    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => [] as string[][]);
    const dmarcRecord = dmarcRecords.map((r: string[]) => r.join("")).find((r: string) => r.startsWith("v=DMARC1"));
    const dmarcPolicy = dmarcRecord?.match(/p=([^;]+)/)?.[1]?.toLowerCase();
    const secure = configured && (dmarcPolicy === "reject" || dmarcPolicy === "quarantine");

    return { configured, relays, secure };
  } catch {
    return { configured: false, relays: [], secure: false };
  }
}

export async function refreshUsomList(): Promise<void> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "www.usom.gov.tr",
        path: "/url-list.txt",
        method: "GET",
        timeout: 15000,
        headers: { "User-Agent": "CyberStep.io Security Scanner/1.0" },
      },
      (res) => {
        let data = "";
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 10 * 1024 * 1024) { res.destroy(); resolve(); return; }
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const domains = new Set<string>();
            for (const line of data.split("\n")) {
              const raw = line.trim();
              if (!raw || raw.startsWith("#")) continue;
              try {
                const url = raw.startsWith("http") ? raw : `http://${raw}`;
                const parsed = new URL(url);
                const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
                if (host && host.includes(".")) domains.add(host);
              } catch {
                const bare = raw.replace(/^https?:\/\//i, "").split("/")[0]!.split(":")[0]!.toLowerCase().replace(/^www\./, "");
                if (bare && bare.includes(".")) domains.add(bare);
              }
            }
            _usomDomains = domains;
            _usomLastFetch = Date.now();
            logger.info({ count: domains.size }, "USOM zararlı alan listesi güncellendi");
          } catch (parseErr) {
            logger.warn({ parseErr }, "USOM listesi ayrıştırılamadı, mevcut liste korunuyor");
          }
          resolve();
        });
      }
    );
    req.on("error", (err) => { logger.warn({ err }, "USOM liste indirme hatası"); resolve(); });
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
}

async function checkUsomList(domain: string): Promise<{ listed: boolean }> {
  if (Date.now() - _usomLastFetch > 23 * 60 * 60 * 1000) {
    refreshUsomList().catch(() => {});
  }
  const bare = domain.toLowerCase().replace(/^www\./, "");
  return { listed: _usomDomains.has(bare) };
}

// ─── Certificate Transparency — crt.sh ───────────────────────────────────────
async function checkCertTransparency(domain: string): Promise<{ subdomains: string[]; count: number }> {
  return new Promise((resolve) => {
    const path = `/?q=%25.${encodeURIComponent(domain)}&output=json`;
    const req = https.request(
      {
        hostname: "crt.sh",
        path,
        method: "GET",
        timeout: 12000,
        headers: { "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" },
      },
      (res) => {
        let data = "";
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 3 * 1024 * 1024) { res.destroy(); resolve({ subdomains: [], count: 0 }); return; }
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const records = JSON.parse(data) as Array<{ name_value: string }>;
            const seen = new Set<string>();
            for (const r of records) {
              for (const name of r.name_value.split("\n")) {
                const clean = name.trim().toLowerCase();
                if (!clean || clean.startsWith("*")) continue;
                if (!clean.endsWith(`.${domain}`) && clean !== domain) continue;
                seen.add(clean);
                if (seen.size >= 60) break;
              }
              if (seen.size >= 60) break;
            }
            resolve({ subdomains: [...seen].slice(0, 30), count: seen.size });
          } catch {
            resolve({ subdomains: [], count: 0 });
          }
        });
      }
    );
    req.on("error", () => resolve({ subdomains: [], count: 0 }));
    req.on("timeout", () => { req.destroy(); resolve({ subdomains: [], count: 0 }); });
    req.end();
  });
}

// ─── NIST NVD CVE Shadow IT Check ────────────────────────────────────────────
const NVD_SERVICE_KEYWORDS: Record<string, string> = {
  "WordPress": "WordPress",
  "Joomla": "Joomla",
  "Drupal": "Drupal",
  "Magento": "Magento",
  "WooCommerce": "WooCommerce",
  "PrestaShop": "PrestaShop",
  "OpenCart": "OpenCart",
  "jQuery": "jQuery library",
};

interface NvdCveEntry { service: string; cveId: string; description: string; cvssScore: number; }

async function checkNvdCve(services: Array<{ name: string; risk: string }>): Promise<NvdCveEntry[]> {
  const targets = services
    .filter(s => NVD_SERVICE_KEYWORDS[s.name] && (s.risk === "Yüksek" || s.risk === "Orta"))
    .slice(0, 2);
  if (targets.length === 0) return [];
  const results: NvdCveEntry[] = [];
  for (const service of targets) {
    const keyword = NVD_SERVICE_KEYWORDS[service.name]!;
    await new Promise<void>((resolve) => {
      const path = `/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=2&cvssV3Severity=CRITICAL`;
      const req = https.request(
        { hostname: "services.nvd.nist.gov", path, method: "GET", timeout: 8000, headers: { "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" } },
        (res) => {
          let data = "";
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 300 * 1024) { res.destroy(); resolve(); return; }
            data += chunk.toString();
          });
          res.on("end", () => {
            try {
              type NvdResp = { vulnerabilities?: Array<{ cve: { id: string; descriptions: Array<{ lang: string; value: string }>; metrics?: { cvssMetricV31?: Array<{ cvssData: { baseScore: number } }> } } }> };
              const json = JSON.parse(data) as NvdResp;
              for (const vuln of (json.vulnerabilities ?? []).slice(0, 2)) {
                const desc = vuln.cve.descriptions.find(d => d.lang === "en")?.value ?? "";
                const score = vuln.cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseScore ?? 9.0;
                results.push({ service: service.name, cveId: vuln.cve.id, description: desc.substring(0, 250), cvssScore: score });
              }
            } catch { /* ignore */ }
            resolve();
          });
        }
      );
      req.on("error", () => resolve());
      req.on("timeout", () => { req.destroy(); resolve(); });
      req.end();
    });
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// ─── Shodan internet exposure check ──────────────────────────────────────────
import { detectCdn, classifyPort, buildPortRiskSummary, type ClassifiedPort, type CdnInfo, type PortRiskSummary } from "../../services/portRiskClassifier";
interface ShodanPort extends ClassifiedPort {}

export async function detectFinalDomain(domain: string): Promise<string | null> {
  return new Promise((resolve) => {
    let lastRedirectHost: string | null = null;
    const makeReq = (url: string, hops = 0) => {
      if (hops > 5) { resolve(lastRedirectHost); return; }
      const isHttps = url.startsWith("https");
      const mod = isHttps ? https : http;
      const req = mod.request(url, { method: "HEAD", timeout: 5000, headers: { "User-Agent": "Mozilla/5.0 (compatible; CyberStep.io Scanner)" } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          const loc = res.headers.location;
          const next = loc.startsWith("http") ? loc : `https://${domain}${loc}`;
          try { lastRedirectHost = new URL(next).hostname; } catch { /**/ }
          res.destroy();
          makeReq(next, hops + 1);
          return;
        }
        resolve(lastRedirectHost);
      });
      req.on("error", () => resolve(lastRedirectHost));
      req.on("timeout", () => { req.destroy(); resolve(lastRedirectHost); });
      req.end();
    };
    makeReq(`https://${domain}`);
  });
}

export async function checkShodan(domain: string): Promise<{
  openPorts: ShodanPort[];
  vulnCount: number;
  country: string | null;
  isp: string | null;
  cdn: CdnInfo;
  portRiskSummary: PortRiskSummary;
} | null> {
  const apiKey = process.env["SHODAN_API_KEY"];
  if (!apiKey) return null;
  const empty = (isp: string | null = null): { openPorts: ShodanPort[]; vulnCount: number; country: string | null; isp: string | null; cdn: CdnInfo; portRiskSummary: PortRiskSummary } => ({
    openPorts: [], vulnCount: 0, country: null, isp,
    cdn: detectCdn(isp),
    portRiskSummary: buildPortRiskSummary([]),
  });
  try {
    const ips = await dns.resolve4(domain);
    if (!ips || ips.length === 0) return empty();
    const ip = ips[0]!;
    return new Promise((resolve) => {
      const req = https.request(
        { hostname: "api.shodan.io", path: `/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(apiKey)}`, method: "GET", timeout: 10000, headers: { "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" } },
        (res) => {
          let data = ""; let size = 0;
          res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 500 * 1024) { res.destroy(); resolve(null); return; } data += chunk.toString(); });
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) { resolve(empty()); return; }
              type ShodanHost = { data?: Array<{ port: number; transport?: string; product?: string; version?: string; _shodan?: { module: string } }>; vulns?: Record<string, unknown>; country_code?: string; org?: string; };
              const json = JSON.parse(data) as ShodanHost;
              const isp = json.org ?? null;
              const cdn = detectCdn(isp);
              const openPorts = (json.data ?? []).slice(0, 20).map((d) =>
                classifyPort(
                  { port: d.port, protocol: d.transport ?? "tcp", service: d._shodan?.module ?? "", product: d.product ?? "", version: d.version ?? "" },
                  cdn,
                )
              ).sort((a, b) => {
                const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
                return (order[b.riskLevel] ?? 0) - (order[a.riskLevel] ?? 0);
              });
              const portRiskSummary = buildPortRiskSummary(openPorts);
              resolve({ openPorts, vulnCount: Object.keys(json.vulns ?? {}).length, country: json.country_code ?? null, isp, cdn, portRiskSummary });
            } catch { resolve(empty()); }
          });
        }
      );
      req.on("error", () => resolve(empty()));
      req.on("timeout", () => { req.destroy(); resolve(empty()); });
      req.end();
    });
  } catch { return empty(); }
}

// ─── VirusTotal domain reputation check ──────────────────────────────────────
async function checkVirusTotal(domain: string): Promise<{
  malicious: number;
  suspicious: number;
  reputation: number;
} | null> {
  const apiKey = process.env["VIRUSTOTAL_API_KEY"];
  if (!apiKey) return null;
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: "www.virustotal.com", path: `/api/v3/domains/${encodeURIComponent(domain)}`, method: "GET", timeout: 10000, headers: { "x-apikey": apiKey, "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" } },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 200 * 1024) { res.destroy(); resolve(null); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) { resolve({ malicious: 0, suspicious: 0, reputation: 0 }); return; }
            type VTResponse = { data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number }; reputation?: number } } };
            const json = JSON.parse(data) as VTResponse;
            const stats = json.data?.attributes?.last_analysis_stats ?? {};
            resolve({ malicious: stats.malicious ?? 0, suspicious: stats.suspicious ?? 0, reputation: json.data?.attributes?.reputation ?? 0 });
          } catch { resolve({ malicious: 0, suspicious: 0, reputation: 0 }); }
        });
      }
    );
    req.on("error", () => resolve({ malicious: 0, suspicious: 0, reputation: 0 }));
    req.on("timeout", () => { req.destroy(); resolve({ malicious: 0, suspicious: 0, reputation: 0 }); });
    req.end();
  });
}

// ─── AbuseIPDB IP abuse history check ────────────────────────────────────────
async function checkAbuseIPDB(domain: string): Promise<{
  score: number;
  totalReports: number;
  countryCode: string | null;
  isp: string | null;
} | null> {
  const apiKey = process.env["ABUSEIPDB_API_KEY"];
  if (!apiKey) return null;
  try {
    const ips = await dns.resolve4(domain);
    if (!ips || ips.length === 0) return { score: 0, totalReports: 0, countryCode: null, isp: null };
    const ip = ips[0]!;
    return new Promise((resolve) => {
      const req = https.request(
        { hostname: "api.abuseipdb.com", path: `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, method: "GET", timeout: 8000, headers: { "Key": apiKey, "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" } },
        (res) => {
          let data = ""; let size = 0;
          res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 100 * 1024) { res.destroy(); resolve(null); return; } data += chunk.toString(); });
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) { resolve({ score: 0, totalReports: 0, countryCode: null, isp: null }); return; }
              type AbuseIPDBResp = { data?: { abuseConfidenceScore?: number; totalReports?: number; countryCode?: string; isp?: string } };
              const json = JSON.parse(data) as AbuseIPDBResp;
              resolve({ score: json.data?.abuseConfidenceScore ?? 0, totalReports: json.data?.totalReports ?? 0, countryCode: json.data?.countryCode ?? null, isp: json.data?.isp ?? null });
            } catch { resolve({ score: 0, totalReports: 0, countryCode: null, isp: null }); }
          });
        }
      );
      req.on("error", () => resolve({ score: 0, totalReports: 0, countryCode: null, isp: null }));
      req.on("timeout", () => { req.destroy(); resolve({ score: 0, totalReports: 0, countryCode: null, isp: null }); });
      req.end();
    });
  } catch { return { score: 0, totalReports: 0, countryCode: null, isp: null }; }
}

function sanitizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  // strip protocol
  d = d.replace(/^https?:\/\//, "");
  // strip path, port, query
  d = d.split("/")[0]!.split("?")[0]!.split("#")[0]!;
  return d;
}

// ─── HTTP Security Headers check ─────────────────────────────────────────────
async function checkHTTPHeaders(domain: string): Promise<{
  score: number;
  hsts: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
  csp: boolean;
  referrerPolicy: boolean;
}> {
  const empty = { score: 0, hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false, referrerPolicy: false };
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: domain, port: 443, method: "HEAD", timeout: 6000, rejectUnauthorized: false },
      (res) => {
        const h = res.headers;
        const hsts = !!h["strict-transport-security"];
        const xfo  = !!(h["x-frame-options"]);
        const xcto = !!(h["x-content-type-options"]);
        const csp  = !!(h["content-security-policy"]);
        const rp   = !!(h["referrer-policy"]);
        resolve({ score: [hsts, xfo, xcto, csp, rp].filter(Boolean).length, hsts, xFrameOptions: xfo, xContentTypeOptions: xcto, csp, referrerPolicy: rp });
      }
    );
    req.on("error", () => resolve(empty));
    req.on("timeout", () => { req.destroy(); resolve(empty); });
    req.end();
  });
}

// ─── URLhaus malware DB check (abuse.ch) — no API key required ───────────────
async function checkURLhaus(domain: string): Promise<{ listed: boolean; threat: string | null }> {
  return new Promise((resolve) => {
    const body = `url=https%3A%2F%2F${encodeURIComponent(domain)}`;
    const reqOpts = {
      hostname: "urlhaus-api.abuse.ch",
      path: "/v1/lookup/",
      method: "POST",
      timeout: 8000,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    };
    const r = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data) as { query_status?: string; threat?: string };
          resolve({ listed: parsed.query_status === "is_host", threat: parsed.threat ?? null });
        } catch {
          resolve({ listed: false, threat: null });
        }
      });
    });
    r.on("error", () => resolve({ listed: false, threat: null }));
    r.on("timeout", () => { r.destroy(); resolve({ listed: false, threat: null }); });
    r.write(body);
    r.end();
  });
}

// ─── Google Safe Browsing API ────────────────────────────────────────────────
async function checkGoogleSafeBrowsing(domain: string): Promise<{ flagged: boolean; threats: string[] } | null> {
  const apiKey = process.env["GOOGLE_SAFE_BROWSING_API_KEY"];
  if (!apiKey) return null;
  return new Promise((resolve) => {
    const body = JSON.stringify({
      client: { clientId: "cyberstep", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: `https://${domain}/` }, { url: `http://${domain}/` }],
      },
    });
    const reqOpts = {
      hostname: "safebrowsing.googleapis.com",
      path: `/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      method: "POST",
      timeout: 8000,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const r = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data) as { matches?: Array<{ threatType: string }> };
          const threats = (parsed.matches ?? []).map((m) => m.threatType);
          resolve({ flagged: threats.length > 0, threats });
        } catch {
          resolve({ flagged: false, threats: [] });
        }
      });
    });
    r.on("error", () => resolve({ flagged: false, threats: [] }));
    r.on("timeout", () => { r.destroy(); resolve({ flagged: false, threats: [] }); });
    r.write(body);
    r.end();
  });
}

// ─── AlienVault OTX — threat intelligence (env-var gated, free API key) ──────
interface OtxData {
  pulseCount: number;
  reputation: number;
  maliciousCount: number;
}

async function checkOTX(domain: string): Promise<OtxData | null> {
  const apiKey = process.env["OTX_API_KEY"];
  if (!apiKey) return null;
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "otx.alienvault.com",
        path: `/api/v1/indicators/domain/${encodeURIComponent(domain)}/general`,
        method: "GET",
        timeout: 10000,
        headers: { "X-OTX-API-KEY": apiKey, "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" },
      },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 300 * 1024) { res.destroy(); resolve(null); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) { resolve(null); return; }
            type OtxResp = { pulse_info?: { count?: number; pulses?: Array<{ targeted_countries?: string[] }> }; reputation?: number };
            const json = JSON.parse(data) as OtxResp;
            const pulseCount = json.pulse_info?.count ?? 0;
            const pulses = json.pulse_info?.pulses ?? [];
            const maliciousCount = pulses.filter(p => (p.targeted_countries ?? []).includes("TR")).length;
            resolve({ pulseCount, reputation: json.reputation ?? 0, maliciousCount });
          } catch { resolve(null); }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── CISA KEV — Known Exploited Vulnerabilities (free, no API key) ─────────────
interface CisaKevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
}

let _cisaKevCache: CisaKevEntry[] = [];
let _cisaKevLastFetch = 0;

async function refreshCisaKev(): Promise<void> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "www.cisa.gov",
        path: "/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        method: "GET",
        timeout: 20000,
        headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", "Accept": "application/json" },
      },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 20 * 1024 * 1024) { res.destroy(); resolve(); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as { vulnerabilities?: CisaKevEntry[] };
            _cisaKevCache = json.vulnerabilities ?? [];
            _cisaKevLastFetch = Date.now();
            logger.info({ count: _cisaKevCache.length }, "CISA KEV katalogu güncellendi");
          } catch { /* ignore */ }
          resolve();
        });
      }
    );
    req.on("error", () => { logger.warn("CISA KEV indirilemedi"); resolve(); });
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
}

const CISA_KEV_SERVICE_KEYWORDS: Record<string, string[]> = {
  "WordPress":    ["wordpress"],
  "WooCommerce":  ["wordpress", "woocommerce"],
  "jQuery":       ["jquery"],
  "Apache":       ["apache"],
  "Nginx":        ["nginx"],
  "PHP":          ["php"],
  "Drupal":       ["drupal"],
  "Joomla":       ["joomla"],
  "Magento":      ["magento"],
  "PrestaShop":   ["prestashop"],
  "OpenCart":     ["opencart"],
};

async function checkCisaKev(services: Array<{ name: string }>): Promise<CisaKevEntry[]> {
  if (Date.now() - _cisaKevLastFetch > 24 * 60 * 60 * 1000) {
    refreshCisaKev().catch(() => {});
  }
  if (_cisaKevCache.length === 0) return [];
  const seen = new Map<string, CisaKevEntry>();
  for (const svc of services) {
    const keywords = CISA_KEV_SERVICE_KEYWORDS[svc.name];
    if (!keywords) continue;
    for (const entry of _cisaKevCache) {
      const text = `${entry.vendorProject} ${entry.product} ${entry.vulnerabilityName}`.toLowerCase();
      if (keywords.some(kw => text.includes(kw)) && !seen.has(entry.cveID)) {
        seen.set(entry.cveID, entry);
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 5);
}

// Warm up CISA KEV cache at startup
refreshCisaKev().catch(() => {});

// ─── Feodo Tracker (Abuse.ch) — aktif botnet C2 IP listesi ──────────────────
interface FeodoEntry { ip_address: string }

let _feodoCache: Set<string> = new Set();
let _feodoLastFetch = 0;

async function refreshFeodoCache(): Promise<void> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "feodotracker.abuse.ch",
        path: "/downloads/ipblocklist.json",
        method: "GET",
        timeout: 15000,
        headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", "Accept": "application/json" },
      },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 5 * 1024 * 1024) { res.destroy(); resolve(); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            const arr = JSON.parse(data) as FeodoEntry[];
            _feodoCache = new Set(arr.map(e => e.ip_address));
            _feodoLastFetch = Date.now();
            logger.info({ count: _feodoCache.size }, "Feodo Tracker önbelleği güncellendi");
          } catch { /* ignore */ }
          resolve();
        });
      }
    );
    req.on("error", () => resolve());
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
}

async function checkFeodoTracker(domain: string): Promise<{ isC2: boolean; matchedIps: string[] }> {
  if (Date.now() - _feodoLastFetch > 6 * 60 * 60 * 1000) refreshFeodoCache().catch(() => {});
  if (_feodoCache.size === 0) return { isC2: false, matchedIps: [] };
  try {
    const dns = await import("dns/promises");
    const ips = await dns.resolve4(domain).catch(() => [] as string[]);
    const matched = ips.filter(ip => _feodoCache.has(ip));
    return { isC2: matched.length > 0, matchedIps: matched };
  } catch { return { isC2: false, matchedIps: [] }; }
}

// Warm up Feodo cache at startup
refreshFeodoCache().catch(() => {});

// ─── ThreatFox (Abuse.ch) — IOC veritabanı (ücretsiz) ──────────────────────
interface ThreatFoxResult { iocCount: number; threatType: string | null; malwareName: string | null }

async function checkThreatFox(domain: string): Promise<ThreatFoxResult> {
  const defaultResult: ThreatFoxResult = { iocCount: 0, threatType: null, malwareName: null };
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: "search_ioc", search_term: domain });
    const req = https.request(
      {
        hostname: "threatfox-api.abuse.ch",
        path: "/api/v1/",
        method: "POST",
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "CyberStep.io Security Scanner/1.0",
          "Auth-Key": "anonymous",
        },
      },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 500 * 1024) { res.destroy(); resolve(defaultResult); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            type TFResp = { query_status?: string; data?: Array<{ threat_type?: string; malware_printable?: string }> };
            const json = JSON.parse(data) as TFResp;
            if (json.query_status === "ok" && json.data && json.data.length > 0) {
              resolve({ iocCount: json.data.length, threatType: json.data[0]?.threat_type ?? null, malwareName: json.data[0]?.malware_printable ?? null });
            } else { resolve(defaultResult); }
          } catch { resolve(defaultResult); }
        });
      }
    );
    req.on("error", () => resolve(defaultResult));
    req.on("timeout", () => { req.destroy(); resolve(defaultResult); });
    req.write(body);
    req.end();
  });
}

// ─── Mozilla Observatory — HTTP başlık güvenlik notu (ücretsiz) ─────────────
interface MozillaObsResult { grade: string | null; score: number | null; testsFailed: number; testsPassed: number }

async function checkMozillaObservatory(domain: string): Promise<MozillaObsResult> {
  const defaultResult: MozillaObsResult = { grade: null, score: null, testsFailed: 0, testsPassed: 0 };
  return new Promise((resolve) => {
    const postBody = "";
    const req = https.request(
      {
        hostname: "http-observatory.security.mozilla.org",
        path: `/api/v1/analyze?host=${encodeURIComponent(domain)}&rescan=false&zero=false`,
        method: "POST",
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": 0,
          "User-Agent": "CyberStep.io Security Scanner/1.0",
          "Accept": "application/json",
        },
      },
      (res) => {
        let data = ""; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 100 * 1024) { res.destroy(); resolve(defaultResult); return; } data += chunk.toString(); });
        res.on("end", () => {
          try {
            type ObsResp = { grade?: string; score?: number; tests_failed?: number; tests_passed?: number; state?: string; error?: string };
            const json = JSON.parse(data) as ObsResp;
            if (json.error) { resolve(defaultResult); return; }
            if ((json.state === "FINISHED" || json.grade) && json.grade) {
              resolve({ grade: json.grade, score: json.score ?? null, testsFailed: json.tests_failed ?? 0, testsPassed: json.tests_passed ?? 0 });
            } else { resolve(defaultResult); }
          } catch { resolve(defaultResult); }
        });
      }
    );
    req.on("error", () => resolve(defaultResult));
    req.on("timeout", () => { req.destroy(); resolve(defaultResult); });
    req.write(postBody);
    req.end();
  });
}

// ─── EPSS (FIRST.org) — CVE istismar olasılığı zenginleştirme ───────────────
interface NvdCveEntryWithEpss extends NvdCveEntry { epssScore: number | null; epssPercentile: number | null }

async function enrichWithEpss(cves: NvdCveEntry[]): Promise<NvdCveEntryWithEpss[]> {
  if (cves.length === 0) return [];
  return new Promise((resolve) => {
    const ids = cves.map(c => c.cveId).join(",");
    const req = https.request(
      {
        hostname: "api.first.org",
        path: `/data/v1/epss?cve=${encodeURIComponent(ids)}`,
        method: "GET",
        timeout: 8000,
        headers: { "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            type EpssEntry = { cve: string; epss: string; percentile: string };
            const json = JSON.parse(data) as { data?: EpssEntry[] };
            const map = new Map<string, { epss: number; pct: number }>();
            for (const e of (json.data ?? [])) map.set(e.cve, { epss: parseFloat(e.epss), pct: parseFloat(e.percentile) });
            resolve(cves.map(c => ({ ...c, epssScore: map.get(c.cveId)?.epss ?? null, epssPercentile: map.get(c.cveId)?.pct ?? null })));
          } catch { resolve(cves.map(c => ({ ...c, epssScore: null, epssPercentile: null }))); }
        });
      }
    );
    req.on("error", () => resolve(cves.map(c => ({ ...c, epssScore: null, epssPercentile: null }))));
    req.on("timeout", () => { req.destroy(); resolve(cves.map(c => ({ ...c, epssScore: null, epssPercentile: null }))); });
    req.end();
  });
}

// ─── SSLLabs grade (fromCache — fast, non-blocking) ──────────────────────────
async function checkSSLLabs(domain: string): Promise<{ grade: string | null }> {
  return new Promise((resolve) => {
    const path = `/api/v3/analyze?host=${encodeURIComponent(domain)}&publish=off&fromCache=on&maxAge=24&all=done`;
    const r = https.request(
      { hostname: "api.ssllabs.com", path, method: "GET", timeout: 12000,
        headers: { "User-Agent": "CyberStep.io Security Scanner/1.0", "Accept": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as { status?: string; endpoints?: Array<{ grade?: string }> };
            if (parsed.status === "READY" && parsed.endpoints?.length) {
              const gradeOrder = ["A+", "A", "A-", "B", "C", "D", "E", "F", "T", "M"];
              const grades = parsed.endpoints.map((e) => e.grade).filter(Boolean) as string[];
              let worst: string | null = null;
              for (let i = gradeOrder.length - 1; i >= 0; i--) {
                if (grades.includes(gradeOrder[i])) { worst = gradeOrder[i]; break; }
              }
              resolve({ grade: worst ?? grades[0] ?? null });
            } else {
              resolve({ grade: null });
            }
          } catch {
            resolve({ grade: null });
          }
        });
      }
    );
    r.on("error", () => resolve({ grade: null }));
    r.on("timeout", () => { r.destroy(); resolve({ grade: null }); });
    r.end();
  });
}

// ─── POST /api/domain-scan ───────────────────────────────────────────────────
router.post("/domain-scan", async (req, res) => {
  const rawDomain: unknown = req.body?.domain;
  const rawEmail: unknown = req.body?.email;

  if (!rawDomain || typeof rawDomain !== "string" || rawDomain.trim().length < 3) {
    res.status(400).json({ error: "Geçersiz alan adı" });
    return;
  }

  if (!rawEmail || typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
    res.status(400).json({ error: "E-posta adresi zorunludur" });
    return;
  }
  const emailStr = rawEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
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

  // ─── Domain scan limit check (for logged-in customers) ───────────────────
  const customerId = getCustomerId(req);
  if (customerId) {
    const [customer] = await db.select({
      domainScanLimit: customersTable.domainScanLimit,
      email: customersTable.email,
    }).from(customersTable).where(eq(customersTable.id, customerId));

    if (customer?.domainScanLimit !== null && customer?.domainScanLimit !== undefined) {
      const [scanCountRow] = await db.select({ cnt: count() })
        .from(domainScansTable)
        .where(eq(domainScansTable.email, customer.email));
      const usedCount = scanCountRow?.cnt ?? 0;
      if (usedCount >= customer.domainScanLimit) {
        res.status(429).json({
          error: `Domain tarama limitinize ulaştınız (${usedCount}/${customer.domainScanLimit}). Daha fazla domain eklemek için plan yükseltin.`,
          code: "DOMAIN_SCAN_LIMIT_REACHED",
          used: usedCount,
          limit: customer.domainScanLimit,
        });
        return;
      }
    }
  }

  logger.info({ domain }, "Starting domain scan");

  const rawRef = req.body?.referralSource;
  const referralSource = typeof rawRef === "string" && rawRef.trim() ? rawRef.trim() : null;

  try {
    const [spf, dmarc, dkim, mx, ssl, hibp, blacklist, shadowIt, httpHeaders, urlhaus, usom, certTrans, shodan, virusTotal, abuseIpdb, safeBrowsing, sslLabs, kep] = await Promise.all([
      checkSPF(domain),
      checkDMARC(domain),
      checkDKIM(domain),
      checkMX(domain),
      checkSSL(domain),
      checkHIBP(domain),
      checkBlacklists(domain),
      checkShadowIT(domain),
      checkHTTPHeaders(domain),
      checkURLhaus(domain),
      checkUsomList(domain),
      checkCertTransparency(domain),
      checkShodan(domain),
      checkVirusTotal(domain),
      checkAbuseIPDB(domain),
      checkGoogleSafeBrowsing(domain),
      checkSSLLabs(domain),
      checkKEP(domain),
    ]);

    const overallScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass, shodan?.portRiskSummary?.scoreDeduction ?? 0);
    const { detectWAF } = await import("../../services/wafDetector");
    const { checkDirectIPAccess } = await import("../../services/wafBypassChecker");
    const { adjustCvesForWAF } = await import("../../services/riskAdjuster");

    const [cveSummaryRaw, cisaKevMatches, otxData, threatFoxData, feodoData, mozillaObs, wafResult] = await Promise.all([
      checkNvdCve(shadowIt.services),
      checkCisaKev(shadowIt.services),
      checkOTX(domain),
      checkThreatFox(domain),
      checkFeodoTracker(domain),
      checkMozillaObservatory(domain),
      detectWAF(domain).catch(() => ({ detected: false, provider: null, confidence: 0, headersAddedByWAF: [] as string[] })),
    ]);

    // WAF tespit edildiyse bypass kontrolü yap
    const bypassResult = wafResult.detected
      ? await checkDirectIPAccess(domain).catch(() => ({ originIp: null, bypassPossible: false }))
      : { originIp: null, bypassPossible: false };

    // CVE risklerini WAF bağlamında ayarla
    const cveSummary = adjustCvesForWAF({
      cveSummary: cveSummaryRaw,
      wafDetected: wafResult.detected,
      wafProvider: wafResult.provider,
      bypassPossible: bypassResult.bypassPossible,
      headersAddedByWAF: wafResult.headersAddedByWAF,
    });

    const cveSummaryWithEpss = cveSummary.length > 0 ? await enrichWithEpss(cveSummary) : [];

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
        httpHeadersScore: httpHeaders.score,
        httpHeadersDetails: { hsts: httpHeaders.hsts, xFrameOptions: httpHeaders.xFrameOptions, xContentTypeOptions: httpHeaders.xContentTypeOptions, csp: httpHeaders.csp, referrerPolicy: httpHeaders.referrerPolicy },
        urlhausListed: urlhaus.listed,
        urlhausThreat: urlhaus.threat,
        usomListed: usom.listed,
        ctSubdomains: certTrans.subdomains,
        ctSubdomainCount: certTrans.count,
        cveSummary,
        shodanOpenPorts: shodan?.openPorts ?? null,
        shodanVulnCount: shodan?.vulnCount ?? 0,
        shodanCountry: shodan?.country ?? null,
        shodanIsp: shodan?.isp ?? null,
        virusTotalReputation: virusTotal?.reputation ?? null,
        virusTotalMalicious: virusTotal?.malicious ?? 0,
        virusTotalSuspicious: virusTotal?.suspicious ?? 0,
        abuseIpdbScore: abuseIpdb?.score ?? null,
        abuseIpdbTotalReports: abuseIpdb?.totalReports ?? 0,
        abuseIpdbCountry: abuseIpdb?.countryCode ?? null,
        abuseIpdbIsp: abuseIpdb?.isp ?? null,
        safeBrowsingFlagged: safeBrowsing !== null ? safeBrowsing.flagged : null,
        safeBrowsingThreats: safeBrowsing?.threats ?? [],
        sslLabsGrade: sslLabs.grade,
        badgeToken: randomUUID(),
        referralSource,
        kepConfigured: kep.configured,
        kepRelays: kep.relays,
        kepSecure: kep.secure,
        wafDetected: wafResult.detected,
        wafProvider: wafResult.provider,
        wafBypassPossible: bypassResult.bypassPossible,
        originIp: bypassResult.originIp,
        wafHeadersAdded: wafResult.headersAddedByWAF,
        wafConfidence: wafResult.confidence,
      })
      .returning();

    logger.info({ domain, overallScore, hibpBreaches: hibp.breachCount, blacklisted: blacklist.blacklisted, cisaKevCount: cisaKevMatches.length, otxConfigured: otxData !== null, threatFoxIocs: threatFoxData.iocCount, feodoC2: feodoData.isC2, mozillaGrade: mozillaObs.grade, epssEnriched: cveSummaryWithEpss.length, scanId: scan?.id }, "Domain scan complete");

    // Fire-and-forget: auto-trigger attack scenario analysis
    if (scan) {
      const { triggerAttackScenariosBackground } = await import("./attack-scenarios");
      triggerAttackScenariosBackground(scan.id, scan).catch((err: unknown) =>
        logger.warn({ err, scanId: scan.id }, "Auto attack scenario trigger failed")
      );

      // Fire-and-forget: scan completion email
      if (email) {
        setImmediate(async () => {
          try {
            const { sendMail } = await import("../../services/email");
            const baseUrl = process.env["REPLIT_DOMAINS"]
              ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
              : "http://localhost:80";
            const grade = overallScore >= 90 ? "A" : overallScore >= 70 ? "B" : overallScore >= 50 ? "C" : overallScore >= 30 ? "D" : "F";
            const gradeColor = overallScore >= 70 ? "#16a34a" : overallScore >= 50 ? "#d97706" : "#dc2626";
            const resultUrl = `${baseUrl}/domain-tarama?domain=${encodeURIComponent(domain)}&scanId=${scan.id}`;
            const rawPorts = (scan.shodanOpenPorts as Array<{ riskLevel?: string }> | null) ?? [];
            const criticalPorts = rawPorts.filter(p => p.riskLevel === "critical" || p.riskLevel === "high");
            const cdnPorts = rawPorts.filter(p => p.riskLevel === "none");
            const portNote = rawPorts.length > 0
              ? criticalPorts.length > 0
                ? `<li style="color:#dc2626;"><strong>${criticalPorts.length} yüksek riskli port</strong> tespit edildi — acil inceleme gerekiyor</li>`
                : cdnPorts.length === rawPorts.length
                  ? `<li style="color:#16a34a;">${rawPorts.length} port CDN/proxy altyapısına ait — güvenlik riski yok</li>`
                  : `<li style="color:#d97706;"><strong>${rawPorts.length} açık port</strong> tespit edildi — ${cdnPorts.length > 0 ? `${cdnPorts.length}'i CDN beklentisi, kalanı doğrulama önerilir` : "detaylar raporda"}</li>`
              : "";
            const blacklistNote = scan.blacklisted
              ? `<li style="color:#dc2626;"><strong>Kara liste uyarısı</strong> — ${scan.blacklistCount} listede kayıtlı</li>`
              : "";
            await sendMail({
              to: email,
              subject: `CyberStep: ${domain} güvenlik taraması tamamlandı — Skor ${overallScore}/100`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:8px;">
                  <h2 style="color:#60a5fa;margin-top:0;">Alan Adı Güvenlik Taraması Tamamlandı</h2>
                  <p style="color:#94a3b8;margin-bottom:20px;"><strong style="color:#e2e8f0;">${domain}</strong> için güvenlik taraması tamamlandı.</p>
                  <div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center;">
                    <div style="display:inline-block;background:${gradeColor};color:#fff;font-size:36px;font-weight:900;width:64px;height:64px;line-height:64px;border-radius:12px;">${grade}</div>
                    <p style="font-size:28px;font-weight:900;color:#fff;margin:12px 0 4px;">${overallScore}<span style="font-size:14px;font-weight:400;color:#94a3b8;">/100</span></p>
                    <p style="color:#94a3b8;font-size:13px;margin:0;">Genel Güvenlik Skoru</p>
                  </div>
                  ${portNote || blacklistNote ? `<ul style="background:#1e293b;border-radius:8px;padding:16px 16px 16px 32px;margin-bottom:20px;">${portNote}${blacklistNote}</ul>` : ""}
                  <a href="${resultUrl}" style="display:block;text-align:center;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:20px;">
                    Tam Raporu Gör
                  </a>
                  <p style="font-size:12px;color:#475569;text-align:center;">CyberStep.io · Türkiye'nin KOBİ Siber Güvenlik Platformu</p>
                </div>
              `,
            });
            await db.execute(sql`UPDATE domain_scans SET notified_at = NOW() WHERE id = ${scan.id}`);
            logger.info({ scanId: scan.id, email }, "Scan completion email sent");
          } catch (err) {
            logger.warn({ err }, "Scan completion email failed");
          }
        });
      }

      // Save to scan_leads for drip email campaign
      db.insert(scanLeadsTable)
        .values({
          email: email.toLowerCase(),
          domain: scan.domain,
          scanId: scan.id,
          overallScore: scan.overallScore,
        })
        .execute()
        .catch((err: unknown) => logger.warn({ err }, "Scan lead save failed"));

      // Fire-and-forget: redirect domain detection
      setImmediate(async () => {
        try {
          const finalDomain = await detectFinalDomain(scan.domain);
          if (finalDomain && finalDomain !== scan.domain && finalDomain !== `www.${scan.domain}`) {
            await db.execute(sql`UPDATE domain_scans SET redirected_to = ${finalDomain} WHERE id = ${scan.id}`);
            logger.info({ domain: scan.domain, finalDomain, scanId: scan.id }, "Redirect hedefi tespit edildi ve kaydedildi");
          }
        } catch (e) { logger.warn({ e }, "Redirect detection failed"); }
      });
    }

    res.json({ ...scan, cisaKevMatches, otxData, threatFoxData, feodoData, mozillaObservatory: mozillaObs, cveSummaryWithEpss });
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

    const attackScenariosData = (scan.attackScenariosStatus === "complete" && scan.attackScenariosJson)
      ? (scan.attackScenariosJson as { genel_tehdit_seviyesi: string; senaryolar: Array<{ baslik: string; olasilik: string; etki: string }> })
      : null;

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
      httpHeadersScore: scan.httpHeadersScore,
      httpHeadersDetails: scan.httpHeadersDetails as { hsts: boolean; xFrameOptions: boolean; xContentTypeOptions: boolean; csp: boolean; referrerPolicy: boolean } | null,
      urlhausListed: scan.urlhausListed, urlhausThreat: scan.urlhausThreat,
      usomListed: scan.usomListed,
      ctSubdomainCount: scan.ctSubdomainCount,
      cveSummary: (scan.cveSummary as Array<{ service: string; cveId: string; description: string; cvssScore: number }>) ?? [],
      shodanOpenPorts: scan.shodanOpenPorts as Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null,
      shodanVulnCount: scan.shodanVulnCount,
      shodanCountry: scan.shodanCountry,
      shodanIsp: scan.shodanIsp,
      virusTotalReputation: scan.virusTotalReputation,
      virusTotalMalicious: scan.virusTotalMalicious,
      virusTotalSuspicious: scan.virusTotalSuspicious,
      abuseIpdbScore: scan.abuseIpdbScore,
      abuseIpdbTotalReports: scan.abuseIpdbTotalReports,
      abuseIpdbCountry: scan.abuseIpdbCountry,
      abuseIpdbIsp: scan.abuseIpdbIsp,
      createdAt: scan.createdAt.toISOString(),
      attackScenarios: attackScenariosData,
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

// ─── GET /api/domain-scan/:id/passport ───────────────────────────────────────
router.get("/domain-scan/:id/passport", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) return void res.status(400).json({ error: "Geçersiz ID" });

  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, id));
  if (!scan) return void res.status(404).json({ error: "Tarama bulunamadı" });

  try {
    const { generateDomainScanPassport } = await import("../../services/pdf");
    const buf = await generateDomainScanPassport({
      id: scan.id,
      domain: scan.domain,
      overallScore: scan.overallScore,
      spfPass: scan.spfPass,
      dmarcPass: scan.dmarcPass,
      dkimPass: scan.dkimPass,
      sslPass: scan.sslPass,
      blacklisted: scan.blacklisted,
      hibpBreachCount: scan.hibpBreachCount,
      createdAt: scan.createdAt,
    });
    const safeDomain = scan.domain.replace(/[^a-z0-9.-]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Pasaport_${safeDomain}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    logger.error({ err, scanId: id }, "Domain scan passport PDF generation failed");
    res.status(500).json({ error: "Pasaport PDF oluşturulamadı" });
  }
});

// ─── GET /api/trust-badge/:token ─────────────────────────────────────────────
router.get("/trust-badge/:token", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  const token = req.params.token;
  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.badgeToken, token));
  if (!scan) return void res.status(404).json({ error: "Rozet bulunamadı" });
  const score = scan.overallScore ?? 0;
  const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F";
  res.json({
    domain: scan.domain,
    score,
    grade,
    spfPass: scan.spfPass,
    dmarcPass: scan.dmarcPass,
    sslPass: scan.sslPass,
    blacklisted: scan.blacklisted,
    lastChecked: scan.createdAt.toISOString(),
    verifiedBy: "CyberStep.io",
  });
});

// ─── GET /api/trust-badge/:token/widget.js ───────────────────────────────────
router.get("/trust-badge/:token/widget.js", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const token = req.params.token;
  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.badgeToken, token));
  if (!scan) return void res.status(404).send("// Badge not found");
  const score = scan.overallScore ?? 0;
  const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F";
  const color = grade === "A" ? "#16a34a" : grade === "B" ? "#65a30d" : grade === "C" ? "#d97706" : grade === "D" ? "#ea580c" : "#dc2626";
  const date = new Date(scan.createdAt).toLocaleDateString("tr-TR");
  const script = `(function(){
  var d=document,el=d.createElement("div");
  el.style.cssText="display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid ${color};border-radius:10px;padding:8px 14px;font-family:system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.08);text-decoration:none;";
  el.innerHTML='<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:${color};border-radius:6px;font-weight:700;font-size:18px;color:#fff;">${grade}</span><span style="display:flex;flex-direction:column;"><span style="font-weight:600;font-size:13px;color:#111;">${scan.domain}</span><span style="font-size:11px;color:#666;">CyberStep.io Doğrulandı &bull; ${date}</span></span>';
  var s=d.currentScript||d.scripts[d.scripts.length-1];
  s.parentNode.insertBefore(el,s);
})();`;
  res.send(script);
});

import attackScenariosRouter from "./attack-scenarios";
router.use(attackScenariosRouter);

export default router;
export { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, sanitizeDomain, checkHIBP, checkBlacklists, checkShadowIT, checkHTTPHeaders, checkURLhaus, checkUsomList, checkCertTransparency, checkGoogleSafeBrowsing, checkSSLLabs };
