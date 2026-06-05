# CyberStep.io — IOC Analiz / Tehdit Sorgulama Merkezi
## Replit Agent Promptu — Ücretli Ek Servis

---

## AMAÇ

Müşteri şüpheli bir IP, domain, hash veya URL
elinde olduğunda tek ekrandan sorgular.
Tüm entegre sistemler paralel çalışır.
Claude sonuçları Türkçe yorumlar.
Kredi bazlı ücretli ek servis.

---

## ADIM 0 — ÖNCE MEVCUT KODU OKU

```
Şunları kontrol et:
  src/services/wafDetector.ts
  → Shodan çağrısı nasıl yapılıyor?

  src/routes/domain-scan/index.ts
  → AbuseIPDB, VirusTotal, ThreatFox
    entegrasyonları var mı?
    Nasıl çağrılıyor?

  src/services/ioc/
  → IOC işleme servisleri nerede?

Mevcut API çağrı yapısını anladıktan sonra
aşağıdaki servisi o yapıyla uyumlu yaz.
```

---

## BÖLÜM 1: VERİTABANI

```sql
-- IOC sorgu geçmişi
CREATE TABLE IF NOT EXISTS ioc_queries (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),

  -- Sorgu
  query_type varchar(20) NOT NULL,
  -- 'ip' | 'domain' | 'hash' | 'url' | 'email'
  query_value varchar(500) NOT NULL,
  -- Sorgulanan değer

  -- Sonuçlar (ham)
  shodan_result       jsonb,
  virustotal_result   jsonb,
  abuseipdb_result    jsonb,
  greynoise_result    jsonb,
  threatfox_result    jsonb,
  urlhaus_result      jsonb,
  malwarebazaar_result jsonb,
  whois_result        jsonb,
  feodo_result        jsonb,

  -- Claude analizi
  threat_level varchar(20),
  -- 'critical' | 'high' | 'medium' | 'low' | 'clean'
  threat_score integer,
  -- 0-100
  ai_summary text,
  -- Türkçe yorum
  ai_recommendations jsonb,
  -- [{action, priority, explanation}]
  indicators jsonb,
  -- Tespit edilen göstergeler listesi

  -- Kredi
  credits_used integer DEFAULT 1,
  cache_hit boolean DEFAULT false,
  -- Aynı IOC tekrar sorgulandı mı?

  -- Durum
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'processing' | 'completed' | 'error'
  error_message text,
  processing_time_ms integer,

  created_at timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS ioc_queries_customer_idx
  ON ioc_queries (customer_id);
CREATE INDEX IF NOT EXISTS ioc_queries_value_idx
  ON ioc_queries (query_value, query_type);
-- Cache için: aynı IOC sorgusu 24 saat içinde tekrarlandı mı?

-- Müşteri kredi bakiyesi
CREATE TABLE IF NOT EXISTS ioc_query_credits (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,
  credits_total integer DEFAULT 10,
  -- Pakete dahil aylık
  credits_used integer DEFAULT 0,
  credits_purchased integer DEFAULT 0,
  -- Ek satın alınan
  reset_date date,
  -- Her ay bu tarihte sıfırlanır
  updated_at timestamp DEFAULT now()
);

-- Kredi işlem logu
CREATE TABLE IF NOT EXISTS ioc_credit_transactions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  amount integer NOT NULL,
  -- Pozitif: yükleme, negatif: kullanım
  type varchar(30),
  -- 'monthly_reset' | 'purchase' | 'query_used' | 'refund'
  query_id integer REFERENCES ioc_queries(id),
  description text,
  created_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: IOC SORGU SERVİSİ

```typescript
// src/services/iocQueryEngine.ts
// YENİ DOSYA

// Sorgu tipi tespiti
export function detectQueryType(
  value: string
): "ip" | "domain" | "hash" | "url" | "email" | "unknown" {
  const v = value.trim();

  // IP adresi
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v))
    return "ip";

  // IPv6
  if (/^[0-9a-fA-F:]+$/.test(v) && v.includes(":"))
    return "ip";

  // Hash (MD5, SHA1, SHA256, SHA512)
  if (/^[0-9a-fA-F]{32}$/.test(v)) return "hash"; // MD5
  if (/^[0-9a-fA-F]{40}$/.test(v)) return "hash"; // SHA1
  if (/^[0-9a-fA-F]{64}$/.test(v)) return "hash"; // SHA256

  // URL
  if (v.startsWith("http://") || v.startsWith("https://"))
    return "url";

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return "email";

  // Domain
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?
      (\.[a-zA-Z]{2,})+$/.test(v))
    return "domain";

  return "unknown";
}

