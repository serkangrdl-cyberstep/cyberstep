# CyberStep — Domain Keşif Kaynakları Genişletme
## Replit Agent Promptu

---

## BAĞLAM

Mevcut sistemde crt.sh, Certstream ve Shodan ile Türk domainleri keşfediliyor.
Sadece `.com.tr` ve `.net.tr` aranıyor, diğer TLD'ler ve alternatif kaynaklar eksik.
Bu prompt üç şey yapıyor:

1. Mevcut crt.sh ve Certstream taramalarına yeni TLD'ler ekle
2. RIPEstat + URLScan + VirusTotal gibi ücretsiz API'lerden yeni kaynak ekle
3. Türk ASN'leri üzerinden Shodan'ı daha verimli kullan

Hukuki kapsam: Tüm kaynaklar public internet verisi.
Hedef kitle filtresi: `.gov.tr` ve `.mil.tr` dışındaki tüm TLD'ler pipeline'a girer.
Önemli: Mevcut çalışan crt.sh ve Certstream entegrasyonlarına dokunma — sadece genişlet.

---

## BÖLÜM 1 — TLD GENİŞLETME

### 1.1 Mevcut crt.sh sorgusunu bul

Sistemde crt.sh'a istek atan fonksiyonu veya cron job'u bul.
Muhtemelen şöyle bir sorgu var:

```
https://crt.sh/?q=%.com.tr&output=json
https://crt.sh/?q=%.net.tr&output=json
```

### 1.2 Yeni TLD'leri ekle

Aynı fonksiyona veya cron job'a şu TLD'leri de ekle:

```typescript
const TR_TLDS = [
  // Mevcut (dokunma)
  'com.tr',
  'net.tr',
  // Yeni eklenecekler
  'org.tr',    // sivil toplum, dernekler, vakıflar
  'biz.tr',    // ticari işletmeler
  'info.tr',   // bilgi siteleri
  'web.tr',    // genel web
  'gen.tr',    // genel
  'tv.tv',     // medya (tr'ye özgü değil ama Türk medya)
  'edu.tr',    // üniversiteler — lead değil ama envanterde olsun
  // Kasıtlı dışarıda bırakılanlar:
  // 'gov.tr'  → kamu, hedef dışı
  // 'mil.tr'  → askeri, kesinlikle dışarıda
];
```

