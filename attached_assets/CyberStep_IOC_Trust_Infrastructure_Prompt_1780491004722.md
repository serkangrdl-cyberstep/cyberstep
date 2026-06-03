# CyberStep.io — IOC Güven Altyapısı
## Replit Agent Promptu — Confidence Scoring + Whitelist + Audit Log

---

## AMAÇ

Bu prompt dört şeyi inşa eder:

1. IOC Confidence Scoring
   Her tehdit verisine kaynak bazlı güven skoru

2. Müşteri Whitelist
   "Bu IP'yi asla bloklatma" mekanizması

3. Aksiyon Audit Log
   Her IOC işlemi izlenebilir ve raporlanabilir

4. Kill Switch
   Tüm otomatik aksiyonları anında durdurma

Şu an FortiGate'e veri gönderimi yok.
Bu altyapı ileride açılacak özellik için zemin.
Satış argümanı olarak da kullanılacak:
"Kontrol tamamen sizde" mesajı.

---

## BÖLÜM 1: VERİTABANI

```sql
-- IOC kayıt tablosu (mevcut ioc tablosu varsa
-- ona kolonlar ekle, yoksa yeni oluştur)
CREATE TABLE IF NOT EXISTS ioc_entries (
  id serial PRIMARY KEY,
  value varchar(500) NOT NULL,
  -- IP, domain, URL, hash
  ioc_type varchar(20) NOT NULL,
  -- 'ip' | 'domain' | 'url' | 'hash'

  -- Kaynak bilgisi
  sources text[] DEFAULT '{}',
  -- ['cisa_kev', 'threatfox', 'urlhaus']

  -- Güven skoru (hesaplanmış)
  confidence_score integer DEFAULT 0,
  -- 0-100
  confidence_level varchar(20),
  -- 'low' | 'medium' | 'high' | 'critical'

  -- Meta
  first_seen_at timestamp DEFAULT now(),
  last_seen_at timestamp DEFAULT now(),
  expires_at timestamp,
  -- Bazı IOC'ler geçici (30 gün sonra kaldır)
  is_active boolean DEFAULT true,

  -- İlişkili tehdit
  malware_family varchar(100),
  threat_type varchar(100),
  tags text[],

  UNIQUE(value, ioc_type)
);

-- Müşteri IP whitelist
CREATE TABLE IF NOT EXISTS customer_ip_whitelist (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),

  ip_cidr varchar(50) NOT NULL,
  -- Tek IP: '185.1.2.3'
  -- CIDR: '185.1.2.0/24'
  -- Wildcard değil, sadece IP veya CIDR

  label varchar(150),
  -- 'Ödeme sağlayıcısı - Iyzico'
  -- 'Ofis statik IP'
  -- 'Yedekleme sunucusu'

  reason varchar(50),
  -- 'payment_provider' | 'office_ip' |
  -- 'backup_server' | 'cdn' | 'monitoring' | 'other'

  added_by varchar(100),
  -- Admin veya müşteri kullanıcı adı

  is_active boolean DEFAULT true,
  expires_at timestamp,
  -- NULL = kalıcı, dolu = geçici whitelist

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  UNIQUE(customer_id, ip_cidr)
);

-- Aksiyon audit log
CREATE TABLE IF NOT EXISTS ioc_action_log (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),

  ioc_value varchar(500) NOT NULL,
  ioc_type varchar(20),
  ioc_id integer REFERENCES ioc_entries(id),

  action varchar(30) NOT NULL,
  -- 'reported'           → Müşteriye bildirildi
  -- 'block_queued'       → Blok kuyruğuna alındı
  -- 'block_sent'         → FortiGate'e gönderildi
  -- 'block_confirmed'    → FortiGate kabul etti
  -- 'skipped_whitelist'  → Whitelist'te, atlandı
  -- 'skipped_confidence' → Güven düşük, atlandı
  -- 'skipped_disabled'   → Auto-block kapalı
  -- 'reverted'           → Blok geri alındı
  -- 'expired'            → IOC süresi doldu

  confidence_score integer,
  sources text[],

  skip_reason varchar(100),
  performed_by varchar(50) DEFAULT 'auto',
  -- 'auto' | 'isr_manual' | 'api' | 'kill_switch'

  -- FortiGate yanıtı (ileride dolar)
  fortinet_response jsonb,
  -- {'status': 'accepted', 'policy_id': '...'}

  reverted_at timestamp,
  revert_reason varchar(100),

  created_at timestamp DEFAULT now()
);

-- Sistem ayarları (kill switch dahil)
CREATE TABLE IF NOT EXISTS system_settings (
  key varchar(100) PRIMARY KEY,
  value text NOT NULL,
  description varchar(255),
  updated_by varchar(100),
  updated_at timestamp DEFAULT now()
);

-- Varsayılan ayarlar
INSERT INTO system_settings (key, value, description)
VALUES
  ('auto_block_enabled', 'false',
   'FortiGate otomatik blok — varsayılan kapalı'),
  ('min_confidence_for_block', '80',
   'Otomatik blok için minimum confidence skoru'),
  ('min_sources_for_block', '2',
   'Blok için minimum kaynak sayısı'),
  ('ioc_report_confidence_threshold', '40',
   'Müşteriye raporlama için minimum skor'),
  ('kill_switch_active', 'false',
   'Acil durdurma — tüm otomatik aksiyonları durdurur')
ON CONFLICT (key) DO NOTHING;
```

