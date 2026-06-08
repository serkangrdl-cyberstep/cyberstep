// ─── Origin IP Discovery ──────────────────────────────────────────────────────
// WAF/CDN arkasındaki gerçek sunucu IP adresini pasif yöntemlerle tespit eder.
// SPF ip4 direktifleri, MX kaydı A çözümleme ve subdomain bypass kontrolü.
// API anahtarı gerekmez, tamamen pasif ve yalnızca DNS/HTTP kullanır.

import dns from "dns/promises";
import https from "https";
import http from "http";

export type OriginSource = "spf" | "mx_record" | "subdomain_bypass";

export interface OriginIpResult {
  found: boolean;
  originIp: string | null;
  source: OriginSource | null;
  sourceDetail: string | null;
  confidence: "high" | "medium" | "low";
  note: string;
}

const EMPTY: OriginIpResult = {
  found: false,
  originIp: null,
  source: null,
  sourceDetail: null,
  confidence: "low",
  note: "Gerçek sunucu IP adresi tespit edilemedi — WAF/CDN koruması etkin görünüyor",
};

// ISP/hostname'de CDN/bulut servisi işareti var mı?
const CDN_KEYWORDS = [
  "cloudflare", "fastly", "akamai", "sucuri", "imperva", "incapsula",
  "stackpath", "maxcdn", "keycdn", "bunny", "limelight", "edgecast",
  "azurefd", "azure-", "amazonaws", "google.com", "googleusercontent",
  "zscaler", "barracuda",
];

function looksLikeCdn(s: string): boolean {
  const lower = s.toLowerCase();
  return CDN_KEYWORDS.some(k => lower.includes(k));
}

// RFC 1918 ve link-local özel IP aralıkları
function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") || ip.startsWith("172.2") || ip.startsWith("172.3") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    ip.startsWith("127.") ||
    ip === "0.0.0.0"
  );
}

// Bir IP'nin CDN'e ait olmadığını doğrula (reverse DNS + özel IP kontrolü)
async function isLikelyOriginIp(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;
  try {
    const hostnames = await dns.reverse(ip).catch((): string[] => []);
    if (hostnames.some(h => looksLikeCdn(h))) return false;
  } catch { /* pass */ }
  return true;
}

// Domaine ait mevcut A kayıtlarını al (CDN IP'leri)
async function getCurrentARecords(domain: string): Promise<Set<string>> {
  try {
    const ips = await dns.resolve4(domain).catch((): string[] => []);
    return new Set(ips);
  } catch {
    return new Set();
  }
}

