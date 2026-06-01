# CyberStep.io — AI Destekli NOC Servisi
## Replit Agent Promptu — Tam NOC Altyapısı

---

## MİMARİ ÖZET

```
[MÜŞTERİ AĞI]                    [CyberStep Cloud]

FortiGate
  ↓ SNMP Trap (UDP 162)        → /api/noc/snmp-trap/:token
  ↓ Syslog Perf Logs           → /api/noc/syslog/:token (mevcut)
  ↓ NetFlow (UDP 2055)         → NetFlow Collector
  ↓ REST API (Read-Only)       → Polling (5 dk)
  ↓
Diğer Ağ Cihazları
  ↓ SNMP v2c/v3               → Polling + Trap
  ↓
Kritik Sunucular/Servisler
  ↓ ICMP Ping                 → Availability Monitor
  ↓ HTTP Health Check         → Servis Uptime

            CyberStep NOC Engine
                    ↓
            Normalizasyon + Baseline
                    ↓
            Claude Anomali Tespiti
                    ↓
         SOC-NOC Korelasyon Motoru
                    ↓
    Bildirim + Case + Playbook + Rapor
```

**Tasarım Prensibi:**
CyberStep hiçbir zaman müşteri ağına config değişikliği yapmaz.
Sadece izle, analiz et, uyar. Passive AI NOC.

---

## BÖLÜM 1: VERİTABANI

```sql
-- ─── NOC ANA TABLOLAR ─────────────────────────────────────

-- Müşteri NOC entegrasyon yapılandırması
CREATE TABLE IF NOT EXISTS noc_integrations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,

  -- Tier
  noc_tier varchar(20),
  -- 'lite' | 'standart' | 'pro'

  -- SNMP Trap endpoint
  snmp_token varchar(64) UNIQUE,
  snmp_trap_enabled boolean DEFAULT false,
  snmp_last_received_at timestamp,
  snmp_trap_count integer DEFAULT 0,

  -- NetFlow endpoint
  netflow_token varchar(64) UNIQUE,
  netflow_enabled boolean DEFAULT false,
  netflow_last_received_at timestamp,

  -- FortiGate REST API (ağ metrikleri için)
  fortigate_host varchar(255),
  fortigate_token_encrypted text,
  fortigate_polling_enabled boolean DEFAULT false,
  fortigate_poll_interval_minutes integer DEFAULT 5,
  fortigate_last_polled_at timestamp,

  -- İzlenen cihazlar
  monitored_devices jsonb DEFAULT '[]',
  -- [{ip, name, type, snmp_community, critical: true/false}]

  -- İzlenen servisler
  monitored_services jsonb DEFAULT '[]',
  -- [{url, name, check_type: 'ping'|'http', critical: true/false}]

  -- Eşik değerleri (müşteri özelleştirebilir)
  bandwidth_warning_pct integer DEFAULT 70,
  bandwidth_critical_pct integer DEFAULT 90,
  packet_loss_warning_pct decimal(5,2) DEFAULT 2.0,
  packet_loss_critical_pct decimal(5,2) DEFAULT 10.0,
  latency_warning_ms integer DEFAULT 100,
  latency_critical_ms integer DEFAULT 300,
  availability_sla_pct decimal(5,2) DEFAULT 99.5,

  -- Baseline (ilk 14 günde öğrenilir)
  baseline_learning boolean DEFAULT true,
  baseline_completed_at timestamp,
  baseline_data jsonb DEFAULT '{}',
  -- {avg_bandwidth_in: X, avg_bandwidth_out: Y, ...}

  -- Kurulum durumu
  setup_step integer DEFAULT 0,
  setup_completed_at timestamp,

  -- İstatistikler
  total_events integer DEFAULT 0,
  total_alerts integer DEFAULT 0,
  uptime_this_month_pct decimal(5,2) DEFAULT 100.0,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- NOC gelen olaylar
CREATE TABLE IF NOT EXISTS noc_events (
  id serial PRIMARY KEY,
  integration_id integer REFERENCES noc_integrations(id),
  customer_id integer REFERENCES customers(id),

  -- Kaynak
  source varchar(30) NOT NULL,
  -- 'snmp_trap' | 'netflow' | 'api_poll' | 'ping' | 'http_check'

  -- Cihaz/Servis
  device_ip varchar(50),
  device_name varchar(255),
  device_type varchar(50),
  -- 'fortigate' | 'switch' | 'router' | 'server' | 'wan_link'
  interface_name varchar(100),
  -- 'wan1' | 'internal' | 'port1' vb.

  -- Olay tipi
  event_type varchar(50) NOT NULL,
  -- 'interface_down' | 'interface_up' | 'bandwidth_high' |
  -- 'packet_loss_high' | 'latency_high' | 'device_unreachable' |
  -- 'device_recovered' | 'traffic_anomaly' | 'new_device_detected' |
  -- 'wan_quality_degraded' | 'capacity_warning' | 'bgp_change'

  severity varchar(20) NOT NULL,
  -- 'critical' | 'high' | 'medium' | 'low' | 'info'

  -- Metrik değerleri
  metric_name varchar(100),
  -- 'bandwidth_utilization' | 'packet_loss' | 'latency' vb.
  metric_value decimal(12,4),
  metric_unit varchar(20),
  -- '%' | 'Mbps' | 'ms' | 'pps'
  metric_threshold decimal(12,4),
  -- Aşılan eşik değeri

  -- Açıklama
  title varchar(500),
  description text,

  -- İşleme durumu
  processed boolean DEFAULT false,
  processed_at timestamp,
  claude_analysis jsonb,
  -- Claude'un analizi
  correlated_soc_event_id integer REFERENCES fabric_events(id),
  alert_sent boolean DEFAULT false,
  noc_case_id integer REFERENCES noc_cases(id),

  raw_data jsonb,
  -- Ham SNMP/NetFlow/API verisi
  occurred_at timestamp NOT NULL,
  received_at timestamp DEFAULT now()
);

-- NOC metrikleri — zaman serisi
CREATE TABLE IF NOT EXISTS noc_metrics (
  id bigserial PRIMARY KEY,
  integration_id integer REFERENCES noc_integrations(id),
  customer_id integer REFERENCES customers(id),

  device_ip varchar(50),
  interface_name varchar(100),
  metric_type varchar(50),
  -- 'bandwidth_in' | 'bandwidth_out' | 'packet_loss' |
  -- 'latency' | 'cpu' | 'memory' | 'availability'
  value decimal(12,4),
  unit varchar(20),

  recorded_at timestamp NOT NULL
);

-- 30 günden eski verileri otomatik sil
-- (TimescaleDB veya partitioning ileride)

CREATE INDEX idx_noc_metrics_lookup
  ON noc_metrics(customer_id, device_ip, metric_type, recorded_at DESC);

-- NOC vakaları (SOC case ile aynı mantık)
CREATE TABLE IF NOT EXISTS noc_cases (
  id serial PRIMARY KEY,
  case_number varchar(30) UNIQUE NOT NULL,
  -- CS-NOC-2026-00001
  customer_id integer REFERENCES customers(id),

  case_type varchar(30) NOT NULL,
  -- 'outage' | 'degradation' | 'anomaly' | 'capacity' | 'security_correlated'

  severity varchar(20) NOT NULL,
  priority integer DEFAULT 3,
  -- P1=Kritik, P2=Yüksek, P3=Orta, P4=Düşük

  title varchar(500),
  description text,
  root_cause_analysis text,
  -- Claude'un kök neden analizi

  -- Etkilenen cihazlar/servisler
  affected_devices text[],
  affected_services text[],

  -- Durum
  status varchar(30) DEFAULT 'open',
  -- 'open' | 'investigating' | 'monitoring' | 'resolved' | 'closed'

  -- SOC ilişkisi
  related_soc_case_id integer REFERENCES soc_cases(id),
  is_security_related boolean DEFAULT false,

  -- SLA
  sla_minutes integer,
  -- P1: 15, P2: 60, P3: 240, P4: 1440
  sla_deadline timestamp,
  sla_breached boolean DEFAULT false,
  response_time_minutes integer,
  resolution_time_minutes integer,

  -- Aksiyonlar
  actions_taken jsonb DEFAULT '[]',
  customer_notified_at timestamp,
  resolved_at timestamp,
  closed_at timestamp,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Availability tracking (uptime hesabı için)
CREATE TABLE IF NOT EXISTS noc_availability (
  id bigserial PRIMARY KEY,
  integration_id integer REFERENCES noc_integrations(id),
  customer_id integer REFERENCES customers(id),
  target_type varchar(20),
  -- 'device' | 'service' | 'wan_link'
  target_identifier varchar(255),
  -- IP adresi veya URL
  is_up boolean NOT NULL,
  check_latency_ms integer,
  checked_at timestamp NOT NULL
);

CREATE INDEX idx_noc_availability_lookup
  ON noc_availability(customer_id, target_identifier, checked_at DESC);

-- NOC SLA konfigürasyonu
INSERT INTO soc_sla_config
  (soc_tier, severity, response_minutes, resolution_hours, escalation_minutes)
VALUES
  ('noc_lite',     'critical', 30,   4,   60),
  ('noc_lite',     'high',     120,  24,  240),
  ('noc_lite',     'medium',   480,  72,  960),
  ('noc_lite',     'low',      1440, 168, 2880),
  ('noc_standart', 'critical', 15,   2,   30),
  ('noc_standart', 'high',     60,   8,   120),
  ('noc_standart', 'medium',   240,  48,  480),
  ('noc_standart', 'low',      720,  120, 1440),
  ('noc_pro',      'critical', 5,    1,   10),
  ('noc_pro',      'high',     30,   4,   60),
  ('noc_pro',      'medium',   120,  24,  240),
  ('noc_pro',      'low',      480,  72,  960)
ON CONFLICT DO NOTHING;
```

