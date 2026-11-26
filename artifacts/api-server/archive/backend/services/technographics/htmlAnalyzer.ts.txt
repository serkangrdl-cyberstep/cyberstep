import axios from "axios";
import type { TechStack } from "./types";

export async function analyzeHTML(domain: string, deepScan = false): Promise<TechStack[]> {
  const found: TechStack[] = [];
  try {
    const resp = await axios.get(`https://${domain}`, { timeout: 10000, validateStatus: null, headers: { "User-Agent": "Mozilla/5.0" } });
    const html = (resp.data || "").toString();
    const htmlLower = html.toLowerCase();

    // ─── CMS TESPİTİ ───────────────────────────────────────
    const cmsPatterns = [
      { patterns: ["wp-content/", "wp-includes/", "wordpress"], vendor: "wordpress", product: "WordPress", versionRegex: /wordpress\s+([\d.]+)/i },
      { patterns: ["/sites/default/files/", "drupal.js", "drupal"], vendor: "drupal", product: "Drupal", versionRegex: /drupal\s+([\d.]+)/i },
      { patterns: ["/administrator/index.php", "joomla"], vendor: "joomla", product: "Joomla" },
      { patterns: ["ghost-url", "ghost.io", "content/ghost"], vendor: "ghost", product: "Ghost CMS" },
    ];
    for (const cms of cmsPatterns) {
      if (cms.patterns.some((p) => htmlLower.includes(p))) {
        const version = cms.versionRegex ? html.match(cms.versionRegex)?.[1] : undefined;
        found.push({ category: "cms", vendor: cms.vendor, product: cms.product, version, confidence: 85, detectedVia: "html", evidence: { matchedPatterns: cms.patterns.filter((p) => htmlLower.includes(p)) } });
        break;
      }
    }

    // ─── TÜRKİYE'YE ÖZGÜ E-TİCARET ────────────────────────
    const trEcommerce = [
      { pattern: "ideasoft", vendor: "ideasoft", product: "İdeasoft" },
      { pattern: "tsoft", vendor: "tsoft", product: "T-Soft" },
      { pattern: "ikas", vendor: "ikas", product: "İkas" },
      { pattern: "faprika", vendor: "faprika", product: "Faprika" },
      { pattern: "woocommerce", vendor: "woocommerce", product: "WooCommerce" },
      { pattern: "shopify", vendor: "shopify", product: "Shopify" },
      { pattern: "magento", vendor: "adobe", product: "Adobe Commerce / Magento" },
      { pattern: "opencart", vendor: "opencart", product: "OpenCart" },
      { pattern: "prestashop", vendor: "prestashop", product: "PrestaShop" },
    ];
    for (const ec of trEcommerce) {
      if (htmlLower.includes(ec.pattern)) {
        found.push({ category: "ecommerce", vendor: ec.vendor, product: ec.product, confidence: 80, detectedVia: "html", salesSignal: "is_ecommerce", evidence: { pattern: ec.pattern } });
        break;
      }
    }

    // ─── ANALİTİK ARAÇLAR ──────────────────────────────────
    const analytics = [
      { pattern: "google-analytics.com|gtag/js|UA-", vendor: "google", product: "Google Analytics" },
      { pattern: "googletagmanager.com|gtm.js", vendor: "google", product: "Google Tag Manager" },
      { pattern: "mc.yandex.ru|yandex_metrika", vendor: "yandex", product: "Yandex Metrica" },
      { pattern: "hotjar.com|hjid", vendor: "hotjar", product: "Hotjar" },
      { pattern: "clarity.ms|microsoft_clarity", vendor: "microsoft", product: "Microsoft Clarity" },
      { pattern: "segment.com/analytics|analytics.js", vendor: "segment", product: "Segment" },
      { pattern: "mixpanel.com", vendor: "mixpanel", product: "Mixpanel" },
    ];
    for (const tool of analytics) {
      if (new RegExp(tool.pattern, "i").test(html)) {
        found.push({ category: "analytics", vendor: tool.vendor, product: tool.product, confidence: 90, detectedVia: "html", evidence: { pattern: tool.pattern } });
      }
    }

    // ─── DESTEK / CHAT ARAÇLARI ─────────────────────────────
    const supportTools = [
      { pattern: "zendesk.com|zdassets", vendor: "zendesk", product: "Zendesk", salesSignal: "budget_indicator_high" },
      { pattern: "intercom.io|intercomSettings", vendor: "intercom", product: "Intercom", salesSignal: "budget_indicator_high" },
      { pattern: "freshdesk.com|freshchat", vendor: "freshworks", product: "Freshdesk", salesSignal: "budget_indicator_medium" },
      { pattern: "tawk.to", vendor: "tawkto", product: "Tawk.to", salesSignal: "budget_indicator_low" },
      { pattern: "crisp.chat", vendor: "crisp", product: "Crisp", salesSignal: "budget_indicator_low" },
      { pattern: "livechatinc.com", vendor: "livechat", product: "LiveChat", salesSignal: "budget_indicator_medium" },
    ];
    for (const tool of supportTools) {
      if (new RegExp(tool.pattern, "i").test(html)) {
        found.push({ category: "support", vendor: tool.vendor, product: tool.product, confidence: 85, detectedVia: "html", salesSignal: tool.salesSignal });
      }
    }

    // ─── CRM / PAZARLAMA ───────────────────────────────────
    const crmTools = [
      { pattern: "hubspot.com|hs-scripts", vendor: "hubspot", product: "HubSpot", signal: "budget_indicator_high" },
      { pattern: "salesforce.com|pardot", vendor: "salesforce", product: "Salesforce", signal: "budget_indicator_enterprise" },
      { pattern: "mailchimp.com", vendor: "mailchimp", product: "Mailchimp", signal: "budget_indicator_medium" },
      { pattern: "klaviyo.com", vendor: "klaviyo", product: "Klaviyo", signal: "is_ecommerce" },
      { pattern: "activecampaign.com", vendor: "activecampaign", product: "ActiveCampaign", signal: "budget_indicator_medium" },
    ];
    for (const tool of crmTools) {
      if (new RegExp(tool.pattern, "i").test(html)) {
        found.push({ category: "crm", vendor: tool.vendor, product: tool.product, confidence: 82, detectedVia: "html", salesSignal: tool.signal });
      }
    }

    // ─── ÖDEME SİSTEMİ ─────────────────────────────────────
    const paymentTools = [
      { pattern: "iyzipay.com|iyzico", vendor: "iyzico", product: "Iyzico" },
      { pattern: "paytr.com", vendor: "paytr", product: "PayTR" },
      { pattern: "stripe.com", vendor: "stripe", product: "Stripe" },
      { pattern: "paypal.com", vendor: "paypal", product: "PayPal" },
      { pattern: "param.com.tr", vendor: "param", product: "Param" },
      { pattern: "garantipay", vendor: "garanti", product: "GarantiPay" },
    ];
    for (const tool of paymentTools) {
      if (new RegExp(tool.pattern, "i").test(html)) {
        found.push({ category: "payment", vendor: tool.vendor, product: tool.product, confidence: 88, detectedVia: "html", salesSignal: "has_payment_system", evidence: { pattern: tool.pattern } });
      }
    }

    // ─── GELİŞTİRME FRAMEWORK'LERİ (deepScan) ─────────────
    if (deepScan) {
      const frameworks = [
        { pattern: "__next/static|__nextjs", vendor: "vercel", product: "Next.js" },
        { pattern: "nuxt.js|__nuxt", vendor: "nuxt", product: "Nuxt.js" },
        { pattern: "react_root|react.development", vendor: "meta", product: "React" },
        { pattern: "vue.runtime|vuejs", vendor: "vue", product: "Vue.js" },
        { pattern: "ng-version|angular", vendor: "google", product: "Angular" },
        { pattern: "laravel_session|laravel/framework", vendor: "laravel", product: "Laravel" },
        { pattern: "csrfmiddlewaretoken|django", vendor: "django", product: "Django" },
      ];
      for (const fw of frameworks) {
        if (new RegExp(fw.pattern, "i").test(html)) {
          found.push({ category: "framework", vendor: fw.vendor, product: fw.product, confidence: 75, detectedVia: "html" });
        }
      }
    }
  } catch {
    // HTML analizi başarısız
  }
  return found;
}