// ─── Yöntem 1: SPF kaydındaki ip4: direktifleri ────────────────────────────
async function trySpfOriginIp(
  domain: string,
  cdnIps: Set<string>,
): Promise<{ ip: string; detail: string } | null> {
  try {
    const records = await dns.resolveTxt(domain).catch((): string[][] => []);
    for (const r of records) {
      const spf = r.join("");
      if (!spf.toLowerCase().startsWith("v=spf1")) continue;
      const matches = [...spf.matchAll(/ip4:([\d.]+(?:\/\d+)?)/g)];
      for (const m of matches) {
        const entry = m[1];
        if (!entry) continue;
        const ip = entry.includes("/") ? entry.split("/")[0]! : entry;
        if (cdnIps.has(ip)) continue;
        if (!(await isLikelyOriginIp(ip))) continue;
        return { ip, detail: `SPF ip4: ${entry}` };
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Yöntem 2: MX kaydı A kaydı çözümleme ─────────────────────────────────
async function tryMxOriginIp(
  domain: string,
  cdnIps: Set<string>,
): Promise<{ ip: string; detail: string } | null> {
  const CLOUD_MAIL = [
    "google", "outlook", "office365", "mimecast", "proofpoint",
    "barracuda", "sophos", "mailgun", "sendgrid", "amazonses",
    "messagelabs", "pphosted",
  ];
  try {
    const mxRecords = await dns.resolveMx(domain).catch(
      (): Array<{ exchange: string; priority: number }> => [],
    );
    for (const mx of mxRecords.sort((a, b) => a.priority - b.priority)) {
      const host = mx.exchange.toLowerCase();
      if (CLOUD_MAIL.some(k => host.includes(k))) continue;
      if (looksLikeCdn(host)) continue;
      const ips = await dns.resolve4(mx.exchange).catch((): string[] => []);
      for (const ip of ips) {
        if (cdnIps.has(ip)) continue;
        if (!(await isLikelyOriginIp(ip))) continue;
        return { ip, detail: `MX ${mx.exchange} → ${ip}` };
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Yöntem 3: Subdomain bypass — CDN kapsamı dışı alt alan adları ─────────
async function trySubdomainBypass(
  domain: string,
  cdnIps: Set<string>,
): Promise<{ ip: string; detail: string } | null> {
  const PREFIXES = [
    "mail", "smtp", "ftp", "cpanel", "webmail", "direct",
    "origin", "www2", "dev", "staging", "portal", "vpn",
    "autodiscover", "remote", "access", "api", "blog",
  ];
  for (const prefix of PREFIXES) {
    const sub = `${prefix}.${domain}`;
    try {
      const ips = await dns.resolve4(sub).catch((): string[] => []);
      for (const ip of ips) {
        if (cdnIps.has(ip)) continue;
        if (!(await isLikelyOriginIp(ip))) continue;
        return { ip, detail: `${sub} → ${ip}` };
      }
    } catch { /* next */ }
  }
  return null;
}

// ─── Erişilebilirlik doğrulama (best-effort, timeout'lu) ───────────────────
async function verifyReachable(ip: string, domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    const reqOpts = {
      hostname: ip, port: 443, method: "HEAD", timeout: 5000,
      rejectUnauthorized: false,
      headers: { Host: domain, "User-Agent": "Mozilla/5.0 (compatible; CyberStep.io)" },
    };
    const req = https.request(reqOpts, (res) => {
      resolve((res.statusCode ?? 0) < 500);
    });
    req.on("error", () => {
      const req2 = http.request(
        { hostname: ip, port: 80, method: "HEAD", timeout: 4000,
          headers: { Host: domain, "User-Agent": "Mozilla/5.0 (compatible; CyberStep.io)" } },
        (res2) => resolve((res2.statusCode ?? 0) < 500),
      );
      req2.on("error", () => resolve(false));
      req2.on("timeout", () => { req2.destroy(); resolve(false); });
      req2.end();
    });
    req.on("timeout", () => { req.destroy(); });
    req.end();
  });
}

// ─── Ana fonksiyon ─────────────────────────────────────────────────────────
export async function discoverOriginIp(domain: string): Promise<OriginIpResult> {
  try {
    const cdnIps = await getCurrentARecords(domain);

    // Üç yöntemi paralel çalıştır, ilk bulunan yeterli
    const [spfResult, mxResult, subResult] = await Promise.all([
      trySpfOriginIp(domain, cdnIps).catch(() => null),
      tryMxOriginIp(domain, cdnIps).catch(() => null),
      trySubdomainBypass(domain, cdnIps).catch(() => null),
    ]);

    const candidate = spfResult ?? mxResult ?? subResult;
    if (!candidate) return EMPTY;

    const source: OriginSource =
      spfResult ? "spf" :
      mxResult ? "mx_record" : "subdomain_bypass";

    const confidence: OriginIpResult["confidence"] =
      source === "spf" ? "high" :
      source === "mx_record" ? "medium" : "low";

    // Erişilebilirlik doğrulama (güven skorunu artırır ama sonucu engellemez)
    const reachable = await verifyReachable(candidate.ip, domain).catch(() => false);
    const finalConfidence: OriginIpResult["confidence"] =
      reachable && source === "subdomain_bypass" ? "medium" :
      reachable ? "high" : confidence;

    const sourceLabel: Record<OriginSource, string> = {
      spf: "SPF kaydı",
      mx_record: "MX kaydı A çözümlemesi",
      subdomain_bypass: "CDN kapsamı dışı subdomain",
    };

    return {
      found: true,
      originIp: candidate.ip,
      source,
      sourceDetail: candidate.detail,
      confidence: finalConfidence,
      note: `Gerçek sunucu IP tespit edildi: ${candidate.ip} (${sourceLabel[source]}) — WAF/CDN koruması bypass edilebilir`,
    };
  } catch {
    return EMPTY;
  }
}
