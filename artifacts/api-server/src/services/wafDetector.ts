// ─── WAF/CDN Tespit Motoru ────────────────────────────────────────────────────
// HTTP header, cookie, body, IP aralığı (Cloudflare CIDR), DNS PTR ve TLS
// sertifika analizi ile WAF/CDN varlığını saptar.
// Hata durumunda güvenli fallback döner — taramayı asla durdurmaz.

import axios from "axios";
import dns from "dns/promises";
import tls from "tls";

export type WafProvider = "cloudflare" | "f5" | "akamai" | "imperva" | "sucuri" | "aws_waf" | "fortinet";

const WAF_SIGNATURES: Record<WafProvider, { headers: string[]; cookies: string[]; body: string[] }> = {
  cloudflare: { headers: ["cf-ray", "cf-cache-status"], cookies: ["__cfduid", "cf_clearance", "__cf_bm"], body: ["cloudflare", "cf_bm"] },
  f5:         { headers: ["x-wa-info", "x-wf-request-id"], cookies: ["bigipserver", "ts01", "ts02", "ts03"], body: ["f5 networks", "the requested url was rejected", "bigip"] },
  akamai:     { headers: ["x-akamai-transformed", "akamai-grn", "x-check-cacheable", "x-akamai-request-id"], cookies: ["ak_bmsc", "bm_sz"], body: ["reference #", "access denied - akamai", "akamai"] },
  imperva:    { headers: ["x-iinfo", "x-cdn"], cookies: ["incap_ses", "visid_incap"], body: ["incapsula incident", "_sec_cpt", "imperva"] },
  sucuri:     { headers: ["x-sucuri-id", "x-sucuri-cache"], cookies: [], body: ["sucuri website firewall", "sucuri-gui"] },
  aws_waf:    { headers: ["x-amzn-requestid", "x-amz-cf-id"], cookies: ["aws-waf-token"], body: ["aws waf"] },
  fortinet:   { headers: ["x-fortigate", "x-fortiweb", "x-fw-header", "x-fortiwaf-rule-id"], cookies: ["FORTIWAFSID", "FSCSRF", "fgCSRFToken"], body: ["fortiweb", "fortigate", "application blocked", "fortinet", "fortigate-challenge"] },
};

// Dolaylı CDN sinyal header'ları (daha düşük güven)
const INDIRECT_CDN_HEADERS: Array<{ header: string; provider: string }> = [
  { header: "x-cache",              provider: "cdn_generic"      },
  { header: "x-served-by",          provider: "fastly"           },
  { header: "x-cache-hits",         provider: "fastly"           },
  { header: "x-fastly-request-id",  provider: "fastly"           },
  { header: "via",                  provider: "cdn_generic"      },
  { header: "x-azure-ref",          provider: "azure_cdn"        },
  { header: "x-fd-healthprobe",     provider: "azure_front_door" },
  { header: "x-amz-cf-id",          provider: "aws_cloudfront"   },
  { header: "x-sucuri-id",          provider: "sucuri"           },
  { header: "x-fw",                 provider: "fortinet_cdn"     },
  { header: "cf-ray",               provider: "cloudflare"       },
  { header: "cf-cache-status",      provider: "cloudflare"       },
];

const WAF_ADDS: Record<string, string[]> = {
  cloudflare: ["x-content-type-options", "x-frame-options"],
  sucuri:     ["x-content-type-options", "x-frame-options"],
  akamai:     ["strict-transport-security"],
  imperva:    ["x-content-type-options"],
  fortinet:   ["x-content-type-options", "x-xss-protection"],
};

export const WAF_DISPLAY_NAMES: Record<string, string> = {
  cloudflare:        "Cloudflare",
  f5:                "F5 BIG-IP",
  akamai:            "Akamai",
  imperva:           "Imperva",
  sucuri:            "Sucuri",
  aws_waf:           "AWS WAF",
  fortinet:          "Fortinet FortiWeb",
  cdn_generic:       "CDN",
  fastly:            "Fastly CDN",
  azure_cdn:         "Azure CDN",
  azure_front_door:  "Azure Front Door",
  aws_cloudfront:    "AWS CloudFront",
  fortinet_cdn:      "Fortinet CDN",
};

