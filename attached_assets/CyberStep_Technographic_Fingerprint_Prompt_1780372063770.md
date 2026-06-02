# CyberStep.io — Technographic Fingerprint Motoru
## Replit Agent Promptu — Müşteri Teknoloji Stack Tespiti

---

## AMAÇ

Her domain taramasında ve lead keşfinde şirketin
teknoloji altyapısını tespit et, kaydet ve satışa
dönüştür.

Tespit edilecekler:
WAF, CDN, e-posta, güvenlik araçları, CMS,
e-ticaret, hosting, SSL otoritesi, açık portlar,
SaaS araçları, geliştirme ortamı, güvenlik olgunluğu.

Bu veriler:
- ISR e-postasını kişiselleştirir
- Doğru servisi otomatik önerir
- Müşteri 360° profilini tamamlar
- Fortinet/M365/Azure entegrasyon satışını kolaylaştırır

---

## BÖLÜM 1: VERİTABANI

```sql
-- Ana technographic tablo
CREATE TABLE IF NOT EXISTS customer_tech_stack (
  id serial PRIMARY KEY,
  domain varchar(255) NOT NULL,
  customer_id integer REFERENCES customers(id),
  lead_candidate_id integer REFERENCES lead_candidates(id),

  -- Teknoloji kategorisi
  category varchar(50) NOT NULL,
  -- 'waf' | 'cdn' | 'mail' | 'mail_security' |
  -- 'cms' | 'ecommerce' | 'webserver' | 'language' |
  -- 'hosting' | 'ssl_ca' | 'analytics' | 'crm' |
  -- 'support' | 'payment' | 'firewall' | 'monitoring' |
  -- 'open_port' | 'dev_environment' | 'hr_tool' |
  -- 'tag_manager' | 'framework' | 'database'

  -- Vendor ve ürün
  vendor varchar(100),
  -- 'cloudflare' | 'microsoft' | 'google' | 'fortinet' vb.
  product varchar(150),
  -- 'Cloudflare WAF' | 'Microsoft 365' | 'WordPress' vb.
  version varchar(50),
  -- Tespit edilebildiğinde: '6.4.2', '8.1', '1.24'

  -- Güven skoru
  confidence integer DEFAULT 50,
  -- 0-100: Kaç farklı sinyalden doğrulandı

  -- Tespit kaynağı
  detected_via varchar(50),
  -- 'header' | 'dns' | 'html' | 'js' | 'shodan' |
  -- 'ssl_cert' | 'whois' | 'port_scan' | 'cookie'

  -- Ham kanıt
  evidence jsonb,
  -- Tam kayıt: hangi header, hangi DNS değeri, vb.

  -- Güvenlik etkisi
  security_risk varchar(20),
  -- 'critical' | 'high' | 'medium' | 'low' | 'none'
  security_note text,
  -- 'Açık port — dışarıdan erişilebilir' vb.

  -- Satış etkisi
  sales_signal varchar(30),
  -- 'upsell_soc' | 'upsell_noc' | 'upsell_m365' |
  -- 'upsell_fortinet' | 'budget_indicator_high' |
  -- 'budget_indicator_low' | 'urgent_risk'

  first_seen_at timestamp DEFAULT now(),
  last_verified_at timestamp DEFAULT now(),
  is_active boolean DEFAULT true,

  UNIQUE(domain, category, vendor, product)
);

CREATE INDEX idx_tech_stack_domain
  ON customer_tech_stack(domain);
CREATE INDEX idx_tech_stack_category
  ON customer_tech_stack(category, vendor);
CREATE INDEX idx_tech_stack_sales
  ON customer_tech_stack(sales_signal)
  WHERE sales_signal IS NOT NULL;

-- Güvenlik olgunluk skoru (hesaplanmış)
CREATE TABLE IF NOT EXISTS customer_security_maturity (
  id serial PRIMARY KEY,
  domain varchar(255) UNIQUE NOT NULL,
  customer_id integer REFERENCES customers(id),
  lead_candidate_id integer REFERENCES lead_candidates(id),

  -- Genel olgunluk skoru 0-100
  maturity_score integer,
  maturity_level varchar(20),
  -- 'low' | 'medium' | 'high' | 'enterprise'

  -- Alt skorlar
  score_email_security integer,
  -- SPF+DKIM+DMARC kombinasyonu
  score_web_security integer,
  -- WAF + TLS + başlıklar
  score_infrastructure integer,
  -- Açık port yok, güncel yazılım
  score_visibility integer,
  -- Monitoring, logging araçları

  -- Otomatik satış önerisi
  recommended_service varchar(100),
  -- 'bundle_full_protection' | 'soc_standart' | vb.
  recommendation_reason text,

  -- Segment
  company_segment varchar(30),
  -- 'startup' | 'sme' | 'mid_market' | 'enterprise'
  segment_signals text[],
  -- Segmenti belirleyen kanıtlar

  calculated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: ANA FİNGERPRİNT ENGİNE

```typescript
// src/technographics/fingerprintEngine.ts
// YENİ DOSYA

import dns from 'dns';
import axios from 'axios';

export async function fingerprintDomain(
  domain: string,
  options: {
    useShodan?: boolean;
    deepScan?: boolean;
    // deepScan=true → JS dosyalarını da parse et
  } = {}
): Promise<TechStack[]> {

  const results: TechStack[] = [];

  // Tüm testleri paralel çalıştır — hız için
  const [
    headerResult,
    dnsResult,
    htmlResult,
    sslResult,
    shodanResult,
  ] = await Promise.allSettled([
    analyzeHeaders(domain),
    analyzeDNS(domain),
    analyzeHTML(domain, options.deepScan),
    analyzeSSL(domain),
    options.useShodan ? analyzeShodan(domain) : Promise.resolve([]),
  ]);

  // Sonuçları birleştir
  for (const result of [headerResult, dnsResult,
      htmlResult, sslResult, shodanResult]) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  // Duplikatleri birleştir — aynı vendor iki kaynaktan
  // gelirse confidence artır
  const merged = mergeAndScore(results);

  // Güvenlik olgunluğunu hesapla
  const maturity = calculateMaturity(merged, domain);

  // Veritabanına kaydet
  await saveTechStack(domain, merged, maturity);

  return merged;
}
```

---

## BÖLÜM 3: HTTP HEADER ANALİZİ

```typescript
// src/technographics/headerAnalyzer.ts