---

## BÖLÜM 2: SERVİS KATALOĞU — NOC EKLEMELERİ

```sql
-- Mevcut service_catalog tablosuna NOC servislerini ekle

INSERT INTO service_catalog
  (slug, name, short_description, category, service_type,
   price_tl, price_tl_annual,
   setup_time_hours, delivery_time_hours, sla_response_minutes,
   features, target_audience, is_self_service,
   requires_admin_approval, sort_order)
VALUES

-- ─── AI NOC SERVİSLERİ ────────────────────────────────────
('noc-lite',
 'AI NOC Lite',
 '7/24 otomatik ağ izleme ve uptime takibi',
 'noc', 'monthly',
 3900,   -- KDV hariç
 39000,  -- Yıllık (2 ay bedava)
 4, 0, 120,
 '["7/24 otomatik ağ izleme",
   "Interface up/down bildirimleri",
   "WAN bant genişliği kullanım izleme",
   "Kritik servis uptime takibi",
   "Aylık ağ performans raporu",
   "E-posta + Telegram bildirimleri",
   "FortiGate SNMP/Syslog entegrasyonu",
   "NOC dashboard erişimi"]',
 '["5-50 çalışan", "Tek lokasyon", "Temel ağ izleme ihtiyacı"]',
 true, false, 200),

('noc-standart',
 'AI NOC Standart',
 'Anomali tespiti ve kapasite planlaması ile profesyonel ağ izleme',
 'noc', 'monthly',
 6900,
 69000,  -- Yıllık
 8, 0, 60,
 '["NOC Lite dahil",
   "AI anomali tespiti (baseline öğrenme)",
   "WAN link kalite izleme (jitter, packet loss)",
   "Kapasite planlama raporu (aylık)",
   "NetFlow trafik analizi",
   "Çoklu lokasyon desteği",
   "SOC-NOC korelasyon",
   "Slack/Teams bildirim entegrasyonu",
   "Haftalık ağ sağlık özeti",
   "7/24 P1/P2 eskalasyon"]',
 '["50-200 çalışan", "Çoklu lokasyon", "FortiGate + WAN bağlantısı"]',
 true, false, 205),

('noc-pro',
 'AI NOC Pro',
 'Kriz yönetimi dahil kurumsal ağ operasyon merkezi',
 'noc', 'monthly',
 11900,
 119000,  -- Yıllık
 24, 0, 30,
 '["NOC Standart dahil",
   "7/24 analist desteği",
   "Gerçek zamanlı trafik görselleştirme",
   "Özel SLA anlaşması",
   "BGP/routing anomali tespiti",
   "Güvenlik duvarı kural optimizasyon önerisi",
   "Aylık executive ağ raporu",
   "Kriz yönetimi (P1 sahaya destek koordinasyonu)"]',
 '["200+ çalışan", "Kritik altyapı", "Finans/Sağlık/Kamu"]',
 false, true, 210),

-- ─── SOC + NOC KOMBİNASYON PAKETLERİ ─────────────────────
('bundle-soc-noc-lite',
 'AI SOC + NOC Lite',
 'Güvenlik ve ağ izlemesini tek platformda birleştirin',
 'bundle', 'monthly',
 7900,    -- Normal: 4900 + 3900 = 8800 TL, %10 indirim
 79000,
 4, 0, 60,
 '["AI SOC Lite dahil",
   "AI NOC Lite dahil",
   "SOC-NOC korelasyon motoru",
   "Birleşik dashboard",
   "\"Saldırı mı, ağ sorunu mu?\" otomatik ayrım",
   "%10 indirim"]',
 '["5-50 çalışan", "Tek pencereden operasyon"]',
 true, false, 220),

('bundle-soc-noc-standart',
 'AI SOC + NOC Standart',
 'Kurumsal operasyon merkezi — güvenlik ve ağ tek ekranda',
 'bundle', 'monthly',
 12900,   -- Normal: 8500 + 6900 = 15400 TL, %16 indirim
 129000,
 8, 0, 30,
 '["AI SOC Standart dahil",
   "AI NOC Standart dahil",
   "DDoS otomatik tespiti ve blok",
   "Veri sızdırma anomali korelasyonu",
   "Birleşik haftalık rapor",
   "Fortinet Security Fabric + NetFlow",
   "%16 indirim"]',
 '["50-200 çalışan", "FortiGate + monitoring araçları"]',
 true, false, 225),

('bundle-soc-noc-pro',
 'AI SOC + NOC Pro',
 '7/24 tam yönetilen operasyon — güvenlik ve ağ',
 'bundle', 'monthly',
 24900,   -- Normal: 16500 + 11900 = 28400 TL, %12 indirim
 249000,
 24, 0, 15,
 '["AI SOC Pro dahil",
   "AI NOC Pro dahil",
   "Sanal CISO dahil",
   "7/24 çift disiplin analist",
   "Özel SLA anlaşması",
   "Aylık C-level brifing",
   "%12 indirim"]',
 '["200+ çalışan", "Kritik altyapı yönetimi"]',
 false, true, 230);
```

