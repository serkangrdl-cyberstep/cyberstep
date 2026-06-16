# CyberStep — Domain Keşif: Yeni Kaynak Ekleme
## Replit Agent Promptu

---

## BAĞLAM

Mevcut kaynaklar: ct_discovery, certstream-bridge, shodan_free (ücretli plan), ripe_dns.
Shodan zaten ücretli plan kullanılıyor — onu değiştirme.

Bu prompt 3 yeni kaynak ekliyor: Censys, Google/Bing dorking, LinkedIn şirket eşleştirme.
Her biri ayrı bir cron job olarak çalışacak, mevcut `lead_candidates` tablosuna yazacak.

---

## ADIM 1 — ÖNCE MEVCUT YAPIYI İNCELE

Şunu bul ve oku:
- Mevcut kaynak cron job'larının kodu (örnek: shodan_free veya ripe_dns dosyası)
- `lead_candidates` tablosunun şeması
- Kaynak isimlendirme konvansiyonu (`source` kolonunda nasıl yazılıyor)
- Mevcut TLD listesi ve domain normalize fonksiyonu

Bunu yaptıktan sonra, aynı pattern'i takip ederek aşağıdaki 3 kaynağı ekle.

---

## ADIM 2 — CENSYS ENTEGRASYONU

Censys.io ücretsiz tier: ayda 250 sorgu (hesap açılırsa API key verilir).

```typescript
// Yeni dosya: censys-discovery.ts (mevcut shodan dosyasıyla aynı klasöre)

import axios from 'axios';

const CENSYS_API_ID = process.env.CENSYS_API_ID;
const CENSYS_API_SECRET = process.env.CENSYS_API_SECRET;

export async function censysDiscovery() {
  const tlds = ['com.tr', 'net.tr', 'org.tr']; // mevcut TLD listesiyle aynı tut

  for (const tld of tlds) {
    try {
      const response = await axios.post(
        'https://search.censys.io/api/v2/hosts/search',
        {
          q: `services.tls.certificates.leaf_data.subject.common_name: "*.${tld}"`,
          per_page: 100,
        },
        {
          auth: { username: CENSYS_API_ID, password: CENSYS_API_SECRET },
        }
      );

      const hosts = response.data?.result?.hits || [];

      for (const host of hosts) {
        const domains = extractDomainsFromCensysHost(host); // yeni helper fonksiyon
        for (const domain of domains) {
          await insertLeadCandidate(domain, 'censys'); // mevcut insert fonksiyonunu kullan
        }
      }

      console.log(`Censys: ${tld} için ${hosts.length} host bulundu`);
    } catch (err) {
      console.error(`Censys hata (${tld}):`, err.message);
    }
  }
}

function extractDomainsFromCensysHost(host: any): string[] {
  const domains: string[] = [];
  const certs = host.services?.flatMap((s: any) =>
    s.tls?.certificates?.leaf_data?.subject?.common_name || []
  ) || [];
  certs.forEach((cn: string) => {
    if (cn && !cn.startsWith('*')) domains.push(cn.toLowerCase());
  });
  return domains;
}
```

Cron'a ekle (mevcut wrapCron pattern'i kullan):

```typescript
// cron tanımları dosyasında
cron.schedule('0 4 * * *', () => wrapCron('censys_discovery', censysDiscovery));
// Günde 1 kez, Shodan'dan farklı saatte çalışsın (rate limit çakışmasın)
```

ENV'e ekle: `CENSYS_API_ID`, `CENSYS_API_SECRET` (Censys.io'dan ücretsiz hesapla alınır).

---

## ADIM 3 — GOOGLE/BING DORKING

API key gerektirmeyen basit bir yaklaşım: Bing'in arama sonuçlarını scrape et
(Google scraping ban riski yüksek, Bing daha toleranslı).