export async function analyzeHeaders(
  domain: string
): Promise<TechStack[]> {

  const found: TechStack[] = [];

  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 8000,
      validateStatus: null,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityBot/1.0)' },
    });

    const h = resp.headers;
    const cookies = (h['set-cookie'] || []).join(' ').toLowerCase();

    // ─── WEB SUNUCU ────────────────────────────────────────
    const server = h['server'] || '';
    if (server) {
      const serverMap: Record<string, [string, string]> = {
        'nginx':     ['nginx', 'nginx'],
        'apache':    ['apache', 'Apache HTTP Server'],
        'iis':       ['microsoft', 'Microsoft IIS'],
        'litespeed': ['litespeed', 'LiteSpeed'],
        'caddy':     ['caddy', 'Caddy'],
        'gunicorn':  ['gunicorn', 'Gunicorn'],
        'openresty': ['openresty', 'OpenResty'],
      };
      for (const [key, [vendor, product]] of Object.entries(serverMap)) {
        if (server.toLowerCase().includes(key)) {
          const version = server.match(/[\d.]+/)?.[0];
          found.push({
            category: 'webserver', vendor, product, version,
            confidence: 90, detectedVia: 'header',
            evidence: { header: 'Server', value: server },
          });
          break;
        }
      }
    }

    // ─── DİL / RUNTIME ─────────────────────────────────────
    const powered = h['x-powered-by'] || '';
    if (powered) {
      const langMap: Record<string, [string, string]> = {
        'php':     ['php', 'PHP'],
        'asp.net': ['microsoft', 'ASP.NET'],
        'express': ['nodejs', 'Node.js/Express'],
        'next.js': ['vercel', 'Next.js'],
        'java':    ['java', 'Java'],
      };
      for (const [key, [vendor, product]] of Object.entries(langMap)) {
        if (powered.toLowerCase().includes(key)) {
          const version = powered.match(/[\d.]+/)?.[0];
          found.push({
            category: 'language', vendor, product, version,
            confidence: 85, detectedVia: 'header',
            evidence: { header: 'X-Powered-By', value: powered },
          });
          break;
        }
      }
    }

    // ─── WAF / CDN (header imzaları) ───────────────────────
    const wafCDNSignatures: Array<{
      check: () => boolean;
      category: string;
      vendor: string;
      product: string;
      confidence: number;
    }> = [
      {
        check: () => !!(h['cf-ray'] || h['cf-cache-status'] ||
          cookies.includes('__cfduid') || cookies.includes('cf_clearance')),
        category: 'cdn', vendor: 'cloudflare', product: 'Cloudflare CDN',
        confidence: 95,
      },
      {
        check: () => !!(h['x-akamai-transformed'] || h['akamai-grn'] ||
          cookies.includes('ak_bmsc')),
        category: 'cdn', vendor: 'akamai', product: 'Akamai', confidence: 90,
      },
      {
        check: () => !!(h['x-amz-cf-id'] || h['x-amz-cf-pop']),
        category: 'cdn', vendor: 'aws', product: 'Amazon CloudFront',
        confidence: 90,
      },
      {
        check: () => !!(h['x-sucuri-id'] || h['x-sucuri-cache']),
        category: 'waf', vendor: 'sucuri', product: 'Sucuri WAF',
        confidence: 90,
      },
      {
        check: () => !!(h['x-iinfo'] || cookies.includes('incap_ses')),
        category: 'waf', vendor: 'imperva', product: 'Imperva Incapsula',
        confidence: 88,
      },
      {
        check: () => !!(h['x-wa-info'] || cookies.includes('bigipserver')),
        category: 'waf', vendor: 'f5', product: 'F5 BIG-IP', confidence: 85,
      },
    ];

    for (const sig of wafCDNSignatures) {
      if (sig.check()) {
        found.push({
          category: sig.category, vendor: sig.vendor,
          product: sig.product, confidence: sig.confidence,
          detectedVia: 'header', evidence: { headers: Object.keys(h) },
          salesSignal: sig.category === 'waf' ? 'waf_detected' : undefined,
        });
      }
    }

    // ─── GÜVENLİK BAŞLIKLARI (eksiklik tespiti) ────────────
    const securityHeaders = {
      'strict-transport-security': 'HSTS',
      'content-security-policy': 'CSP',
      'x-frame-options': 'X-Frame-Options',
      'x-content-type-options': 'X-Content-Type-Options',
      'referrer-policy': 'Referrer-Policy',
      'permissions-policy': 'Permissions-Policy',
    };

    for (const [header, name] of Object.entries(securityHeaders)) {
      if (!h[header]) {
        found.push({
          category: 'missing_header', vendor: 'none',
          product: `${name} Eksik`, confidence: 100,
          detectedVia: 'header',
          securityRisk: header === 'content-security-policy' ? 'high' : 'medium',
          securityNote: `${name} başlığı yapılandırılmamış`,
          evidence: { missingHeader: header },
        });
      }
    }

  } catch (e) {
    // Header analizi başarısız — diğer analizler devam eder
  }

  return found;
}
```

---

## BÖLÜM 4: DNS ANALİZİ

```typescript
// src/technographics/dnsAnalyzer.ts

