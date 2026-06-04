# CyberStep.io — SEO Optimizasyonu
## Replit Agent Promptu — Teknik SEO + İçerik SEO + Türkiye Odaklı

---

## TALİMAT

Mevcut sayfaları SEO için optimize et.
Yeni özellik ekleme — sadece SEO iyileştirmesi yap.
Her bölüm tamamlanınca "✅ Bölüm X tamamlandı" yaz.

---

## BÖLÜM 1: TEKNİK SEO ALTYAPISI

### 1a — Meta Tag Sistemi

```typescript
// src/utils/seo.ts
// Her sayfa için dinamik meta tag üretici

interface SEOMeta {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

export function generateMeta(page: SEOMeta): SEOMeta {
  const siteName = 'CyberStep.io';
  const defaultOgImage = 'https://cyberstep.io/og-default.png';

  return {
    title: page.title.includes(siteName)
      ? page.title
      : `${page.title} | ${siteName}`,
    description: page.description.slice(0, 160),
    canonical: page.canonical,
    ogTitle: page.ogTitle || page.title,
    ogDescription: page.ogDescription || page.description,
    ogImage: page.ogImage || defaultOgImage,
    ogType: page.ogType || 'website',
    noIndex: page.noIndex || false,
  };
}

// Her sayfa için SEO tanımları:
export const PAGE_SEO: Record<string, SEOMeta> = {
  home: {
    title: 'Siber Güvenlik Risk Platformu | CyberStep.io',
    description: 'Türkiye\'nin yapay zeka destekli CASM platformu. Domain tarama, güvenlik değerlendirmesi, AI SOC ve KVKK uyum servisleri.',
    keywords: 'siber güvenlik, domain güvenlik tarama, KVKK uyum, güvenlik değerlendirmesi, Türkiye',
    canonical: 'https://cyberstep.io',
  },
  assessment: {
    title: 'Ücretsiz Güvenlik Değerlendirmesi | CyberStep.io',
    description: '20 soruda şirketinizin siber güvenlik riskini ölçün. Ücretsiz, anında sonuç, KVKK uyum skoru dahil.',
    keywords: 'güvenlik değerlendirmesi, siber güvenlik testi, KVKK uyum kontrolü',
    canonical: 'https://cyberstep.io/degerlendirme',
  },
  domainScan: {
    title: 'Ücretsiz Domain Güvenlik Taraması | CyberStep.io',
    description: 'Şirket domain\'inizin SSL, SPF, DMARC, kara liste ve dark web durumunu ücretsiz kontrol edin.',
    keywords: 'domain güvenlik tarama, ssl kontrol, dmarc kontrol, domain blacklist kontrol',
    canonical: 'https://cyberstep.io',
  },
  pricing: {
    title: 'Fiyatlar | CyberStep.io',
    description: 'Başlangıç paketi 8.990 TL\'den. AI güvenlik değerlendirmesi, phishing simülasyonu, SOC servisi ve daha fazlası.',
    canonical: 'https://cyberstep.io/fiyatlar',
  },
  kvkk: {
    title: 'KVKK Uyum Değerlendirmesi | CyberStep.io',
    description: 'KVKK uyumunuzu ölçün, eksikleri tespit edin, 72 saat bildirim prosedürünü hazırlayın.',
    keywords: 'KVKK uyum, kişisel veri koruma, KVKK değerlendirmesi, VERBİS',
  },
  aiSecurity: {
    title: 'AI Araçları Güvenlik Değerlendirmesi | CyberStep.io',
    description: 'ChatGPT, Copilot, Midjourney gibi AI araçlarının KVKK ve şirket verisi risklerini değerlendirin.',
    keywords: 'AI araç güvenliği, ChatGPT KVKK, yapay zeka güvenliği',
  },
  soc: {
    title: 'AI Destekli SOC Servisi | CyberStep.io',
    description: '7/24 yapay zeka destekli güvenlik izleme. Klasik SOC\'un 1/10 fiyatına kurumsal güvenlik.',
    keywords: 'SOC hizmeti, güvenlik izleme, 7/24 siber güvenlik, AI SOC Türkiye',
  },
  blog: {
    title: 'Siber Güvenlik Blog | CyberStep.io',
    description: 'Türkiye\'deki şirketler için güncel siber tehditler, KVKK haberleri ve güvenlik önerileri.',
    keywords: 'siber güvenlik blog, KVKK haberleri, siber tehdit türkiye',
    canonical: 'https://cyberstep.io/blog',
  },
};
```