## KDV Hesaplama Tablosu

```sql
-- KDV oranı: %20 (2024 Türkiye standart KDV oranı)
-- Fiyat sayfasında her iki değer gösterilmeli

-- KDV hesaplama view'i
CREATE OR REPLACE VIEW service_catalog_with_vat AS
SELECT
  *,
  20 AS vat_rate_pct,
  ROUND(price_tl * 1.20, 2) AS price_tl_with_vat,
  ROUND(price_tl * 0.20, 2) AS vat_amount_tl,
  CASE WHEN price_tl_annual IS NOT NULL
    THEN ROUND(price_tl_annual * 1.20, 2)
  END AS price_tl_annual_with_vat
FROM service_catalog
WHERE is_active = true;
```

### Fiyat Tablosu (KDV Dahil/Hariç)

```
Servis                    KDV Hariç     KDV (%20)    KDV Dahil
──────────────────────────────────────────────────────────────
AI NOC Lite               3.900 TL       780 TL       4.680 TL/ay
AI NOC Standart           6.900 TL     1.380 TL       8.280 TL/ay
AI NOC Pro               11.900 TL     2.380 TL      14.280 TL/ay

AI NOC Lite (Yıllık)     39.000 TL     7.800 TL      46.800 TL/yıl
AI NOC Standart (Yıllık) 69.000 TL    13.800 TL      82.800 TL/yıl
AI NOC Pro (Yıllık)     119.000 TL    23.800 TL     142.800 TL/yıl

SOC + NOC Lite           7.900 TL      1.580 TL       9.480 TL/ay
SOC + NOC Standart      12.900 TL      2.580 TL      15.480 TL/ay
SOC + NOC Pro           24.900 TL      4.980 TL      29.880 TL/ay

Karşılaştırma (SOC+NOC ayrı):
  SOC Lite + NOC Lite:     8.800 TL  →  7.900 TL (%10 tasarruf)
  SOC Standart + NOC Std: 15.400 TL  → 12.900 TL (%16 tasarruf)
  SOC Pro + NOC Pro:      28.400 TL  → 24.900 TL (%12 tasarruf)
```

---

## BÖLÜM 3: VERİ TOPLAMA SİSTEMLERİ

### 3a — SNMP Trap Receiver

```typescript
// src/noc/snmpReceiver.ts
// UDP port 1162 (root gerektirmeyen — firewall'da 162→1162 forward)

import dgram from 'dgram';
import snmp from 'net-snmp'; // pnpm add net-snmp

export function startSNMPTrapReceiver(): void {
  const server = dgram.createSocket('udp4');

  server.on('message', async (msg, rinfo) => {
    try {
      // Source IP'den müşteri entegrasyonunu bul
      const integration = await getNOCIntegrationByDeviceIP(rinfo.address);
      if (!integration) return;

      // SNMP trap parse et
      const trap = parseSNMPTrap(msg);
      if (!trap) return;

      // Olay tipi belirle
      const eventType = mapSNMPTrapToEventType(trap);
      const severity = determineSNMPSeverity(trap, integration);

      await db.insert(nocEvents).values({
        integrationId: integration.id,
        customerId: integration.customerId,
        source: 'snmp_trap',
        deviceIp: rinfo.address,
        deviceName: await resolveDeviceName(rinfo.address, integration),
        eventType,
        severity,
        title: buildTrapTitle(trap),
        description: buildTrapDescription(trap),
        rawData: trap,
        occurredAt: new Date(),
      });

      await db.update(nocIntegrations).set({
        snmpLastReceivedAt: new Date(),
        snmpTrapCount: sql`snmp_trap_count + 1`,
        totalEvents: sql`total_events + 1`,
      }).where(eq(nocIntegrations.id, integration.id));

      // Kritik event → anlık işleme
      if (['critical', 'high'].includes(severity)) {
        setImmediate(() => processNOCEvent(integration.customerId, eventType));
      }

    } catch (e) {
      logger.error('SNMP trap processing error', e);
    }
  });

  server.bind(1162, () => {
    logger.info('SNMP Trap receiver listening on UDP 1162');
  });
}

// SNMP OID → Event type mapping
function mapSNMPTrapToEventType(trap: SNMPTrap): string {
  const oidMap: Record<string, string> = {
    '1.3.6.1.6.3.1.1.5.3': 'interface_down',  // linkDown
    '1.3.6.1.6.3.1.1.5.4': 'interface_up',    // linkUp
    '1.3.6.1.6.3.1.1.5.1': 'device_cold_start', // coldStart
    '1.3.6.1.6.3.1.1.5.2': 'device_warm_start', // warmStart
    // Fortinet özel OID'leri
    '1.3.6.1.4.1.12356.101.6.0.1': 'fortiguard_update',
    '1.3.6.1.4.1.12356.101.6.0.502': 'ips_detected',
    '1.3.6.1.4.1.12356.101.6.0.1006': 'ha_failover',
    '1.3.6.1.4.1.12356.101.6.0.108': 'vpn_tunnel_down',
    '1.3.6.1.4.1.12356.101.6.0.110': 'vpn_tunnel_up',
    '1.3.6.1.4.1.12356.101.6.0.210': 'device_cpu_high',
    '1.3.6.1.4.1.12356.101.6.0.208': 'device_memory_high',
  };

  return oidMap[trap.oid] || 'unknown_trap';
}
```

### 3b — FortiGate REST API Polling