export async function analyzeDNS(
  domain: string
): Promise<TechStack[]> {

  const found: TechStack[] = [];

  try {
    // MX kayıtları — e-posta sağlayıcısı
    const mxRecords = await dns.promises.resolveMx(domain)
      .catch(() => []);

    const mxString = mxRecords.map(m => m.exchange).join(' ').toLowerCase();

    const mailProviders: Array<{
      pattern: string;
      vendor: string;
      product: string;
      salesSignal: string;
    }> = [
      {
        pattern: 'google', vendor: 'google',
        product: 'Google Workspace',
        salesSignal: 'has_google_workspace',
      },
      {
        pattern: 'outlook.com|protection.outlook|mail.protection',
        vendor: 'microsoft',
        product: 'Microsoft 365',
        salesSignal: 'has_microsoft365',
      },
      {
        pattern: 'yandex', vendor: 'yandex',
        product: 'Yandex Mail',
        salesSignal: 'budget_indicator_low',
      },
      {
        pattern: 'zoho', vendor: 'zoho',
        product: 'Zoho Mail',
        salesSignal: 'budget_indicator_medium',
      },
      {
        pattern: 'pphosted|proofpoint', vendor: 'proofpoint',
        product: 'Proofpoint Email Security',
        salesSignal: 'budget_indicator_high',
      },
      {
        pattern: 'mimecast', vendor: 'mimecast',
        product: 'Mimecast',
        salesSignal: 'budget_indicator_high',
      },
      {
        pattern: 'barracudanetworks', vendor: 'barracuda',
        product: 'Barracuda Email Security',
        salesSignal: 'budget_indicator_high',
      },
    ];

    for (const provider of mailProviders) {
      const regex = new RegExp(provider.pattern, 'i');
      if (regex.test(mxString)) {
        found.push({
          category: 'mail', vendor: provider.vendor,
          product: provider.product, confidence: 98,
          detectedVia: 'dns',
          salesSignal: provider.salesSignal,
          evidence: { mxRecords: mxRecords.map(m => m.exchange) },
        });
        break;
      }
    }

    // TXT kayıtları — SPF, DKIM, DMARC, doğrulama
    const txtRecords = await dns.promises.resolveTxt(domain)
      .catch(() => [] as string[][]);
    const txtFlat = txtRecords.flat().join('\n').toLowerCase();

    // SPF analizi
    if (txtFlat.includes('v=spf1')) {
      const spfLine = txtRecords.flat()
        .find(t => t.startsWith('v=spf1')) || '';

      // SPF'ten e-posta servisi tespit
      if (spfLine.includes('_spf.google.com')) {
        found.push({
          category: 'mail', vendor: 'google',
          product: 'Google Workspace (SPF)', confidence: 95,
          detectedVia: 'dns',
          evidence: { spf: spfLine },
        });
      }
      if (spfLine.includes('spf.protection.outlook')) {
        found.push({
          category: 'mail', vendor: 'microsoft',
          product: 'Microsoft 365 (SPF)', confidence: 95,
          detectedVia: 'dns',
          evidence: { spf: spfLine },
        });
      }
      if (spfLine.includes('sendgrid') || spfLine.includes('em.amazonaws')) {
        found.push({
          category: 'mail_marketing', vendor: 'sendgrid',
          product: 'SendGrid / Transactional Email', confidence: 85,
          detectedVia: 'dns',
          evidence: { spf: spfLine },
        });
      }
    }

    // DMARC
    const dmarcRecords = await dns.promises
      .resolveTxt(`_dmarc.${domain}`)
      .catch(() => [] as string[][]);
    const dmarcFlat = dmarcRecords.flat().join('').toLowerCase();
    if (dmarcFlat.includes('v=dmarc1')) {
      const policy = dmarcFlat.match(/p=(none|quarantine|reject)/)?.[1];
      found.push({
        category: 'mail_security', vendor: 'dmarc',
        product: `DMARC (p=${policy || 'unknown'})`,
        confidence: 100, detectedVia: 'dns',
        securityNote: policy === 'reject' ? 'Tam koruma' :
          policy === 'quarantine' ? 'Kısmi koruma' : 'Koruma yok (none)',
        securityRisk: policy === 'none' ? 'high' : 'low',
        evidence: { dmarc: dmarcFlat },
      });
    }

    // NS kayıtları — DNS sağlayıcısı
    const nsRecords = await dns.promises.resolveNs(domain)
      .catch(() => [] as string[]);
    const nsString = nsRecords.join(' ').toLowerCase();

    const dnsProviders: Record<string, [string, string]> = {
      'cloudflare': ['cloudflare', 'Cloudflare DNS'],
      'awsdns':     ['aws', 'AWS Route53'],
      'azure-dns':  ['microsoft', 'Azure DNS'],
      'dnsmadeeasy': ['dnsmadeeasy', 'DNS Made Easy'],
      'natro':      ['natro', 'Natro DNS'],
      'isimtescil': ['isimtescil', 'İsimtescil DNS'],
    };

    for (const [pattern, [vendor, product]] of Object.entries(dnsProviders)) {
      if (nsString.includes(pattern)) {
        found.push({
          category: 'dns_provider', vendor, product,
          confidence: 95, detectedVia: 'dns',
          evidence: { nsRecords },
        });
        break;
      }
    }

  } catch (e) {
    // DNS analizi başarısız
  }

  return found;
}
```

---

## BÖLÜM 5: HTML / JS ANALİZİ

```typescript
// src/technographics/htmlAnalyzer.ts