// ─── Cloudflare CIDR aralıkları ───────────────────────────────────────────────
const CF_CIDRS = [
  "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "104.16.0.0/13",   "104.24.0.0/14",
  "108.162.192.0/18","131.0.72.0/22",   "141.101.64.0/18",
  "162.158.0.0/15",  "172.64.0.0/13",   "173.245.48.0/20",
  "188.114.96.0/20", "190.93.240.0/20", "197.234.240.0/22",
  "198.41.128.0/17",
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (((acc << 8) >>> 0) | parseInt(oct, 10)) >>> 0, 0) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  if (!range || !bits) return false;
  const prefixLen = parseInt(bits, 10);
  if (prefixLen === 0) return true;
  const mask = (~((1 << (32 - prefixLen)) - 1)) >>> 0;
  return (ipToInt(ip) & mask) >>> 0 === (ipToInt(range) & mask) >>> 0;
}

function isCloudflareIp(ip: string): boolean {
  return CF_CIDRS.some(cidr => isIpInCidr(ip, cidr));
}

// ─── Yardımcı: timeout'lu Promise.race ───────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
}

// ─── DNS PTR + IP aralığı kontrolü ───────────────────────────────────────────
async function checkDnsPtrProvider(domain: string): Promise<string | null> {
  try {
    // dns.resolve4 sisteme bağlı timeout kullanır — max 3s ile sınırla
    const addresses = await withTimeout(dns.resolve4(domain), 3000, [] as string[]);
    const ip = addresses[0];
    if (!ip) return null;

    if (isCloudflareIp(ip)) return "cloudflare";

    try {
      // dns.reverse da timeout'suz — max 3s
      const ptrs = await withTimeout(dns.reverse(ip), 3000, [] as string[]);
      const ptr = (ptrs[0] ?? "").toLowerCase();
      if (ptr.includes("cloudflare")) return "cloudflare";
      if (ptr.includes("akamai") || ptr.includes("akamaiedge")) return "akamai";
      if (ptr.includes("cloudfront.net") || ptr.includes("cloudfront")) return "aws_cloudfront";
      if (ptr.includes("fastly")) return "fastly";
      if (ptr.includes("azure") || ptr.includes("msedge")) return "azure_cdn";
    } catch { /* PTR yok */ }

    return null;
  } catch {
    return null;
  }
}

// ─── TLS sertifika veren kuruluş — Cloudflare/Sucuri tespit ──────────────────
function checkTlsCertIssuer(domain: string): Promise<string | null> {
  return new Promise(resolve => {
    let settled = false;
    const done = (v: string | null) => { if (!settled) { settled = true; resolve(v); } };
    const timeout = setTimeout(() => done(null), 5000);
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, rejectUnauthorized: false },
      () => {
        clearTimeout(timeout);
        const cert = socket.getPeerCertificate();
        socket.destroy();
        const issO  = String(cert?.issuer?.O  ?? "").toLowerCase();
        const issCN = String(cert?.issuer?.CN ?? "").toLowerCase();
        if (issO.includes("cloudflare") || issCN.includes("cloudflare")) done("cloudflare");
        else if (issO.includes("sucuri") || issCN.includes("sucuri")) done("sucuri");
        else done(null);
      }
    );
    socket.on("error", () => { clearTimeout(timeout); done(null); });
  });
}

export interface WafResult {
  detected: boolean;
  provider: string | null;
  confidence: number;
  headersAddedByWAF: string[];
  indirectCdnProvider: string | null;
  indirectCdnNote: string | null;
  // Yeni alanlar
  hasCdn: boolean;
  cdnProvider: string | null;
  confidenceLevel: "high" | "medium" | "low" | null;
  detectionMethods: string[];
}

const EMPTY: WafResult = {
  detected: false, provider: null, confidence: 0, headersAddedByWAF: [],
  indirectCdnProvider: null, indirectCdnNote: null,
  hasCdn: false, cdnProvider: null, confidenceLevel: null, detectionMethods: [],
};