crt.sh sorgusu TLD başına ayrı istek atar:
```typescript
for (const tld of TR_TLDS) {
  const url = `https://crt.sh/?q=%.${tld}&output=json`;
  // mevcut işlem mantığı aynı kalır
}
```

### 1.3 Certstream filtresini güncelle

Certstream'de domain'i filtreleyen yeri bul.
Muhtemelen `.com.tr` veya `.net.tr` içerip içermediğini kontrol eden bir koşul var.
Bunu şu şekilde genişlet:

```typescript
function isTurkishDomain(domain: string): boolean {
  const TR_TLDS = [
    '.com.tr', '.net.tr', '.org.tr', '.biz.tr',
    '.info.tr', '.web.tr', '.gen.tr', '.edu.tr',
    // gov.tr ve mil.tr kasıtlı dışarıda
  ];
  return TR_TLDS.some(tld => domain.endsWith(tld));
}
```

---

## BÖLÜM 2 — RIPEstat API (Türk ASN → Domain)

RIPEstat ücretsiz, kayıt gerektirmez, rate limit gevşek.

### 2.1 Türkiye ASN Listesi

Bu AS numaraları Türkiye'nin en büyük ISP'leri:

```typescript
const TURKISH_ASNS = [
  'AS9121',   // Türk Telekom
  'AS47331',  // Turkcell
  'AS34984',  // Superonline
  'AS8386',   // TTNet
  'AS43260',  // Radore / DGN
  'AS197328', // Vodafone TR
  'AS15924',  // Biznet (hosting)
  'AS201252', // Netdirekt
  'AS44565',  // Çözüm Park
];
```

### 2.2 RIPEstat'tan IP Bloklarını Çek

```typescript
async function getTurkishIpRanges(asn: string): Promise<string[]> {
  const url = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=${asn}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data?.prefixes?.map((p: any) => p.prefix) ?? [];
}
```

### 2.3 Reverse DNS ile Domain Çıkar

IP bloklarından domain çıkarmak için iki yöntem:

**Yöntem A — Shodan üzerinden (mevcut Shodan entegrasyonu varsa kullan):**

```typescript
async function getDomainsFromShodan(asn: string): Promise<string[]> {
  // Mevcut Shodan API client'ı kullan
  // asn:AS9121 port:443 sorgusu
  const query = `asn:${asn} port:443`;
  const results = await shodanSearch(query);
  
  const domains: string[] = [];
  for (const result of results) {
    if (result.hostnames) {
      domains.push(...result.hostnames.filter(isTurkishDomain));
    }
    if (result.ssl?.cert?.subject?.cn) {
      const cn = result.ssl.cert.subject.cn;
      if (isTurkishDomain(cn)) domains.push(cn);
    }
  }
  return [...new Set(domains)];
}
```

**Yöntem B — RIPEstat passive DNS (kayıt gerektirmez):**

```typescript
async function getDomainsFromRipeStat(domain: string): Promise<string[]> {
  const url = `https://stat.ripe.net/data/dns-zone-raw/data.json?resource=${domain}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  // passive DNS kayıtlarından domain çıkar
  return data.data?.zone_lines
    ?.filter((line: string) => line.includes('.tr'))
    ?.map((line: string) => {
      const parts = line.split(/\s+/);
      return parts[0]?.toLowerCase().replace(/\.$/, '');
    })
    ?.filter(Boolean) ?? [];
}
```

---

## BÖLÜM 3 — URLScan.io (Ücretsiz, Kayıt Gerektirmez)

URLScan.io Türkiye'deki aktif web sitelerinin tarama sonuçlarını tutuyor.
Ücretsiz API, günde 1000 sorgu limiti var.

### 3.1 Endpoint

```typescript
const URLSCAN_BASE = 'https://urlscan.io/api/v1';

async function searchTurkishDomainsUrlScan(page = 0): Promise<string[]> {
  // .tr uzantılı domainleri ara
  const query = 'domain:*.tr AND (domain:*.com.tr OR domain:*.net.tr OR domain:*.org.tr OR domain:*.biz.tr)';
  const url = `${URLSCAN_BASE}/search/?q=${encodeURIComponent(query)}&size=100&offset=${page * 100}`;
  
  const res = await fetch(url, {
    headers: {
      'API-Key': process.env.URLSCAN_API_KEY || '', // opsiyonel, anonim de çalışır ama sınırlı
    }
  });
  
  if (!res.ok) return [];
  const data = await res.json();
  
  return data.results
    ?.map((r: any) => r.page?.domain)
    ?.filter((d: string) => d && isTurkishDomain(d))
    ?? [];
}
```

### 3.2 Cron Job

```typescript
// Haftada 1 kez — urlscan_discovery
// cron: '0 3 * * 1' (Pazartesi 03:00)
await wrapCron('urlscan_domain_discovery', '0 3 * * 1', async () => {
  const domains: string[] = [];
  
  // 5 sayfa = 500 domain (ücretsiz limit gözetiliyor)
  for (let page = 0; page < 5; page++) {
    const batch = await searchTurkishDomainsUrlScan(page);
    domains.push(...batch);
    await sleep(2000); // rate limit
  }
  
  const unique = [...new Set(domains)];
  let added = 0;
  
  for (const domain of unique) {
    const exists = await db.query.enterpriseProspects.findFirst({
      where: eq(enterpriseProspects.domain, domain)
    });
    if (!exists) {
      await db.insert(enterpriseProspects).values({
        domain,
        source: 'urlscan',
        status: 'new',
        discoveredAt: new Date(),
      });
      added++;
    }
  }
  
  console.log(`URLScan: ${unique.length} işlendi, ${added} yeni eklendi`);
});
```

---

## BÖLÜM 4 — VirusTotal (Pasif DNS, Ücretsiz Tier)

VirusTotal ücretsiz API ile domain'e ait alt domain ve ilişkili domainleri döndürür.
Rate limit: 4 istek/dakika (ücretsiz).

### 4.1 Subdomains Discovery

```typescript
const VT_BASE = 'https://www.virustotal.com/api/v3';

async function getSubdomainsVirusTotal(domain: string): Promise<string[]> {
  const url = `${VT_BASE}/domains/${domain}/subdomains?limit=40`;
  const res = await fetch(url, {
    headers: {
      'x-apikey': process.env.VIRUSTOTAL_API_KEY || '',
    }
  });
  
  if (!res.ok) return [];
  const data = await res.json();
  
  return data.data
    ?.map((item: any) => item.id)
    ?.filter((d: string) => isTurkishDomain(d))
    ?? [];
}
```

### 4.2 Seed Domain Listesi

VirusTotal'ı seed domain'ler üzerinden kullan — büyük Türk domainlerin alt domainlerini keşfeder:

```typescript
const SEED_DOMAINS = [
  'com.tr', 'net.tr', 'org.tr', 'biz.tr'
];

// Haftada 1 — virustotal_subdomain_discovery
// Rate limit: 4 req/dk, çok dikkatli kullan
await wrapCron('virustotal_discovery', '0 4 * * 2', async () => {
  // Mevcut pipeline'daki yüksek skorlu domainlerin alt domainlerini keşfet
  const topDomains = await db.query.enterpriseProspects.findMany({
    where: and(
      gte(enterpriseProspects.overallScore, 60),
      eq(enterpriseProspects.status, 'scanned')
    ),
    limit: 50,
    orderBy: desc(enterpriseProspects.overallScore)
  });
  
  let added = 0;
  for (const prospect of topDomains) {
    const subs = await getSubdomainsVirusTotal(prospect.domain);
    for (const sub of subs) {
      const exists = await db.query.enterpriseProspects.findFirst({
        where: eq(enterpriseProspects.domain, sub)
      });
      if (!exists) {
        await db.insert(enterpriseProspects).values({
          domain: sub,
          source: 'virustotal_subdomain',
          status: 'new',
          discoveredAt: new Date(),
        });
        added++;
      }
    }
    await sleep(15000); // 4 req/dk = 15 sn bekle
  }
  
  console.log(`VirusTotal: ${added} yeni subdomain eklendi`);
});
```

**Not:** VirusTotal API key için virustotal.com'da ücretsiz hesap aç.
`.env`'e ekle: `VIRUSTOTAL_API_KEY=your_key_here`

---

## BÖLÜM 5 — WHOIS Türkiye Nic.tr (Toplu TLD Listesi)

nic.tr RDAP endpoint'i ücretsiz ve Türkiye'deki tüm kayıtlı domainler için sorgulanabilir.

### 5.1 Belirli TLD'nin domain sayısını kontrol et

```typescript
async function getNicTrStats(): Promise<void> {
  // nic.tr RDAP base URL
  const url = 'https://rdap.nic.tr/help';
  const res = await fetch(url);
  const data = await res.json();
  console.log('NIC.TR RDAP:', JSON.stringify(data, null, 2));
}
```

### 5.2 Zone File Alternatifi

nic.tr zone file doğrudan dağıtmıyor ama CZDS (ICANN Centralized Zone Data Service) 
üzerinden `.tr` zone file erişimi istenebilir. Bu uzun vadeli bir kaynak.
Şimdilik RDAP ile tek tek domain sorgulama yeterli.

---

## BÖLÜM 6 — KAYNAK TAKIP TABLOSU

Domain kaynağını kayıt altına almak için mevcut `enterprise_prospects` tablosuna
`source` kolonu yoksa ekle:

```sql
ALTER TABLE enterprise_prospects 
ADD COLUMN IF NOT EXISTS source varchar(50) DEFAULT 'certstream';
```

Kaynak değerleri:
- `certstream` — Certstream (mevcut)
- `crt_sh` — crt.sh (mevcut)
- `shodan` — Shodan (mevcut)
- `shodan_asn` — Türk ASN üzerinden Shodan (yeni)
- `urlscan` — URLScan.io (yeni)
- `virustotal_subdomain` — VirusTotal alt domain (yeni)
- `ripestat` — RIPEstat pasif DNS (yeni)
- `manual` — manuel ekleme

Bu sayede hangi kaynağın en kaliteli lead ürettiğini ölçebilirsin.

---

## BÖLÜM 7 — KALİFİYE ETME FİLTRESİ GÜNCELLEMESİ

Yeni TLD'lerden gelen domainlerde sektör filtresi önemli.
`.edu.tr` domainleri pipeline'a girer ama `sector` alanına `education` yazılır,
ISR ekibi öncelik sıralamasında en sona koyar.

```typescript
function inferSectorFromDomain(domain: string): string {
  if (domain.endsWith('.edu.tr')) return 'education';
  if (domain.endsWith('.org.tr')) return 'ngo';
  if (domain.endsWith('.biz.tr')) return 'commercial';
  if (domain.endsWith('.com.tr')) return 'commercial';
  if (domain.endsWith('.net.tr')) return 'technology';
  return 'unknown';
}
```

---

## UYGULAMA SIRASI

1. `isTurkishDomain()` fonksiyonunu güncelle — yeni TLD'leri ekle
2. crt.sh cron'unu güncelle — `TR_TLDS` array'i ile döngü
3. Certstream filtresini güncelle — yeni TLD'leri dahil et
4. `source` kolonu — tabloya ekle
5. Shodan ASN sorgusu — mevcut Shodan entegrasyonuna AS numaraları ekle
6. URLScan cron'u ekle — Pazartesi 03:00
7. VirusTotal API key al, cron'u ekle — Salı 04:00
8. `inferSectorFromDomain()` — mevcut domain kayıt fonksiyonuna ekle

---

## KISITLAR

- `.gov.tr` ve `.mil.tr` hiçbir koşulda pipeline'a girmesin
- VirusTotal: 4 istek/dakika sınırına kesinlikle uy — ban yer
- URLScan: anonim mod günde 100 istek, API key ile 1000
- Mevcut crt.sh ve Certstream mantığını bozmadan sadece genişlet
- `source` alanı her yeni kayıtta doldurulsun — ölçüm için zorunlu
- RIPEstat için API key gerekmez — doğrudan kullan