export async function analyzeHTML(
  domain: string,
  deepScan: boolean = false
): Promise<TechStack[]> {

  const found: TechStack[] = [];

  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 10000, validateStatus: null,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const html = (resp.data || '').toString();
    const htmlLower = html.toLowerCase();

    // ─── CMS TESPİTİ ───────────────────────────────────────
    const cmsPatterns: Array<{
      patterns: string[];
      vendor: string;
      product: string;
      versionRegex?: RegExp;
    }> = [
      {
        patterns: ['wp-content/', 'wp-includes/', 'wordpress'],
        vendor: 'wordpress', product: 'WordPress',
        versionRegex: /wordpress\s+([\d.]+)/i,
      },
      {
        patterns: ['/sites/default/files/', 'drupal.js', 'drupal'],
        vendor: 'drupal', product: 'Drupal',
        versionRegex: /drupal\s+([\d.]+)/i,
      },
      {
        patterns: ['/administrator/index.php', 'joomla'],
        vendor: 'joomla', product: 'Joomla',
      },
      {
        patterns: ['ghost-url', 'ghost.io', 'content/ghost'],
        vendor: 'ghost', product: 'Ghost CMS',
      },
    ];

    for (const cms of cmsPatterns) {
      if (cms.patterns.some(p => htmlLower.includes(p))) {
        const version = cms.versionRegex
          ? (html.match(cms.versionRegex)?.[1])
          : undefined;
        found.push({
          category: 'cms', vendor: cms.vendor,
          product: cms.product, version,
          confidence: 85, detectedVia: 'html',
          evidence: { matchedPatterns: cms.patterns.filter(p => htmlLower.includes(p)) },
        });
        break;
      }
    }

    // ─── TÜRKİYE'YE ÖZGÜ E-TİCARET ────────────────────────
    const trEcommerce: Array<{
      pattern: string; vendor: string; product: string;
    }> = [
      { pattern: 'ideasoft', vendor: 'ideasoft', product: 'İdeasoft' },
      { pattern: 'tsoft', vendor: 'tsoft', product: 'T-Soft' },
      { pattern: 'ikas', vendor: 'ikas', product: 'İkas' },
      { pattern: 'faprika', vendor: 'faprika', product: 'Faprika' },
      { pattern: 'woocommerce', vendor: 'woocommerce', product: 'WooCommerce' },
      { pattern: 'shopify', vendor: 'shopify', product: 'Shopify' },
      { pattern: 'magento', vendor: 'adobe', product: 'Adobe Commerce / Magento' },
      { pattern: 'opencart', vendor: 'opencart', product: 'OpenCart' },
      { pattern: 'prestashop', vendor: 'prestashop', product: 'PrestaShop' },
    ];

    for (const ec of trEcommerce) {
      if (htmlLower.includes(ec.pattern)) {
        found.push({
          category: 'ecommerce', vendor: ec.vendor,
          product: ec.product, confidence: 80,
          detectedVia: 'html',
          salesSignal: 'is_ecommerce',
          evidence: { pattern: ec.pattern },
        });
        break;
      }
    }

    // ─── ANALİTİK ARAÇLAR ──────────────────────────────────
    const analytics: Array<{
      pattern: RegExp | string;
      vendor: string; product: string;
    }> = [
      { pattern: 'google-analytics.com|gtag/js|UA-', vendor: 'google', product: 'Google Analytics' },
      { pattern: 'googletagmanager.com|gtm.js', vendor: 'google', product: 'Google Tag Manager' },
      { pattern: 'mc.yandex.ru|yandex_metrika', vendor: 'yandex', product: 'Yandex Metrica' },
      { pattern: 'hotjar.com|hjid', vendor: 'hotjar', product: 'Hotjar' },
      { pattern: 'clarity.ms|microsoft_clarity', vendor: 'microsoft', product: 'Microsoft Clarity' },
      { pattern: 'segment.com/analytics', vendor: 'segment', product: 'Segment' },
      { pattern: 'mixpanel.com', vendor: 'mixpanel', product: 'Mixpanel' },
    ];

    for (const tool of analytics) {
      const pattern = tool.pattern instanceof RegExp
        ? tool.pattern : new RegExp(tool.pattern, 'i');
      if (pattern.test(html)) {
        found.push({
          category: 'analytics', vendor: tool.vendor,
          product: tool.product, confidence: 90,
          detectedVia: 'html',
          evidence: { pattern: tool.pattern.toString() },
        });
      }
    }

    // ─── DESTEK / CHAT ARAÇLARI ─────────────────────────────
    const supportTools: Array<{
      pattern: string; vendor: string; product: string;
      salesSignal?: string;
    }> = [
      { pattern: 'zendesk.com|zdassets', vendor: 'zendesk',
        product: 'Zendesk', salesSignal: 'budget_indicator_high' },
      { pattern: 'intercom.io|intercomSettings', vendor: 'intercom',
        product: 'Intercom', salesSignal: 'budget_indicator_high' },
      { pattern: 'freshdesk.com|freshchat', vendor: 'freshworks',
        product: 'Freshdesk', salesSignal: 'budget_indicator_medium' },
      { pattern: 'tawk.to', vendor: 'tawkto',
        product: 'Tawk.to', salesSignal: 'budget_indicator_low' },
      { pattern: 'crisp.chat', vendor: 'crisp',
        product: 'Crisp', salesSignal: 'budget_indicator_low' },
      { pattern: 'livechatinc.com', vendor: 'livechat',
        product: 'LiveChat', salesSignal: 'budget_indicator_medium' },
    ];

    for (const tool of supportTools) {
      if (htmlLower.includes(tool.pattern.split('|')[0]) ||
          (tool.pattern.includes('|') &&
           htmlLower.includes(tool.pattern.split('|')[1]))) {
        found.push({
          category: 'support', vendor: tool.vendor,
          product: tool.product, confidence: 85,
          detectedVia: 'html', salesSignal: tool.salesSignal,
        });
      }
    }

    // ─── CRM / PAZARLAMA ───────────────────────────────────
    const crmTools: Array<{
      pattern: string; vendor: string; product: string;
      signal: string;
    }> = [
      { pattern: 'hubspot.com|hs-scripts', vendor: 'hubspot',
        product: 'HubSpot', signal: 'budget_indicator_high' },
      { pattern: 'salesforce.com|pardot', vendor: 'salesforce',
        product: 'Salesforce', signal: 'budget_indicator_enterprise' },
      { pattern: 'mailchimp.com', vendor: 'mailchimp',
        product: 'Mailchimp', signal: 'budget_indicator_medium' },
      { pattern: 'klaviyo.com', vendor: 'klaviyo',
        product: 'Klaviyo', signal: 'is_ecommerce' },
      { pattern: 'activecampaign.com', vendor: 'activecampaign',
        product: 'ActiveCampaign', signal: 'budget_indicator_medium' },
    ];

    for (const tool of crmTools) {
      if (htmlLower.includes(tool.pattern.split('|')[0]) ||
          (tool.pattern.includes('|') &&
           htmlLower.includes(tool.pattern.split('|')[1]))) {
        found.push({
          category: 'crm', vendor: tool.vendor,
          product: tool.product, confidence: 82,
          detectedVia: 'html', salesSignal: tool.signal,
        });
      }
    }

    // ─── ÖDEME SİSTEMİ ─────────────────────────────────────
    const paymentTools: Array<{
      pattern: string; vendor: string; product: string;
    }> = [
      { pattern: 'iyzipay.com|iyzico', vendor: 'iyzico', product: 'Iyzico' },
      { pattern: 'paytr.com', vendor: 'paytr', product: 'PayTR' },
      { pattern: 'stripe.com', vendor: 'stripe', product: 'Stripe' },
      { pattern: 'paypal.com', vendor: 'paypal', product: 'PayPal' },
      { pattern: 'param.com.tr', vendor: 'param', product: 'Param' },
      { pattern: 'garantipay', vendor: 'garanti', product: 'GarantiPay' },
    ];

    for (const tool of paymentTools) {
      if (htmlLower.includes(tool.pattern.split('|')[0])) {
        found.push({
          category: 'payment', vendor: tool.vendor,
          product: tool.product, confidence: 88,
          detectedVia: 'html',
          salesSignal: 'has_payment_system',
          evidence: { pattern: tool.pattern },
        });
      }
    }

    // ─── GELİŞTİRME FRAMEWORK'LERİ ─────────────────────────
    if (deepScan) {
      const frameworks: Array<{
        pattern: string; vendor: string; product: string;
      }> = [
        { pattern: '__next/static|__nextjs', vendor: 'vercel', product: 'Next.js' },
        { pattern: 'nuxt.js|__nuxt', vendor: 'nuxt', product: 'Nuxt.js' },
        { pattern: 'react_root|react.development', vendor: 'meta', product: 'React' },
        { pattern: 'vuejs|vue.runtime', vendor: 'vue', product: 'Vue.js' },
        { pattern: 'angular.js|ng-version', vendor: 'google', product: 'Angular' },
        { pattern: 'laravel_session|laravel/framework', vendor: 'laravel', product: 'Laravel' },
        { pattern: 'csrfmiddlewaretoken|django', vendor: 'django', product: 'Django' },
      ];

      for (const fw of frameworks) {
        if (htmlLower.includes(fw.pattern.split('|')[0]) ||
            (fw.pattern.includes('|') &&
             htmlLower.includes(fw.pattern.split('|')[1]))) {
          found.push({
            category: 'framework', vendor: fw.vendor,
            product: fw.product, confidence: 75,
            detectedVia: 'html',
          });
        }
      }
    }

  } catch (e) {
    // HTML analizi başarısız
  }

  return found;
}
```

---

## BÖLÜM 6: SSL ANALİZİ

```typescript
// src/technographics/sslAnalyzer.ts

