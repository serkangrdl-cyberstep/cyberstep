// ─── WAF Bypass Denetleyicisi ─────────────────────────────────────────────────
// WAF tespit edildikten sonra origin sunucuya direkt IP erişimini test eder.
// Erişim mümkünse WAF bypass riski yüksektir — risk azaltımı uygulanmaz.

import dns from "dns";
import https from "https";
import axios from "axios";

export interface BypassResult {
  originIp: string | null;
  bypassPossible: boolean;
}

const EMPTY: BypassResult = { originIp: null, bypassPossible: false };

export async function checkDirectIPAccess(domain: string): Promise<BypassResult> {
  try {
    const ips = await dns.promises.resolve4(domain).catch((): string[] => []);
    if (!ips.length) return EMPTY;
    const ip = ips[0]!;

    // HTTPS ile direkt IP bağlantısı (sertifika doğrulamasını atla)
    try {
      const r = await axios.get(`https://${ip}`, {
        timeout: 6000,
        validateStatus: () => true,
        headers: { Host: domain },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        maxRedirects: 2,
      });
      if (r.status < 500) return { originIp: ip, bypassPossible: true };
    } catch { /* http ile devam */ }

    // HTTP fallback
    try {
      const r = await axios.get(`http://${ip}`, {
        timeout: 5000,
        validateStatus: () => true,
        headers: { Host: domain },
        maxRedirects: 2,
      });
      if (r.status < 500) return { originIp: ip, bypassPossible: true };
    } catch { /* ulaşılamıyor */ }

    return { originIp: ip, bypassPossible: false };
  } catch {
    return EMPTY;
  }
}
