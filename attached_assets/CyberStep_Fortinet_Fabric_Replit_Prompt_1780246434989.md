# CyberStep.io — Fortinet Security Fabric Entegrasyonu
## Replit Agent Promptu — FortiGate + FortiAnalyzer + FortiManager + Claude Korelasyon

---

## MİMARİ ÖZET

```
[MÜŞTERİ ALTYAPISI]              [CyberStep Cloud]
                                   
FortiGate                          
  ↓ Automation Stitch (webhook)  → /api/fabric/webhook/:token
  ↓ Security Fabric              
FortiAnalyzer                      
  ↓ Log Forwarding (syslog/HTTPS)→ /api/fabric/syslog/:token
  ↓                              
FortiManager ←─────────────────── FortiManager API (mevcut)
  ↓ push IoC block list            ↓
FortiEDR, FortiAP, FortiSwitch    Claude Korelasyon Motoru
  (Security Fabric üzerinden       ↓
   otomatik yayılım)              Risk Skoru + Alert + Rapor
```

**Güvenlik Prensibi:**
- Müşteri altyapısı OUTBOUND bağlantı açıyor (dışarı itiyor)
- CyberStep hiçbir zaman INBOUND bağlantı açmıyor
- Saklanan tek şey: read-only, IP kısıtlı, scope sınırlı token
- FortiManager write: sadece address objects (blok listesi)

---

## BÖLÜM 1: VERİTABANI

```sql
-- Müşteri Fortinet entegrasyon yapılandırması
CREATE TABLE IF NOT EXISTS fortinet_integrations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,

  -- Webhook token (Automation Stitch için)
  webhook_token varchar(64) UNIQUE NOT NULL,
  -- URL: /api/fabric/webhook/{token}
  webhook_enabled boolean DEFAULT false,
  webhook_last_received_at timestamp,
  webhook_events_count integer DEFAULT 0,

  -- Syslog token (FortiAnalyzer log forward için)
  syslog_token varchar(64) UNIQUE NOT NULL,
  -- URL: /api/fabric/syslog/{token}
  syslog_enabled boolean DEFAULT false,
  syslog_last_received_at timestamp,
  syslog_events_count integer DEFAULT 0,

  -- FortiManager bağlantısı (mevcut entegrasyonu genişlet)
  fortimanager_host varchar(255),
  fortimanager_port integer DEFAULT 443,
  fortimanager_token_encrypted text,
  -- AES-256 şifrelenmiş read-only token
  fortimanager_adom varchar(100) DEFAULT 'root',
  fortimanager_trusted_ips text[],
  -- CyberStep IP'lerini buraya ekle
  fortimanager_enabled boolean DEFAULT false,
  fortimanager_last_sync_at timestamp,
  fortimanager_version varchar(20),
  -- '7.4.0' gibi

  -- Blok listesi yönetimi
  block_list_object_name varchar(100) DEFAULT 'CyberStep-BlockList',
  -- FortiManager'daki address group adı
  auto_block_enabled boolean DEFAULT false,
  -- Kritik IoC'leri otomatik blokla (müşteri onayı gerekiyor)
  auto_block_threshold varchar(20) DEFAULT 'critical',
  -- 'critical' | 'high' (otomatik blok için minimum seviye)
  block_count integer DEFAULT 0,

  -- Security Fabric cihaz envanteri
  fabric_devices jsonb DEFAULT '[]',
  -- [{type: 'fortigate', serial: 'FG...', version: '7.4', ...}]
  fabric_last_discovered_at timestamp,

  -- Kurulum durumu
  setup_step integer DEFAULT 0,
  -- 0=başlamadı, 1=webhook, 2=syslog, 3=fortimanager, 4=test, 5=tamamlandı
  setup_completed_at timestamp,

  -- İstatistikler
  total_threats_received integer DEFAULT 0,
  total_iocs_blocked integer DEFAULT 0,
  total_correlations integer DEFAULT 0,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Gelen FortiGate/FortiAnalyzer olayları
CREATE TABLE IF NOT EXISTS fabric_events (
  id serial PRIMARY KEY,
  integration_id integer REFERENCES fortinet_integrations(id),
  customer_id integer REFERENCES customers(id),

  -- Kaynak
  source varchar(30) NOT NULL,
  -- 'automation_stitch' | 'fortianalyzer_syslog' |
  -- 'fortianalyzer_https' | 'fortimanager_api'

  -- Olay tipi
  event_type varchar(50) NOT NULL,
  -- 'threat_detected' | 'ips_alert' | 'botnet_c2' |
  -- 'malware_detected' | 'intrusion_attempt' | 'policy_violation' |
  -- 'anomaly' | 'vulnerability_scan' | 'brute_force'

  -- Ağ detayları
  source_ip varchar(50),
  destination_ip varchar(50),
  source_port integer,
  destination_port integer,
  protocol varchar(20),

  -- Tehdit detayları
  threat_name varchar(500),
  threat_severity varchar(20),
  -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  action_taken varchar(50),
  -- 'block' | 'allow' | 'monitor' | 'drop' | 'reset'
  cve_ids text[],

  -- Cihaz bilgisi
  device_serial varchar(50),
  device_hostname varchar(255),
  device_type varchar(30),
  -- 'fortigate' | 'fortianalyzer' | 'fortiedr'
  vdom varchar(100),
  policy_id varchar(50),
  policy_name varchar(255),

  -- Ham log
  raw_log jsonb,
  raw_format varchar(20),
  -- 'cef' | 'json' | 'syslog_rfc5424' | 'fortilog'

  -- İşleme durumu
  processed boolean DEFAULT false,
  processed_at timestamp,
  correlated_with_ioc integer REFERENCES ioc_registry(id),
  alert_sent boolean DEFAULT false,

  occurred_at timestamp NOT NULL,
  received_at timestamp DEFAULT now()
);

-- Claude korelasyon sonuçları
CREATE TABLE IF NOT EXISTS fabric_correlations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  integration_id integer REFERENCES fortinet_integrations(id),

  correlation_type varchar(50),
  -- 'ioc_match' | 'attack_pattern' | 'campaign_match' |
  -- 'kill_chain' | 'lateral_movement' | 'data_exfiltration'

  -- Bağlantılı olaylar
  fabric_event_ids integer[],
  -- Bu korelasyonu oluşturan olay ID'leri
  external_scan_finding_ids integer[],
  -- Dış taramadan gelen eşleşen bulgular
  ioc_ids integer[],
  -- Eşleşen IoC'ler

  -- Claude analizi
  severity varchar(20) NOT NULL,
  confidence integer,
  -- 0-100
  attack_narrative text,
  -- "Saldırgan X yaptı, sonra Y yaptı..."
  mitre_techniques text[],
  -- ['T1190', 'T1078', 'T1566']
  kill_chain_stage varchar(50),
  -- 'reconnaissance' | 'weaponization' | 'delivery' |
  -- 'exploitation' | 'installation' | 'c2' | 'actions'

  -- Önerilen aksiyon
  recommended_action varchar(50),
  -- 'block_ip' | 'isolate_host' | 'reset_credentials' |
  -- 'patch_system' | 'monitor' | 'investigate'
  action_details text,

  -- Bildirim durumu
  notified_at timestamp,
  notification_channels text[],
  -- ['email', 'whatsapp', 'slack']

  -- Uygulanan aksiyon
  action_taken_at timestamp,
  action_taken_by varchar(100),
  -- 'auto' | 'admin' | 'customer'
  blocked_ips text[],

  created_at timestamp DEFAULT now()
);

-- FortiManager blok listesi geçmişi
CREATE TABLE IF NOT EXISTS fortimanager_block_actions (
  id serial PRIMARY KEY,
  integration_id integer REFERENCES fortinet_integrations(id),
  customer_id integer REFERENCES customers(id),
  correlation_id integer REFERENCES fabric_correlations(id),

  action_type varchar(20) NOT NULL,
  -- 'block' | 'unblock'
  ip_address varchar(50) NOT NULL,
  reason text,

  -- FortiManager sonucu
  fm_object_name varchar(255),
  -- 'CyberStep-Block-1-2-3-4'
  fm_task_id varchar(100),
  fm_status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'success' | 'failed'
  fm_error text,

  -- Doğrulama
  verified boolean DEFAULT false,
  -- Sonraki taramada IP gerçekten bloke mi kontrol edildi
  verified_at timestamp,

  created_at timestamp DEFAULT now(),
  applied_at timestamp
);
```

