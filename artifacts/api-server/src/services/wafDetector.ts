// ─── WAF Tespit Motoru ────────────────────────────────────────────────────────
// HTTP header, cookie ve aktif probe ile WAF/CDN WAF varlığını saptar.
// Hata durumunda güvenli fallback döner — taramayı asla durdurmaz.

import axios from "axios";
import type { AxiosResponse } from "axios";

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

// WAF sağlayıcılarının genellikle eklediği güvenlik başlıkları
const WAF_ADDS: Record<string, string[]> = {
  cloudflare: ["x-content-type-options", "x-frame-options"],
  sucuri:     ["x-content-type-options", "x-frame-options"],
  akamai:     ["strict-transport-security"],
  imperva:    ["x-content-type-options"],
  fortinet:   ["x-content-type-options", "x-xss-protection"],
};

export const WAF_DISPLAY_NAMES: Record<string, string> = {
  cloudflare: "Cloudflare",
  f5:         "F5 BIG-IP",
  akamai:     "Akamai",
  imperva:    "Imperva",
  sucuri:     "Sucuri",
  aws_waf:    "AWS WAF",
  fortinet:   "Fortinet FortiWeb",
};

export interface WafResult {
  detected: boolean;
  provider: string | null;
  confidence: number;
  headersAddedByWAF: string[];
}

const EMPTY: WafResult = { detected: false, provider: null, confidence: 0, headersAddedByWAF: [] };

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
    return {
      detected,
      provider: detected ? bestProvider : null,
      confidence: bestScore,
      headersAddedByWAF: detected && bestProvider ? (WAF_ADDS[bestProvider] ?? []) : [],
    };
  } catch {
    return EMPTY;
  }
}