### 1b — React Helmet / Meta Tags Entegrasyonu

```tsx
// src/components/SEOHead.tsx
// Her sayfaya ekle

import { Helmet } from 'react-helmet-async';

export function SEOHead({ seo }: { seo: SEOMeta }) {
  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {seo.keywords && <meta name="keywords" content={seo.keywords} />}
      {seo.canonical && <link rel="canonical" href={seo.canonical} />}
      {seo.noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={seo.ogTitle || seo.title} />
      <meta property="og:description" content={seo.ogDescription || seo.description} />
      <meta property="og:image" content={seo.ogImage} />
      <meta property="og:type" content={seo.ogType || 'website'} />
      <meta property="og:locale" content="tr_TR" />
      <meta property="og:site_name" content="CyberStep.io" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.ogTitle || seo.title} />
      <meta name="twitter:description" content={seo.ogDescription || seo.description} />
      <meta name="twitter:image" content={seo.ogImage} />
    </Helmet>
  );
}

// Kullanım — her sayfa bileşeninde:
// <SEOHead seo={PAGE_SEO.home} />
```

### 1c — Structured Data (JSON-LD)

```tsx
// src/components/StructuredData.tsx

// Ana sayfa — Organization + WebSite
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CyberStep.io',
  url: 'https://cyberstep.io',
  logo: 'https://cyberstep.io/logo.png',
  description: 'Türkiye\'nin yapay zeka destekli siber güvenlik risk platformu',
  sameAs: [
    'https://linkedin.com/company/cyberstep-io',
    'https://twitter.com/cyberstep_io',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'security@cyberstep.io',
    contactType: 'customer service',
    availableLanguage: 'Turkish',
  },
};

// Araç sayfaları — SoftwareApplication
export const toolSchema = (tool: {
  name: string;
  description: string;
  url: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: tool.name,
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TRY',
    description: 'Ücretsiz',
  },
  url: tool.url,
  description: tool.description,
});

// Blog post — Article
export const articleSchema = (post: BlogPost) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  description: post.excerpt,
  author: {
    '@type': 'Organization',
    name: 'CyberStep.io',
  },
  publisher: {
    '@type': 'Organization',
    name: 'CyberStep.io',
    logo: { '@type': 'ImageObject', url: 'https://cyberstep.io/logo.png' },
  },
  datePublished: post.publishedAt,
  dateModified: post.updatedAt,
  image: post.coverImage || 'https://cyberstep.io/blog-default.png',
  url: `https://cyberstep.io/blog/${post.slug}`,
  inLanguage: 'tr-TR',
  keywords: post.tags.join(', '),
});

// Fiyat sayfası — Service + Offer
export const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'CyberStep Güvenlik Değerlendirmesi',
  provider: {
    '@type': 'Organization',
    name: 'CyberStep.io',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Mini Değerlendirme',
      price: '0',
      priceCurrency: 'TRY',
      description: '20 soruluk ücretsiz siber güvenlik değerlendirmesi',
    },
    {
      '@type': 'Offer',
      name: 'Tam Değerlendirme',
      price: '5990',
      priceCurrency: 'TRY',
      description: '60 soruluk kapsamlı güvenlik değerlendirmesi, uzman doğrulamalı',
    },
  ],
  areaServed: 'TR',
  availableLanguage: 'Turkish',
};

// SSS şeması — blog ve araç sayfalarına ekle
export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
```

---

## BÖLÜM 2: SİTEMAP + ROBOTS.TXT

### 2a — Dinamik Sitemap

```typescript
// GET /sitemap.xml — Express route