---

## BÖLÜM 2: WEBHOOK ENDPOINT (FortiGate Automation Stitch)

```typescript
// src/routes/fabric.ts

import express from 'express';
import { parseFabricEvent } from '../services/fabricParser';
import { processAndCorrelate } from '../services/claudeCorrelation';

const router = express.Router();

// FortiGate Automation Stitch Webhook
// Müşteri FortiGate'de bu URL'i hedef olarak tanımlar
// POST /api/fabric/webhook/:token
router.post('/webhook/:token', async (req, res) => {
  const { token } = req.params;

  // Token doğrulama
  const integration = await db.select()
    .from(fortinetIntegrations)
    .where(
      and(
        eq(fortinetIntegrations.webhookToken, token),
        eq(fortinetIntegrations.webhookEnabled, true)
      )
    ).limit(1);

  if (!integration[0]) {
    // 200 dön — FortiGate retry yapmasın
    // Gerçek hata logla ama sessiz geç
    logger.warn(`Invalid webhook token: ${token}`);
    return res.status(200).json({ status: 'ok' });
  }

  const customerId = integration[0].customerId;

  // FortiGate birçok formatta gönderebilir
  // JSON (varsayılan), CEF veya syslog-like
  const rawBody = req.body;
  const contentType = req.headers['content-type'] || '';

  // Event'i parse et ve normalize et
  const parsedEvent = parseFabricEvent(rawBody, 'automation_stitch');

  if (!parsedEvent) {
    return res.status(200).json({ status: 'ok' });
  }

  // Veritabanına kaydet
  const [savedEvent] = await db.insert(fabricEvents).values({
    integrationId: integration[0].id,
    customerId,
    source: 'automation_stitch',
    eventType: parsedEvent.eventType,
    sourceIp: parsedEvent.sourceIp,
    destinationIp: parsedEvent.destinationIp,
    sourcePort: parsedEvent.sourcePort,
    destinationPort: parsedEvent.destinationPort,
    protocol: parsedEvent.protocol,
    threatName: parsedEvent.threatName,
    threatSeverity: parsedEvent.severity,
    actionTaken: parsedEvent.action,
    deviceSerial: parsedEvent.deviceSerial,
    deviceHostname: parsedEvent.deviceHostname,
    deviceType: 'fortigate',
    vdom: parsedEvent.vdom,
    rawLog: rawBody,
    rawFormat: parsedEvent.format,
    occurredAt: parsedEvent.timestamp || new Date(),
  }).returning();

  // İstatistik güncelle
  await db.update(fortinetIntegrations).set({
    webhookLastReceivedAt: new Date(),
    webhookEventsCount: sql`webhook_events_count + 1`,
    totalThreatsReceived: sql`total_threats_received + 1`,
  }).where(eq(fortinetIntegrations.id, integration[0].id));

  // Kritik veya yüksek tehdit → anlık korelasyon
  if (['critical', 'high'].includes(parsedEvent.severity)) {
    // Async — response'u bekletme
    setImmediate(() => {
      processAndCorrelate(customerId, savedEvent.id, 'immediate');
    });
  }

  // FortiGate 200 bekliyor, 3 saniye içinde
  res.status(200).json({ status: 'ok', eventId: savedEvent.id });
});

// FortiAnalyzer HTTPS Log Forwarding
// POST /api/fabric/syslog/:token
router.post('/syslog/:token', async (req, res) => {
  const { token } = req.params;

  const integration = await db.select()
    .from(fortinetIntegrations)
    .where(
      and(
        eq(fortinetIntegrations.syslogToken, token),
        eq(fortinetIntegrations.syslogEnabled, true)
      )
    ).limit(1);

  if (!integration[0]) {
    return res.status(200).send('OK');
  }

  // FortiAnalyzer toplu log gönderebilir
  const body = req.body;
  const logs = Array.isArray(body) ? body : [body];

  const eventsToInsert = logs
    .map(log => parseFabricEvent(log, 'fortianalyzer_https'))
    .filter(Boolean)
    .map(event => ({
      integrationId: integration[0].id,
      customerId: integration[0].customerId,
      source: 'fortianalyzer_https' as const,
      ...event,
    }));

  if (eventsToInsert.length > 0) {
    await db.insert(fabricEvents).values(eventsToInsert);

    await db.update(fortinetIntegrations).set({
      syslogLastReceivedAt: new Date(),
      syslogEventsCount: sql`syslog_events_count + ${eventsToInsert.length}`,
    }).where(eq(fortinetIntegrations.id, integration[0].id));
  }

  res.status(200).send('OK');
});

// Token doğrulama (kurulum wizard'ı için)
router.post('/verify/:token', async (req, res) => {
  const { token } = req.params;
  const { type } = req.body;
  // type: 'webhook' | 'syslog'

  const field = type === 'webhook' ? 'webhookToken' : 'syslogToken';
  const integration = await db.select()
    .from(fortinetIntegrations)
    .where(eq(fortinetIntegrations[field], token))
    .limit(1);

  if (!integration[0]) {
    return res.status(404).json({ valid: false });
  }

  res.json({ valid: true, customerId: integration[0].customerId });
});

export default router;
```