export async function analyzeSSL(
  domain: string
): Promise<TechStack[]> {

  const found: TechStack[] = [];

  try {
    const resp = await axios.get(`https://${domain}`, {
      timeout: 8000, validateStatus: null,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      }),
    });

    const cert = (resp.request as any)?.socket?.getPeerCertificate(true);
    if (!cert) return found;

    // ─── SSL OTORİTESİ → BÜTÇESİ GÖSTERGESI ───────────────
    const issuer = (cert.issuer?.O || '').toLowerCase();
    const caMap: Record<string, {
      vendor: string; product: string;
      signal: string; note: string;
    }> = {
      "let's encrypt": {
        vendor: 'letsencrypt', product: "Let's Encrypt (DV)",
        signal: 'budget_indicator_low',
        note: 'Ücretsiz sertifika — maliyet odaklı',
      },
      'zerossl': {
        vendor: 'zerossl', product: 'ZeroSSL (DV)',
        signal: 'budget_indicator_low',
        note: 'Ücretsiz/düşük maliyetli sertifika',
      },
      'digicert': {
        vendor: 'digicert', product: 'DigiCert (OV/EV)',
        signal: 'budget_indicator_high',
        note: 'Kurumsal sertifika — bütçe var',
      },
      'comodo': {
        vendor: 'comodo', product: 'Comodo/Sectigo',
        signal: 'budget_indicator_medium',
        note: 'Orta ölçekli sertifika',
      },
      'globalsign': {
        vendor: 'globalsign', product: 'GlobalSign (EV)',
        signal: 'budget_indicator_high',
        note: 'Kurumsal EV sertifika — bütçe yüksek',
      },
      'entrust': {
        vendor: 'entrust', product: 'Entrust (EV)',
        signal: 'budget_indicator_enterprise',
        note: 'Enterprise sertifika',
      },
    };

    for (const [pattern, info] of Object.entries(caMap)) {
      if (issuer.includes(pattern)) {
        found.push({
          category: 'ssl_ca', vendor: info.vendor,
          product: info.product, confidence: 100,
          detectedVia: 'ssl_cert',
          salesSignal: info.signal,
          securityNote: info.note,
          evidence: { issuer: cert.issuer?.O, subject: cert.subject?.O },
        });
        break;
      }
    }

    // ─── SERTİFİKA ORGANİZASYONU → ŞİRKET ADI ─────────────
    const certOrg = cert.subject?.O;
    if (certOrg && certOrg.length > 2) {
      found.push({
        category: 'company_name_from_cert', vendor: 'ssl',
        product: certOrg, confidence: 85,
        detectedVia: 'ssl_cert',
        evidence: { certSubject: cert.subject },
      });
    }

    // ─── CLOUDFLARE CDN (SSL imzasından) ───────────────────
    const certCN = cert.subject?.CN || '';
    if (certCN.includes('cloudflare') || issuer.includes('cloudflare')) {
      found.push({
        category: 'cdn', vendor: 'cloudflare',
        product: 'Cloudflare CDN', confidence: 95,
        detectedVia: 'ssl_cert',
      });
    }

    // ─── TLS VERSİYONU ─────────────────────────────────────
    const tlsVersion = (resp.request as any)?.socket?.getProtocol?.();
    if (tlsVersion) {
      const isOld = ['TLSv1', 'TLSv1.1'].includes(tlsVersion);
      if (isOld) {
        found.push({
          category: 'tls_version', vendor: 'tls',
          product: `TLS Eski Versiyon (${tlsVersion})`,
          confidence: 95, detectedVia: 'ssl_cert',
          securityRisk: 'high',
          securityNote: `${tlsVersion} destekleniyor — güncel değil`,
        });
      }
    }

  } catch (e) {
    // SSL analizi başarısız
  }

  return found;
}
```

---

## BÖLÜM 7: SHODAN ANALİZİ

```typescript
// src/technographics/shodanAnalyzer.ts

