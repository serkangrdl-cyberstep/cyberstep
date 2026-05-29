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

// ─── USOM Zararlı Alan Listesi (Ulusal Siber Olaylar Müdahale Merkezi) ─────────
let _usomDomains: Set<string> = new Set();
let _usomLastFetch = 0;

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
interface ShodanPort { port: number; protocol: string; service: string; product: string; version: string; }

async function checkShodan(domain: string): Promise<{
  openPorts: ShodanPort[];
  vulnCount: number;
  country: string | null;
  isp: string | null;
} | null> {
  const apiKey = process.env["SHODAN_API_KEY"];
  if (!apiKey) return null;
  try {
    const ips = await dns.resolve4(domain);
    if (!ips || ips.length === 0) return { openPorts: [], vulnCount: 0, country: null, isp: null };
    const ip = ips[0]!;
    return new Promise((resolve) => {
      const req = https.request(
        { hostname: "api.shodan.io", path: `/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(apiKey)}`, method: "GET", timeout: 10000, headers: { "Accept": "application/json", "User-Agent": "CyberStep.io Security Scanner/1.0" } },
        (res) => {
          let data = ""; let size = 0;
          res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 500 * 1024) { res.destroy(); resolve(null); return; } data += chunk.toString(); });
          res.on("end", () => {
            try {
              if (res.statusCode !== 200) { resolve({ openPorts: [], vulnCount: 0, country: null, isp: null }); return; }
              type ShodanHost = { data?: Array<{ port: number; transport?: string; product?: string; version?: string; _shodan?: { module: string } }>; vulns?: Record<string, unknown>; country_code?: string; org?: string; };
              const json = JSON.parse(data) as ShodanHost;
              const HIGH_RISK_PORTS = new Set([21, 22, 23, 25, 135, 139, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 27017]);
              const openPorts = (json.data ?? []).slice(0, 20).map((d) => ({
                port: d.port,
                protocol: d.transport ?? "tcp",
                service: d._shodan?.module ?? "",
                product: d.product ?? "",
                version: d.version ?? "",
                isHighRisk: HIGH_RISK_PORTS.has(d.port),
              })).sort((a, b) => (b.isHighRisk ? 1 : 0) - (a.isHighRisk ? 1 : 0)).map(({ isHighRisk: _, ...rest }) => rest);
              resolve({ openPorts, vulnCount: Object.keys(json.vulns ?? {}).length, country: json.country_code ?? null, isp: json.org ?? null });
            } catch { resolve({ openPorts: [], vulnCount: 0, country: null, isp: null }); }
          });
        }
      );
      req.on("error", () => resolve({ openPorts: [], vulnCount: 0, country: null, isp: null }));
      req.on("timeout", () => { req.destroy(); resolve({ openPorts: [], vulnCount: 0, country: null, isp: null }); });
      req.end();
    });
  } catch { return { openPorts: [], vulnCount: 0, country: null, isp: null }; }
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
    const [spf, dmarc, dkim, mx, ssl, hibp, blacklist, shadowIt, httpHeaders, urlhaus, usom, certTrans, shodan, virusTotal, abuseIpdb] = await Promise.all([
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
    ]);

    const overallScore = calcScore(spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass);
    const cveSummary = await checkNvdCve(shadowIt.services);

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
      })
      .returning();

    logger.info({ domain, overallScore, hibpBreaches: hibp.breachCount, blacklisted: blacklist.blacklisted, httpHeadersScore: httpHeaders.score, urlhausListed: urlhaus.listed, usomListed: usom.listed, ctSubdomainCount: certTrans.count, shodanConfigured: shodan !== null, virusTotalConfigured: virusTotal !== null, abuseIpdbConfigured: abuseIpdb !== null, scanId: scan?.id }, "Domain scan complete");
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
export { checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, calcScore, sanitizeDomain, checkHIBP, checkBlacklists, checkShadowIT, checkHTTPHeaders, checkURLhaus, checkUsomList, checkCertTransparency };
