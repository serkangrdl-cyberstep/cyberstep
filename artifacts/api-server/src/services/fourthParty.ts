/**
 * Dördüncü taraf (tedarikçinin kullandığı hizmet sağlayıcılar) görünürlüğü — YALNIZCA dışarıdan görünenler:
 * MX (e-posta), SPF include (e-posta gönderen servisler), NS (DNS), ana sayfadaki üçüncü taraf script/iframe adresleri.
 * Liste tam değildir; veri paylaşımı gibi dışarıdan görünmeyenler anket (soru 11, 20, 21) ile sorulur.
 */

export type FourthPartyCategory = "e-posta" | "bulut/CDN" | "DNS" | "pazarlama/analitik" | "müşteri destek/CRM" | "ödeme" | "web/e-ticaret altyapısı" | "güvenlik";
export interface FourthParty { provider: string; category: FourthPartyCategory; via: Array<"mx" | "spf" | "ns" | "web"> }

// [alan adı soneki, sağlayıcı, kategori]
const PROVIDERS: Array<[string, string, FourthPartyCategory]> = [
  ["google.com", "Google", "e-posta"], ["googlemail.com", "Google", "e-posta"], ["_spf.google.com", "Google Workspace", "e-posta"],
  ["googletagmanager.com", "Google Tag Manager", "pazarlama/analitik"], ["google-analytics.com", "Google Analytics", "pazarlama/analitik"],
  ["googleapis.com", "Google", "bulut/CDN"], ["gstatic.com", "Google", "bulut/CDN"], ["doubleclick.net", "Google Ads", "pazarlama/analitik"],
  ["outlook.com", "Microsoft 365", "e-posta"], ["protection.outlook.com", "Microsoft 365", "e-posta"], ["microsoft.com", "Microsoft", "bulut/CDN"],
  ["azure.com", "Microsoft Azure", "bulut/CDN"], ["azureedge.net", "Microsoft Azure", "bulut/CDN"], ["windows.net", "Microsoft Azure", "bulut/CDN"],
  ["amazonaws.com", "Amazon AWS", "bulut/CDN"], ["cloudfront.net", "Amazon AWS", "bulut/CDN"], ["amazonses.com", "Amazon SES", "e-posta"],
  ["cloudflare.com", "Cloudflare", "bulut/CDN"], ["cloudflare.net", "Cloudflare", "bulut/CDN"], ["cdnjs.cloudflare.com", "Cloudflare", "bulut/CDN"],
  ["akamai.net", "Akamai", "bulut/CDN"], ["akamaiedge.net", "Akamai", "bulut/CDN"], ["fastly.net", "Fastly", "bulut/CDN"], ["jsdelivr.net", "jsDelivr", "bulut/CDN"],
  ["unpkg.com", "unpkg", "bulut/CDN"], ["bootstrapcdn.com", "BootstrapCDN", "bulut/CDN"], ["jquery.com", "jQuery CDN", "bulut/CDN"],
  ["mailchimp.com", "Mailchimp", "e-posta"], ["mandrillapp.com", "Mailchimp (Mandrill)", "e-posta"], ["mcsv.net", "Mailchimp", "e-posta"],
  ["sendgrid.net", "SendGrid", "e-posta"], ["mailgun.org", "Mailgun", "e-posta"], ["sparkpostmail.com", "SparkPost", "e-posta"],
  ["mimecast.com", "Mimecast", "güvenlik"], ["pphosted.com", "Proofpoint", "güvenlik"], ["fortimail.com", "Fortinet FortiMail", "güvenlik"],
  ["zoho.com", "Zoho", "e-posta"], ["zoho.eu", "Zoho", "e-posta"], ["yandex.net", "Yandex", "e-posta"], ["yandex.ru", "Yandex", "e-posta"],
  ["salesforce.com", "Salesforce", "müşteri destek/CRM"], ["force.com", "Salesforce", "müşteri destek/CRM"], ["hubspot.com", "HubSpot", "pazarlama/analitik"],
  ["hs-scripts.com", "HubSpot", "pazarlama/analitik"], ["hsforms.net", "HubSpot", "pazarlama/analitik"], ["zendesk.com", "Zendesk", "müşteri destek/CRM"],
  ["freshdesk.com", "Freshdesk", "müşteri destek/CRM"], ["intercom.io", "Intercom", "müşteri destek/CRM"], ["intercomcdn.com", "Intercom", "müşteri destek/CRM"],
  ["tawk.to", "Tawk.to", "müşteri destek/CRM"], ["livechatinc.com", "LiveChat", "müşteri destek/CRM"], ["crisp.chat", "Crisp", "müşteri destek/CRM"],
  ["facebook.net", "Meta", "pazarlama/analitik"], ["facebook.com", "Meta", "pazarlama/analitik"], ["hotjar.com", "Hotjar", "pazarlama/analitik"],
  ["clarity.ms", "Microsoft Clarity", "pazarlama/analitik"], ["linkedin.com", "LinkedIn", "pazarlama/analitik"], ["yandex.com", "Yandex Metrica", "pazarlama/analitik"],
  ["stripe.com", "Stripe", "ödeme"], ["iyzipay.com", "iyzico", "ödeme"], ["iyzico.com", "iyzico", "ödeme"], ["paytr.com", "PayTR", "ödeme"],
  ["paypal.com", "PayPal", "ödeme"], ["param.com.tr", "Param", "ödeme"],
  ["shopify.com", "Shopify", "web/e-ticaret altyapısı"], ["myshopify.com", "Shopify", "web/e-ticaret altyapısı"], ["wixsite.com", "Wix", "web/e-ticaret altyapısı"],
  ["wix.com", "Wix", "web/e-ticaret altyapısı"], ["wordpress.com", "WordPress.com", "web/e-ticaret altyapısı"], ["wp.com", "WordPress.com", "web/e-ticaret altyapısı"],
  ["squarespace.com", "Squarespace", "web/e-ticaret altyapısı"], ["ticimax.com", "Ticimax", "web/e-ticaret altyapısı"], ["ideasoft.com.tr", "IdeaSoft", "web/e-ticaret altyapısı"],
  ["godaddy.com", "GoDaddy", "DNS"], ["domaincontrol.com", "GoDaddy", "DNS"], ["awsdns", "Amazon Route 53", "DNS"], ["nsone.net", "NS1", "DNS"],
  ["dynect.net", "Oracle Dyn", "DNS"], ["azure-dns", "Azure DNS", "DNS"], ["googledomains.com", "Google Domains", "DNS"], ["natro.com", "Natro", "DNS"],
  ["turhost.com", "Turhost", "DNS"], ["trdns.com", "TRDNS", "DNS"],
];