```typescript
// src/noc/fortiGatePoller.ts
// Her 5 dakikada bir FortiGate'den metrikler çekilir

export async function pollFortiGateMetrics(
  integration: NOCIntegration
): Promise<void> {

  if (!integration.fortigateHost || !integration.fortigateTokenEncrypted) return;

  const token = decrypt(integration.fortigateTokenEncrypted);
  const base = `https://${integration.fortigateHost}/api/v2`;
  const headers = {
    'Authorization': `Bearer ${token}`,
  };
  const agent = new https.Agent({ rejectUnauthorized: false });

  const results = await Promise.allSettled([
    // WAN interface istatistikleri
    axios.get(`${base}/monitor/system/interface?include_vlan=true`,
      { headers, httpsAgent: agent }),
    // CPU ve bellek
    axios.get(`${base}/monitor/system/resource/usage`,
      { headers, httpsAgent: agent }),
    // VPN tünelleri
    axios.get(`${base}/monitor/vpn/ipsec`,
      { headers, httpsAgent: agent }),
    // HA durumu (varsa)
    axios.get(`${base}/monitor/system/ha-statistics`,
      { headers, httpsAgent: agent }),
  ]);

  const now = new Date();
  const metricsToInsert = [];

  // Interface metrikleri
  if (results[0].status === 'fulfilled') {
    for (const iface of results[0].value.data.results || []) {
      if (!iface.name.startsWith('wan') &&
          !iface.name.startsWith('port')) continue;

      const speedMbps = iface.speed || 1000;
      const inPct = (iface.rx_bandwidth / speedMbps) * 100;
      const outPct = (iface.tx_bandwidth / speedMbps) * 100;

      metricsToInsert.push(
        { integrationId: integration.id, customerId: integration.customerId,
          deviceIp: integration.fortigateHost,
          interfaceName: iface.name,
          metricType: 'bandwidth_in',
          value: iface.rx_bandwidth, unit: 'Kbps', recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId,
          deviceIp: integration.fortigateHost,
          interfaceName: iface.name,
          metricType: 'bandwidth_out',
          value: iface.tx_bandwidth, unit: 'Kbps', recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId,
          deviceIp: integration.fortigateHost,
          interfaceName: iface.name,
          metricType: 'bandwidth_in_pct',
          value: inPct, unit: '%', recordedAt: now },
        { integrationId: integration.id, customerId: integration.customerId,
          deviceIp: integration.fortigateHost,
          interfaceName: iface.name,
          metricType: 'bandwidth_out_pct',
          value: outPct, unit: '%', recordedAt: now }
      );

      // Eşik kontrol
      const threshold = integration.bandwidthCriticalPct;
      if (inPct > threshold || outPct > threshold) {
        await createBandwidthAlert(integration, iface.name,
          Math.max(inPct, outPct), threshold);
      }
    }
  }

  // CPU + Bellek
  if (results[1].status === 'fulfilled') {
    const res = results[1].value.data.results;
    if (res.cpu) {
      metricsToInsert.push({
        integrationId: integration.id, customerId: integration.customerId,
        deviceIp: integration.fortigateHost, interfaceName: 'system',
        metricType: 'cpu', value: res.cpu[0]?.current || 0,
        unit: '%', recordedAt: now,
      });
    }
    if (res.mem) {
      metricsToInsert.push({
        integrationId: integration.id, customerId: integration.customerId,
        deviceIp: integration.fortigateHost, interfaceName: 'system',
        metricType: 'memory', value: res.mem[0]?.current || 0,
        unit: '%', recordedAt: now,
      });
    }
  }

  if (metricsToInsert.length > 0) {
    await db.insert(nocMetrics).values(metricsToInsert);
  }

  await db.update(nocIntegrations).set({
    fortigateLastPolledAt: now,
  }).where(eq(nocIntegrations.id, integration.id));
}
```

### 3c — Availability Monitor (Ping + HTTP)

```typescript
// src/noc/availabilityMonitor.ts
// Her 5 dakikada izlenen cihaz ve servisleri kontrol et

import ping from 'ping'; // pnpm add ping

export async function checkAvailability(
  integration: NOCIntegration
): Promise<void> {

  const devices = integration.monitoredDevices as MonitoredDevice[];
  const services = integration.monitoredServices as MonitoredService[];

  for (const device of devices) {
    const start = Date.now();
    const result = await ping.promise.probe(device.ip, {
      timeout: 5,
      extra: ['-c', '3'], // 3 ping gönder
    });

    const latency = result.avg ? parseFloat(result.avg) : null;
    const isUp = result.alive;
    const packetLoss = result.packetLoss
      ? parseFloat(result.packetLoss) : 0;

    // Availability kaydet
    await db.insert(nocAvailability).values({
      integrationId: integration.id,
      customerId: integration.customerId,
      targetType: 'device',
      targetIdentifier: device.ip,
      isUp,
      checkLatencyMs: latency,
      checkedAt: new Date(),
    });

    // Metrikler kaydet
    if (latency) {
      await db.insert(nocMetrics).values({
        integrationId: integration.id,
        customerId: integration.customerId,
        deviceIp: device.ip,
        interfaceName: 'icmp',
        metricType: 'latency',
        value: latency, unit: 'ms',
        recordedAt: new Date(),
      });
    }

    // Kritik cihaz down olduysa alert
    if (!isUp && device.critical) {
      await createDeviceDownAlert(integration, device, latency);
    }

    // Packet loss eşiği aşıldıysa
    if (packetLoss > integration.packetLossCriticalPct) {
      await createPacketLossAlert(integration, device, packetLoss);
    }
  }

  // HTTP servis kontrolleri
  for (const service of services) {
    try {
      const start = Date.now();
      const response = await axios.get(service.url, {
        timeout: 10000,
        validateStatus: null,
      });
      const latency = Date.now() - start;
      const isUp = response.status >= 200 && response.status < 400;

      await db.insert(nocAvailability).values({
        integrationId: integration.id,
        customerId: integration.customerId,
        targetType: 'service',
        targetIdentifier: service.url,
        isUp,
        checkLatencyMs: latency,
        checkedAt: new Date(),
      });

      if (!isUp && service.critical) {
        await createServiceDownAlert(integration, service, response.status);
      }

    } catch (e) {
      await db.insert(nocAvailability).values({
        integrationId: integration.id,
        customerId: integration.customerId,
        targetType: 'service',
        targetIdentifier: service.url,
        isUp: false,
        checkedAt: new Date(),
      });

      if (service.critical) {
        await createServiceDownAlert(integration, service, 0);
      }
    }
  }

  // Aylık uptime yüzdesini güncelle
  await updateUptimePercentage(integration);
}
```

---

## BÖLÜM 4: CLAUDE NOC TRİAGE PİPELİNE

```typescript
// src/noc/claudeNOCTriage.ts