// 24 saatlik cache kontrolü
async function getCachedResult(
  queryType: string,
  queryValue: string
): Promise<typeof iocQueriesTable.$inferSelect | null> {
  const cached = await db.select()
    .from(iocQueriesTable)
    .where(
      and(
        eq(iocQueriesTable.queryType, queryType),
        eq(iocQueriesTable.queryValue, queryValue),
        eq(iocQueriesTable.status, "completed"),
        gte(iocQueriesTable.createdAt, subHours(new Date(), 24))
      )
    )
    .orderBy(desc(iocQueriesTable.createdAt))
    .limit(1);

  return cached[0] || null;
}

// Ana sorgu orkestrasyonu
export async function runIOCQuery(
  queryId: number,
  queryType: string,
  queryValue: string
): Promise<void> {

  const startTime = Date.now();

  await db.update(iocQueriesTable).set({
    status: "processing",
  }).where(eq(iocQueriesTable.id, queryId));

  try {
    // Sorgu tipine göre hangi servislerin çalışacağı
    const results: Record<string, any> = {};

    // ─── IP SORGULARI ─────────────────────────────────
    if (queryType === "ip") {
      // Paralel çalıştır — hız için
      const [shodan, abuseipdb, virustotal,
             greynoise, threatfox, feodo] =
        await Promise.allSettled([
          queryShodan(queryValue),
          queryAbuseIPDB(queryValue),
          queryVirusTotal(queryValue, "ip"),
          queryGreyNoise(queryValue),
          queryThreatFox("ip", queryValue),
          queryFeodoTracker(queryValue),
        ]);

      results.shodan = shodan.status === "fulfilled"
        ? shodan.value : null;
      results.abuseipdb = abuseipdb.status === "fulfilled"
        ? abuseipdb.value : null;
      results.virustotal = virustotal.status === "fulfilled"
        ? virustotal.value : null;
      results.greynoise = greynoise.status === "fulfilled"
        ? greynoise.value : null;
      results.threatfox = threatfox.status === "fulfilled"
        ? threatfox.value : null;
      results.feodo = feodo.status === "fulfilled"
        ? feodo.value : null;
    }

    // ─── DOMAIN SORGULARI ─────────────────────────────
    else if (queryType === "domain") {
      const [virustotal, urlhaus, threatfox,
             whois, shodan] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "domain"),
          queryURLhaus(queryValue),
          queryThreatFox("domain", queryValue),
          queryWHOIS(queryValue),
          queryShodanDomain(queryValue),
          // Domain'in IP'si üzerinden Shodan
        ]);

      results.virustotal = virustotal.status === "fulfilled"
        ? virustotal.value : null;
      results.urlhaus = urlhaus.status === "fulfilled"
        ? urlhaus.value : null;
      results.threatfox = threatfox.status === "fulfilled"
        ? threatfox.value : null;
      results.whois = whois.status === "fulfilled"
        ? whois.value : null;
      results.shodan = shodan.status === "fulfilled"
        ? shodan.value : null;
    }

    // ─── HASH SORGULARI ───────────────────────────────
    else if (queryType === "hash") {
      const [virustotal, malwarebazaar, threatfox] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "hash"),
          queryMalwareBazaar(queryValue),
          queryThreatFox("hash", queryValue),
        ]);

      results.virustotal = virustotal.status === "fulfilled"
        ? virustotal.value : null;
      results.malwarebazaar = malwarebazaar.status === "fulfilled"
        ? malwarebazaar.value : null;
      results.threatfox = threatfox.status === "fulfilled"
        ? threatfox.value : null;
    }

    // ─── URL SORGULARI ────────────────────────────────
    else if (queryType === "url") {
      const domain = new URL(queryValue).hostname;
      const [virustotal, urlhaus, safebrowsing] =
        await Promise.allSettled([
          queryVirusTotal(queryValue, "url"),
          queryURLhaus(domain),
          queryGoogleSafeBrowsing(queryValue),
        ]);

      results.virustotal = virustotal.status === "fulfilled"
        ? virustotal.value : null;
      results.urlhaus = urlhaus.status === "fulfilled"
        ? urlhaus.value : null;
      results.safebrowsing = safebrowsing.status === "fulfilled"
        ? safebrowsing.value : null;
    }

    // ─── CLAUDE ANALİZİ ───────────────────────────────
    const aiAnalysis = await analyzeWithClaude(
      queryType, queryValue, results
    );

    // Sonuçları kaydet
    await db.update(iocQueriesTable).set({
      shodanResult:         results.shodan,
      virustotalResult:     results.virustotal,
      abuseipdbResult:      results.abuseipdb,
      greynoiseResult:      results.greynoise,
      threatfoxResult:      results.threatfox,
      urlhausResult:        results.urlhaus,
      malwarebazaarResult:  results.malwarebazaar,
      whoisResult:          results.whois,
      feodoResult:          results.feodo,
      threatLevel:          aiAnalysis.threatLevel,
      threatScore:          aiAnalysis.threatScore,
      aiSummary:            aiAnalysis.summary,
      aiRecommendations:    aiAnalysis.recommendations,
      indicators:           aiAnalysis.indicators,
      status:               "completed",
      processingTimeMs:     Date.now() - startTime,
      completedAt:          new Date(),
    }).where(eq(iocQueriesTable.id, queryId));

  } catch (err) {
    logger.error({ err, queryId }, "IOC sorgusu hatası");
    await db.update(iocQueriesTable).set({
      status: "error",
      errorMessage: String(err),
    }).where(eq(iocQueriesTable.id, queryId));
  }
}