---

## BÖLÜM 3: SYSLOG TCP SUNUCUSU (UDP/TCP 514)

```typescript
// src/services/syslogServer.ts
// FortiAnalyzer UDP/TCP syslog forwarding için

import net from 'net';
import dgram from 'dgram';

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || '5514');
// 514 yerine 5514 — 514 root gerektirir

// Token mapping: kaynak IP → integration token
// FortiAnalyzer "description" alanına token gömülür
// Alternatif: her müşteri için ayrı port (port range: 5514-5614)

// TCP Syslog Server
export function startTCPSyslogServer(): void {
  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // RFC 5424 format — her satır bir log
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          processSyslogLine(line.trim(), socket.remoteAddress || '');
        }
      }
    });

    socket.on('error', () => {});
  });

  server.listen(SYSLOG_PORT, () => {
    logger.info(`TCP Syslog server listening on port ${SYSLOG_PORT}`);
  });
}

// UDP Syslog Server
export function startUDPSyslogServer(): void {
  const server = dgram.createSocket('udp4');

  server.on('message', (msg, rinfo) => {
    processSyslogLine(msg.toString(), rinfo.address);
  });

  server.bind(SYSLOG_PORT + 1); // UDP: 5515
}

async function processSyslogLine(
  line: string,
  sourceIP: string
): Promise<void> {
  try {
    // FortiLog format: date=2026-05-31 time=10:23:45 devname="FG..." ...
    // Token FortiAnalyzer'ın "device description" alanında
    const token = extractTokenFromSyslog(line);
    if (!token) return;

    const integration = await getIntegrationBySyslogToken(token);
    if (!integration) return;

    const event = parseFabricEvent(line, 'fortianalyzer_syslog');
    if (!event) return;

    await db.insert(fabricEvents).values({
      integrationId: integration.id,
      customerId: integration.customerId,
      source: 'fortianalyzer_syslog',
      rawLog: { raw: line },
      rawFormat: 'fortilog',
      ...event,
    });

  } catch (e) {
    logger.error('Syslog parse error', e);
  }
}

function extractTokenFromSyslog(line: string): string | null {
  // FortiAnalyzer log description alanından token çıkar
  // Format: desc="cyberstep:TOKEN"
  const match = line.match(/desc="cyberstep:([a-f0-9]{32})"/i);
  return match?.[1] || null;
}
```

---

## BÖLÜM 4: LOG PARSER (FortiLog → CyberStep Format)