/** Host, listedeki soneklerden biriyle eşleşir (tam eşitlik veya ".sonek"). "awsdns"/"azure-dns" gibi parça eşleşmeleri DNS için içerir. */
export function providerOf(host: string): { provider: string; category: FourthPartyCategory } | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  let best: { provider: string; category: FourthPartyCategory; len: number } | null = null;
  for (const [suffix, provider, category] of PROVIDERS) {
    const hit = suffix.includes(".") ? (h === suffix || h.endsWith("." + suffix)) : h.includes(suffix);
    if (hit && (!best || suffix.length > best.len)) best = { provider, category, len: suffix.length };
  }
  return best ? { provider: best.provider, category: best.category } : null;
}

/** HTML'deki script/iframe/link src host adları (kendi alan adı ve alt alanları hariç). */
export function extractWebHosts(html: string, ownDomain: string): string[] {
  const own = ownDomain.toLowerCase();
  const out = new Set<string>();
  for (const m of html.matchAll(/<(?:script|iframe|link)\b[^>]*?\b(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"'>\s]+)["']/gi)) {
    try {
      const host = new URL(m[1]!.startsWith("//") ? "https:" + m[1] : m[1]!).hostname.toLowerCase();
      if (host === own || host.endsWith("." + own)) continue;
      out.add(host);
    } catch { /* geçersiz adres */ }
  }
  return [...out];
}

export function extractSpfIncludes(spf: string | null | undefined): string[] {
  return [...(spf ?? "").matchAll(/\b(?:include|redirect)[:=]([^\s]+)/gi)].map((m) => m[1]!.toLowerCase());
}

export interface FourthPartyInput {
  domain: string;
  mxHosts?: string[]; spfRecord?: string | null; nsHosts?: string[]; webHosts?: string[];
}

export function detectFourthParties(input: FourthPartyInput): FourthParty[] {
  const map = new Map<string, FourthParty>();
  const add = (host: string, via: "mx" | "spf" | "ns" | "web") => {
    const p = providerOf(host);
    if (!p) return;
    const key = `${p.provider}|${p.category}`;
    const cur = map.get(key);
    if (cur) { if (!cur.via.includes(via)) cur.via.push(via); } else map.set(key, { provider: p.provider, category: p.category, via: [via] });
  };
  for (const h of input.mxHosts ?? []) add(h, "mx");
  for (const h of extractSpfIncludes(input.spfRecord)) add(h, "spf");
  for (const h of input.nsHosts ?? []) add(h, "ns");
  for (const h of input.webHosts ?? []) add(h, "web");
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.provider.localeCompare(b.provider));
}

export interface VendorFourthParties { vendorId: number; vendorName: string; parties: FourthParty[] }
export interface Concentration { provider: string; category: FourthPartyCategory; vendorCount: number; share: number; vendors: string[]; high: boolean }

/** Portföy yoğunlaşması: aynı sağlayıcıya bağlı tedarikçi sayısı. Yüksek: en az 3 tedarikçi ve portföyün >= %25'i. */
export function portfolioConcentration(vendors: VendorFourthParties[]): Concentration[] {
  const total = vendors.length;
  const map = new Map<string, Concentration>();
  for (const v of vendors) for (const p of v.parties) {
    const key = `${p.provider}|${p.category}`;
    const c = map.get(key) ?? { provider: p.provider, category: p.category, vendorCount: 0, share: 0, vendors: [], high: false };
    c.vendorCount++; c.vendors.push(v.vendorName);
    map.set(key, c);
  }
  return [...map.values()]
    .map((c) => { const share = total ? c.vendorCount / total : 0; return { ...c, share, high: c.vendorCount >= 3 && share >= 0.25 }; })
    .sort((a, b) => b.vendorCount - a.vendorCount || a.provider.localeCompare(b.provider));
}