---

## BÖLÜM 2: IOC CONFIDENCE SCORING

```typescript
// src/ioc/confidenceScorer.ts
// YENİ DOSYA

// Kaynak ağırlıkları — her kaynak eşit değil
const IOC_SOURCE_WEIGHTS: Record<string, number> = {
  cisa_kev:   100, // ABD resmi — aktif istismar
  usom:        85, // Türkiye resmi — BTK
  feodo:       85, // Botnet C2, çok spesifik
  threatfox:   75, // Abuse.ch community, doğrulanmış
  urlhaus:     70, // Abuse.ch malicious URL
  otx:         60, // AlienVault community, geniş
  greynoise:   65, // Aktif scanner tespiti
  virustotal:  70, // Çok motorlu doğrulama
  spamhaus:    80, // Email güvenlik otoritesi
  // Bilinmeyen kaynak
  unknown:     30,
};

export function calculateIOCConfidence(
  sources: string[],
  additionalSignals?: {
    virusTotalPositives?: number,
    // kaç engine zararlı dedi?
    ageInDays?: number,
    // IOC kaç gündür aktif?
    sightingsCount?: number,
    // Kaç farklı yerde görüldü?
  }
): { score: number; level: string; explanation: string } {

  if (!sources || sources.length === 0) {
    return { score: 0, level: 'none', explanation: 'Kaynak yok' };
  }

  // En yüksek kaynak ağırlığı taban skor
  const maxWeight = Math.max(
    ...sources.map(s => IOC_SOURCE_WEIGHTS[s] || 30)
  );

  let score = maxWeight;
  const bonuses: string[] = [];

  // Çoklu kaynak bonusu
  if (sources.length >= 3) {
    score += 15;
    bonuses.push(`${sources.length} kaynak`);
  } else if (sources.length === 2) {
    score += 8;
    bonuses.push('2 kaynak');
  }

  // VirusTotal sinyali
  if (additionalSignals?.virusTotalPositives) {
    const vt = additionalSignals.virusTotalPositives;
    if (vt >= 20) { score += 10; bonuses.push('VT 20+'); }
    else if (vt >= 10) { score += 6; bonuses.push('VT 10+'); }
    else if (vt >= 5) { score += 3; bonuses.push('VT 5+'); }
  }

  // Yaşlı IOC — güvenilirlik azalır
  if (additionalSignals?.ageInDays) {
    const age = additionalSignals.ageInDays;
    if (age > 365) score -= 20;
    else if (age > 180) score -= 10;
    else if (age > 90) score -= 5;
  }

  score = Math.min(100, Math.max(0, score));

  // Seviye belirleme
  const level =
    score >= 80 ? 'high' :
    score >= 60 ? 'medium' :
    score >= 40 ? 'low' : 'minimal';

  // Açıklama
  const explanation = [
    `Kaynaklar: ${sources.join(', ')}`,
    ...bonuses,
    `Skor: ${score}/100`,
  ].join(' | ');

  return { score, level, explanation };
}

// Mevcut IOC feed işleme fonksiyonunu bul
// (threatfox, urlhaus, feodo, cisa_kev verilerini
//  işleyen yer)
// Her IOC kaydedilirken confidence hesapla ve kaydet:
//
// const confidence = calculateIOCConfidence(
//   [sourceName],  // ['threatfox']
//   { virusTotalPositives: vtScore }
// );
//
// await db.insert(iocEntries).values({
//   value: ioc.value,
//   iocType: ioc.type,
//   sources: [sourceName],
//   confidenceScore: confidence.score,
//   confidenceLevel: confidence.level,
//   ...
// }).onConflictDoUpdate({
//   target: [iocEntries.value, iocEntries.iocType],
//   set: {
//     sources: sql`array_append(
//       CASE WHEN ${sourceName} = ANY(ioc_entries.sources)
//       THEN ioc_entries.sources
//       ELSE array_append(ioc_entries.sources, ${sourceName})
//       END, NULL
//     )`,
//     // Yeni kaynak eklenince confidence yeniden hesapla
//     confidenceScore: confidence.score,
//     lastSeenAt: new Date(),
//   }
// });
```

---

## BÖLÜM 3: WHITELIST KONTROLÜ

```typescript
// src/ioc/whitelistChecker.ts
// YENİ DOSYA

import { isIPInCIDR } from './ipUtils';

export async function isWhitelisted(
  ipOrDomain: string,
  customerId: number
): Promise<{ whitelisted: boolean; matchedRule?: string }> {

  // Sadece IP kontrolü (domain için farklı mantık gerekir)
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipOrDomain);
  if (!isIP) {
    return { whitelisted: false };
  }

  const rules = await db.select()
    .from(customerIpWhitelist)
    .where(
      and(
        eq(customerIpWhitelist.customerId, customerId),
        eq(customerIpWhitelist.isActive, true),
        or(
          isNull(customerIpWhitelist.expiresAt),
          gte(customerIpWhitelist.expiresAt, new Date())
        )
      )
    );

  for (const rule of rules) {
    // Tam eşleşme
    if (rule.ipCidr === ipOrDomain) {
      return {
        whitelisted: true,
        matchedRule: `${rule.label} (${rule.ipCidr})`,
      };
    }
    // CIDR kontrolü
    if (rule.ipCidr.includes('/')) {
      if (isIPInCIDR(ipOrDomain, rule.ipCidr)) {
        return {
          whitelisted: true,
          matchedRule: `${rule.label} (${rule.ipCidr})`,
        };
      }
    }
  }

  return { whitelisted: false };
}