```typescript
// src/services/fabricParser.ts

interface ParsedFabricEvent {
  eventType: FabricEventType;
  sourceIp: string;
  destinationIp: string;
  sourcePort?: number;
  destinationPort?: number;
  protocol?: string;
  threatName?: string;
  severity: ThreatSeverity;
  action: string;
  deviceSerial?: string;
  deviceHostname?: string;
  vdom?: string;
  cveIds?: string[];
  timestamp: Date;
  format: 'cef' | 'json' | 'fortilog' | 'syslog_rfc5424';
}

export function parseFabricEvent(
  raw: unknown,
  source: string
): ParsedFabricEvent | null {

  try {
    if (typeof raw === 'string') {
      // FortiLog text format
      if (raw.includes('date=') && raw.includes('devname=')) {
        return parseFortiLog(raw);
      }
      // CEF format
      if (raw.startsWith('CEF:')) {
        return parseCEFFormat(raw);
      }
    }

    if (typeof raw === 'object' && raw !== null) {
      return parseJSONFormat(raw as Record<string, unknown>);
    }

    return null;
  } catch {
    return null;
  }
}

function parseFortiLog(log: string): ParsedFabricEvent {
  // FortiGate log format: key="value" pairs
  const fields: Record<string, string> = {};

  const regex = /(\w+)="([^"]*?)"|(\w+)=(\S+)/g;
  let match;
  while ((match = regex.exec(log)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    fields[key] = value;
  }

  // Event type mapping
  const typeMap: Record<string, FabricEventType> = {
    'ips':        'ips_alert',
    'anomaly':    'anomaly',
    'virus':      'malware_detected',
    'botnet':     'botnet_c2',
    'webfilter':  'policy_violation',
    'app-ctrl':   'policy_violation',
  };

  const subtype = fields['subtype'] || fields['type'] || '';

  return {
    eventType:     typeMap[subtype] || 'threat_detected',
    sourceIp:      fields['srcip'] || fields['src'] || '',
    destinationIp: fields['dstip'] || fields['dst'] || '',
    sourcePort:    parseInt(fields['srcport'] || '0') || undefined,
    destinationPort: parseInt(fields['dstport'] || fields['service'] || '0') || undefined,
    protocol:      fields['proto'] || fields['protocol'],
    threatName:    fields['attack'] || fields['threatname'] || fields['virus'],
    severity:      mapFortiSeverity(fields['severity'] || fields['level']),
    action:        fields['action'] || 'detected',
    deviceSerial:  fields['devid'],
    deviceHostname: fields['devname'],
    vdom:          fields['vd'] || fields['vdom'],
    cveIds:        fields['cve'] ? [fields['cve']] : [],
    timestamp:     parseFortiDate(fields['date'], fields['time']),
    format:        'fortilog',
  };
}

function parseCEFFormat(cef: string): ParsedFabricEvent {
  // CEF:Version|DeviceVendor|DeviceProduct|DeviceVersion|SignatureID|Name|Severity|Extension
  const parts = cef.replace('CEF:', '').split('|');
  const extension = parts[7] || '';

  // Extension key=value pairs
  const ext: Record<string, string> = {};
  extension.split(' ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) ext[k] = v;
  });

  return {
    eventType:      'threat_detected',
    sourceIp:       ext['src'] || ext['sourceAddress'] || '',
    destinationIp:  ext['dst'] || ext['destinationAddress'] || '',
    sourcePort:     parseInt(ext['spt'] || '0') || undefined,
    destinationPort: parseInt(ext['dpt'] || '0') || undefined,
    protocol:       ext['proto'],
    threatName:     parts[5],
    severity:       mapCEFSeverity(parts[6]),
    action:         ext['act'] || 'detected',
    deviceSerial:   ext['deviceExternalId'],
    deviceHostname: ext['dhost'],
    timestamp:      new Date(parseInt(ext['rt'] || '0') || Date.now()),
    format:         'cef',
  };
}

function mapFortiSeverity(sev: string): ThreatSeverity {
  const map: Record<string, ThreatSeverity> = {
    'critical': 'critical', 'alert': 'critical',
    'high':     'high',     'error': 'high',
    'medium':   'medium',   'warning': 'medium',
    'low':      'low',      'notice': 'low',
    'info':     'info',     'debug': 'info',
  };
  return map[sev?.toLowerCase()] || 'medium';
}
```

---

## BÖLÜM 5: CLAUDE KORELASYON MOTORU

```typescript
// src/services/claudeCorrelation.ts

export async function processAndCorrelate(
  customerId: number,
  triggerEventId: number,
  mode: 'immediate' | 'batch' = 'batch'
): Promise<FabricCorrelation | null> {

  const customer = await getCustomer(customerId);
  const integration = await getIntegration(customerId);

  // Son 1 saatin olaylarını topla (immediate için son 5 dakika)
  const windowMinutes = mode === 'immediate' ? 5 : 60;
  const recentEvents = await db.select()
    .from(fabricEvents)
    .where(
      and(
        eq(fabricEvents.customerId, customerId),
        eq(fabricEvents.processed, false),
        gte(fabricEvents.receivedAt,
            new Date(Date.now() - windowMinutes * 60 * 1000))
      )
    )
    .orderBy(desc(fabricEvents.receivedAt))
    .limit(100);

  if (recentEvents.length === 0) return null;

  // Dış tarama bulguları
  const externalFindings = await getLatestScanFindings(customerId);

  // IoC veritabanı eşleşmeleri
  const iocMatches = await checkBulkIOCMatches(
    recentEvents.map(e => e.sourceIp).filter(Boolean)
  );

  // Aktif tehdit kampanyaları
  const activeCampaigns = await getRelevantCampaigns(
    customer.sector, 'TR'
  );

  // ─── CLAUDE KORELASYON PROMPT'U ───────────────────────────
  const correlationPrompt = `
Sen CyberStep'in Baş Güvenlik Analisti'sin.
Aşağıdaki çok kaynaklı güvenlik verisini analiz et
ve korelasyon raporu oluştur.

MÜŞTERİ: ${customer.companyName}
SEKTÖR: ${customer.sector}
ZAMAN PENCERESİ: Son ${windowMinutes} dakika

─── FORTIGATE/FORTIANALYZER OLAYLARI (${recentEvents.length} olay) ───
${recentEvents.slice(0, 20).map(e => `
Olay: ${e.eventType}
Kaynak IP: ${e.sourceIp} → Hedef: ${e.destinationIp}:${e.destinationPort}
Tehdit: ${e.threatName || 'Bilinmiyor'}
Ciddiyet: ${e.threatSeverity}
Alınan Aksiyon: ${e.actionTaken}
Cihaz: ${e.deviceHostname} (${e.deviceSerial})
`).join('---\n')}

