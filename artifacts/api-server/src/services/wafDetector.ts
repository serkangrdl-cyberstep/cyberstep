// ─── WAF Tespit Motoru ────────────────────────────────────────────────────────
// HTTP header, cookie ve aktif probe ile WAF/CDN WAF varlığını saptar.
// Hata durumunda güvenli fallback döner — taramayı asla durdurmaz.

import axios from "axios";

export type WafProvider = "cloudflare" | "f5" | "akamai" | "imperva" | "sucuri" | "aws_waf" | "fortinet";

const WAF_SIGNATURES: Record<WafProvider, { headers: string[]; cookies: string[]; body: string[] }> = {
  cloudflare: { headers: ["cf-ray", "cf-cache-status"], cookies: ["__cfduid", "cf_clearance", "__cf_bm"], body: ["cloudflare", "cf_bm"] },
  f5:         { headers: ["x-wa-info"], cookies: ["bigipserver", "ts01", "ts02"], body: ["f5 networks", "the requested url was rejected"] },
  akamai:     { headers: ["x-akamai-transformed", "akamai-grn", "x-check-cacheable"], cookies: ["ak_bmsc"], body: ["reference #", "access denied - akamai"] },
  imperva:    { headers: ["x-iinfo", "x-cdn"], cookies: ["incap_ses", "visid_incap"], body: ["incapsula incident", "_sec_cpt"] },
  sucuri:     { headers: ["x-sucuri-id", "x-sucuri-cache"], cookies: [], body: ["sucuri website firewall", "sucuri-gui"] },
  aws_waf:    { headers: ["x-amzn-requestid", "x-amz-cf-id"], cookies: ["aws-waf-token"], body: ["aws waf"] },
  fortinet:   { headers: ["x-fortigate", "x-fortiweb", "x-fw-header"], cookies: ["FORTIWAFSID", "FSCSRF", "fgCSRFToken"], body: ["fortiweb", "fortigate", "application blocked", "fortinet", "fortigate-challenge"] },
};

// Dolaylı CDN sinyal header'ları (daha düşük güven — tespit eder ama provider kesin değil)
const INDIRECT_CDN_HEADERS: Array<{ header: string; provider: string }> = [
  { header: "x-cache",         provider: "cdn_generic"  },
  { header: "x-served-by",     provider: "fastly"       },
  { header: "x-cache-hits",    provider: "fastly"       },
  { header: "via",             provider: "cdn_generic"  },
  { header: "x-azure-ref",     provider: "azure_cdn"    },
  { header: "x-amz-cf-id",     provider: "aws_cloudfront" },
  { header: "x-sucuri-id",     provider: "sucuri"       },
  { header: "x-fw",            provider: "fortinet_cdn" },
  { header: "cf-ray",          provider: "cloudflare"   },
  { header: "cf-cache-status", provider: "cloudflare"   },
];

// WAF sağlayıcılarının genellikle eklediği güvenlik başlıkları
const WAF_ADDS: Record<string, string[]> = {
  cloudflare: ["x-content-type-options", "x-frame-options"],
  sucuri:     ["x-content-type-options", "x-frame-options"],
  akamai:     ["strict-transport-security"],
  imperva:    ["x-content-type-options"],
  fortinet:   ["x-content-type-options", "x-xss-protection"],
};

export const WAF_DISPLAY_NAMES: Record<string, string> = {
  cloudflare:     "Cloudflare",
  f5:             "F5 BIG-IP",
  akamai:         "Akamai",
  imperva:        "Imperva",
  sucuri:         "Sucuri",
  aws_waf:        "AWS WAF",
  fortinet:       "Fortinet FortiWeb",
  cdn_generic:    "CDN",
  fastly:         "Fastly CDN",
  azure_cdn:      "Azure CDN",
  aws_cloudfront: "AWS CloudFront",
  fortinet_cdn:   "Fortinet CDN",
};

export interface WafResult {
  detected: boolean;
  provider: string | null;
  confidence: number;
  headersAddedByWAF: string[];
  // Dolaylı tespit: WAF net değil ama CDN sinyali var
  indirectCdnProvider: string | null;
  indirectCdnNote: string | null;
}

const EMPTY: WafResult = {
  detected: false, provider: null, confidence: 0, headersAddedByWAF: [],
  indirectCdnProvider: null, indirectCdnNote: null,
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
    } catch { /* probe başarısız olursa normal sonuçla devam et */ }

    const headers = normal.headers as Record<string, string | string[]>;
    const body = String(normal.data ?? "").toLowerCase();
    const cookieHeader = headers["set-cookie"];
    const cookies = (Array.isArray(cookieHeader) ? cookieHeader.join(" ") : (cookieHeader ?? "")).toLowerCase();

    let bestProvider: string | null = null;
    let bestScore = 0;

    for (const [waf, sigs] of Object.entries(WAF_SIGNATURES) as [WafProvider, typeof WAF_SIGNATURES[WafProvider]][]) {
      let score = 0;
      for (const h of sigs.headers) {
        const hLow = h.toLowerCase();
        if (headers[hLow] || headers[h]) score += 35;
      }
      for (const c of sigs.cookies) {
        if (cookies.includes(c.toLowerCase())) score += 25;
      }
      for (const b of sigs.body) {
        if (body.includes(b.toLowerCase()) || attackBody.includes(b.toLowerCase())) score += 20;
      }
      if (score > bestScore) { bestScore = score; bestProvider = waf; }
    }

    const detected = bestScore >= 25;
    if (detected) {
      return {
        detected,
        provider: bestProvider,
        confidence: bestScore,
        headersAddedByWAF: bestProvider ? (WAF_ADDS[bestProvider] ?? []) : [],
        indirectCdnProvider: null,
        indirectCdnNote: null,
      };
    }

    // Doğrudan tespit yok — dolaylı CDN header kontrolü (orta güven)
    let indirectProvider: string | null = null;
    for (const { header, provider } of INDIRECT_CDN_HEADERS) {
      if (headers[header.toLowerCase()] || headers[header]) {
        indirectProvider = provider;
        break;
      }
    }

    if (indirectProvider) {
      const displayName = WAF_DISPLAY_NAMES[indirectProvider] ?? indirectProvider;
      return {
        detected: false,
        provider: null,
        confidence: 0,
        headersAddedByWAF: [],
        indirectCdnProvider: indirectProvider,
        indirectCdnNote: `WAF header'ları kesin tespit edilemedi. ${displayName} CDN sinyali alındı (dolaylı). Port riskleri CDN arkasında geçerli olmayabilir.`,
      };
    }

    return EMPTY;
  } catch {
    return EMPTY;
  }
}