// Claude ile tehdit analizi
async function analyzeWithClaude(
  queryType: string,
  queryValue: string,
  results: Record<string, any>
): Promise<{
  threatLevel: string;
  threatScore: number;
  summary: string;
  recommendations: any[];
  indicators: any[];
}> {

  const ai = getClaudeAiFn("claude-haiku-4-5");
  // Haiku — hızlı ve maliyet etkin

  const prompt = `
Sen bir siber güvenlik analistisin.
Türk KOBİ'lere danışmanlık yapıyorsun.
Aşağıdaki IOC sorgu sonuçlarını analiz et.

Sorgulanan: ${queryValue} (tip: ${queryType})

Sonuçlar:
${JSON.stringify(results, null, 2).slice(0, 6000)}

JSON formatında yanıt ver:
{
  "threat_level": "critical|high|medium|low|clean",
  "threat_score": 0-100,
  "summary": "2-3 cümle Türkçe özet. Teknik değil, yönetici dili.",
  "indicators": [
    {
      "source": "virustotal/shodan/abuseipdb vb.",
      "finding": "Ne bulundu",
      "severity": "critical|high|medium|low"
    }
  ],
  "recommendations": [
    {
      "priority": "immediate|soon|monitor",
      "action": "Ne yapılmalı",
      "explanation": "Neden"
    }
  ],
  "context": "Bu tehdit Türkiye'deki şirketleri nasıl etkiler?"
}

Kural:
- Türkçe yaz
- Net ve anlaşılır ol
- Teknik jargon kullanma
- Eylem odaklı öner
- Sadece JSON döndür
`;

  const response = await ai(prompt);

  try {
    const parsed = JSON.parse(
      response.replace(/```json|```/g, "").trim()
    );
    return {
      threatLevel:     parsed.threat_level || "unknown",
      threatScore:     parsed.threat_score || 0,
      summary:         parsed.summary || "",
      recommendations: parsed.recommendations || [],
      indicators:      parsed.indicators || [],
    };
  } catch {
    return {
      threatLevel: "unknown",
      threatScore: 0,
      summary: "Analiz tamamlanamadı.",
      recommendations: [],
      indicators: [],
    };
  }
}
```

---

## BÖLÜM 3: API SERVİS YARDIMCILARI

```typescript
// src/services/iocQueryAdapters.ts
// YENİ DOSYA — Her harici API için adapter

// ─── SHODAN ───────────────────────────────────────────
async function queryShodan(ip: string): Promise<any> {
  const key = process.env["SHODAN_API_KEY"];
  if (!key) return null;

  const { default: axios } = await import("axios");
  const res = await axios.get(
    `https://api.shodan.io/shodan/host/${ip}`,
    { params: { key }, timeout: 10000 }
  );
  return {
    ports:       res.data.ports || [],
    hostnames:   res.data.hostnames || [],
    org:         res.data.org,
    country:     res.data.country_name,
    isp:         res.data.isp,
    last_update: res.data.last_update,
    vulns:       res.data.vulns || [],
    // Bilinen CVE'ler
    tags:        res.data.tags || [],
  };
}

// ─── ABUSEIPDB ────────────────────────────────────────
async function queryAbuseIPDB(ip: string): Promise<any> {
  const key = process.env["ABUSEIPDB_API_KEY"];
  if (!key) return null;

  const { default: axios } = await import("axios");
  const res = await axios.get(
    "https://api.abuseipdb.com/api/v2/check",
    {
      headers: { Key: key, Accept: "application/json" },
      params: { ipAddress: ip, maxAgeInDays: 90, verbose: true },
      timeout: 10000,
    }
  );
  return {
    abuse_confidence_score: res.data.data.abuseConfidenceScore,
    total_reports:          res.data.data.totalReports,
    last_reported_at:       res.data.data.lastReportedAt,
    country:                res.data.data.countryCode,
    isp:                    res.data.data.isp,
    usage_type:             res.data.data.usageType,
    is_tor:                 res.data.data.isTor,
    // Son raporlardan ilk 5
    reports: (res.data.data.reports || []).slice(0, 5).map(
      (r: any) => ({
        categories: r.categories,
        reported_at: r.reportedAt,
        comment: r.comment?.slice(0, 200),
      })
    ),
  };
}