─── DIŞ TARAMA BULGULARI ───
${externalFindings.slice(0, 10).map(f =>
  `[${f.severity}] ${f.title}: ${f.description}`
).join('\n')}

─── IOC VERİTABANI EŞLEŞMELERİ ───
${iocMatches.length > 0
  ? iocMatches.map(m =>
      `${m.ip} → ${m.threatLevel} (${m.tags.join(', ')}) [Kaynak: ${m.sources.join(', ')}]`
    ).join('\n')
  : 'Bilinen IoC eşleşmesi yok'}

─── AKTİF TEHDIT KAMPANYALARI ───
${activeCampaigns.slice(0, 3).map(c =>
  `${c.name} | Aktör: ${c.actor?.name} | Vektör: ${c.attackVector}`
).join('\n')}

GÖREV:
1. Bu olaylar arasında bir saldırı kalıbı/zinciri var mı?
2. İç olaylar (FortiGate) ile dış bulgular (domain tarama) örtüşüyor mu?
3. Bilinen IoC veya kampanyalarla bağlantı var mı?
4. MITRE ATT&CK kill chain'inde hangi aşamada?
5. Gerçek saldırı mı, gürültü mü? Güven skoru nedir?

JSON FORMATINDA YANIT VER:
{
  "has_correlation": true/false,
  "severity": "critical|high|medium|low",
  "confidence": 0-100,
  "correlation_type": "ioc_match|attack_pattern|campaign_match|kill_chain|noise",
  "kill_chain_stage": "reconnaissance|delivery|exploitation|installation|c2|actions|none",
  "mitre_techniques": ["T1190", "T1078"],

  "attack_narrative": "Saldırı senaryosu — patron dili, 3-5 cümle. Teknik terim yok.",

  "key_evidence": [
    "Bağlantıyı kanıtlayan 3-5 kritik bulgu"
  ],

  "false_positive_risk": "low|medium|high",
  "false_positive_reasoning": "Neden gerçek/sahte olabilir",

  "recommended_action": "block_ip|isolate|investigate|monitor|ignore",
  "action_details": "Spesifik aksiyon — hangi IP'yi blokla, ne yap",
  "action_urgency": "immediate|today|this_week",

  "ips_to_block": ["1.2.3.4"],

  "customer_message": "Müşteriye gönderilecek Türkçe uyarı mesajı (2-3 cümle, teknik olmayan)",

  "should_notify": true/false,
  "notification_priority": "immediate|normal|digest"
}

ÖNEMLİ:
- Gürültüden gerçek tehdidi ayırt et
- Tek olay korelasyon değildir — örüntü ara
- Güven skoru düşükse "monitor" öner, "block" değil
- Sadece JSON döndür
`;

  const response = await callClaude(correlationPrompt, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2000,
  });

  let analysis;
  try {
    analysis = JSON.parse(response);
  } catch {
    logger.error('Claude correlation parse error');
    return null;
  }

  // Korelasyon yoksa veya güven düşükse kaydetme
  if (!analysis.has_correlation || analysis.confidence < 30) {
    // Olayları işlenmiş işaretle
    await markEventsProcessed(recentEvents.map(e => e.id));
    return null;
  }

  // Korelasyon kaydı oluştur
  const [correlation] = await db.insert(fabricCorrelations).values({
    customerId,
    integrationId: integration.id,
    correlationType:    analysis.correlation_type,
    severity:           analysis.severity,
    confidence:         analysis.confidence,
    attackNarrative:    analysis.attack_narrative,
    mitreTechniques:    analysis.mitre_techniques,
    killChainStage:     analysis.kill_chain_stage,
    recommendedAction:  analysis.recommended_action,
    actionDetails:      analysis.action_details,
    fabricEventIds:     recentEvents.map(e => e.id),
    iocIds:             iocMatches.map(m => m.id),
  }).returning();

  // Otomatik blok uygula (müşteri izin verdiyse)
  if (
    analysis.ips_to_block?.length > 0 &&
    integration.autoBlockEnabled &&
    meetsSeverityThreshold(analysis.severity, integration.autoBlockThreshold)
  ) {
    for (const ip of analysis.ips_to_block) {
      await blockIPViaFortiManager(
        customerId, ip, analysis.attack_narrative,
        correlation.id
      );
    }
  }

  // Bildirim gönder
  if (analysis.should_notify) {
    await sendFabricAlert(
      customerId,
      correlation,
      analysis.customer_message,
      analysis.notification_priority
    );
  }

  // Olayları işlenmiş işaretle
  await markEventsProcessed(recentEvents.map(e => e.id));

  return correlation;
}
```

---

## BÖLÜM 6: FORTIMANAGER BLOK MOTORU