app.get('/sitemap.xml', async (req, res) => {
  const baseUrl = 'https://cyberstep.io';

  // Statik sayfalar
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/degerlendirme', priority: '0.9', changefreq: 'monthly' },
    { url: '/fiyatlar', priority: '0.9', changefreq: 'weekly' },
    { url: '/hakkimizda', priority: '0.6', changefreq: 'monthly' },
    { url: '/blog', priority: '0.8', changefreq: 'daily' },
    { url: '/araclar/ssl-kontrol', priority: '0.8', changefreq: 'monthly' },
    { url: '/araclar/domain-guvenlik-taramasi', priority: '0.9', changefreq: 'monthly' },
    { url: '/araclar/kvkk-ceza-hesaplayici', priority: '0.8', changefreq: 'monthly' },
    { url: '/araclar/dmarc-kontrol', priority: '0.7', changefreq: 'monthly' },
    { url: '/araclar/dark-web-sorgulama', priority: '0.7', changefreq: 'monthly' },
    { url: '/rakip-karsilastirma', priority: '0.7', changefreq: 'weekly' },
    { url: '/yatirim-paketi', priority: '0.6', changefreq: 'monthly' },
  ];

  // Blog yazıları (DB'den)
  const blogs = await getPublishedBlogs();
  const blogPages = blogs.map(b => ({
    url: `/blog/${b.slug}`,
    lastmod: b.updatedAt.toISOString().split('T')[0],
    priority: '0.7',
    changefreq: 'monthly',
  }));

  // Sektör landing sayfaları
  const sectors = ['finans', 'saglik', 'perakende', 'teknoloji', 'enerji', 'lojistik'];
  const sectorPages = sectors.map(s => ({
    url: `/sektor/${s}`,
    priority: '0.7',
    changefreq: 'monthly',
  }));

  const allPages = [...staticPages, ...blogPages, ...sectorPages];

  const today = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${p.lastmod || today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});
```

### 2b — robots.txt

```typescript
// GET /robots.txt

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Allow: /blog/
Allow: /araclar/
Allow: /sektor/
Allow: /fiyatlar
Allow: /hakkimizda
Allow: /kariyer

# Admin ve portal sayfaları indexlenmesin
Disallow: /hesabim/
Disallow: /panel/
Disallow: /admin-panel/
Disallow: /api/
Disallow: /preview/
Disallow: /odeme/

# Sitemap
Sitemap: https://cyberstep.io/sitemap.xml

# Crawl-delay
Crawl-delay: 2
`);
});
```

---

## BÖLÜM 3: SAYFA HIZI OPTİMİZASYONU

### 3a — Resim Optimizasyonu

```typescript
// Tüm <img> tag'lerini kontrol et:

// 1. Alt text eksik olanları bul ve ekle:
// grep -r "<img" src/ --include="*.tsx" | grep -v "alt="

// 2. Lazy loading ekle:
// <img loading="lazy" alt="..." />

// 3. WebP formatı (zaten Vite build'da yapılabilir)
// vite.config.ts'ye ekle:
/*
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});
*/

// 4. OG image'lar için:
// /public/og-default.png — 1200x630px
// Her servis için ayrı OG image oluştur
```

### 3b — Vite Build Optimizasyonu

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],
  build: {
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
    // Chunk boyut uyarısı
    chunkSizeWarningLimit: 500,
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Production'da console.log kaldır
        drop_debugger: true,
      },
    },
  },
});
```

### 3c — Express Statik Dosya Caching

```typescript
// Production'da statik dosyalar için uzun cache
app.use('/assets', express.static('dist/assets', {
  maxAge: '1y',        // 1 yıl cache (hash'li dosyalar)
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // HTML cache'lenmesin
    }
  },
}));

// API yanıtlarına cache header'ı ekleme (uygulanabilecekler)
// Domain tarama sonuçları: 1 saat cache
app.get('/api/scan/:id/results', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  // ... handler
});
```

---

## BÖLÜM 4: URL VE SAYFA YAPISI

### 4a — SEO Dostu URL'ler

```typescript
// Türkçe karakter normalize — slug üreteci
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Blog URL'leri: /blog/kvkk-cezasi-nasil-onlenir
// Araç URL'leri: /araclar/ssl-kontrol
// Sektör URL'leri: /sektor/finans-sektoru-siber-guvenlik

// 301 redirect'ler — eski URL'ler varsa
const REDIRECTS: Record<string, string> = {
  '/degerlendirme/ucretsiz': '/degerlendirme',
  '/tarama': '/',
};

app.use((req, res, next) => {
  const redirect = REDIRECTS[req.path];
  if (redirect) return res.redirect(301, redirect);
  next();
});
```

### 4b — Breadcrumb Şeması

```tsx
// Blog ve araç sayfalarına ekle