// ─── VIRUSTOTAL ───────────────────────────────────────
async function queryVirusTotal(
  value: string,
  type: "ip" | "domain" | "url" | "hash"
): Promise<any> {
  const key = process.env["VIRUSTOTAL_API_KEY"];
  if (!key) return null;

  const { default: axios } = await import("axios");

  // Endpoint belirleme
  const endpoints: Record<string, string> = {
    ip:     `https://www.virustotal.com/api/v3/ip_addresses/${value}`,
    domain: `https://www.virustotal.com/api/v3/domains/${value}`,
    hash:   `https://www.virustotal.com/api/v3/files/${value}`,
    url:    `https://www.virustotal.com/api/v3/urls/${
              Buffer.from(value).toString("base64url")}`,
  };

  const res = await axios.get(endpoints[type], {
    headers: { "x-apikey": key },
    timeout: 15000,
  });

  const stats = res.data.data?.attributes
    ?.last_analysis_stats || {};

  return {
    malicious:    stats.malicious  || 0,
    suspicious:   stats.suspicious || 0,
    clean:        stats.undetected || 0,
    total_engines: Object.values(stats).reduce(
      (a: any, b: any) => a + b, 0
    ),
    reputation:   res.data.data?.attributes?.reputation,
    // Domain/IP için
    categories:   res.data.data?.attributes?.categories,
    // Zararlı kategoriler
    tags:         res.data.data?.attributes?.tags || [],
    last_analysis_date:
      res.data.data?.attributes?.last_analysis_date,
  };
}

// ─── GREYNOISE ────────────────────────────────────────
async function queryGreyNoise(ip: string): Promise<any> {
  const key = process.env["GREYNOISE_API_KEY"];
  if (!key) return null;
  // Ücretsiz tier: greynoise.io/signup

  const { default: axios } = await import("axios");
  try {
    const res = await axios.get(
      `https://api.greynoise.io/v3/community/${ip}`,
      {
        headers: { key },
        timeout: 8000,
      }
    );
    return {
      noise:        res.data.noise,
      // true = internet scanner/bot
      riot:         res.data.riot,
      // true = güvenilir servis (Google, Cloudflare vb.)
      classification: res.data.classification,
      // 'malicious' | 'benign' | 'unknown'
      name:         res.data.name,
      link:         res.data.link,
      last_seen:    res.data.last_seen,
      message:      res.data.message,
    };
  } catch (e: any) {
    if (e.response?.status === 404) {
      return { noise: false, riot: false,
               classification: "unknown" };
    }
    return null;
  }
}

// ─── THREATFOX ────────────────────────────────────────
async function queryThreatFox(
  iocType: "ip" | "domain" | "hash" | "url",
  value: string
): Promise<any> {
  // ThreatFox: Ücretsiz, API key gerektirmez
  const { default: axios } = await import("axios");

  const typeMap: Record<string, string> = {
    ip: "ip:port", domain: "domain",
    hash: "md5_hash", url: "url",
  };

  const res = await axios.post(
    "https://threatfox-api.abuse.ch/api/v1/",
    {
      query: "search_ioc",
      search_term: value,
    },
    { timeout: 10000 }
  );

  if (res.data.query_status !== "ok") return { found: false };

  const data = res.data.data?.slice(0, 5) || [];
  return {
    found: data.length > 0,
    iocs: data.map((d: any) => ({
      threat_type:    d.threat_type,
      malware:        d.malware,
      confidence:     d.confidence_level,
      first_seen:     d.first_seen,
      last_seen:      d.last_seen,
      reporter:       d.reporter,
    })),
  };
}

// ─── URLHAUS ─────────────────────────────────────────
async function queryURLhaus(value: string): Promise<any> {
  // URLhaus: Ücretsiz
  const { default: axios } = await import("axios");
  const res = await axios.post(
    "https://urlhaus-api.abuse.ch/v1/host/",
    `host=${encodeURIComponent(value)}`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    }
  );

  return {
    found: res.data.query_status === "is_host",
    urls_count: res.data.urls?.length || 0,
    urls: (res.data.urls || []).slice(0, 3).map(
      (u: any) => ({
        url:          u.url,
        status:       u.url_status,
        threat:       u.threat,
        date_added:   u.date_added,
      })
    ),
  };
}