// IP CIDR kontrolü yardımcısı
// ipUtils.ts'e ekle:
export function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipNum = ip.split('.').reduce(
    (acc, oct) => (acc << 8) + parseInt(oct), 0
  );
  const rangeNum = range.split('.').reduce(
    (acc, oct) => (acc << 8) + parseInt(oct), 0
  );

  return (ipNum & mask) === (rangeNum & mask);
}
```

---

## BÖLÜM 4: AKSİYON LOG FONKSİYONU

```typescript
// src/ioc/actionLogger.ts
// YENİ DOSYA

export async function logIOCAction(params: {
  customerId: number;
  iocValue: string;
  iocType: string;
  iocId?: number;
  action: string;
  confidenceScore?: number;
  sources?: string[];
  skipReason?: string;
  performedBy?: string;
  fortinetResponse?: object;
}): Promise<void> {

  await db.insert(iocActionLog).values({
    customerId: params.customerId,
    iocValue: params.iocValue,
    iocType: params.iocType,
    iocId: params.iocId,
    action: params.action,
    confidenceScore: params.confidenceScore,
    sources: params.sources || [],
    skipReason: params.skipReason,
    performedBy: params.performedBy || 'auto',
    fortinetResponse: params.fortinetResponse,
  });
}

// IOC'yi işleyen her yerde şunu çağır:
// Örnek kullanım:

export async function processIOCForCustomer(
  ioc: IOCEntry,
  customerId: number
): Promise<void> {

  const settings = await getSystemSettings();

  // Kill switch kontrolü
  if (settings.kill_switch_active === 'true') {
    await logIOCAction({
      customerId,
      iocValue: ioc.value,
      iocType: ioc.iocType,
      iocId: ioc.id,
      action: 'skipped_disabled',
      skipReason: 'kill_switch_active',
    });
    return;
  }

  // Confidence kontrolü
  const minScore = parseInt(settings.ioc_report_confidence_threshold);
  if (ioc.confidenceScore < minScore) {
    await logIOCAction({
      customerId,
      iocValue: ioc.value,
      iocType: ioc.iocType,
      iocId: ioc.id,
      action: 'skipped_confidence',
      confidenceScore: ioc.confidenceScore,
      skipReason: `confidence_${ioc.confidenceScore}_below_${minScore}`,
    });
    return;
  }

  // Whitelist kontrolü
  const whitelistResult = await isWhitelisted(ioc.value, customerId);
  if (whitelistResult.whitelisted) {
    await logIOCAction({
      customerId,
      iocValue: ioc.value,
      iocType: ioc.iocType,
      iocId: ioc.id,
      action: 'skipped_whitelist',
      skipReason: whitelistResult.matchedRule,
    });
    return;
  }

  // Müşteriyi bildir (her zaman)
  await logIOCAction({
    customerId,
    iocValue: ioc.value,
    iocType: ioc.iocType,
    iocId: ioc.id,
    action: 'reported',
    confidenceScore: ioc.confidenceScore,
    sources: ioc.sources,
  });

  // Auto-block kontrolü (ileride aktif olacak)
  const autoBlockEnabled = settings.auto_block_enabled === 'true';
  const minBlockScore = parseInt(settings.min_confidence_for_block);
  const minSources = parseInt(settings.min_sources_for_block);

  if (
    autoBlockEnabled &&
    ioc.confidenceScore >= minBlockScore &&
    ioc.sources.length >= minSources
  ) {
    // TODO: FortiGate entegrasyonu aktif olduğunda burayı aç
    // await sendToFortiGate(ioc, customerId);

    await logIOCAction({
      customerId,
      iocValue: ioc.value,
      iocType: ioc.iocType,
      iocId: ioc.id,
      action: 'block_queued',
      // queued — henüz gönderilmedi
      confidenceScore: ioc.confidenceScore,
      sources: ioc.sources,
    });
  }
}
```

---

## BÖLÜM 5: KILL SWITCH

```typescript
// src/ioc/killSwitch.ts
// YENİ DOSYA

export async function activateKillSwitch(
  reason: string,
  activatedBy: string
): Promise<void> {

  // Redis'e yaz (anlık etki için)
  if (redis) {
    await redis.set('kill_switch_active', 'true');
    await redis.set('kill_switch_reason', reason);
  }

  // DB'ye de yaz (kalıcı kayıt)
  await db.update(systemSettings)
    .set({
      value: 'true',
      updatedBy: activatedBy,
      updatedAt: new Date(),
    })
    .where(eq(systemSettings.key, 'kill_switch_active'));

  // Bekleyen tüm block_queued aksiyonları iptal et
  await db.update(iocActionLog)
    .set({
      action: 'skipped_disabled',
      skipReason: `kill_switch: ${reason}`,
    })
    .where(eq(iocActionLog.action, 'block_queued'));

  // Tüm admin ve ISR'a bildirim
  await sendEmergencyAlert({
    subject: '⛔ IOC Kill Switch Aktif Edildi',
    body: `Aktif eden: ${activatedBy}\nNeden: ${reason}`,
    channels: ['email', 'telegram'],
  });

  logger.warn(`Kill switch aktif: ${reason} (${activatedBy})`);
}

export async function deactivateKillSwitch(
  deactivatedBy: string
): Promise<void> {

  if (redis) {
    await redis.del('kill_switch_active');
  }

  await db.update(systemSettings)
    .set({
      value: 'false',
      updatedBy: deactivatedBy,
      updatedAt: new Date(),
    })
    .where(eq(systemSettings.key, 'kill_switch_active'));

  logger.info(`Kill switch deaktif: ${deactivatedBy}`);
}