export function Breadcrumb({ items }: {
  items: { name: string; href?: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.href ? `https://cyberstep.io${item.href}` : undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
      <nav aria-label="Breadcrumb">
        <ol>
          {items.map((item, i) => (
            <li key={i}>
              {item.href
                ? <a href={item.href}>{item.name}</a>
                : <span>{item.name}</span>
              }
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

// Kullanım:
// Blog sayfasında:
// <Breadcrumb items={[
//   { name: 'Ana Sayfa', href: '/' },
//   { name: 'Blog', href: '/blog' },
//   { name: post.title },
// ]} />
```

---

## BÖLÜM 5: BLOG SEO OPTİMİZASYONU

### 5a — Blog Yazısı SEO Şablonu

```typescript
// Blog yazıları için otomatik SEO alanları

interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  category: string;
  publishedAt: Date;
  updatedAt: Date;
  coverImage?: string;
  readingTime?: number;
  // SEO alanları
  seoTitle?: string;       // Varsayılan: title
  seoDescription?: string; // Varsayılan: excerpt
  focusKeyword?: string;   // Ana hedef kelime
}

// Blog içeriği checklist (her yazı için):
export function blogSEOScore(post: BlogPost): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  if (!post.seoTitle || post.seoTitle.length < 30) {
    issues.push('SEO başlığı 30-60 karakter olmalı');
    score -= 10;
  }
  if (!post.seoDescription || post.seoDescription.length < 120) {
    issues.push('Meta açıklama 120-160 karakter olmalı');
    score -= 10;
  }
  if (!post.focusKeyword) {
    issues.push('Odak kelime tanımlanmamış');
    score -= 15;
  }
  if (post.focusKeyword && !post.title.toLowerCase()
      .includes(post.focusKeyword.toLowerCase())) {
    issues.push('Odak kelime başlıkta geçmiyor');
    score -= 10;
  }
  if (!post.coverImage) {
    issues.push('Kapak görseli eksik');
    score -= 10;
  }
  if (!post.readingTime) {
    issues.push('Okuma süresi hesaplanmamış');
    score -= 5;
  }
  if (post.content.length < 800) {
    issues.push('İçerik çok kısa (min 800 kelime önerilir)');
    score -= 20;
  }

  return { score: Math.max(0, score), issues };
}

// Otomatik okuma süresi hesapla
export function calculateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.ceil(words / 200); // Ortalama 200 kelime/dk
}
```

### 5b — Hreflang (İleride Azerbaycan için)

```tsx
// Şimdi sadece Türkçe — ilerleyen dönem için hazırlık
<Helmet>
  <link rel="alternate" hreflang="tr" href={`https://cyberstep.io${path}`} />
  <link rel="alternate" hreflang="x-default" href={`https://cyberstep.io${path}`} />
  {/* İleride: */}
  {/* <link rel="alternate" hreflang="az" href={`https://az.cyberstep.io${path}`} /> */}
</Helmet>
```

---

## BÖLÜM 6: ARAÇ SAYFALARI SEO

```typescript
// Her araç sayfası bağımsız SEO değerine sahip

const TOOL_PAGES = [
  {
    slug: 'ssl-kontrol',
    title: 'Ücretsiz SSL Sertifika Kontrol Aracı | CyberStep.io',
    h1: 'SSL Sertifikanızı Ücretsiz Kontrol Edin',
    description: 'Web sitenizin SSL sertifikası geçerli mi? Bitiş tarihi, güvenlik derecesi, zincir doğruluğu — 10 saniyede öğrenin.',
    focusKeyword: 'ssl sertifika kontrol',
    faqs: [
      {
        q: 'SSL sertifikası ne işe yarar?',
        a: 'SSL sertifikası, web siteniz ile ziyaretçileriniz arasındaki veri iletişimini şifreler. Google Chrome, SSL\'siz siteleri "güvenli değil" olarak işaretler.',
      },
      {
        q: 'SSL sertifikam ne zaman yenilenmeli?',
        a: 'SSL sertifikaları genellikle 1-2 yıl geçerlidir. Bitiş tarihinden en az 30 gün önce yenileme yapılması önerilir.',
      },
    ],
    internalLinks: [
      { text: 'DMARC Kontrolü', href: '/araclar/dmarc-kontrol' },
      { text: 'Domain Güvenlik Taraması', href: '/araclar/domain-guvenlik-taramasi' },
    ],
    relatedCTA: 'Tüm güvenlik açıklarınızı görmek için ücretsiz değerlendirme yapın →',
  },
  {
    slug: 'domain-guvenlik-taramasi',
    title: 'Ücretsiz Domain Güvenlik Taraması | CyberStep.io',
    h1: 'Domain\'inizi Ücretsiz Güvenlik Taramasından Geçirin',
    description: 'SPF, DKIM, DMARC, SSL, kara liste, dark web sızıntı — tek taramada tüm güvenlik kontrolü.',
    focusKeyword: 'domain güvenlik tarama',
    faqs: [
      {
        q: 'Domain güvenlik taraması ne kontrol eder?',
        a: 'CyberStep\'in ücretsiz domain taraması; e-posta güvenliği (SPF, DKIM, DMARC), SSL sertifikası, kara liste durumu, dark web veri sızıntısı ve subdomain güvenliğini kontrol eder.',
      },
      {
        q: 'DMARC kaydı neden önemlidir?',
        a: 'DMARC kaydı olmayan domainler, CEO fraud ve e-posta sahteciliği (phishing) saldırılarına açıktır. Saldırganlar şirketiniz adına sahte e-postalar gönderebilir.',
      },
    ],
  },
  {
    slug: 'kvkk-ceza-hesaplayici',
    title: 'KVKK Ceza Simülatörü 2026 | CyberStep.io',
    h1: 'KVKK İhlalinde Ceza Riskinizi Hesaplayın',
    description: '2026 güncel KVKK ceza skalası ile olası para cezanızı simüle edin. KVK Kurulu kararlarına dayalı hesaplama.',
    focusKeyword: 'KVKK ceza hesaplama',
    faqs: [
      {
        q: 'KVKK ihlalinde maksimum ceza ne kadar?',
        a: '2024 yılında KVK Kurulu, tek bir firmaya 1.750.000 TL\'ye kadar idari para cezası verdi. Veri ihlali bildirim yükümlülüğü ihlallerinde cezalar daha yüksek olabilir.',
      },
    ],
  },
];

// Her araç sayfası şablonu:
// H1: Odak kelime içermeli
// İçerik: Min 300 kelime açıklama
// SSS bölümü (FAQPage schema)
// İlgili araçlara internal link
// CTA: Ücretsiz değerlendirmeye yönlendirme
```

---

## BÖLÜM 7: SEKTÖR LANDING SAYFALARI

```typescript
// /sektor/finans, /sektor/saglik, vs.

const SECTOR_PAGES = {
  finans: {
    title: 'Finans Sektörü Siber Güvenlik | CyberStep.io',
    h1: 'Finans Şirketleri İçin Siber Güvenlik',
    description: 'BDDK uyumu, müşteri verisi koruma, online bankacılık güvenliği. Türk finans sektörüne özel siber güvenlik platformu.',
    focusKeyword: 'finans sektörü siber güvenlik',
    stats: [
      '%67 — Türk finans firmalarının DMARC kaydı yok',
      '₺2.1M — 2024\'te finans sektörü KVKK cezası ortalaması',
    ],
    threats: ['CEO fraud', 'Online bankacılık phishing', 'SWIFT saldırıları'],
    compliance: ['BDDK Bilgi Sistemleri Tebliği', 'KVKK', 'PCI-DSS'],
  },
  saglik: {
    title: 'Sağlık Sektörü Siber Güvenlik | CyberStep.io',
    h1: 'Hastane ve Sağlık Kuruluşları İçin Siber Güvenlik',
    description: 'Hasta verisi koruma, KVKK sağlık verileri, medikal cihaz güvenliği. Türk sağlık sektörüne özel çözümler.',
    focusKeyword: 'sağlık sektörü siber güvenlik',
    stats: [
      'Fidye yazılımı saldırılarının %15\'i sağlık sektörünü hedefliyor',
      'Sağlık verisi ihlali başına ortalama maliyet: $10.9M (küresel)',
    ],
  },
  perakende: {
    title: 'E-ticaret ve Perakende Siber Güvenlik | CyberStep.io',
    h1: 'E-ticaret Siteleri İçin Siber Güvenlik',
    description: 'Ödeme güvenliği, müşteri verisi koruma, sahte sipariş tespiti. Türk e-ticaret şirketlerine özel güvenlik platformu.',
    focusKeyword: 'e-ticaret siber güvenlik',
  },
};

// Her sektör sayfası:
// H1 + istatistikler
// "Bu sektörde en yaygın tehditler" bölümü
// İlgili mevzuat (BDDK, HIPAA benzeri, KVKK)
// CTA: "Sektörünüz için ücretsiz değerlendirme"
// InternalLink: İlgili araç sayfalarına
```

---

## BÖLÜM 8: CORE WEB VİTALS

```typescript
// src/utils/webVitals.ts
// LCP, FID, CLS ölçümü ve raporlama

export function reportWebVitals() {
  if (typeof window === 'undefined') return;

  // Web Vitals kütüphanesi
  // pnpm add web-vitals

  import('web-vitals').then(({ getCLS, getFID, getLCP, getFCP, getTTFB }) => {
    const report = (metric) => {
      console.log(metric.name, metric.value.toFixed(2));
      // Production'da analytics'e gönder
    };

    getCLS(report);
    getFID(report);
    getLCP(report);
    getFCP(report);
    getTTFB(report);
  });
}

// Hedef değerler:
// LCP (Largest Contentful Paint): < 2.5s
// FID (First Input Delay): < 100ms
// CLS (Cumulative Layout Shift): < 0.1
// FCP (First Contentful Paint): < 1.8s
// TTFB (Time to First Byte): < 800ms
```

---

## BÖLÜM 9: INTERNAL LİNKİNG

```typescript
// Her sayfa en az 3 internal link içermeli

// Ana sayfadan:
// → /degerlendirme (ücretsiz değerlendirme CTA)
// → /blog (son yazılar)
// → /araclar/* (araç kartları)
// → /fiyatlar

// Blog yazılarından:
// → İlgili araç sayfası
// → İlgili diğer blog yazısı
// → /degerlendirme CTA

// Araç sayfalarından:
// → Diğer araçlar
// → /degerlendirme
// → İlgili blog yazısı

// Otomatik internal link suggestion (Claude ile):
export async function suggestInternalLinks(
  content: string,
  existingUrls: string[]
): Promise<{ anchor: string; url: string }[]> {
  const prompt = `
İçeriği analiz et ve aşağıdaki URL'lerden uygun iç bağlantıları öner.
Metin: "${content.slice(0, 500)}"
Mevcut sayfalar: ${existingUrls.join(', ')}
JSON: [{anchor: "link metni", url: "/url"}]
  `;
  // ... Claude çağrısı
}
```

---

## BÖLÜM 10: SEO KONTROL LİSTESİ

```
Tüm sayfalarda kontrol et:

META:
[ ] Her sayfa benzersiz <title> tag'i var (30-60 karakter)
[ ] Her sayfa benzersiz meta description (120-160 karakter)
[ ] Canonical URL tanımlı
[ ] OG title/description/image tanımlı
[ ] noindex: admin, portal, API sayfalarında aktif

YAPISAL:
[ ] Her sayfada bir H1 var (odak kelime içeriyor)
[ ] H2, H3 hiyerarşisi doğru
[ ] Resimler alt text'e sahip
[ ] Internal link yapısı kurulmuş

TEKNİK:
[ ] /sitemap.xml çalışıyor, tüm sayfaları içeriyor
[ ] /robots.txt doğru, admin sayfaları disallow
[ ] HTTPS zorunlu, HTTP → HTTPS redirect var
[ ] 404 sayfası düzgün çalışıyor (özel 404 sayfası)
[ ] Broken link yok (linkcheck ile kontrol et)

HIZLANMA:
[ ] LCP < 2.5s (Lighthouse ile test et)
[ ] Resimler lazy loading ile yükleniyor
[ ] CSS/JS minified
[ ] Gzip/Brotli sıkıştırma aktif

SCHEMA:
[ ] Organization schema ana sayfada
[ ] Article schema blog yazılarında
[ ] FAQPage schema araç sayfalarında
[ ] Service + Offer schema fiyat sayfasında
[ ] Breadcrumb schema blog ve araç sayfalarında

ARAÇLAR:
[ ] Google Search Console'a ekle ve sitemap gönder
[ ] Google Analytics veya Plausible ekle
[ ] Bing Webmaster Tools'a ekle
```

---

*CyberStep.io SEO Optimizasyon Promptu — 2026*