// ─── MALWAREBAZAAR ────────────────────────────────────
async function queryMalwareBazaar(hash: string): Promise<any> {
  // MalwareBazaar: Ücretsiz
  const { default: axios } = await import("axios");
  const res = await axios.post(
    "https://mb-api.abuse.ch/api/v1/",
    `query=get_info&hash=${hash}`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    }
  );

  if (res.data.query_status !== "ok") return { found: false };

  const data = res.data.data?.[0];
  return {
    found:         true,
    file_type:     data?.file_type,
    file_size:     data?.file_size,
    signature:     data?.signature,
    // Malware ailesi
    tags:          data?.tags || [],
    first_seen:    data?.first_seen,
    last_seen:     data?.last_seen,
    vendor_intel:  data?.vendor_intel,
    delivery_method: data?.delivery_method,
  };
}

// ─── FEODO TRACKER ───────────────────────────────────
async function queryFeodoTracker(ip: string): Promise<any> {
  // Feodo: Botnet C2 tracker, ücretsiz
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(
      "https://feodotracker.abuse.ch/downloads/ipblocklist.json",
      { timeout: 10000 }
    );
    const list: any[] = res.data || [];
    const match = list.find(
      (e: any) => e.ip_address === ip
    );
    if (!match) return { is_c2: false };
    return {
      is_c2:        true,
      malware:      match.malware,
      status:       match.status,
      first_seen:   match.first_seen,
      last_online:  match.last_online,
      country:      match.country,
    };
  } catch {
    return { is_c2: false };
  }
}

// ─── WHOIS ───────────────────────────────────────────
async function queryWHOIS(domain: string): Promise<any> {
  // whois-json paketi veya harici API
  try {
    const whois = await import("whois");
    const raw: string = await new Promise((res, rej) =>
      whois.lookup(domain, (err: any, data: string) =>
        err ? rej(err) : res(data)
      )
    );
    // Ham WHOIS'ten temel alanları çek
    const created = raw.match(
      /Creation Date:\s*(.+)/i
    )?.[1]?.trim();
    const expires = raw.match(
      /Expiry Date:\s*(.+)/i
    )?.[1]?.trim();
    const registrar = raw.match(
      /Registrar:\s*(.+)/i
    )?.[1]?.trim();
    const registrant = raw.match(
      /Registrant Organization:\s*(.+)/i
    )?.[1]?.trim();

    return {
      created_date: created,
      expiry_date:  expires,
      registrar,
      registrant_org: registrant,
      // Domain yaşı
      domain_age_days: created
        ? Math.floor(
            (Date.now() - new Date(created).getTime())
            / 86400000
          )
        : null,
    };
  } catch {
    return null;
  }
}

// ─── SHODAN DOMAIN ────────────────────────────────────
async function queryShodanDomain(domain: string): Promise<any> {
  // Domain'in DNS A kaydını alıp IP sorgula
  const dns = await import("dns/promises");
  try {
    const ips = await dns.resolve4(domain);
    if (!ips[0]) return null;
    return await queryShodan(ips[0]);
  } catch {
    return null;
  }
}

// ─── GOOGLE SAFE BROWSING ─────────────────────────────
async function queryGoogleSafeBrowsing(
  url: string
): Promise<any> {
  const key = process.env["GOOGLE_SAFE_BROWSING_API_KEY"];
  if (!key) return null;

  const { default: axios } = await import("axios");
  const res = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
    {
      client: { clientId: "cyberstep", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE", "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    },
    { timeout: 8000 }
  );
  return {
    threats: res.data.matches || [],
    is_safe: !res.data.matches?.length,
  };
}
```

---

## BÖLÜM 4: KREDİ YÖNETİMİ

```typescript
// src/services/iocCreditManager.ts
// YENİ DOSYA

// Paketle gelen aylık ücretsiz kredi
const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  soc_lite:      10,
  soc_standard:  30,
  soc_pro:       100,
  soc_noc:       50,
  ciso_assistant: 20,
  // Diğer paketler: 0 (ek satın alma gerekir)
};

// Aylık kredi sıfırlama
export async function resetMonthlyCredits(): Promise<void> {
  const customers = await db.select()
    .from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.status, "active"));

  for (const sub of customers) {
    const monthlyCredits =
      PLAN_MONTHLY_CREDITS[sub.serviceName] || 0;
    if (monthlyCredits === 0) continue;

    await db.insert(iocQueryCreditsTable).values({
      customerId:        sub.customerId,
      creditsTotal:      monthlyCredits,
      creditsUsed:       0,
      creditsPurchased:  0,
      resetDate:         new Date(),
    }).onConflictDoUpdate({
      target: iocQueryCreditsTable.customerId,
      set: {
        creditsTotal: monthlyCredits,
        creditsUsed:  0,
        resetDate:    new Date(),
        updatedAt:    new Date(),
      },
    });

    await db.insert(iocCreditTransactionsTable).values({
      customerId: sub.customerId,
      amount:     monthlyCredits,
      type:       "monthly_reset",
      description: `${monthlyCredits} aylık sorgu kredisi`,
    });
  }
}

