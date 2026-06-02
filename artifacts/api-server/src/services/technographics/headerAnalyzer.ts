import axios from "axios";
import type { TechStack } from "./types";

export async function analyzeHeaders(domain: string): Promise<TechStack[]> {
  const found: TechStack[] = [];
  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 8000,
      validateStatus: null,
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SecurityBot/1.0)" },
    });
    const h = resp.headers;
    const rawCookies = h["set-cookie"];
    const cookies = (Array.isArray(rawCookies) ? rawCookies.join(" ") : String(rawCookies || "")).toLowerCase();

    const server = String(h["server"] || "");
    if (server) {
      const serverMap: Record<string, [string, string]> = {
        nginx: ["nginx", "nginx"],
        apache: ["apache", "Apache HTTP Server"],
        iis: ["microsoft", "Microsoft IIS"],
        litespeed: ["litespeed", "LiteSpeed"],
        caddy: ["caddy", "Caddy"],
        gunicorn: ["gunicorn", "Gunicorn"],
        openresty: ["openresty", "OpenResty"],
      };
      for (const [key, [vendor, product]] of Object.entries(serverMap)) {
        if (server.toLowerCase().includes(key)) {
          const version = server.match(/[\d.]+/)?.[0];
          found.push({ category: "webserver", vendor, product, version, confidence: 90, detectedVia: "header", evidence: { header: "Server", value: server } });
          break;
        }
      }
    }

    const powered = String(h["x-powered-by"] || "");
    if (powered) {
      const langMap: Record<string, [string, string]> = {
        php: ["php", "PHP"],
        "asp.net": ["microsoft", "ASP.NET"],
        express: ["nodejs", "Node.js/Express"],
        "next.js": ["vercel", "Next.js"],
        java: ["java", "Java"],
      };
      for (const [key, [vendor, product]] of Object.entries(langMap)) {
        if (powered.toLowerCase().includes(key)) {
          const version = powered.match(/[\d.]+/)?.[0];
          found.push({ category: "language", vendor, product, version, confidence: 85, detectedVia: "header", evidence: { header: "X-Powered-By", value: powered } });
          break;
        }
      }
    }

    // ─── CDN TESPİTİ ───────────────────────────────────────
    const cdnSignatures: Array<{ check: () => boolean; vendor: string; product: string; confidence: number }> = [
      { check: () => !!(h["cf-ray"] || h["cf-cache-status"] || cookies.includes("__cfduid") || cookies.includes("cf_clearance")), vendor: "cloudflare", product: "Cloudflare CDN", confidence: 95 },
      { check: () => !!(h["x-akamai-transformed"] || h["akamai-grn"] || cookies.includes("ak_bmsc")), vendor: "akamai", product: "Akamai CDN", confidence: 90 },
      { check: () => !!(h["x-amz-cf-id"] || h["x-amz-cf-pop"]), vendor: "aws", product: "Amazon CloudFront", confidence: 90 },
      { check: () => !!(h["x-fastly-id"] || h["x-served-by"]?.includes("cache")), vendor: "fastly", product: "Fastly CDN", confidence: 85 },
    ];
    for (const sig of cdnSignatures) {
      if (sig.check()) {
        found.push({ category: "cdn", vendor: sig.vendor, product: sig.product, confidence: sig.confidence, detectedVia: "header", evidence: { headers: Object.keys(h) } });
        // Cloudflare ve Akamai WAF da sunar — her ikisini de kaydet
        if (sig.vendor === "cloudflare") {
          found.push({ category: "waf", vendor: "cloudflare", product: "Cloudflare WAF", confidence: 90, detectedVia: "header", evidence: { headers: Object.keys(h) }, salesSignal: "waf_detected" });
        }
      }
    }

    // ─── BAĞIMSIZ WAF TESPİTİ ──────────────────────────────
    const wafSignatures: Array<{ check: () => boolean; vendor: string; product: string; confidence: number }> = [
      { check: () => !!(h["x-sucuri-id"] || h["x-sucuri-cache"]),                            vendor: "sucuri",   product: "Sucuri WAF",        confidence: 92 },
      { check: () => !!(h["x-iinfo"] || cookies.includes("incap_ses")),                       vendor: "imperva",  product: "Imperva Incapsula", confidence: 90 },
      { check: () => !!(h["x-wa-info"] || cookies.includes("bigipserver")),                   vendor: "f5",       product: "F5 BIG-IP",         confidence: 88 },
      { check: () => !!(h["x-protected-by"]?.includes("aws") || h["x-amzn-waf-action"]),     vendor: "aws",      product: "AWS WAF",            confidence: 88 },
      { check: () => !!(h["x-guard"] || cookies.includes("wordfence")),                       vendor: "wordfence", product: "Wordfence WAF",     confidence: 82 },
      { check: () => !!(h["x-powered-cms"] === "barracuda" || h["x-barracuda-connect"]),      vendor: "barracuda", product: "Barracuda WAF",     confidence: 85 },
    ];
    for (const sig of wafSignatures) {
      if (sig.check()) {
        found.push({ category: "waf", vendor: sig.vendor, product: sig.product, confidence: sig.confidence, detectedVia: "header", evidence: { headers: Object.keys(h) }, salesSignal: "waf_detected" });
      }
    }

    const securityHeaders: Record<string, string> = {
      "strict-transport-security": "HSTS",
      "content-security-policy": "CSP",
      "x-frame-options": "X-Frame-Options",
      "x-content-type-options": "X-Content-Type-Options",
      "referrer-policy": "Referrer-Policy",
      "permissions-policy": "Permissions-Policy",
    };
    for (const [header, name] of Object.entries(securityHeaders)) {
      if (!h[header]) {
        found.push({ category: "missing_header", vendor: "none", product: `${name} Eksik`, confidence: 100, detectedVia: "header", securityRisk: header === "content-security-policy" ? "high" : "medium", securityNote: `${name} başlığı yapılandırılmamış`, evidence: { missingHeader: header } });
      }
    }
  } catch {
    // header analizi başarısız
  }
  return found;
}