export async function triageNOCEvent(
  event: NOCEvent,
  integration: NOCIntegration
): Promise<NOCTriageResult> {

  // ─── KATMAN 0: KURAL MOTORU ───────────────────────────────

  // Baseline döneminde false positive bastır
  if (integration.baselineLearning) {
    await learnBaseline(integration, event);
    if (!isCriticalEnoughForBaselinePeriod(event)) {
      return { level: 0, action: 'baseline_learning' };
    }
  }

  // Bilinen periyodik pattern: backup trafiği, güncelleme vb.
  if (await isKnownPeriodicPattern(integration, event)) {
    return { level: 0, action: 'known_pattern', reason: 'Periyodik trafik' };
  }

  // Zaten açık NOC case var mı bu cihaz için?
  const existingCase = await getOpenNOCCaseForDevice(
    integration.customerId, event.deviceIp
  );
  if (existingCase) {
    await addEventToExistingCase(existingCase.id, event.id);
    return { level: 0, action: 'added_to_existing_case',
             caseId: existingCase.id };
  }

  // ─── KATMAN 1: CLAUDE HAIKU (Hızlı karar) ─────────────────

  const haikuPrompt = `
NOC olayı:
Tip: ${event.eventType}
Cihaz: ${event.deviceName} (${event.deviceIp})
Metrik: ${event.metricName} = ${event.metricValue} ${event.metricUnit}
Eşik: ${event.metricThreshold}

Gerçek sorun mu, gürültü mü?
JSON: {"real": true/false, "confidence": 0-100, "reason": "tek cümle"}
`;

  const [haikuResp] = await Promise.all([
    callClaudeWithCost(haikuPrompt, 'claude-haiku-4-5', { maxTokens: 80 }),
  ]);

  const haikuResult = JSON.parse(haikuResp[0]);

  if (!haikuResult.real && haikuResult.confidence > 75) {
    return { level: 1, action: 'noise', confidence: haikuResult.confidence };
  }

  // ─── KATMAN 2: CLAUDE SONNET (Tam analiz) ─────────────────

  // Son 1 saatin metrikleri
  const recentMetrics = await getRecentMetrics(
    integration.id, event.deviceIp, 60
  );

  // Aynı müşteride SOC olayı var mı?
  const recentSOCEvents = await getRecentSOCEvents(
    integration.customerId, 30
  );

  // Baseline karşılaştırması
  const baselineComp = compareWithBaseline(
    event, integration.baselineData
  );

  const sonnetPrompt = `
Sen CyberStep'in AI NOC analisti ve ağ uzmanısın.

MÜŞTERİ BAĞLAMI:
  Sektör: ${await getCustomerSector(integration.customerId)}
  NOC Tier: ${integration.nocTier}

ANA OLAY:
  Cihaz: ${event.deviceName} (${event.deviceIp})
  Tip: ${event.eventType}
  Açıklama: ${event.description}
  Zaman: ${event.occurredAt}

SON 1 SAATLİK METRİKLER:
${JSON.stringify(recentMetrics, null, 2)}

BASELINE KARŞILAŞTIRMASI:
${JSON.stringify(baselineComp, null, 2)}

EŞ ZAMANLI GÜVENLİK OLAYLARI (son 30 dk):
${recentSOCEvents.length > 0
  ? recentSOCEvents.map(e =>
    `${e.eventType}: ${e.sourceIp} → ${e.threatName}`
  ).join('\n')
  : 'Yok'}

JSON YANIT:
{
  "severity": "critical|high|medium|low",
  "priority": 1-4,
  "event_category": "outage|degradation|anomaly|capacity|security_related",
  "root_cause_hypothesis": "En olası neden — teknik ama anlaşılır",
  "business_impact": "İş etkisi — patron dili, 1-2 cümle",
  "is_security_related": true/false,
  "security_correlation": "SOC olayıyla bağlantı varsa açıkla",
  "recommended_actions": ["Müşterinin yapacakları — adım adım"],
  "customer_message": "Müşteriye WhatsApp/e-posta mesajı — Türkçe, teknik değil",
  "should_notify": true/false,
  "auto_resolve_expected": true/false,
  "auto_resolve_minutes": 30,
  "needs_escalation": false
}
`;

  const [sonnetResp] = await Promise.all([
    callClaudeWithCost(sonnetPrompt, 'claude-sonnet-4-6',
      { maxTokens: 600 }),
  ]);

  const analysis = JSON.parse(sonnetResp[0]);

  // NOC case oluştur
  const caseNumber = await generateNOCCaseNumber();
  const slaConfig = await getSLAConfig(
    `noc_${integration.nocTier}`, analysis.severity
  );

  const [nocCase] = await db.insert(nocCases).values({
    caseNumber,
    customerId: integration.customerId,
    caseType: analysis.event_category,
    severity: analysis.severity,
    priority: analysis.priority,
    title: event.title,
    description: event.description,
    rootCauseAnalysis: analysis.root_cause_hypothesis,
    affectedDevices: [event.deviceName].filter(Boolean),
    isSecurityRelated: analysis.is_security_related,
    slaMinutes: slaConfig.response_minutes,
    slaDeadline: new Date(Date.now() +
      slaConfig.response_minutes * 60 * 1000),
  }).returning();

  // NOC event'i case'e bağla
  await db.update(nocEvents).set({
    nocCaseId: nocCase.id,
    claudeAnalysis: analysis,
    processed: true,
    processedAt: new Date(),
  }).where(eq(nocEvents.id, event.id));

  // Güvenlik ilişkisi varsa SOC'u bilgilendir
  if (analysis.is_security_related) {
    await correlateNOCWithSOC(
      nocCase, analysis.security_correlation
    );
  }

  // Bildirim gönder
  if (analysis.should_notify) {
    await sendNOCAlert(
      integration.customerId, nocCase, analysis.customer_message
    );
  }

  // Otomatik kapanma takvimle
  if (analysis.auto_resolve_expected) {
    await scheduleAutoResolveCheck(
      nocCase.id, analysis.auto_resolve_minutes
    );
  }

  return {
    level: 2,
    action: 'case_created',
    caseId: nocCase.id,
    caseNumber,
    severity: analysis.severity,
    analysis,
  };
}
```

---

## BÖLÜM 5: BASELINE ÖĞRENME SİSTEMİ

```typescript
// src/noc/baselineLearning.ts
// İlk 14 gün: "normal" ağ davranışını öğren

export async function updateBaseline(
  integration: NOCIntegration,
  newMetrics: NOCMetric[]
): Promise<void> {

  if (!integration.baselineLearning) return;

  const existingBaseline = integration.baselineData as BaselineData || {};

  // Her interface, her metrik tipi için running average güncelle
  for (const metric of newMetrics) {
    const key = `${metric.interfaceName}_${metric.metricType}`;

    if (!existingBaseline[key]) {
      existingBaseline[key] = {
        samples: 0, sum: 0, min: metric.value,
        max: metric.value, avg: metric.value,
        stddev: 0, p95: metric.value,
        hourly_avg: {}, // Saat bazlı ortalama
      };
    }

    const b = existingBaseline[key];
    b.samples++;
    b.sum += metric.value;
    b.avg = b.sum / b.samples;
    b.min = Math.min(b.min, metric.value);
    b.max = Math.max(b.max, metric.value);

    // Saat bazlı ortalama (peak hours tespiti için)
    const hour = new Date(metric.recordedAt).getHours();
    if (!b.hourly_avg[hour]) b.hourly_avg[hour] = { sum: 0, count: 0 };
    b.hourly_avg[hour].sum += metric.value;
    b.hourly_avg[hour].count++;
  }

  // 14 gün tamamlandıysa baseline tamamlandı
  const daysSinceCreation = getDaysSince(integration.createdAt);
  const baselineCompleted = daysSinceCreation >= 14;

  await db.update(nocIntegrations).set({
    baselineData: existingBaseline,
    baselineLearning: !baselineCompleted,
    baselineCompletedAt: baselineCompleted ? new Date() : null,
  }).where(eq(nocIntegrations.id, integration.id));

  if (baselineCompleted) {
    await sendBaselineCompletedNotification(integration.customerId);
  }
}