export async function analyzeShodan(
  domain: string
): Promise<TechStack[]> {

  if (!process.env.SHODAN_API_KEY) return [];

  const found: TechStack[] = [];

  try {
    // IP'den Shodan verisi çek
    const ips = await dns.promises.resolve4(domain).catch(() => []);
    if (!ips.length) return found;

    const resp = await axios.get(
      `https://api.shodan.io/shodan/host/${ips[0]}`,
      {
        params: { key: process.env.SHODAN_API_KEY },
        timeout: 10000,
      }
    );

    const data = resp.data;

    // ─── HOSTİNG SAĞLAYICI (ASN/ISP) ───────────────────────
    const org = (data.org || '').toLowerCase();
    const isp = (data.isp || '').toLowerCase();

    const hostingMap: Record<string, [string, string, string]> = {
      'amazon':      ['aws', 'Amazon AWS', 'budget_indicator_high'],
      'microsoft':   ['azure', 'Microsoft Azure', 'budget_indicator_high'],
      'google':      ['gcp', 'Google Cloud', 'budget_indicator_high'],
      'hetzner':     ['hetzner', 'Hetzner', 'budget_indicator_medium'],
      'digitalocean':['digitalocean', 'DigitalOcean', 'budget_indicator_medium'],
      'turkcell':    ['turkcell', 'Turkcell Bulut', 'budget_indicator_high'],
      'türk telekom':['tt', 'Türk Telekom', 'budget_indicator_medium'],
      'superonline': ['superonline', 'Superonline', 'budget_indicator_medium'],
      'natro':       ['natro', 'Natro Hosting', 'budget_indicator_low'],
      'hostinger':   ['hostinger', 'Hostinger', 'budget_indicator_low'],
    ];

    for (const [pattern, [vendor, product, signal]] of Object.entries(hostingMap)) {
      if (org.includes(pattern) || isp.includes(pattern)) {
        found.push({
          category: 'hosting', vendor, product,
          confidence: 88, detectedVia: 'shodan',
          salesSignal: signal,
          evidence: { org: data.org, isp: data.isp, asn: data.asn },
        });
        break;
      }
    }

    // ─── AÇIK PORTLAR → GÜVENLİK AÇIĞI ────────────────────
    const dangerousPorts: Record<number, {
      product: string; risk: string; note: string;
    }> = {
      22:    { product: 'SSH Açık',        risk: 'medium', note: 'SSH dışarıdan erişilebilir — brute force riski' },
      23:    { product: 'Telnet Açık',     risk: 'critical', note: 'Telnet şifresiz protokol — kritik risk' },
      3389:  { product: 'RDP Açık',        risk: 'critical', note: 'RDP internete açık — ransomware giriş noktası' },
      3306:  { product: 'MySQL Açık',      risk: 'critical', note: 'MySQL dışarıdan erişilebilir — veri sızıntısı riski' },
      5432:  { product: 'PostgreSQL Açık', risk: 'critical', note: 'PostgreSQL dışarıdan erişilebilir' },
      27017: { product: 'MongoDB Açık',    risk: 'critical', note: 'MongoDB şifresiz erişilebilir — veri sızıntısı' },
      6379:  { product: 'Redis Açık',      risk: 'critical', note: 'Redis şifresiz erişilebilir' },
      9200:  { product: 'Elasticsearch Açık', risk: 'critical', note: 'Elasticsearch herkese açık — veri sızıntısı' },
      8080:  { product: 'HTTP Alt Port',   risk: 'medium', note: 'Alternatif HTTP portu açık' },
      8443:  { product: 'HTTPS Alt Port',  risk: 'low', note: 'Alternatif HTTPS portu' },
      445:   { product: 'SMB Açık',        risk: 'critical', note: 'SMB internete açık — WannaCry risk vektörü' },
      1433:  { product: 'MSSQL Açık',      risk: 'critical', note: 'MSSQL dışarıdan erişilebilir' },
    };

    for (const portData of data.ports || []) {
      const danger = dangerousPorts[portData];
      if (danger) {
        found.push({
          category: 'open_port', vendor: 'network',
          product: danger.product, confidence: 100,
          detectedVia: 'shodan',
          securityRisk: danger.risk as any,
          securityNote: danger.note,
          salesSignal: 'urgent_risk',
          evidence: { port: portData, ip: ips[0] },
        });
      }
    }

    // ─── AĞ ÜRÜNÜ TESPİTİ (FortiGate, Cisco vb.) ──────────
    for (const service of data.data || []) {
      const product = (service.product || '').toLowerCase();
      const banner = (service.data || '').toLowerCase();

      const networkProducts: Array<{
        pattern: string; vendor: string; product: string;
      }> = [
        { pattern: 'fortinet|fortigate', vendor: 'fortinet', product: 'FortiGate' },
        { pattern: 'palo alto|pan-os', vendor: 'paloalto', product: 'Palo Alto' },
        { pattern: 'cisco asa|cisco ios', vendor: 'cisco', product: 'Cisco' },
        { pattern: 'juniper|junos', vendor: 'juniper', product: 'Juniper' },
        { pattern: 'checkpoint', vendor: 'checkpoint', product: 'Check Point' },
        { pattern: 'sophos xg', vendor: 'sophos', product: 'Sophos XG' },
        { pattern: 'mikrotik|routeros', vendor: 'mikrotik', product: 'MikroTik' },
      ];

      for (const np of networkProducts) {
        const regex = new RegExp(np.pattern, 'i');
        if (regex.test(product) || regex.test(banner)) {
          found.push({
            category: 'firewall', vendor: np.vendor,
            product: np.product, version: service.version,
            confidence: 90, detectedVia: 'shodan',
            salesSignal: np.vendor === 'fortinet'
              ? 'has_fortinet' : 'has_network_device',
            evidence: { port: service.port, product: service.product },
          });
          break;
        }
      }
    }

  } catch (e) {
    // Shodan analizi başarısız — kritik değil
  }

  return found;
}
```

---

## BÖLÜM 8: GÜVENLİK OLGUNLUK SKORU

```typescript
// src/technographics/maturityCalculator.ts