// Her IOC işlemi başında bu kontrolü yap:
export async function isKillSwitchActive(): Promise<boolean> {
  // Önce Redis'e bak (hızlı)
  if (redis) {
    const cached = await redis.get('kill_switch_active');
    if (cached !== null) return cached === 'true';
  }
  // Redis yoksa DB'den
  const setting = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'kill_switch_active'))
    .limit(1);
  return setting[0]?.value === 'true';
}
```

---

## BÖLÜM 6: SCAN AUDIT LOG

```typescript
// src/scanner/scanAuditLogger.ts
// YENİ DOSYA — Her domain taramasını belgele

// domain_scans tablosuna şu kolonları ekle:
// ALTER TABLE domain_scans
//   ADD COLUMN IF NOT EXISTS scan_method varchar(50),
//   ADD COLUMN IF NOT EXISTS external_apis_used text[],
//   ADD COLUMN IF NOT EXISTS direct_port_scan boolean DEFAULT false,
//   ADD COLUMN IF NOT EXISTS requests_made integer DEFAULT 0;

export async function logScanAudit(
  scanId: number,
  details: {
    method: 'passive' | 'active' | 'hybrid';
    apisUsed: string[];
    requestsMade: number;
    directPortScan: boolean;
  }
): Promise<void> {

  await db.update(domainScans).set({
    scanMethod: details.method,
    externalApisUsed: details.apisUsed,
    requestsMade: details.requestsMade,
    directPortScan: details.directPortScan,
  }).where(eq(domainScans.id, scanId));
}

// Tarama tamamlandığında çağır:
// await logScanAudit(scan.id, {
//   method: 'passive',
//   apisUsed: ['shodan', 'hibp', 'virustotal', 'crtsh'],
//   requestsMade: 3,  // DNS + HTTP header + SSL
//   directPortScan: false,
// });
```

---

## BÖLÜM 7: ADMİN PANELİ EKLEMELERI

```
/admin-panel/security/ioc-controls

─── GENEL AYARLAR ───────────────────────────────────────────
Auto-Block:        ⛔ KAPALI (varsayılan)
                   [Aktif Et] ← sadece whitelist kurulduktan sonra

Min Confidence:    80/100
Min Kaynak:        2

─── KİLL SWİTCH ─────────────────────────────────────────────
Durum:  🟢 Normal

[⛔ Acil Durdur] ← büyük kırmızı buton
Tüm otomatik aksiyonları anında durdurur.

─── IOC İSTATİSTİKLERİ (Son 24 Saat) ───────────────────────
Toplam IOC işlendi:     1.247
Müşteriye raporlanan:   892  (%71)
Whitelist'ten atlanan:   45  (%4)
Düşük confidence:       289  (%23)
Block kuyruğu:            0  (auto-block kapalı)

─── SON AKSİYON LOGU ────────────────────────────────────────
Saat     Müşteri    IOC              Aksiyon        Skor
14:23    Acme A.Ş.  185.x.x.x       reported        85
14:23    Beta Ltd.  malware.com.tr  skipped_wlist    90
14:22    Acme A.Ş.  192.x.x.x       skipped_conf    35
...

[Tüm Logu Gör] [CSV İndir] [Müşteri Filtrele]


/admin-panel/customers/:id/whitelist

─── IP BEYAZ LİSTE ──────────────────────────────────────────
Acme A.Ş. — Güvenli IP Listesi

185.x.x.x/24   Iyzico Ödeme Altyapısı     Kalıcı    [Sil]
212.x.x.x      Ofis Statik IP             Kalıcı    [Sil]
10.x.x.x/8     İç Ağ (RFC1918)           Kalıcı    [Sil]

[+ Yeni IP / CIDR Ekle]

Not: Bu listedeki IP'ler hiçbir koşulda
engellenemez ve IOC eşleşmesi raporlanmaz.
```

---

## BÖLÜM 8: MÜŞTERİ PORTAL EKLEMESİ

```
/portal/security/whitelist  (müşteri kendi yönetir)

─── GÜVENLİ IP LİSTEM ───────────────────────────────────────
Bu IP'ler CyberStep tarafından hiçbir zaman
tehdit olarak işaretlenmez.

185.x.x.x/24   Ödeme Sağlayıcısı  [Düzenle] [Sil]
212.x.x.x      Ofis IP            [Düzenle] [Sil]

[+ IP Ekle]

Neden eklerim?
  Ödeme sağlayıcısı IP'leri
  Ofis veya şube IP'leri
  Yedekleme sunucuları
  Monitoring servisleri