// Kredi kontrolü ve düşürme
export async function useCredit(
  customerId: number,
  queryId: number
): Promise<{ success: boolean; remaining: number }> {

  const [balance] = await db.select()
    .from(iocQueryCreditsTable)
    .where(eq(iocQueryCreditsTable.customerId, customerId))
    .limit(1);

  const total = (balance?.creditsTotal || 0) +
                (balance?.creditsPurchased || 0);
  const used  = balance?.creditsUsed || 0;
  const remaining = total - used;

  if (remaining <= 0) {
    return { success: false, remaining: 0 };
  }

  await db.update(iocQueryCreditsTable).set({
    creditsUsed: used + 1,
    updatedAt:   new Date(),
  }).where(eq(iocQueryCreditsTable.customerId, customerId));

  await db.insert(iocCreditTransactionsTable).values({
    customerId,
    amount:      -1,
    type:        "query_used",
    queryId,
    description: "IOC sorgusu",
  });

  return { success: true, remaining: remaining - 1 };
}

// Ek kredi satın alma (Iyzico üzerinden)
// POST /api/portal/ioc/credits/purchase
export async function purchaseCredits(
  customerId: number,
  pack: "10" | "50" | "100"
): Promise<{ paymentUrl: string }> {

  const CREDIT_PACKS = {
    "10":  { credits: 10,  priceTL: 50 },
    "50":  { credits: 50,  priceTL: 200 },
    "100": { credits: 100, priceTL: 350 },
  };

  const selected = CREDIT_PACKS[pack];

  // Iyzico one-time payment
  // Mevcut payment servisini kullan
  const payment = await createOneTimePayment({
    customerId,
    amount:      selected.priceTL,
    description: `CyberStep IOC Sorgu Kredisi — ${selected.credits} Sorgu`,
    metadata:    { type: "ioc_credits", pack, credits: selected.credits },
  });

  return { paymentUrl: payment.url };
}

// Ödeme webhook'unda kredi yükle
export async function onCreditPaymentSuccess(
  customerId: number,
  credits: number
): Promise<void> {
  await db.update(iocQueryCreditsTable).set({
    creditsPurchased: sql`credits_purchased + ${credits}`,
    updatedAt: new Date(),
  }).where(eq(iocQueryCreditsTable.customerId, customerId));

  await db.insert(iocCreditTransactionsTable).values({
    customerId,
    amount:      credits,
    type:        "purchase",
    description: `${credits} kredi satın alındı`,
  });
}
```

---

## BÖLÜM 5: API ROTALAR

```typescript
// src/routes/portal/ioc-query.ts
// YENİ DOSYA

// POST /api/portal/ioc/query — Yeni sorgu başlat
router.post("/query", requireCustomer,
  rateLimitMiddleware(10, 60),
  // 10 sorgu/dakika max
  async (req, res) => {

  const customerId = getCustomerId(req)!;
  const { value } = req.body;

  if (!value?.trim()) {
    res.status(400).json({
      error: "Sorgu değeri gerekli"
    });
    return;
  }

  const queryType = detectQueryType(value.trim());
  if (queryType === "unknown") {
    res.status(400).json({
      error: "Desteklenmeyen sorgu tipi. IP, domain, hash veya URL girin."
    });
    return;
  }

  // 24 saat cache kontrolü
  const cached = await getCachedResult(queryType, value.trim());
  if (cached) {
    // Cache hit — kredi düşme, sadece log
    const [newQuery] = await db.insert(iocQueriesTable).values({
      customerId,
      queryType,
      queryValue: value.trim(),
      status:     "completed",
      cacheHit:   true,
      creditsUsed: 0,
      // Cache hit'te kredi kullanma
      shodanResult:      cached.shodanResult,
      virustotalResult:  cached.virustotalResult,
      abuseipdbResult:   cached.abuseipdbResult,
      greynoiseResult:   cached.greynoiseResult,
      threatfoxResult:   cached.threatfoxResult,
      threatLevel:       cached.threatLevel,
      threatScore:       cached.threatScore,
      aiSummary:         cached.aiSummary,
      aiRecommendations: cached.aiRecommendations,
      indicators:        cached.indicators,
      completedAt:       new Date(),
    }).returning();

    res.json({
      queryId:    newQuery.id,
      cached:     true,
      cacheAge:   "24 saatten yeni sonuç",
      threatLevel: cached.threatLevel,
      threatScore: cached.threatScore,
      summary:    cached.aiSummary,
      indicators: cached.indicators,
      recommendations: cached.aiRecommendations,
      sources: buildSourceSummary(cached),
    });
    return;
  }

  // Kredi kontrolü
  const credit = await useCredit(customerId,  0);
  // 0 — henüz query ID yok, sonra güncelle
  if (!credit.success) {
    res.status(402).json({
      error: "Sorgu krediniz tükendi.",
      remaining: 0,
      purchaseUrl: `${process.env.BASE_URL}/portal/ioc/credits`,
    });
    return;
  }

  // Yeni sorgu kaydı oluştur
  const [query] = await db.insert(iocQueriesTable).values({
    customerId,
    queryType,
    queryValue: value.trim(),
    status:     "pending",
    creditsUsed: 1,
  }).returning();

  // Arka planda çalıştır (async)
  setImmediate(() => void runIOCQuery(
    query.id, queryType, value.trim()
  ));

  res.json({
    queryId:   query.id,
    status:    "processing",
    message:   "Sorgu başlatıldı. 5-15 saniye içinde tamamlanır.",
    remaining: credit.remaining,
  });
});