```typescript
// Yeni dosya: search-dorking.ts

import axios from 'axios';
import * as cheerio from 'cheerio'; // yoksa: npm install cheerio

export async function searchDorking() {
  const queries = [
    'site:com.tr "KVKK"',
    'site:com.tr "kişisel verilerin korunması"',
    'site:net.tr "iletişim"',
  ];

  for (const query of queries) {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=50`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CyberStepBot/1.0)' },
      });

      const $ = cheerio.load(response.data);
      const links: string[] = [];

      $('li.b_algo h2 a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) links.push(href);
      });

      for (const link of links) {
        try {
          const domain = new URL(link).hostname.replace('www.', '');
          if (domain.endsWith('.tr')) {
            await insertLeadCandidate(domain, 'search_dorking');
          }
        } catch {}
      }

      console.log(`Dorking: "${query}" için ${links.length} sonuç`);

      // Rate limit — sorgular arası 3 saniye bekle
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`Dorking hata (${query}):`, err.message);
    }
  }
}
```

Cron'a ekle:

```typescript
cron.schedule('0 6 * * *', () => wrapCron('search_dorking', searchDorking));
// Günde 1 kez — Bing'i fazla zorlama, query sayısını az tut
```

**Not:** Bing scraping kararsız olabilir (HTML yapısı değişebilir). Çalışmazsa
sorun değil — bu üçünün arasında en az kritik olan kaynak.

---

## ADIM 4 — LINKEDIN ŞİRKET EŞLEŞTİRME

LinkedIn'i doğrudan scrape etmek ToS ihlali — bunun yerine halka açık
"Türkiye şirket listesi" kaynaklarından domain çıkar. En basit ve güvenli yöntem:

**Ticaret Sicili Gazetesi** açık verisi veya **OpenCorporates** API kullan
(ücretsiz tier mevcut, Türkiye şirketleri kısmen kapsanıyor).

```typescript
// Yeni dosya: company-registry-discovery.ts

import axios from 'axios';

export async function companyRegistryDiscovery() {
  try {
    // OpenCorporates ücretsiz API — Türkiye jurisdiction kodu: tr
    const response = await axios.get(
      'https://api.opencorporates.com/v0.4/companies/search',
      {
        params: {
          jurisdiction_code: 'tr',
          per_page: 100,
        },
      }
    );

    const companies = response.data?.results?.companies || [];

    for (const item of companies) {
      const company = item.company;
      // OpenCorporates bazen website alanı döndürür
      if (company.website) {
        try {
          const domain = new URL(company.website).hostname.replace('www.', '');
          if (domain.endsWith('.tr')) {
            await insertLeadCandidate(domain, 'company_registry');
          }
        } catch {}
      }
    }

    console.log(`Company Registry: ${companies.length} şirket tarandı`);
  } catch (err) {
    console.error('Company Registry hata:', err.message);
  }
}
```

Cron'a ekle:

```typescript
cron.schedule('0 8 * * 1', () => wrapCron('company_registry', companyRegistryDiscovery));
// Haftada 1 kez (Pazartesi) — bu kaynak hızlı tükenmez, sık çalıştırmaya gerek yok
```

ENV gerekmiyor (ücretsiz tier key'siz çalışıyor, ama rate limit var — günde
yüksek hacimde çağırma).

---

## ADIM 5 — KAYNAK DASHBOARD'A EKLE

Mevcut "Kaynak Detayları" panelinde (ekran görüntüsündeki) yeni 3 kaynak da
otomatik görünecek çünkü aynı `source` kolonunu kullanıyorlar. Ek bir şey
yapmana gerek yok — panel zaten dinamik.

---

## TEST

1. Censys: `CENSYS_API_ID` ve `CENSYS_API_SECRET` ENV'e eklendi mi?
2. Censys cron manuel tetiklendiğinde domain ekliyor mu?
3. `npm install cheerio` çalıştı mı?
4. Search dorking manuel tetiklendiğinde Bing'den sonuç dönüyor mu?
5. Company registry OpenCorporates'tan yanıt alıyor mu?
6. Üç kaynak da `lead_candidates` tablosuna doğru `source` adıyla yazıyor mu?
7. Kaynak Detayları panelinde 3 yeni kaynak görünüyor mu?

---

## KISITLAR

- Shodan'a dokunma — zaten ücretli ve çalışıyor
- Mevcut ct_discovery ve certstream-bridge'e dokunma
- Her yeni kaynak kendi try/catch içinde — biri patlarsa diğerleri durmasın
- Rate limit'e dikkat et — özellikle Bing scraping agresif olmasın
- Mevcut TLD listesi ve domain normalize fonksiyonunu tekrar yazma, olanı kullan
- İsimlendirme: `censys`, `search_dorking`, `company_registry` — kaynak dashboard'da böyle görünsün