/portal/security/ioc-log  (müşteri kendi logunu görür)

─── TEHDİT KAYIT LOGU ───────────────────────────────────────
Son 30 gün — Acme A.Ş.

Saat     Tehdit             Durum        Güven
14:23    185.x.x.x (IP)    Raporlandı   Yüksek
14:22    192.x.x.x (IP)    Atlandı*     Düşük
13:45    malware.com       Raporlandı   Kritik

*Güven skoru minimum eşiğin altında.

[PDF Rapor İndir] ← denetim için
```

---

## BÖLÜM 9: API ROTALAR

```
─── IOC YÖNETİMİ ────────────────────────────────────────────
GET  /api/admin/ioc/stats              → Genel istatistikler
GET  /api/admin/ioc/log                → Aksiyon logu
GET  /api/admin/ioc/entries            → IOC listesi (filtreli)

─── SİSTEM AYARLARI ─────────────────────────────────────────
GET  /api/admin/settings               → Tüm ayarlar
PUT  /api/admin/settings/:key          → Ayar güncelle

POST /api/admin/kill-switch/activate   → Kill switch aç
POST /api/admin/kill-switch/deactivate → Kill switch kapat

─── WHİTELİST ───────────────────────────────────────────────
GET  /api/admin/customers/:id/whitelist
POST /api/admin/customers/:id/whitelist
DELETE /api/admin/customers/:id/whitelist/:entryId

GET  /api/portal/whitelist             → Müşteri kendi listesi
POST /api/portal/whitelist
DELETE /api/portal/whitelist/:id

─── AUDIT LOG ───────────────────────────────────────────────
GET  /api/admin/ioc/log/export         → CSV export
GET  /api/portal/ioc-log               → Müşteri kendi logu
GET  /api/portal/ioc-log/export        → PDF export
```

---

## BÖLÜM 10: SATIŞ ARGÜMANI METNİ

Bu altyapı tamamlandığında şu metni
web sitesine ve satış sunumuna ekle:

```
/admin-panel/content/sales-copy
veya doğrudan web sitesi servis sayfasına:

"Tehdit İstihbaratı Kontrolü Sizde

CyberStep tespit ettiği tehditleri
size bildirir. Sisteminize müdahale etmez.

Müşterilerimize sunduğumuz kontroller:

✓ Güvenli IP Listesi
  Hiçbir koşulda işaretlenmeyecek
  IP'lerinizi tanımlayın.
  Ödeme sağlayıcıları, ofis IP'leri,
  yedekleme sistemleri.

✓ Güven Eşiği
  Kaç kaynaktan doğrulanmış tehditleri
  görmek istediğinizi siz belirleyin.

✓ Tam Denetim İzi
  Her tehdit tespiti, her karar,
  her atlanan bildirim log'da.
  Denetim için PDF export.

✓ Anlık Durdurma
  Tek tuşla tüm otomatik bildirimleri
  durdurabilirsiniz.

Verilerinizin kontrolü tamamen sizde."
```

---

## TEST SENARYOSU

```
1. Confidence scoring testi:
   Bir IOC'yi sadece 'threatfox' kaynağıyla ekle
   → confidenceScore: 75, level: 'medium'

   Aynı IOC'ye 'cisa_kev' de ekle
   → confidenceScore: 90+, level: 'high'

2. Whitelist testi:
   Müşteri A için '8.8.8.8' whitelist'e ekle
   processIOCForCustomer('8.8.8.8', customerA.id)
   → action: 'skipped_whitelist' logu düştü mü?

   Müşteri B için aynı IP — whitelist yok
   → action: 'reported' logu düştü mü?

3. Kill switch testi:
   activateKillSwitch('test', 'admin')
   Yeni IOC işlemeye çalış
   → action: 'skipped_disabled' logu düştü mü?
   deactivateKillSwitch('admin')
   → Normal akış devam etti mi?

4. Audit log testi:
   GET /api/portal/ioc-log (müşteri token ile)
   → Sadece kendi logları görüyor mu?
   GET /api/portal/ioc-log/export
   → PDF indi mi?
```

---

*CyberStep.io — IOC Güven Altyapısı — 2026*
*"Kontrol tamamen sizde" — Satış Argümanı Altyapısı*