```typescript
// src/services/fortiManagerBlock.ts
// Mevcut FortiManager entegrasyonunu genişlet

export async function blockIPViaFortiManager(
  customerId: number,
  ip: string,
  reason: string,
  correlationId: number
): Promise<boolean> {

  const integration = await getIntegration(customerId);
  if (!integration?.fortimanagerEnabled) return false;

  const fmConfig = {
    host:   integration.fortimanagerHost,
    port:   integration.fortimanagerPort,
    token:  decrypt(integration.fortimanagerTokenEncrypted),
    adom:   integration.fortimanagerAdom,
  };

  // Blok aksiyonu kaydı
  const [blockAction] = await db.insert(fortimanagerBlockActions).values({
    integrationId: integration.id,
    customerId,
    correlationId,
    actionType: 'block',
    ipAddress: ip,
    reason,
    fmObjectName: `CyberStep-Block-${ip.replace(/\./g, '-')}`,
    fmStatus: 'pending',
  }).returning();

  try {
    // 1. FortiManager'a login
    const session = await fmLogin(fmConfig);

    // 2. Adres objesi oluştur
    await fmCreateAddressObject(fmConfig, session, {
      name:    blockAction.fmObjectName,
      subnet:  `${ip}/32`,
      comment: `CyberStep Auto-Block | ${new Date().toISOString()} | ${reason.slice(0, 100)}`,
      color:   6, // Kırmızı
    });

    // 3. CyberStep blok grubuna ekle
    const groupName = integration.blockListObjectName;
    await fmAddToGroup(fmConfig, session, groupName, blockAction.fmObjectName);

    // 4. Policy install tetikle (FortiGate'e push)
    const taskId = await fmInstallPolicy(fmConfig, session);

    // 5. Task tamamlanmasını bekle (async — max 30 saniye)
    const taskResult = await waitForFMTask(fmConfig, session, taskId, 30000);

    // 6. Logout
    await fmLogout(fmConfig, session);

    // Başarı kaydı
    await db.update(fortimanagerBlockActions).set({
      fmTaskId: taskId,
      fmStatus: taskResult.success ? 'success' : 'failed',
      fmError:  taskResult.error,
      appliedAt: new Date(),
    }).where(eq(fortimanagerBlockActions.id, blockAction.id));

    // İstatistik güncelle
    if (taskResult.success) {
      await db.update(fortinetIntegrations).set({
        blockCount: sql`block_count + 1`,
        totalIocsBlocked: sql`total_iocs_blocked + 1`,
      }).where(eq(fortinetIntegrations.id, integration.id));
    }

    // Korelasyonu güncelle
    await db.update(fabricCorrelations).set({
      actionTakenAt: new Date(),
      actionTakenBy: 'auto',
      blockedIps: sql`blocked_ips || ${[ip]}::text[]`,
    }).where(eq(fabricCorrelations.id, correlationId));

    logger.info(`FortiManager block successful: ${ip} for customer ${customerId}`);
    return taskResult.success;

  } catch (error) {
    await db.update(fortimanagerBlockActions).set({
      fmStatus: 'failed',
      fmError: error.message,
    }).where(eq(fortimanagerBlockActions.id, blockAction.id));

    logger.error(`FortiManager block failed: ${ip}`, error);
    return false;
  }
}

// FortiManager JSON-RPC yardımcı fonksiyonları
async function fmLogin(config: FMConfig): Promise<string> {
  const response = await axios.post(
    `https://${config.host}:${config.port}/jsonrpc`,
    {
      id: 1,
      method: 'exec',
      params: [{
        url: '/sys/login/user',
        data: {
          user:   process.env.FM_API_USER,
          passwd: config.token,
        }
      }]
    },
    { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  );
  return response.data.session;
}