// Baseline'a göre anomali skoru
export function calculateAnomalyScore(
  value: number,
  baseline: BaselineKeyData,
  hour: number
): number {
  const hourlyAvg = baseline.hourly_avg[hour]?.sum /
    (baseline.hourly_avg[hour]?.count || 1) || baseline.avg;

  const deviation = Math.abs(value - hourlyAvg);
  const normalizedDeviation = deviation / (baseline.stddev || baseline.avg * 0.1);

  // > 3 sigma = anomali
  if (normalizedDeviation > 3) return 90;
  if (normalizedDeviation > 2) return 70;
  if (normalizedDeviation > 1.5) return 50;
  return 0;
}
```

---

## BÖLÜM 6: NOC DASHBOARD'LARI

### 6a — Admin NOC Operatör Paneli

```
/admin-panel/noc

Sekmeler:
[ Genel Bakış | Aktif Case'ler | Event Akışı | Müşteri Ağları | Raporlar ]

─── GENEL BAKIŞ ────────────────────────────────────────────
Aktif NOC Müşterisi: 18
Açık Case: P1:0  P2:2  P3:5  P4:12
Bu Saat Event: 47
Baseline Öğrenimde: 3 müşteri

─── AKTİF CASE'LER ─────────────────────────────────────────
P2 | CS-NOC-2026-00089
    Acme A.Ş. — WAN1 %91 bant genişliği kullanımı
    Başlangıç: 14:23  |  SLA: 15:23 (38 dk kaldı) ⚠️
    [Detay] [Müşteri Bildir] [Kapat]

P2 | CS-NOC-2026-00088
    Beta Ltd. — VPN Tünel Kesintisi (Branch-Istanbul)
    Başlangıç: 13:45  |  SLA: 14:45 ✅ karşılandı
    [Detay]

─── MÜŞTERİ AĞLARI ─────────────────────────────────────────
Müşteri         WAN Durum   Bant W.    Cihaz    Uptime
──────────────────────────────────────────────────────────
Acme A.Ş.       🔴 Uyarı   91% ⚠️    8/8 ✅   %99.2
Beta Ltd.       🟢 Normal  23%        5/6 ⚠️  %98.7
Gamma A.Ş.      🟢 Normal  45%        3/3 ✅   %100
```

### 6b — Müşteri NOC Dashboard

```
/hesabim/noc

Ağ Sağlığı: 🟡 DİKKAT    Güncelleme: 2 dk önce

Anlık Durum:
┌──────────────────────────────────────────────────────────┐
│ WAN1          🔴 UYARI   %91 kullanım  (eşik: %90)      │
│ WAN2          🟢 Normal  %23 kullanım                    │
│ VPN Tüneli    🟢 Aktif   12ms gecikme                   │
│ İnternet      🟢 Normal  4.2ms, %0 paket kaybı          │
└──────────────────────────────────────────────────────────┘

Bant Genişliği Grafiği (Son 24 Saat):
[Çizgi grafik — in/out Mbps]

Uptime Bu Ay: %99.2
SLA Taahhüdü: %99.5  ⚠️ Uyarı

Aktif Case:
  CS-NOC-2026-00089 — WAN1 yüksek kullanım
  [Detay Gör →]

Cihaz Durumu:
  FortiGate-100F    🟢 Erişilebilir  CPU:%23  RAM:%41
  SW-Core-01        🟢 Erişilebilir
  AP-Floor1         🟢 Erişilebilir
  Backup-Router     🔴 Erişilemiyor  [Bildir →]
```

---

## BÖLÜM 7: ONBOARDING SİHİRBAZI

```tsx
// /hesabim/entegrasyonlar/noc-kurulum
// 6 adım

const NOC_SETUP_STEPS = [
  {
    step: 1,
    title: 'Hoş Geldiniz — Token\'larınız Hazır',
    description: 'SNMP trap ve NetFlow endpoint\'leriniz oluşturuldu.',
    autoCompleted: true,
    tokens: {
      snmpTrapURL: 'snmptrap.cyberstep.io:1162',
      snmpCommunity: '[SNMP_TOKEN]',
      netflowCollector: 'netflow.cyberstep.io:2055',
    },
  },
  {
    step: 2,
    title: 'FortiGate SNMP Trap Yapılandırması',
    instructions: `
FortiGate CLI veya GUI:
  System → SNMP → v1/v2c → + Create New
  
  Name: CyberStep-NOC
  Status: Enable
  Trap Server: snmptrap.cyberstep.io
  Port: 1162
  Community: [SNMP_TOKEN]
  
  Trap Events (hepsini seçin):
  [✓] Link up/down   [✓] CPU high   [✓] Memory high
  [✓] HA events      [✓] VPN events [✓] System events
    `,
    testButton: 'SNMP Trap Testi Gönder',
    testEndpoint: '/api/noc/test/snmp',
  },
  {
    step: 3,
    title: 'FortiGate REST API (İzleme)',
    instructions: `
Read-Only API token oluştur:
  System → Administrators → + Create New → REST API Admin
  Profile: cyberstep_noc_readonly
  
  İzinler:
  [✓] System Status: Read
  [✓] Log & Report: Read
  [✓] Network: Read
  [✗] Diğerleri: None
  
  Trusted Hosts: [CyberStep IP listesi]
    `,
    form: {
      fields: ['host', 'token'],
      optional: false,
    },
    testButton: 'API Bağlantısını Test Et',
  },
  {
    step: 4,
    title: 'İzlenecek Cihazları Ekleyin',
    description: `
Ağınızdaki kritik cihazları tanımlayın.
FortiGate dışında switch, router, sunucu ekleyebilirsiniz.
    `,
    dynamicForm: {
      type: 'device_list',
      fields: ['ip', 'name', 'type', 'critical'],
      addButton: '+ Cihaz Ekle',
    },
  },
  {
    step: 5,
    title: 'İzlenecek Servisleri Ekleyin',
    description: 'Web siteleri, API endpointleri veya özel portları izleyin.',
    dynamicForm: {
      type: 'service_list',
      fields: ['url', 'name', 'checkType', 'critical'],
      addButton: '+ Servis Ekle',
    },
    optional: true,
  },
  {
    step: 6,
    title: 'Baseline Öğrenimi Başladı',
    description: `
Her şey hazır! CyberStep ağınızın normal davranışını
14 gün boyunca öğrenecek.

Bu süreçte:
• Bant genişliği baseline'ı oluşturuluyor
• Peak hour'lar tespit ediliyor
• Normal paket kaybı / gecikme değerleri öğreniliyor
• Sadece kritik olaylar (cihaz down, link kopması) için bildirim gönderilecek
    `,
    expectedEvents: [
      'İlk 14 gün: Sadece kritik olaylar',
      '14. gün: Baseline tamamlandı bildirimi',
      '15. gün: Tam anomali tespiti aktif',
    ],
  },
];
```

---

## BÖLÜM 8: SERVİS İPTAL ve FATURALAMA

### 8a — İptal Akışı

```typescript
// src/services/cancellationService.ts

export async function cancelNOCService(
  customerId: number,
  customerServiceId: number,
  reason: string,
  requestedBy: string = 'customer'
): Promise<CancellationResult> {

  const cs = await getCustomerService(customerServiceId);
  if (cs.customerId !== customerId) throw new Error('Yetkisiz erişim');

  const service = await getServiceCatalog(cs.serviceCatalogId);
  const now = new Date();

  // İptal politikası
  // Monthly: 30 gün önceden bildirim gerekmiyor, cari dönemi kullanır
  // Annual: 30 gün önceden bildirim zorunlu, kalan ay iadesi yok

  let effectiveEndDate: Date;
  let refundAmountTl = 0;

  if (service.serviceType === 'monthly') {
    // Cari dönem sonunda iptal
    effectiveEndDate = cs.expiresAt || addMonths(now, 1);
    refundAmountTl = 0; // İade yok
  } else if (service.serviceType === 'annual') {
    const remainingMonths = monthsDiff(now, cs.expiresAt);
    if (remainingMonths > 1) {
      // 30 gün sonra iptal
      effectiveEndDate = addDays(now, 30);
      // Kalan süre iadesi (politikaya göre)
      refundAmountTl = 0; // CyberStep politikası: iade yok
    } else {
      effectiveEndDate = cs.expiresAt;
    }
  } else {
    // Tek seferlik: anında iptal
    effectiveEndDate = now;
  }

  // İptal kaydı
  const [cancellation] = await db.insert(serviceCancellations).values({
    customerServiceId: cs.id,
    customerId,
    reason,
    requestedBy,
    requestedAt: now,
    effectiveDate: effectiveEndDate,
    refundAmountTl,
    status: 'pending',
  }).returning();

  // Servis durumu güncelle
  await db.update(customerServices).set({
    status: 'cancellation_pending',
    autoRenew: false,
    cancellationDate: effectiveEndDate,
  }).where(eq(customerServices.id, cs.id));

  // NOC entegrasyonunu kapat (effective date'de)
  await scheduleNOCDeactivation(customerId, effectiveEndDate);

  // E-posta bildirimleri
  await sendCancellationConfirmation(customerId, {
    serviceName: service.name,
    effectiveDate: effectiveEndDate,
    refundAmount: refundAmountTl,
  });

  await sendAdminCancellationAlert(customerId, service.name, reason);

  // CRM pipeline güncelle (churn)
  await updateCRMChurnStatus(customerId, service.slug, reason);

  return {
    cancellationId: cancellation.id,
    effectiveDate: effectiveEndDate,
    refundAmountTl,
    message: `Servisiniz ${formatDate(effectiveEndDate)} tarihinde sona erecek.`,
  };
}

// İptal sonrası veri saklama
export async function handleNOCDeactivation(
  customerId: number
): Promise<void> {
  // NOC entegrasyonunu pasife al
  await db.update(nocIntegrations).set({
    snmpTrapEnabled: false,
    fortigatePollingEnabled: false,
    netflowEnabled: false,
  }).where(eq(nocIntegrations.customerId, customerId));

  // 90 gün veri sakla (KVKK gereği)
  await scheduleDataDeletion(customerId, 'noc', addDays(new Date(), 90));

  // Son rapor üret ve gönder
  await generateFinalNOCReport(customerId);
}
```

### 8b — KDV Dahil Fatura Üretimi

```typescript
// Mevcut fatura sistemine KDV desteği ekle

export async function generateInvoiceWithVAT(
  paymentId: number
): Promise<void> {

  const payment = await getPayment(paymentId);
  const service = await getServiceForPayment(paymentId);
  const customer = await getCustomer(payment.customerId);

  const vatRate = 0.20; // %20 KDV
  const subtotal = payment.amount; // KDV hariç
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  // Fatura satır kalemleri
  const lineItems = [{
    description: service.name,
    quantity: 1,
    unit_price: subtotal,
    vat_rate: 20,
    line_total: subtotal,
  }];

  // Fatura oluştur
  const invoiceNum = await generateInvoiceNumber('CS-INV');

  await db.update(enterpriseInvoices).set({
    lineItems,
    subtotalTl: subtotal,
    vatRate: 20,
    vatAmountTl: vatAmount,
    totalTl: total,
    fullInvoiceNumber: invoiceNum.fullNumber,
  }).where(eq(enterpriseInvoices.paymentId, paymentId));

  // PDF üret ve gönder
  await generateInvoicePDF(invoiceId);
  await sendInvoiceEmail(customer.email, invoiceId);

  // Muhasebe webhook'u
  await syncInvoiceToAccounting(invoiceId);
}
```

---

## BÖLÜM 9: CRON JOB'LAR

```typescript
// Her 5 dakikada — FortiGate polling
cron.schedule('*/5 * * * *', async () => {
  const active = await db.select()
    .from(nocIntegrations)
    .where(
      and(
        eq(nocIntegrations.fortigatePollingEnabled, true),
        isNotNull(nocIntegrations.fortigateHost)
      )
    );

  for (const integ of active) {
    try {
      await pollFortiGateMetrics(integ);
    } catch (e) {
      logger.error(`FortiGate poll failed: ${integ.id}`, e);
    }
    await sleep(200);
  }
});

// Her 5 dakikada — availability check
cron.schedule('*/5 * * * *', async () => {
  const active = await db.select()
    .from(nocIntegrations)
    .where(eq(nocIntegrations.snmpTrapEnabled, true));

  for (const integ of active) {
    await checkAvailability(integ);
    await sleep(300);
  }
});

// Her 15 dakikada — NOC event triage
cron.schedule('*/15 * * * *', async () => {
  const unprocessed = await db.select()
    .from(nocEvents)
    .where(eq(nocEvents.processed, false))
    .limit(100);

  for (const event of unprocessed) {
    const integ = await getNOCIntegration(event.integrationId);
    await triageNOCEvent(event, integ);
    await sleep(200);
  }
});

// Her gece 02:00 — Aylık uptime raporu hazırla
cron.schedule('0 2 * * *', async () => {
  await updateAllUptimePercentages();
});

// Her Pazartesi 08:30 — Haftalık ağ raporu
cron.schedule('30 8 * * 1', async () => {
  const customers = await getNOCCustomers();
  for (const c of customers) {
    await generateWeeklyNOCReport(c.id);
    await sleep(3000);
  }
});

// Her ayın 1'i — Aylık kapasity raporu
cron.schedule('0 9 1 * *', async () => {
  const customers = await getNOCCustomers();
  for (const c of customers) {
    await generateMonthlyCapacityReport(c.id);
    await sleep(3000);
  }
});

// Baseline tamamlama kontrolü
cron.schedule('0 * * * *', async () => {
  const learning = await db.select()
    .from(nocIntegrations)
    .where(eq(nocIntegrations.baselineLearning, true));

  for (const integ of learning) {
    const days = getDaysSince(integ.createdAt);
    if (days >= 14) {
      await completeBaseline(integ);
    }
  }
});
```

---

## BÖLÜM 10: HAFTALIK NOC RAPORU

```typescript
export async function generateWeeklyNOCReport(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);
  const integ = await getNOCIntegration(customerId);
  const weekCases = await getWeekNOCCases(customerId);
  const uptimeStats = await getWeekUptimeStats(customerId);
  const bandwidthStats = await getWeekBandwidthStats(customerId);
  const topAlerts = await getTopAlertsThisWeek(customerId, 5);

  const prompt = `
CyberStep NOC haftalık ağ sağlık raporu.
${customer.companyName} BT yöneticisine sunulacak.

HAFTALIK İSTATİSTİKLER:
Uptime: %${uptimeStats.avgUptime}  (SLA: %${integ.availabilitySlaPct})
Toplam Case: ${weekCases.total} (P1:${weekCases.p1} P2:${weekCases.p2} P3:${weekCases.p3})
Ortalama Çözüm: ${weekCases.avgResolutionMinutes} dakika
Bant Genişliği Peak: WAN1 ${bandwidthStats.maxPct}% (${bandwidthStats.peakTime})

EN ÇOK YAŞANAN SORUNLAR:
${topAlerts.map(a => `- ${a.eventType}: ${a.count} kez`).join('\n')}

Rapor bölümleri:
1. GENEL DEĞERLENDİRME (3-4 cümle, BT müdürü dili)
2. UPTIME VE SLA DURUMU
3. HAFTANİN ÖNEMLİ OLAYLARI
4. BANT GENİŞLİĞİ TRENDİ
5. GELECEKTEKİ KAPAS İTE RİSKLERİ (varsa)
6. ÖNERİLEN AKSIYONLAR

Ton: Teknik ama patron anlasın.
Kötü haber varsa net söyle ama çözüm öner.
`;

  const content = await callClaude(prompt);
  await sendWeeklyNOCEmail(customer, content, uptimeStats, bandwidthStats);
}
```

---

## BÖLÜM 11: SOC-NOC KORELASYONu

```typescript
// NOC olayıyla eş zamanlı SOC olayı varsa otomatik ilişkilendir