// GET /api/portal/ioc/query/:id — Sonuç getir
router.get("/query/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req)!;
  const queryId = parseInt(req.params.id);

  const [query] = await db.select()
    .from(iocQueriesTable)
    .where(
      and(
        eq(iocQueriesTable.id, queryId),
        eq(iocQueriesTable.customerId, customerId)
      )
    ).limit(1);

  if (!query) {
    res.status(404).json({ error: "Sorgu bulunamadı" });
    return;
  }

  res.json({
    queryId:     query.id,
    queryType:   query.queryType,
    queryValue:  query.queryValue,
    status:      query.status,
    cached:      query.cacheHit,
    threatLevel: query.threatLevel,
    threatScore: query.threatScore,
    summary:     query.aiSummary,
    indicators:  query.indicators,
    recommendations: query.aiRecommendations,
    sources:     buildSourceSummary(query),
    processingTimeMs: query.processingTimeMs,
    createdAt:   query.createdAt,
  });
});

// GET /api/portal/ioc/history — Sorgu geçmişi
router.get("/history", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req)!;
  const { page = 1, limit = 20 } = req.query;

  const queries = await db.select({
    id:          iocQueriesTable.id,
    queryType:   iocQueriesTable.queryType,
    queryValue:  iocQueriesTable.queryValue,
    threatLevel: iocQueriesTable.threatLevel,
    threatScore: iocQueriesTable.threatScore,
    cached:      iocQueriesTable.cacheHit,
    createdAt:   iocQueriesTable.createdAt,
  })
  .from(iocQueriesTable)
  .where(eq(iocQueriesTable.customerId, customerId))
  .orderBy(desc(iocQueriesTable.createdAt))
  .limit(Number(limit))
  .offset((Number(page) - 1) * Number(limit));

  const [credits] = await db.select()
    .from(iocQueryCreditsTable)
    .where(eq(iocQueryCreditsTable.customerId, customerId))
    .limit(1);

  res.json({
    queries,
    credits: {
      total:     (credits?.creditsTotal || 0) +
                 (credits?.creditsPurchased || 0),
      used:      credits?.creditsUsed || 0,
      remaining: Math.max(0,
        (credits?.creditsTotal || 0) +
        (credits?.creditsPurchased || 0) -
        (credits?.creditsUsed || 0)
      ),
    },
  });
});

// GET /api/portal/ioc/credits — Kredi durumu
router.get("/credits", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req)!;

  const [credits] = await db.select()
    .from(iocQueryCreditsTable)
    .where(eq(iocQueryCreditsTable.customerId, customerId))
    .limit(1);

  res.json({
    monthly_included: credits?.creditsTotal || 0,
    purchased:        credits?.creditsPurchased || 0,
    used:             credits?.creditsUsed || 0,
    remaining: Math.max(0,
      (credits?.creditsTotal || 0) +
      (credits?.creditsPurchased || 0) -
      (credits?.creditsUsed || 0)
    ),
    reset_date: credits?.resetDate,
    packs: [
      { credits: 10,  price_tl: 50,  label: "10 Sorgu — 50 TL" },
      { credits: 50,  price_tl: 200, label: "50 Sorgu — 200 TL" },
      { credits: 100, price_tl: 350, label: "100 Sorgu — 350 TL" },
    ],
  });
});
```

---

## BÖLÜM 6: PORTAL SAYFASI

```
/portal/ioc-sorgu