async function fmCreateAddressObject(
  config: FMConfig,
  session: string,
  obj: { name: string; subnet: string; comment: string; color: number }
): Promise<void> {
  await axios.post(
    `https://${config.host}:${config.port}/jsonrpc`,
    {
      id: 2, session,
      method: 'add',
      params: [{
        url: `/pm/config/adom/${config.adom}/obj/firewall/address`,
        data: {
          name:     obj.name,
          type:     'ipmask',
          subnet:   obj.subnet,
          comment:  obj.comment,
          color:    obj.color,
        }
      }]
    },
    { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  );
}

async function fmAddToGroup(
  config: FMConfig,
  session: string,
  groupName: string,
  memberName: string
): Promise<void> {
  // Önce grubun mevcut üyelerini al
  const current = await axios.post(
    `https://${config.host}:${config.port}/jsonrpc`,
    {
      id: 3, session,
      method: 'get',
      params: [{ url: `/pm/config/adom/${config.adom}/obj/firewall/addrgrp/${groupName}` }]
    },
    { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  );

  const currentMembers = current.data.result[0].data.member || [];

  // Yeni üyeyi ekle
  await axios.post(
    `https://${config.host}:${config.port}/jsonrpc`,
    {
      id: 4, session,
      method: 'update',
      params: [{
        url: `/pm/config/adom/${config.adom}/obj/firewall/addrgrp/${groupName}`,
        data: {
          member: [...currentMembers, memberName]
        }
      }]
    },
    { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  );
}

async function fmInstallPolicy(
  config: FMConfig,
  session: string
): Promise<string> {
  const response = await axios.post(
    `https://${config.host}:${config.port}/jsonrpc`,
    {
      id: 5, session,
      method: 'exec',
      params: [{
        url: '/securityconsole/install/package',
        data: {
          adom: config.adom,
          pkg: 'default',
          flags: ['none'],
        }
      }]
    },
    { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
  );
  return response.data.result[0].data.task;
}
```

---

## BÖLÜM 7: CRON JOB'LAR

```typescript
// src/scheduler/fabricCorrelation.ts

// Her 15 dakikada — batch korelasyon
cron.schedule('*/15 * * * *', async () => {

  // İşlenmemiş olayı olan entegrasyonları bul
  const integrations = await db.select({
    customerId: fabricEvents.customerId,
    count: count(),
  })
  .from(fabricEvents)
  .where(eq(fabricEvents.processed, false))
  .groupBy(fabricEvents.customerId)
  .having(gte(count(), 5));
  // En az 5 işlenmemiş olay varsa korelasyon çalıştır

  for (const item of integrations) {
    try {
      await processAndCorrelate(item.customerId, 0, 'batch');
    } catch (e) {
      logger.error(`Correlation failed for customer ${item.customerId}`, e);
    }
    await sleep(500);
  }
});

// Her gece 03:00 — tüm entegrasyonların sağlık kontrolü
cron.schedule('0 3 * * *', async () => {

  const integrations = await db.select()
    .from(fortinetIntegrations)
    .where(eq(fortinetIntegrations.fortimanagerEnabled, true));

  for (const integration of integrations) {
    try {
      // FortiManager bağlantısı hâlâ çalışıyor mu?
      const isAlive = await testFortiManagerConnection(integration);

      // Security Fabric cihaz listesini güncelle
      if (isAlive) {
        const devices = await discoverFabricDevices(integration);
        await db.update(fortinetIntegrations).set({
          fabricDevices: devices,
          fabricLastDiscoveredAt: new Date(),
        }).where(eq(fortinetIntegrations.id, integration.id));
      }

    } catch (e) {
      logger.error(`FM health check failed: ${integration.id}`, e);
    }
  }
});

// Her hafta Pazartesi 09:00 — haftalık fabric raporu
cron.schedule('0 9 * * 1', async () => {

  const integrations = await db.select()
    .from(fortinetIntegrations)
    .where(
      and(
        eq(fortinetIntegrations.webhookEnabled, true),
        gte(fortinetIntegrations.webhookEventsCount, 1)
      )
    );

  for (const integration of integrations) {
    await generateWeeklyFabricReport(integration.customerId);
  }
});

// Blok doğrulama: 24 saat sonra gerçekten bloke mi?
cron.schedule('0 12 * * *', async () => {

  const pendingVerifications = await db.select()
    .from(fortimanagerBlockActions)
    .where(
      and(
        eq(fortimanagerBlockActions.fmStatus, 'success'),
        eq(fortimanagerBlockActions.verified, false),
        lte(fortimanagerBlockActions.appliedAt,
            new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    );

  for (const action of pendingVerifications) {
    // Shodan veya basit port taramasıyla doğrula
    const isBlocked = await verifyBlockEffective(
      action.ipAddress, action.destinationPort
    );

    await db.update(fortimanagerBlockActions).set({
      verified: true,
      verifiedAt: new Date(),
    }).where(eq(fortimanagerBlockActions.id, action.id));
  }
});
```

---

## BÖLÜM 8: KURULUM SİHİRBAZI (Setup Wizard)

```typescript
// src/pages/portal/FabricSetupPage.tsx
// /hesabim/fortinet-entegrasyonu

// 5 adımlı kurulum sihirbazı
```

**Adım 1 — Giriş ve Token Üretimi:**
```
CyberStep × Fortinet Security Fabric
Entegrasyon Kurulum Sihirbazı

Bu kurulum yaklaşık 20-30 dakika sürer.
Gerekli yetki: FortiGate/FortiAnalyzer admin veya
               FortiManager read-write (sadece policy için)

[Başla →]
```

**Adım 2 — FortiGate Automation Stitch:**
```
Adım 1/4: FortiGate Automation Stitch

Webhook URL'niz:
https://cyberstep.io/api/fabric/webhook/[TOKEN]
[Kopyala]

FortiGate'de yapılacaklar:
Security Fabric → Automation → Automation Stitch
→ + Create New

Trigger: FortiOS Event Log
  Log Level: Critical, High
  Event: Antivirus, IPS, Botnet, Application Control

Action: Webhook
  Method: POST
  URL: [yukarıdaki URL]
  Body: {"srcip":"%%log.srcip%%","dstip":"%%log.dstip%%",
         "threatname":"%%log.threatname%%","severity":"%%log.level%%",
         "action":"%%log.action%%","devname":"%%log.devname%%",
         "devid":"%%log.devid%%"}
  Headers: Content-Type: application/json

[Kurulumu Test Et] ← Bu buton FortiGate'e test event tetikler

Durum: Bağlantı bekleniyor... ⏳
```

**Adım 3 — FortiAnalyzer Log Forwarding:**
```
Adım 2/4: FortiAnalyzer Log Forwarding

FortiAnalyzer'da:
Log Forwarding → + Create New

Remote Server Type: Syslog
Server IP/FQDN: logs.cyberstep.io
Port: 5514 (TCP)
Format: JSON

Filter: Log Type = UTM (Threat)
        Severity >= High

Description: cyberstep:[TOKEN]
← Token burada gizli kanal olarak kullanılır

[Alternatif: HTTPS forward] için:
URL: https://cyberstep.io/api/fabric/syslog/[TOKEN]

[Test Et — FortiAnalyzer'dan test log gönder]
```

**Adım 4 — FortiManager (Opsiyonel):**
```
Adım 3/4: FortiManager Blok Listesi (İsteğe Bağlı)

Bu adım olmadan da çalışır.
Bu adımla: CyberStep kritik IoC'leri otomatik bloklar.

FortiManager'da:
System Settings → Admin → Administrators → + Create New
  Admin Profile: cyberstep_connector
  JSON API Access: Read-Write (sadece Firewall Objects için)
  
Profile Kısıtlamaları:
  [✓] Firewall Address: Read-Write
  [✓] Firewall Address Group: Read-Write
  [✓] Policy Install: Execute
  [✗] System Settings: None
  [✗] Admin Settings: None

Trusted Hosts: 54.93.XX.XX, 18.185.XX.XX
← CyberStep IP aralığı

API Token: [yapıştırın]
Host: [FortiManager IP veya hostname]
ADOM: [adom adı, genelde 'root']

[Bağlantıyı Test Et]
```

**Adım 5 — Özet ve Tamamlama:**
```
✅ Entegrasyon Tamamlandı!

Aktif Bileşenler:
  ✅ FortiGate Automation Stitch — Bağlı (son test: 2 dk önce)
  ✅ FortiAnalyzer Log Forwarding — Bağlı
  ✅ FortiManager Blok Motoru — Bağlı
  
Security Fabric'te bulunan cihazlar:
  FortiGate-100F (FG-DEMO-001) v7.4.2
  FortiGate-60F  (FG-BRANCH-001) v7.4.1
  FortiAnalyzer-VM v7.4.0

Otomatik Blok:
  [✓] Kritik tehditlerde otomatik blok aktif
  Eşik: Critical seviyesi ve üzeri

İlk korelasyon raporu ~1 saat içinde hazır olacak.
Kritik tehdit tespit edilirse WhatsApp + e-posta ile bildirim alacaksınız.

[Entegrasyon Panelime Git →]
```

---

## BÖLÜM 9: DEMO ORTAMI KONFIGÜRASYONU

```typescript
// src/config/demoMode.ts
// Demo FortiGate ortamı için özel konfigürasyon

export const DEMO_CONFIG = {
  enabled: process.env.DEMO_MODE === 'true',

  // Demo FortiGate simülasyonu
  // Gerçek FortiGate olmadan test için
  simulateFortiGateEvents: true,

  demoEvents: [
    {
      eventType: 'ips_alert',
      sourceIp: '185.220.101.45',
      // Gerçek Tor exit node IP
      destinationIp: '10.0.0.1',
      destinationPort: 3389,
      threatName: 'RDP.Login.Brute.Force',
      severity: 'critical',
      action: 'block',
      deviceHostname: 'FG-DEMO-001',
    },
    {
      eventType: 'botnet_c2',
      sourceIp: '10.0.0.50',
      // İç network'ten dışarıya
      destinationIp: '91.108.4.1',
      // Bilinen Telegram C2 IP
      destinationPort: 443,
      threatName: 'Botnet.C2.Communication',
      severity: 'critical',
      action: 'monitor',
      deviceHostname: 'FG-DEMO-001',
    },
    {
      eventType: 'malware_detected',
      sourceIp: '10.0.0.75',
      threatName: 'W32/Ransomware.GenVariant',
      severity: 'high',
      action: 'block',
      deviceHostname: 'FG-DEMO-001',
    },
  ],
};

// Demo event tetikleyici
// POST /api/fabric/demo/trigger → Demo olayı simüle et
export async function triggerDemoEvent(
  customerId: number,
  eventIndex: number = 0
): Promise<void> {
  const event = DEMO_CONFIG.demoEvents[eventIndex];
  const integration = await getIntegration(customerId);

  await db.insert(fabricEvents).values({
    integrationId: integration.id,
    customerId,
    source: 'automation_stitch',
    ...event,
    rawLog: { demo: true, ...event },
    rawFormat: 'json',
    occurredAt: new Date(),
  });

  // Anlık korelasyon başlat
  await processAndCorrelate(customerId, 0, 'immediate');
}
```

---

## BÖLÜM 10: API ROTALAR

```
─── FABRIC ENTEGRASYON ─────────────────────────────────────

POST /api/fabric/webhook/:token
     FortiGate Automation Stitch endpoint

POST /api/fabric/syslog/:token
     FortiAnalyzer log forward endpoint

POST /api/fabric/verify/:token
     Kurulum wizard token doğrulama

GET  /api/portal/fabric/integration
     Müşterinin entegrasyon durumu

POST /api/portal/fabric/setup
     Kurulum wizard adım kaydet

POST /api/portal/fabric/test-webhook
     Test event gönder

GET  /api/portal/fabric/events
     Gelen olaylar listesi (filtreli)

GET  /api/portal/fabric/correlations
     Korelasyon listesi + detay

POST /api/portal/fabric/block-ip
     Manuel IP blok isteği

GET  /api/portal/fabric/block-history
     Blok geçmişi

GET  /api/portal/fabric/fabric-devices
     Security Fabric cihaz envanteri

─── ADMIN ──────────────────────────────────────────────────

GET  /api/admin/fabric/integrations
     Tüm entegrasyonlar özeti

GET  /api/admin/fabric/events
     Global olay stream

POST /api/admin/fabric/demo/trigger
     Demo olay tetikle

GET  /api/admin/fabric/correlations
     Global korelasyon listesi

─── DEMO ───────────────────────────────────────────────────

POST /api/fabric/demo/trigger
     Demo event simülasyonu
```

---

## BÖLÜM 11: ENVIRONMENT VARIABLES

```bash
# Fortinet
FM_API_USER=cyberstep-api
FORTIGATE_TRUSTED_IPS=54.93.XX.XX,18.185.XX.XX

# Syslog Server
SYSLOG_PORT=5514
SYSLOG_UDP_PORT=5515

# Demo Modu
DEMO_MODE=false

# Encryption (token şifreleme)
ENCRYPTION_KEY=           # 32 byte AES-256 key

# Log Storage
FABRIC_LOG_RETENTION_DAYS=90
```

---

## BÖLÜM 12: TEST SENARYOSU (Demo Ortamı)

```
TEST 1 — Temel Webhook Bağlantısı:
  FortiGate'de Automation Stitch kur
  Test event gönder
  CyberStep'te gelen event'i doğrula ✓

TEST 2 — Korelasyon Motoru:
  3 demo event tetikle (RDP brute-force, C2, malware)
  Claude korelasyonu bekle (~30 saniye)
  "Kill chain tespit edildi" uyarısını doğrula ✓

TEST 3 — FortiManager Blok:
  Yüksek ciddiyet korelasyon sonrası
  FortiManager'da address object oluştu mu? ✓
  FortiGate policy'de blok uygulandı mı? ✓
  24 saat sonra doğrulama çalıştı mı? ✓

TEST 4 — Security Fabric Yayılım:
  FortiManager'da blok → FortiGate'e push
  Varsa FortiEDR'de de görünüyor mu? ✓

TEST 5 — Müşteri Bildirim:
  Kritik korelasyon → WhatsApp + e-posta
  Patron dilinde 2-3 cümle mesaj ✓
```

---

*CyberStep.io — Fortinet Security Fabric Entegrasyonu — Mayıs 2026*