export async function correlateNOCWithSOC(
  nocCase: NOCCase,
  correlationHint: string
): Promise<void> {

  // Son 1 saatte aynı müşteride SOC case var mı?
  const recentSOCCases = await db.select()
    .from(socCases)
    .where(
      and(
        eq(socCases.customerId, nocCase.customerId),
        inArray(socCases.status, ['open', 'investigating']),
        gte(socCases.createdAt,
            new Date(Date.now() - 60 * 60 * 1000))
      )
    );

  if (recentSOCCases.length > 0) {
    // NOC case'i SOC case'e bağla
    await db.update(nocCases).set({
      relatedSocCaseId: recentSOCCases[0].id,
      isSecurityRelated: true,
    }).where(eq(nocCases.id, nocCase.id));

    // SOC case'e NOC notu ekle
    await addSOCCaseNote(recentSOCCases[0].id, {
      source: 'NOC Korelasyon',
      content: `Eş zamanlı NOC olayı: ${nocCase.title}. `
        + `${correlationHint}. `
        + `NOC Case: ${nocCase.caseNumber}`,
      isAutomatic: true,
    });

    // Birleşik yüksek öncelik uyarısı
    await sendCombinedSOCNOCAlert(
      nocCase.customerId, nocCase, recentSOCCases[0]
    );
  }
}