export function calculateMaturity(
  stack: TechStack[],
  domain: string
): MaturityResult {

  // Alt skorlar
  let emailScore = 0;
  let webScore = 0;
  let infraScore = 100; // Açık port yoksa 100'den başla
  let visibilityScore = 0;

  // E-posta güvenliği (maks 100)
  if (stack.find(s => s.category === 'mail_security' &&
      s.vendor === 'dmarc')) {
    const dmarc = stack.find(s => s.vendor === 'dmarc');
    if (dmarc?.product.includes('reject')) emailScore += 50;
    else if (dmarc?.product.includes('quarantine')) emailScore += 30;
    else emailScore += 10;
  }
  if (stack.find(s => s.category === 'mail_security' &&
      s.product.toLowerCase().includes('spf'))) emailScore += 25;
  if (stack.find(s => s.category === 'mail_security' &&
      s.product.toLowerCase().includes('dkim'))) emailScore += 25;
  // E-posta güvenlik aracı
  if (stack.find(s => ['proofpoint', 'mimecast', 'barracuda']
      .includes(s.vendor))) emailScore = Math.min(emailScore + 20, 100);

  // Web güvenliği (maks 100)
  if (stack.find(s => s.category === 'waf')) webScore += 35;
  if (stack.find(s => s.category === 'cdn')) webScore += 15;
  const missingHeaders = stack.filter(s => s.category === 'missing_header');
  webScore += Math.max(0, 35 - missingHeaders.length * 7);
  if (stack.find(s => s.category === 'tls_version' &&
      s.securityRisk === 'high')) webScore -= 20;
  const sslCA = stack.find(s => s.category === 'ssl_ca');
  if (sslCA?.salesSignal === 'budget_indicator_high') webScore += 15;

  // Altyapı güvenliği (maks 100)
  const criticalPorts = stack.filter(s =>
    s.category === 'open_port' && s.securityRisk === 'critical');
  infraScore -= criticalPorts.length * 25;
  const mediumPorts = stack.filter(s =>
    s.category === 'open_port' && s.securityRisk === 'medium');
  infraScore -= mediumPorts.length * 10;
  infraScore = Math.max(0, infraScore);

  // Görünürlük (maks 100)
  if (stack.find(s => s.category === 'analytics')) visibilityScore += 30;
  if (stack.find(s => s.category === 'support')) visibilityScore += 25;
  if (stack.find(s => s.category === 'crm')) visibilityScore += 25;
  if (stack.find(s => s.category === 'monitoring')) visibilityScore += 20;

  const overall = Math.round(
    emailScore * 0.30 +
    webScore * 0.35 +
    infraScore * 0.25 +
    visibilityScore * 0.10
  );

  const level = overall >= 80 ? 'enterprise'
    : overall >= 60 ? 'high'
    : overall >= 35 ? 'medium'
    : 'low';

  // Segment tespiti
  const segment = determineSegment(stack);

  // Otomatik servis önerisi
  const recommendation = buildRecommendation(stack, overall, segment);

  return {
    maturityScore: overall,
    maturityLevel: level,
    scoreEmail: emailScore,
    scoreWeb: webScore,
    scoreInfra: infraScore,
    scoreVisibility: visibilityScore,
    companySegment: segment.name,
    segmentSignals: segment.signals,
    recommendedService: recommendation.service,
    recommendationReason: recommendation.reason,
  };
}

function determineSegment(stack: TechStack[]): {
  name: string; signals: string[]
} {
  const signals: string[] = [];

  // Enterprise sinyalleri
  const isEnterprise =
    stack.some(s => s.vendor === 'salesforce') ||
    stack.some(s => s.salesSignal === 'budget_indicator_enterprise') ||
    stack.some(s => ['f5', 'akamai', 'proofpoint'].includes(s.vendor));

  if (isEnterprise) {
    if (stack.some(s => s.vendor === 'salesforce')) signals.push('Salesforce CRM');
    if (stack.some(s => s.vendor === 'akamai')) signals.push('Akamai CDN');
    return { name: 'enterprise', signals };
  }

  // Mid-market
  const isMidMarket =
    stack.some(s => s.salesSignal === 'budget_indicator_high') ||
    stack.some(s => ['zendesk', 'hubspot'].includes(s.vendor)) ||
    stack.some(s => s.vendor === 'digicert');

  if (isMidMarket) {
    if (stack.some(s => s.vendor === 'hubspot')) signals.push('HubSpot CRM');
    if (stack.some(s => s.vendor === 'zendesk')) signals.push('Zendesk Support');
    return { name: 'mid_market', signals };
  }

  // SME
  return { name: 'sme', signals: ['Let\'s Encrypt veya küçük CA'] };
}

function buildRecommendation(
  stack: TechStack[],
  score: number,
  segment: { name: string },
): { service: string; reason: string } {

  // Kritik açık port → acil satış
  if (stack.some(s => s.category === 'open_port' &&
      s.securityRisk === 'critical')) {
    return {
      service: 'full_assessment',
      reason: 'Kritik açık port tespit edildi — acil değerlendirme',
    };
  }

  // FortiGate → SOC entegrasyon satışı
  if (stack.some(s => s.vendor === 'fortinet')) {
    return {
      service: 'bundle_soc_noc_standart',
      reason: 'FortiGate mevcut — SOC+NOC Fabric entegrasyonu önerilir',
    };
  }

  // Microsoft 365 → M365 SOC entegrasyonu
  if (stack.some(s => s.vendor === 'microsoft' && s.category === 'mail')) {
    return {
      service: 'soc_standart',
      reason: 'Microsoft 365 mevcut — M365 log entegrasyonu ile SOC',
    };
  }

  // Düşük olgunluk → temel paket
  if (score < 35) {
    return {
      service: 'bundle_starter',
      reason: 'Güvenlik olgunluğu düşük — Başlangıç Paketi önerilir',
    };
  }

  // E-ticaret → ödeme güvenliği vurgusu
  if (stack.some(s => s.category === 'ecommerce')) {
    return {
      service: 'bundle_full_protection',
      reason: 'E-ticaret sitesi — müşteri verisi ve ödeme güvenliği kritik',
    };
  }

  return {
    service: 'bundle_full_protection',
    reason: 'Kapsamlı güvenlik değerlendirmesi önerilir',
  };
}
```

---

## BÖLÜM 9: MEVCUT TARAMA AKIŞINA ENTEGRASYON

```typescript
// Domain tarama motorundaki ana fonksiyonu bul
// Tarama bittikten sonra, sonuçlar kaydedilirken şunu ekle:

import { fingerprintDomain } from './technographics/fingerprintEngine';

// Tarama tamamlandıktan SONRA:
const techStack = await fingerprintDomain(domain, {
  useShodan: !!process.env.SHODAN_API_KEY,
  deepScan: false, // Hızlı taramalarda false
});