─── TEHDİT SORGULAMA MERKEZİ ────────────────────────────

  ┌─────────────────────────────────────────────────────┐
  │ IP, domain, dosya hash veya URL girin               │
  │                                                     │
  │ [185.143.x.x                               ] [Sorgula] │
  │                                                     │
  │ Örnekler: 185.x.x.x  ·  phishing.com  ·  abc123...│
  └─────────────────────────────────────────────────────┘

  Kalan Krediniz: 8 / 10   [Kredi Yükle →]


─── SONUÇ ────────────────────────────────────────────────
[Sorgu tamamlanınca gösterilir]

  185.143.x.x — 🔴 KRİTİK TEHDİT (Skor: 87/100)

  ┌── AI Yorumu ─────────────────────────────────────────┐
  │ Bu IP adresi aktif olarak fidye yazılımı dağıtmak   │
  │ için kullanılıyor. AbuseIPDB'de 234 kez rapor-       │
  │ landı, son 30 günde 47 yeni şikayet var. Shodan      │
  │ verilerine göre Hollanda'da bir sunucuda çalışıyor   │
  │ ve ThreatFox'ta Emotet botnet C2 olarak kayıtlı.    │
  └──────────────────────────────────────────────────────┘

  Göstergeler:
  🔴 AbuseIPDB      %98 güven skoru — 234 rapor
  🔴 ThreatFox      Emotet C2 — Son görülme: 2 gün önce
  🔴 Feodo Tracker  Aktif botnet C2
  🟡 Shodan         Port 443, 8080 açık

  Önerilen Aksiyonlar:
  ⚡ Hemen  Güvenlik duvarında bu IP'yi engelleyin
  📋 Yakında  Ağ loglarında bu IP'ye bağlantı kontrol edin
  👁️ İzle   Benzer IP aralığı: 185.143.x.0/24

  Kaynak Detayları:
  [Shodan ▼] [AbuseIPDB ▼] [VirusTotal ▼] [ThreatFox ▼]

─── SORGU GEÇMİŞİ ───────────────────────────────────────
Tarih          Sorgu          Tip      Tehdit    Kredi
2 saat önce    185.143.x.x    IP       🔴 Kritik  1
Dün            malware.com    Domain   🟠 Yüksek  1
3 gün önce     d41d8cd9...    Hash     🟢 Temiz   1 (Cache)

[Tümünü Gör] [CSV İndir]
```

---

## BÖLÜM 7: CRON — KREDİ SIFIRLAMA

```typescript
// Her ayın 1'inde 08:00 — aylık kredi sıfırlama
cron.schedule("0 8 1 * *",
  wrapCron("ioc_credit_reset", "0 8 1 * *", async () => {
    const { resetMonthlyCredits } = await import(
      "./services/iocCreditManager"
    );
    await resetMonthlyCredits();
    logger.info("IOC aylık krediler sıfırlandı");
  }),
  { timezone: "Europe/Istanbul" }
);
```

---

## ENVIRONMENT VARIABLES

```bash
# Zaten var olması gerekenler:
SHODAN_API_KEY=               ✅
VIRUSTOTAL_API_KEY=           ekle
ABUSEIPDB_API_KEY=            ekle (ücretsiz)
GOOGLE_SAFE_BROWSING_API_KEY= ekle (ücretsiz)

# Yeni eklenecek:
GREYNOISE_API_KEY=            # greynoise.io/signup (ücretsiz tier)

# Ücretsiz (API key gerektirmez):
# ThreatFox, URLhaus, MalwareBazaar, Feodo Tracker
```

---

## TEST SENARYOLARI

```
1. IP sorgusu:
   POST /api/portal/ioc/query
   { "value": "185.x.x.x" } (bilinen kötü IP)
   → queryId döndü mü?
   → 10-15 sn sonra GET /query/:id
   → status: "completed" mi?
   → threatLevel: "critical" mi?
   → aiSummary Türkçe mi?

2. Cache testi:
   Aynı IP'yi 2 kez sorgula
   → 2. sorguda cached: true mi?
   → Kredi düşmedi mi?

3. Kredi testi:
   10 sorgu kullan
   11. sorguda 402 hatası geldi mi?
   purchaseUrl döndü mü?

4. Hash sorgusu:
   Bilinen bir malware hash'i sorgula
   MalwareBazaar'da bulunuyor mu?
   threatLevel: "critical" mi?

5. Domain sorgusu:
   Bilinen phishing domain gir
   VirusTotal'da malicious dönüyor mu?
   WHOIS domain_age_days kısa mı? (<30)
```

---

*CyberStep.io — IOC Tehdit Sorgulama Merkezi — Haziran 2026*
*Tek Ekran · Tüm Kaynaklar · Türkçe Yorum*