// Spesifik korelasyon örnekleri:

// DDoS tespiti
// NOC: "WAN bant genişliği %95'e çıktı — anormal trafik"
// SOC: "Aynı IP bloğundan SYN flood"
// Birleşik: "Aktif DDoS saldırısı tespit edildi"

// Veri sızdırma
// NOC: "Gece 02:30'da 4GB outbound trafik"
// SOC: "Bilinen C2 IP'sine bağlantı"
// Birleşik: "Şüpheli veri sızdırma — aktif exfiltration"

// Fidye yazılımı yayılımı
// NOC: "İç ağda olağandışı broadcast trafiği"
// SOC: "WannaCry/SMB imzası FortiGate'de"
// Birleşik: "Ağda fidye yazılımı yayılıyor — izolasyon önerilir"
```

---

## API ROTALAR

```
─── NOC VERİ AKIŞI ─────────────────────────────────────────
POST /api/noc/snmp-trap/:token         — SNMP trap receiver
POST /api/noc/syslog/:token            — Perf syslog (mevcut /fabric/syslog'a ek)
POST /api/noc/netflow/:token           — NetFlow webhook

─── MÜŞTERİ PORTAL ─────────────────────────────────────────
GET  /api/portal/noc/dashboard         — NOC dashboard verisi
GET  /api/portal/noc/metrics           — Metrik grafikler
GET  /api/portal/noc/cases             — NOC case listesi
GET  /api/portal/noc/availability      — Uptime / SLA durumu
GET  /api/portal/noc/reports/weekly    — Haftalık rapor
GET  /api/portal/noc/devices           — Cihaz listesi ve durumu

─── ONBOARDING ──────────────────────────────────────────────
POST /api/portal/noc/setup/step        — Kurulum adımı kaydet
POST /api/portal/noc/test/snmp         — SNMP test
POST /api/portal/noc/test/api          — FortiGate API test
POST /api/portal/noc/devices           — Cihaz ekle
POST /api/portal/noc/services          — İzlenecek servis ekle

─── ADMIN ───────────────────────────────────────────────────
GET  /api/admin/noc/dashboard          — Operatör dashboard
GET  /api/admin/noc/cases              — Tüm NOC case'leri
GET  /api/admin/noc/customers          — Müşteri ağ durumu
GET  /api/admin/noc/correlations       — SOC-NOC korelasyonlar
```

---

## UYGULAMA SIRASI

```
SPRINT 1 — Veri Toplama Altyapısı:
  ✓ noc_* tabloları (migration)
  ✓ SNMP trap receiver (UDP 1162)
  ✓ FortiGate API polling
  ✓ Availability monitor (ping + HTTP)
  ✓ NetFlow collector (temel)
  Test: FortiGate'de SNMP trap kur → CyberStep'te görün

SPRINT 2 — Claude NOC Triage:
  ✓ triageNOCEvent() pipeline
  ✓ Baseline öğrenme sistemi
  ✓ NOC case management
  ✓ SOC-NOC korelasyon motoru
  Test: Interface down → case açıldı → bildirim gönderildi

SPRINT 3 — Dashboard ve Onboarding:
  ✓ Admin NOC operatör paneli
  ✓ Müşteri NOC dashboard
  ✓ 6 adımlı kurulum sihirbazı
  ✓ Gerçek zamanlı metrik grafikler
  Test: Sihirbazı uçtan uca tamamla → dashboard doldu

SPRINT 4 — Servis Kataloğu + Ödeme:
  ✓ Service catalog'a NOC servisleri ekle (seed data)
  ✓ KDV hesaplama (price_tl_with_vat view)
  ✓ NOC servis aktivasyonu
  ✓ İptal akışı + veri saklama
  ✓ Haftalık/aylık raporlar
  Test: NOC Lite satın al → aktive → 14 gün baseline → rapor gel
```

---

## ENVIRONMENT VARIABLES

```bash
# NOC
SNMP_TRAP_PORT=1162
NETFLOW_PORT=2055
NOC_POLLING_INTERVAL_MINUTES=5
NOC_BASELINE_DAYS=14

# Ping (availability monitor)
PING_TIMEOUT_SECONDS=5
PING_COUNT=3

# NOC e-posta
NOC_ALERT_FROM=noc@cyberstep.io
```

---

*CyberStep.io — AI NOC Servisi — 2026*