export async function detectWAF(domain: string): Promise<WafResult> {
  try {
    const normal = await axios.get(`https://${domain}`, {
      timeout: 8000,
      validateStatus: () => true,
      maxRedirects: 3,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    }).catch(() => null);

    if (!normal) return EMPTY;

    // Aktif probe — WAF'ı tetikle
    let attackBody = "";
    try {
      const probe = await axios.get(
        `https://${domain}/?id=1%20OR%201%3D1&q=%3Cscript%3Ealert(1)%3C%2Fscript%3E`,
        { timeout: 5000, validateStatus: () => true, headers: { "User-Agent": "sqlmap/1.0" } }
      );
      attackBody = String(probe.data ?? "").toLowerCase();
    } catch { /* probe başarısız */ }

    const headers = normal.headers as Record<string, string | string[]>;
    const body = String(normal.data ?? "").toLowerCase();
    const cookieHeader = headers["set-cookie"];
    const cookies = (Array.isArray(cookieHeader) ? cookieHeader.join(" ") : (cookieHeader ?? "")).toLowerCase();

    const detectionMethods: string[] = [];
    let bestProvider: string | null = null;
    let bestScore = 0;

    // 1. Header / cookie / body imza kontrolü
    for (const [waf, sigs] of Object.entries(WAF_SIGNATURES) as [WafProvider, typeof WAF_SIGNATURES[WafProvider]][]) {
      let score = 0;
      for (const h of sigs.headers) {
        const hLow = h.toLowerCase();
        if (headers[hLow] !== undefined || headers[h] !== undefined) score += 35;
      }
      for (const c of sigs.cookies) {
        if (cookies.includes(c.toLowerCase())) score += 25;
      }
      for (const b of sigs.body) {
        if (body.includes(b.toLowerCase()) || attackBody.includes(b.toLowerCase())) score += 20;
      }
      if (score > bestScore) { bestScore = score; bestProvider = waf; }
    }

    if (bestScore >= 25) detectionMethods.push("header_signature");

    // 2. DNS PTR / IP aralığı + TLS sertifika (paralel)
    const [dnsProvider, tlsProvider] = await Promise.all([
      checkDnsPtrProvider(domain),
      checkTlsCertIssuer(domain),
    ]);

    if (dnsProvider) {
      detectionMethods.push("dns_ptr_ip_range");
      if (bestScore < 25) {
        bestProvider = dnsProvider;
        bestScore = Math.max(bestScore, 30);
      } else if (dnsProvider === bestProvider) {
        bestScore += 15;
      }
    }

    if (tlsProvider) {
      detectionMethods.push("tls_cert");
      if (bestScore < 25) {
        bestProvider = tlsProvider;
        bestScore = Math.max(bestScore, 25);
      } else if (tlsProvider === bestProvider) {
        bestScore += 10;
      }
    }

    const detected = bestScore >= 25;

    // 3. Dolaylı CDN header kontrolü (WAF tespit edilmediyse)
    let indirectProvider: string | null = null;
    if (!detected) {
      for (const { header, provider } of INDIRECT_CDN_HEADERS) {
        if (headers[header.toLowerCase()] !== undefined || headers[header] !== undefined) {
          indirectProvider = provider;
          break;
        }
      }
    }

    // Güven seviyesi hesapla
    const confidenceLevel: "high" | "medium" | "low" | null =
      !detected                                               ? null :
      detectionMethods.length >= 2                           ? "high" :
      detectionMethods.length === 1 && bestScore >= 60       ? "high" :
      detectionMethods.length === 1 && bestScore >= 35       ? "medium" :
                                                               "low";

    const effectiveIndirect = indirectProvider ?? (!detected ? dnsProvider : null);
    const hasCdn  = detected || effectiveIndirect !== null;
    const cdnProvider = detected ? bestProvider : effectiveIndirect;

    if (detected) {
      return {
        detected,
        provider: bestProvider,
        confidence: bestScore,
        headersAddedByWAF: bestProvider ? (WAF_ADDS[bestProvider] ?? []) : [],
        indirectCdnProvider: null,
        indirectCdnNote: null,
        hasCdn,
        cdnProvider,
        confidenceLevel,
        detectionMethods,
      };
    }

    if (effectiveIndirect) {
      const displayName = WAF_DISPLAY_NAMES[effectiveIndirect] ?? effectiveIndirect;
      return {
        detected: false,
        provider: null,
        confidence: 0,
        headersAddedByWAF: [],
        indirectCdnProvider: effectiveIndirect,
        indirectCdnNote: `WAF header'ları kesin tespit edilemedi. ${displayName} CDN sinyali alındı (dolaylı). Port riskleri CDN arkasında geçerli olmayabilir.`,
        hasCdn: true,
        cdnProvider: effectiveIndirect,
        confidenceLevel: null,
        detectionMethods: detectionMethods.length > 0 ? detectionMethods : ["indirect_cdn"],
      };
    }

    return EMPTY;
  } catch {
    return EMPTY;
  }
}