// Domain scan sonucunu güncelle
await db.update(domainScans).set({
  techStackDetected: techStack.length > 0,
  techStackCount: techStack.length,
  securityMaturityScore: maturity.maturityScore,
  securityMaturityLevel: maturity.maturityLevel,
  recommendedService: maturity.recommendedService,
}).where(eq(domainScans.id, scanId));

// Lead candidate güncelle (lead taramasıysa)
if (leadCandidateId) {
  const companyFromCert = techStack.find(
    s => s.category === 'company_name_from_cert'
  );
  await db.update(leadCandidates).set({
    companyName: sql`COALESCE(lead_candidates.company_name, ${companyFromCert?.product})`,
    hasFortigate: techStack.some(s => s.vendor === 'fortinet'),
  }).where(eq(leadCandidates.id, leadCandidateId));
}
```

---

## BÖLÜM 10: ISR KİŞİSELLEŞTİRME

```typescript
// src/isr/techStackPersonalizer.ts
// Teaser e-postasını tech stack'e göre kişiselleştir

export function buildPersonalizedISRContext(
  stack: TechStack[],
  maturity: MaturityResult
): string {

  const lines: string[] = [];

  // Mail sağlayıcı
  const mail = stack.find(s => s.category === 'mail');
  if (mail?.vendor === 'microsoft') {
    lines.push('Microsoft 365 kullanıcısı — Azure Monitor + M365 SOC entegrasyonu önerilebilir');
  } else if (mail?.vendor === 'google') {
    lines.push('Google Workspace kullanıcısı — Google Admin log entegrasyonu önerilebilir');
  }

  // FortiGate
  if (stack.some(s => s.vendor === 'fortinet')) {
    lines.push('FortiGate tespit edildi — Fortinet Fabric SOC entegrasyonu ana argüman');
  }

  // Kritik portlar
  const critPorts = stack.filter(s =>
    s.category === 'open_port' && s.securityRisk === 'critical');
  if (critPorts.length > 0) {
    lines.push(`KRİTİK: ${critPorts.map(p => p.product).join(', ')} — e-postada direkt belirt`);
  }

  // WAF
  const waf = stack.find(s => s.category === 'waf');
  if (waf) {
    lines.push(`${waf.product} WAF aktif — CVE risklerini buna göre ayarla`);
  }

  // Bütçe sinyali
  if (maturity.companySegment === 'enterprise') {
    lines.push('Enterprise segment — SOC Pro / Kurumsal paket öner');
  } else if (maturity.companySegment === 'mid_market') {
    lines.push('Mid-market segment — SOC Standart / Tam Koruma Paketi öner');
  }

  // E-ticaret
  if (stack.some(s => s.category === 'ecommerce')) {
    const platform = stack.find(s => s.category === 'ecommerce');
    lines.push(`E-ticaret: ${platform?.product} — ödeme güvenliği ve müşteri verisi vurgula`);
  }

  return lines.join('\n');
}
```

---

## BÖLÜM 11: ADMİN DASHBOARD

```
/admin-panel/tech-intelligence

─── GENEL BAKIŞ ─────────────────────────────────────────────
Toplam analiz edilen domain: 892
Cloudflare WAF kullanan:     234  (%26)
Microsoft 365 kullanan:      312  (%35)
Google Workspace kullanan:   198  (%22)
FortiGate tespit edilen:      67  (%8)
Kritik açık port olan:        45  (%5) ← FIYAT KRİTİK

─── SATIŞA HAZIR SEGMENTLER ─────────────────────────────────
FortiGate + M365 (SOC+NOC hedef): 23 şirket
  [Listeyi Gör] [ISR Kampanyası Başlat]

Kritik Açık Port (Acil Risk): 45 şirket
  [Listeyi Gör] [Teaser Gönder]

Enterprise Segment (Salesforce/Akamai): 18 şirket
  [Listeyi Gör] [Manuel Outreach]

─── DOMAIN DETAYI ───────────────────────────────────────────
Domain: acme.com.tr
Olgunluk: 42/100 — ORTA

Teknoloji stack'i:
  📧 Microsoft 365 (MX kayıtlarından, %98)
  🛡️ Cloudflare WAF + CDN (%95)
  📝 WordPress 6.4 (%85)
  🔓 RDP Port 3389 Açık — KRİTİK (%100)
  📊 Google Analytics 4 (%90)
  🏦 SSL: Let's Encrypt — bütçe odaklı (%100)
  ❌ DMARC eksik
  ❌ CSP başlığı eksik

Otomatik Öneri: SOC Standart
Sebep: Microsoft 365 + FortiGate yok →
       M365 log entegrasyonu ile SOC Standart öner

[Teaser Üret] [ISR'a Ekle] [Manuel Düzenle]
```

---

## BÖLÜM 12: API ROTALAR

```
GET  /api/admin/tech-stack/:domain      — Domain stack detayı
GET  /api/admin/tech-stack/stats        — Genel istatistikler
GET  /api/admin/tech-stack/segments     — Segment bazlı gruplar
GET  /api/admin/tech-stack/by-vendor    — Vendor bazlı liste

GET  /api/portal/my-tech-stack          — Müşteri kendi stack'i
     (Müşteriye "tespit ettiklerimiz" gösterimi)
```

---

## BÖLÜM 13: TEST SENARYOSU

```
1. Cloudflare + WordPress kullanan bir TR domain tara
   Beklenen:
     category: cdn,     vendor: cloudflare
     category: waf,     vendor: cloudflare
     category: cms,     vendor: wordpress, version: X.X
     category: ssl_ca,  vendor: letsencrypt
     maturity_level: low veya medium

2. Microsoft 365 kullanan kurumsal bir TR domain
   Beklenen:
     category: mail, vendor: microsoft, product: Microsoft 365
     salesSignal: has_microsoft365
     recommendedService: soc_standart

3. Shodan'da FortiGate görünen bir domain
   Beklenen:
     category: firewall, vendor: fortinet, product: FortiGate
     salesSignal: has_fortinet
     recommendedService: bundle_soc_noc_standart
```

---

*CyberStep.io — Technographic Fingerprint Motoru — 2026*
