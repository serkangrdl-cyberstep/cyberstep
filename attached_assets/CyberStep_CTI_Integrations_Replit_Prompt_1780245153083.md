# CyberStep.io — Tam Entegrasyon + CTI Platform
## Replit Agent Promptu — Tüm Entegrasyonlar + Tehdit İstihbaratı

---

## BAĞLAM

Mevcut stack: Node.js + Express + TypeScript + PostgreSQL
+ Drizzle ORM + React + Claude API.

Bu prompt üç katmanda çalışır:
1. Yeni veri kaynağı entegrasyonları
2. Güvenlik vendor feed entegrasyonları (Fortinet, PAN, CheckPoint, Cisco)
3. Tam CTI platform altyapısı

Her bölüm bağımsız uygulanabilir. Sırayla ver.

---

# BÖLÜM 1: VERİTABANI — TÜM YENİ TABLOLAR

```sql
-- ─── CTI ANA TABLOLAR ────────────────────────────────────

-- Tehdit aktörü profilleri
CREATE TABLE IF NOT EXISTS threat_actors (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}',
  origin_country varchar(10),
  motivation varchar(50),
  -- 'financial' | 'espionage' | 'hacktivism' | 'sabotage' | 'unknown'
  target_sectors text[] DEFAULT '{}',
  target_countries text[] DEFAULT '{}',
  activity_level varchar(20) DEFAULT 'unknown',
  -- 'high' | 'medium' | 'low' | 'dormant' | 'unknown'
  first_seen date,
  last_seen date,
  description text,
  ttps text[] DEFAULT '{}',
  -- MITRE ATT&CK teknik ID'leri: ['T1190', 'T1566.001']
  known_tools text[] DEFAULT '{}',
  source_urls text[] DEFAULT '{}',
  mitre_group_id varchar(20),
  -- MITRE G-ID: 'G0016'
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Aktif saldırı kampanyaları
CREATE TABLE IF NOT EXISTS threat_campaigns (
  id serial PRIMARY KEY,
  actor_id integer REFERENCES threat_actors(id),
  name varchar(255) NOT NULL,
  status varchar(20) DEFAULT 'active',
  -- 'active' | 'concluded' | 'suspected'
  start_date date,
  end_date date,
  target_sectors text[] DEFAULT '{}',
  target_countries text[] DEFAULT '{}',
  attack_vector varchar(100),
  -- 'phishing' | 'supply_chain' | 'zero_day' | 'brute_force' | 'watering_hole'
  ttps text[] DEFAULT '{}',
  iocs jsonb DEFAULT '{}',
  -- {ips: [], domains: [], hashes: [], emails: [], urls: []}
  description text,
  severity varchar(20) DEFAULT 'medium',
  -- 'critical' | 'high' | 'medium' | 'low'
  source varchar(50),
  -- 'fortiguard' | 'unit42' | 'talos' | 'checkpoint' | 'misp' | 'manual'
  source_report_url varchar(500),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- IoC (Indicator of Compromise) merkezi havuzu
CREATE TABLE IF NOT EXISTS ioc_registry (
  id serial PRIMARY KEY,
  type varchar(20) NOT NULL,
  -- 'ip' | 'domain' | 'url' | 'hash_md5' | 'hash_sha256' |
  -- 'email' | 'asn' | 'cidr'
  value varchar(2000) NOT NULL,
  threat_level varchar(20) DEFAULT 'medium',
  -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  tags text[] DEFAULT '{}',
  -- ['ransomware', 'c2', 'phishing', 'botnet', 'malware']
  confidence integer DEFAULT 50,
  -- 0-100: Bu IoC'nin güvenilirliği
  first_seen timestamp DEFAULT now(),
  last_seen timestamp DEFAULT now(),
  expiry_at timestamp,
  -- null = süresiz, dolu = bu tarihten sonra geçersiz
  -- Kaynak bilgisi
  sources text[] DEFAULT '{}',
  -- ['fortiguard', 'usom', 'talos', 'misp', 'urlhaus']
  source_count integer DEFAULT 1,
  -- Kaç ayrı kaynak bu IoC'yi bildiriyor
  -- İlişkiler
  actor_ids integer[] DEFAULT '{}',
  campaign_ids integer[] DEFAULT '{}',
  -- İstatistik
  match_count integer DEFAULT 0,
  -- CyberStep taramalarında kaç kez eşleşti
  is_active boolean DEFAULT true,
  UNIQUE(type, value)
);

-- IoC eşleşme log'u
CREATE TABLE IF NOT EXISTS ioc_matches (
  id serial PRIMARY KEY,
  ioc_id integer REFERENCES ioc_registry(id),
  customer_id integer REFERENCES customers(id),
  domain varchar(255),
  match_type varchar(50),
  -- 'dns_resolution' | 'outbound_connection' | 'email_sender' |
  -- 'header_value' | 'cert_issuer'
  matched_value varchar(2000),
  severity varchar(20),
  notified boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Vendor feed durumu
CREATE TABLE IF NOT EXISTS threat_feed_status (
  id serial PRIMARY KEY,
  feed_name varchar(100) UNIQUE NOT NULL,
  -- 'fortiguard' | 'talos' | 'unit42' | 'checkpoint_threatcloud' |
  -- 'misp' | 'opencti' | 'usom' | 'urlhaus' | 'feodo'
  is_active boolean DEFAULT false,
  last_fetch_at timestamp,
  last_success_at timestamp,
  records_fetched integer DEFAULT 0,
  error_count integer DEFAULT 0,
  last_error text,
  api_key_configured boolean DEFAULT false,
  fetch_interval_minutes integer DEFAULT 60,
  created_at timestamp DEFAULT now()
);

-- MITRE ATT&CK teknik kataloğu
CREATE TABLE IF NOT EXISTS mitre_techniques (
  id serial PRIMARY KEY,
  technique_id varchar(20) UNIQUE NOT NULL,
  -- 'T1190', 'T1566.001'
  name varchar(255) NOT NULL,
  tactic varchar(50) NOT NULL,
  -- 'initial_access' | 'execution' | 'persistence' | 'privilege_escalation'
  -- | 'defense_evasion' | 'credential_access' | 'discovery'
  -- | 'lateral_movement' | 'collection' | 'exfiltration' | 'impact'
  description text,
  platform text[] DEFAULT '{}',
  -- ['Windows', 'Linux', 'macOS', 'Cloud']
  detection_tips text,
  mitigation_tips text,
  url varchar(500),
  is_subtechnique boolean DEFAULT false,
  parent_id varchar(20)
);

-- Müşteri tehdit alaka skoru
CREATE TABLE IF NOT EXISTS customer_threat_relevance (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  actor_id integer REFERENCES threat_actors(id),
  campaign_id integer REFERENCES threat_campaigns(id),
  relevance_score integer DEFAULT 0,
  -- 0-100
  matching_factors jsonb,
  -- {sector_match: true, country_match: true, ttp_overlap: ['T1190']}
  notified_at timestamp,
  resolved_at timestamp,
  created_at timestamp DEFAULT now(),
  UNIQUE(customer_id, campaign_id)
);

-- ─── GÜVENLİK VENDOR ENTEGRASYONLARI ─────────────────────

-- Müşteri güvenlik cihazı kayıtları
CREATE TABLE IF NOT EXISTS customer_security_devices (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  device_type varchar(50) NOT NULL,
  -- 'fortigate' | 'panos' | 'checkpoint' | 'cisco_asa' |
  -- 'cisco_ftd' | 'fortianalyzer' | 'fortisiem'
  vendor varchar(30) NOT NULL,
  -- 'fortinet' | 'palo_alto' | 'checkpoint' | 'cisco'
  device_name varchar(255),
  management_ip varchar(50),
  api_endpoint varchar(500),
  api_key_encrypted text,
  -- Şifrelenmiş API key
  api_version varchar(20),
  -- 'v7.0' | 'v10.1' | 'R81.10' | '7.x'
  is_active boolean DEFAULT false,
  last_synced_at timestamp,
  sync_status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'success' | 'error'
  last_error text,
  capabilities text[] DEFAULT '{}',
  -- ['read_policy', 'push_block_ip', 'pull_logs', 'read_threats']
  created_at timestamp DEFAULT now()
);

-- Vendor'dan çekilen tehdit verileri
CREATE TABLE IF NOT EXISTS vendor_threat_events (
  id serial PRIMARY KEY,
  device_id integer REFERENCES customer_security_devices(id),
  customer_id integer REFERENCES customers(id),
  event_type varchar(50),
  -- 'blocked_ip' | 'detected_malware' | 'ips_alert' |
  -- 'botnet_detection' | 'c2_communication' | 'vulnerability_scan'
  source_ip varchar(50),
  destination_ip varchar(50),
  destination_port integer,
  protocol varchar(20),
  threat_name varchar(255),
  severity varchar(20),
  action_taken varchar(50),
  -- 'blocked' | 'allowed' | 'detected' | 'dropped'
  raw_event jsonb,
  -- Vendor'ın ham log verisi
  ioc_matched integer REFERENCES ioc_registry(id),
  -- Bu event'in eşleştiği IoC
  occurred_at timestamp,
  created_at timestamp DEFAULT now()
);

-- ─── EK ENTEGRASYON TABLOLARI ─────────────────────────────

-- SecurityTrails sorgu cache'i
CREATE TABLE IF NOT EXISTS securitytrails_cache (
  domain varchar(255) PRIMARY KEY,
  dns_history jsonb,
  subdomains text[],
  associated_ips text[],
  fetched_at timestamp DEFAULT now()
);

-- E-fatura kayıtları
CREATE TABLE IF NOT EXISTS e_invoice_records (
  id serial PRIMARY KEY,
  invoice_id integer REFERENCES enterprise_invoices(id),
  gib_uuid varchar(100) UNIQUE,
  -- GİB tarafından verilen UUID
  e_invoice_type varchar(20) DEFAULT 'e_arsiv',
  -- 'e_fatura' | 'e_arsiv'
  xml_content text,
  -- Ham XML içerik
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'sent' | 'accepted' | 'rejected'
  sent_at timestamp,
  response_at timestamp,
  response_code varchar(20),
  response_message text
);
```

---

# BÖLÜM 2: GÜVENLİK VENDOR FEED ENTEGRASYONları

## 2.1 Fortinet FortiGuard Tehdit İstihbaratı

```typescript
// src/integrations/fortiguard.ts
// FortiGuard Labs API — Fortinet'in global tehdit istihbarat servisi

const FORTIGUARD_BASE = 'https://fortiguard.fortinet.com/api/v2';

export class FortiGuardService {

  // IP itibar sorgusu
  async getIPReputation(ip: string): Promise<FortiGuardIPResult> {
    // FortiGuard ücretsiz web lookup API'si
    // Ticari müşteriler için tam API anahtarı gerekiyor
    const response = await axios.get(
      `${FORTIGUARD_BASE}/lookup/ip`,
      {
        params: { ip },
        headers: this.getHeaders(),
        timeout: 5000,
      }
    );

    return {
      ip,
      threatLevel:      response.data.score,
      -- 0-5: 0=clean, 5=critical
      categories:       response.data.categories,
      -- ['Botnet', 'C&C', 'Malicious', 'Phishing', 'Spam']
      countryCode:      response.data.country,
      asn:              response.data.asn,
      lastSeen:         response.data.last_seen,
      source:           'fortiguard',
    };
  }

  // URL/Domain itibar sorgusu
  async getURLReputation(url: string): Promise<FortiGuardURLResult> {
    const response = await axios.get(
      `${FORTIGUARD_BASE}/lookup/url`,
      {
        params: { url },
        headers: this.getHeaders(),
      }
    );

    return {
      url,
      category:    response.data.category,
      riskLevel:   response.data.risk,
      -- 'high' | 'medium' | 'low' | 'clean'
      malwareType: response.data.malware_type,
      source:      'fortiguard',
    };
  }

  // FortiGuard günlük IoC feed'i (ticari abonelik gerektirir)
  async fetchDailyIOCFeed(): Promise<FortiGuardIOC[]> {
    const response = await axios.get(
      `${FORTIGUARD_BASE}/intelligence/feed/daily`,
      { headers: this.getHeaders() }
    );

    return response.data.indicators.map(ioc => ({
      type:        ioc.type,
      value:       ioc.value,
      threatLevel: ioc.severity,
      tags:        ioc.categories,
      source:      'fortiguard',
      confidence:  ioc.confidence || 80,
    }));
  }

  // FortiGate firewall'dan tehdit olaylarını çek
  // Müşteri kendi FortiGate'inin API erişimini CyberStep'e verirse
  async pullFortiGateEvents(
    deviceConfig: CustomerSecurityDevice
  ): Promise<VendorThreatEvent[]> {

    const fgBase = `https://${deviceConfig.managementIP}/api/v2`;

    // FortiGate'e bağlan
    const response = await axios.get(
      `${fgBase}/log/threat/list`,
      {
        params: {
          filter: `date>=${getYesterdayISO()}`,
          rows: 1000,
          start: 0,
        },
        headers: {
          'Authorization': `Bearer ${decrypt(deviceConfig.apiKeyEncrypted)}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        // Çoğu FortiGate self-signed cert kullanır
      }
    );

    return response.data.results.map(event => ({
      deviceId:         deviceConfig.id,
      customerId:       deviceConfig.customerId,
      eventType:        mapFortiGateEventType(event.type),
      sourceIp:         event.srcip,
      destinationIp:    event.dstip,
      destinationPort:  event.dstport,
      protocol:         event.proto,
      threatName:       event.threatname || event.attack,
      severity:         mapFortiGateSeverity(event.severity),
      actionTaken:      event.action,
      rawEvent:         event,
      occurredAt:       new Date(event.eventtime * 1000),
    }));
  }

  // FortiGate'e IP blok kuralı gönder
  async pushBlockIPToFortiGate(
    deviceConfig: CustomerSecurityDevice,
    ip: string,
    reason: string
  ): Promise<boolean> {

    const fgBase = `https://${deviceConfig.managementIP}/api/v2`;

    // Adres objesi oluştur
    await axios.post(
      `${fgBase}/cmdb/firewall/address`,
      {
        name: `CyberStep-Block-${ip.replace(/\./g, '-')}`,
        type: 'ipmask',
        subnet: `${ip} 255.255.255.255`,
        comment: `CyberStep: ${reason} | ${new Date().toISOString()}`,
      },
      {
        headers: {
          'Authorization': `Bearer ${decrypt(deviceConfig.apiKeyEncrypted)}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    // Adres grubuna ekle
    await axios.put(
      `${fgBase}/cmdb/firewall/addrgrp/CyberStep-BlockList`,
      { member: [{ name: `CyberStep-Block-${ip.replace(/\./g, '-')}` }] },
      {
        headers: {
          'Authorization': `Bearer ${decrypt(deviceConfig.apiKeyEncrypted)}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return true;
  }

  private getHeaders() {
    return process.env.FORTIGUARD_API_KEY
      ? { 'Authorization': `Bearer ${process.env.FORTIGUARD_API_KEY}` }
      : {};
  }
}

// FortiGate severity → CyberStep severity mapping
function mapFortiGateSeverity(severity: string): string {
  const map: Record<string, string> = {
    'critical': 'critical',
    'high':     'high',
    'medium':   'medium',
    'low':      'low',
    'info':     'info',
  };
  return map[severity.toLowerCase()] || 'medium';
}
```

---

## 2.2 Palo Alto Networks — Unit 42 + AutoFocus

```typescript
// src/integrations/paloalto.ts

export class PaloAltoService {

  // AutoFocus Threat Intelligence API
  // Ücretli: Cortex XSOAR veya AutoFocus aboneliği gerektirir
  async getAutoFocusTagInfo(tag: string): Promise<AutoFocusTag> {
    const response = await axios.post(
      'https://autofocus.paloaltonetworks.com/api/v1.0/tag',
      { tag },
      {
        headers: {
          'apiKey': process.env.AUTOFOCUS_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    return response.data;
  }

  // WildFire malware analiz API'si
  // Şüpheli dosya hash'ini sorgula
  async checkFileHash(
    hash: string,
    hashType: 'md5' | 'sha256' | 'sha1' = 'sha256'
  ): Promise<WildFireResult> {
    const response = await axios.post(
      'https://wildfire.paloaltonetworks.com/publicapi/get/verdict',
      `apikey=${process.env.WILDFIRE_API_KEY}&hash=${hash}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const verdict = response.data['wildfire']['get-verdict-info']['verdict'];
    return {
      hash,
      verdict:  verdict === '1' ? 'malware'
              : verdict === '2' ? 'phishing'
              : verdict === '0' ? 'benign'
              : 'unknown',
      malwareType: response.data['wildfire']['get-verdict-info']['type'],
      source: 'wildfire',
    };
  }

  // Unit 42 Threat Research — Public RSS/API
  // Ücretsiz: RSS feed'den son tehdit araştırmaları
  async fetchUnit42Reports(): Promise<ThreatReport[]> {
    const response = await axios.get(
      'https://unit42.paloaltonetworks.com/feed/'
    );
    return parseRSSFeed(response.data).map(item => ({
      title:       item.title,
      url:         item.link,
      publishedAt: new Date(item.pubDate),
      summary:     item.description,
      tags:        extractTagsFromUnit42(item),
      source:      'unit42',
    }));
  }

  // PAN-OS firewall'dan güvenlik olayları çek
  async pullPANOSLogs(
    deviceConfig: CustomerSecurityDevice
  ): Promise<VendorThreatEvent[]> {
    // PAN-OS REST API
    const response = await axios.get(
      `https://${deviceConfig.managementIP}/restapi/v10.1/Logs/threat`,
      {
        params: {
          'location': 'vsys',
          'vsys': 'vsys1',
          'limit': 1000,
          'filter': `( receive_time geq '${getYesterdayForPAN()}' )`,
        },
        headers: {
          'X-PAN-KEY': decrypt(deviceConfig.apiKeyEncrypted),
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return response.data.result.entry.map(event => ({
      deviceId:    deviceConfig.id,
      customerId:  deviceConfig.customerId,
      eventType:   mapPANEventType(event['subtype']),
      sourceIp:    event['src'],
      destinationIp: event['dst'],
      destinationPort: parseInt(event['dport']),
      threatName:  event['threatid'] || event['app'],
      severity:    event['severity'],
      actionTaken: event['action'],
      rawEvent:    event,
      occurredAt:  new Date(event['receive_time']),
    }));
  }

  // PAN-OS'a dinamik adres grubu üzerinden IP blok
  async pushBlockIPToPANOS(
    deviceConfig: CustomerSecurityDevice,
    ip: string,
    reason: string
  ): Promise<boolean> {

    // PAN-OS Dynamic Address Group (DAG) yaklaşımı
    // Gerçek zamanlı güncelleme — policy değişikliği gerektirmez
    const response = await axios.post(
      `https://${deviceConfig.managementIP}/api/`,
      null,
      {
        params: {
          key:    decrypt(deviceConfig.apiKeyEncrypted),
          type:   'op',
          cmd:    `<request><address-group-push>
                    <address-group>CyberStep-BlockList</address-group>
                    <tag><member>CyberStep-Block</member></tag>
                    <ip>${ip}</ip>
                  </address-group-push></request>`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return response.data.response['@status'] === 'success';
  }
}
```

---

## 2.3 Check Point — ThreatCloud

```typescript
// src/integrations/checkpoint.ts

export class CheckPointService {

  // ThreatCloud IP/URL/File sorgusu
  // Ticari: Check Point aboneliği veya ücretsiz deneme API'si
  async getThreatCloudReputation(
    indicator: string,
    type: 'ip' | 'url' | 'domain' | 'file'
  ): Promise<ThreatCloudResult> {

    const response = await axios.post(
      'https://te.checkpoint.com/tecloud/api/v1/file/query',
      {
        request: [{
          [`${type}`]: indicator,
        }]
      },
      {
        headers: {
          'Authorization': process.env.CHECKPOINT_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    const result = response.data.response[0];
    return {
      indicator,
      type,
      verdict:     result.status.label,
      -- 'Malicious' | 'Benign' | 'Unknown'
      confidence:  result.status.confidence,
      threatName:  result.threat_names?.[0],
      families:    result.threat_names,
      source:      'threatcloud',
    };
  }

  // Check Point Research blog feed (ücretsiz)
  async fetchCPRResearch(): Promise<ThreatReport[]> {
    const response = await axios.get(
      'https://research.checkpoint.com/feed/'
    );
    return parseRSSFeed(response.data).map(item => ({
      title:       item.title,
      url:         item.link,
      publishedAt: new Date(item.pubDate),
      summary:     item.description,
      source:      'checkpoint_research',
    }));
  }

  // Check Point Gateway'den log çekme (SmartLog API)
  async pullCheckPointLogs(
    deviceConfig: CustomerSecurityDevice
  ): Promise<VendorThreatEvent[]> {

    // SmartLog API — Check Point Management Server'a bağlanır
    const response = await axios.post(
      `https://${deviceConfig.managementIP}/web_api/run-script`,
      {
        'script-name': 'GetThreatLogs',
        'script': `mgmt_cli login -r true -f json > /dev/null &&
                   mgmt_cli show logs from-date "${getYesterdayISO()}" -f json`,
        'targets': ['localhost'],
      },
      {
        headers: {
          'x-chkp-sid': await this.getSession(deviceConfig),
          'Content-Type': 'application/json',
        }
      }
    );

    return parseCPLogs(response.data);
  }

  // Check Point Gateway'e IP blok (Network Objects API)
  async pushBlockIPToCheckPoint(
    deviceConfig: CustomerSecurityDevice,
    ip: string,
    reason: string
  ): Promise<boolean> {

    const session = await this.getSession(deviceConfig);

    // Host objesi oluştur
    await axios.post(
      `https://${deviceConfig.managementIP}/web_api/add-host`,
      {
        name:    `CyberStep-Block-${ip.replace(/\./g, '-')}`,
        'ip-address': ip,
        comments: `CyberStep: ${reason}`,
        color:   'red',
      },
      { headers: { 'x-chkp-sid': session, 'Content-Type': 'application/json' } }
    );

    // Blok grubuna ekle
    await axios.post(
      `https://${deviceConfig.managementIP}/web_api/set-group`,
      {
        name:    'CyberStep-BlockList',
        members: { add: `CyberStep-Block-${ip.replace(/\./g, '-')}` }
      },
      { headers: { 'x-chkp-sid': session, 'Content-Type': 'application/json' } }
    );

    // Policy publish et
    await axios.post(
      `https://${deviceConfig.managementIP}/web_api/publish`,
      {},
      { headers: { 'x-chkp-sid': session } }
    );

    return true;
  }

  private async getSession(device: CustomerSecurityDevice): Promise<string> {
    const response = await axios.post(
      `https://${device.managementIP}/web_api/login`,
      {
        user: process.env.CP_MGMT_USER,
        password: decrypt(device.apiKeyEncrypted),
      }
    );
    return response.data.sid;
  }
}
```

---

## 2.4 Cisco — Talos + Umbrella

```typescript
// src/integrations/cisco.ts

export class CiscoService {

  // Talos Intelligence API
  // Ücretsiz sorgu: talosintelligence.com
  // Ticari: Cisco SecureX veya Threat Response aboneliği
  async getTalosReputation(ip: string): Promise<TalosResult> {
    // Talos'un kamuya açık JSON endpoint'i
    const response = await axios.get(
      `https://talosintelligence.com/api/v1/lookup/ip/?ip=${ip}`,
      {
        headers: {
          'User-Agent': 'CyberStep-ThreatIntel/1.0',
        },
        timeout: 8000,
      }
    );

    return {
      ip,
      reputation:       response.data.email_score_name,
      -- 'Good' | 'Neutral' | 'Poor' | 'Threat'
      blacklistStatus:  response.data.blacklist_status,
      -- 'Blacklisted' | 'Graylisted' | 'Not Listed'
      ownerDomain:      response.data.owner_url,
      hostname:         response.data.hostname,
      source:           'talos',
    };
  }

  // Cisco Umbrella Investigate API
  // Domain güvenilirlik skoru + kategorilendirme
  async getUmbrellaRisk(domain: string): Promise<UmbrellaResult> {
    const response = await axios.get(
      `https://investigate.api.umbrella.com/domains/score/${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.UMBRELLA_API_KEY}`,
        }
      }
    );

    return {
      domain,
      score:      response.data.domainScore,
      -- -100 (malicious) to 100 (trusted)
      status:     response.data.domainStatus,
      -- 1=malicious, 0=unknown, -1=benign
      categories: response.data.categories,
      source:     'umbrella',
    };
  }

  // Talos Threat Advisory feed (ücretsiz RSS)
  async fetchTalosAdvisories(): Promise<ThreatReport[]> {
    const response = await axios.get(
      'https://blog.talosintelligence.com/feeds/posts/default?alt=rss'
    );
    return parseRSSFeed(response.data)
      .slice(0, 20)
      .map(item => ({
        title:       item.title,
        url:         item.link,
        publishedAt: new Date(item.pubDate),
        summary:     stripHTML(item.description).slice(0, 300),
        source:      'talos',
      }));
  }

  // Cisco Firepower/ASA'dan log çekme
  async pullCiscoFTDLogs(
    deviceConfig: CustomerSecurityDevice
  ): Promise<VendorThreatEvent[]> {

    // Cisco FTD REST API
    const response = await axios.get(
      `https://${deviceConfig.managementIP}/api/fmc_config/v1/domain/`
        + `${process.env.FTD_DOMAIN_UUID}/audit/auditrecords`,
      {
        params: {
          startTime: getYesterdayEpoch(),
          endTime:   getNowEpoch(),
          limit:     1000,
        },
        headers: {
          'X-auth-access-token': await this.getFTDToken(deviceConfig),
          'X-auth-refresh-token': await this.getFTDRefreshToken(deviceConfig),
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return parseCiscoFTDLogs(response.data.items);
  }

  // Cisco ASA'ya ACL üzerinden IP blok
  async pushBlockIPToCiscoASA(
    deviceConfig: CustomerSecurityDevice,
    ip: string
  ): Promise<boolean> {

    // Cisco ASA REST API
    const response = await axios.post(
      `https://${deviceConfig.managementIP}/api/access/in/OUTSIDE/rules`,
      {
        permit:          false,
        sourceAddress:   { kind: 'IPv4Address', value: ip },
        destinationAddress: { kind: 'AnyIPAddress' },
        sourceService:   { kind: 'AnyService' },
        destinationService: { kind: 'AnyService' },
        remarks:         [`CyberStep Block: ${new Date().toISOString()}`],
        position:        1,
        -- En üste ekle (önce işlenir)
        isAccessRule:    true,
        enabled:         true,
      },
      {
        headers: {
          'User-Agent': 'REST API Agent',
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${process.env.CISCO_ASA_USER}:${decrypt(deviceConfig.apiKeyEncrypted)}`
          ).toString('base64')}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return response.status === 201;
  }
}
```

---

## 2.5 Açık Kaynak CTI Servisleri

```typescript
// src/integrations/openSourceCTI.ts

export class OpenSourceCTIService {

  // MISP — Malware Information Sharing Platform
  async fetchMISPEvents(
    mispUrl: string,
    apiKey: string,
    daysBack: number = 7
  ): Promise<MISPEvent[]> {
    const response = await axios.post(
      `${mispUrl}/events/index`,
      {
        from: getDateDaysAgo(daysBack),
        published: 1,
        tag: ['tlp:white', 'tlp:green'],
        -- Kamuya açık verileri çek
      },
      {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      }
    );

    return response.data.map(event => ({
      id:          event.Event.id,
      info:        event.Event.info,
      threatLevel: event.Event.threat_level_id,
      -- 1=High, 2=Medium, 3=Low, 4=Undefined
      tags:        event.Event.Tag?.map(t => t.name),
      iocs:        extractMISPIOCs(event.Event.Attribute),
      publishedAt: new Date(event.Event.publish_timestamp * 1000),
    }));
  }

  // OpenCTI — Open Cyber Threat Intelligence
  async fetchOpenCTIIndicators(
    ctiUrl: string,
    apiToken: string,
    since: Date
  ): Promise<OpenCTIIndicator[]> {
    const query = `
      query {
        indicators(
          filters: { key: "created_at", values: ["${since.toISOString()}"] }
          first: 500
        ) {
          edges {
            node {
              id
              name
              description
              indicator_types
              pattern
              valid_from
              valid_until
              confidence
              createdBy { name }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      `${ctiUrl}/graphql`,
      { query },
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );

    return response.data.data.indicators.edges.map(e => e.node);
  }

  // Shodan Trends — Tarihsel internet tarama verisi
  async getShodanTrends(query: string): Promise<ShodanTrend[]> {
    const response = await axios.get(
      'https://trends.shodan.io/api/v1/search',
      {
        params: { query, key: process.env.SHODAN_API_KEY },
      }
    );
    return response.data.facets.ts;
  }

  // GreyNoise — İnternet gürültüsü vs gerçek tehdit
  async getGreyNoiseContext(ip: string): Promise<GreyNoiseResult> {
    const response = await axios.get(
      `https://api.greynoise.io/v3/community/${ip}`,
      {
        headers: {
          'key': process.env.GREYNOISE_API_KEY || '',
          -- Community API ücretsiz (sınırlı)
        }
      }
    );

    return {
      ip,
      classification: response.data.classification,
      -- 'malicious' | 'benign' | 'unknown'
      isBot:          response.data.noise,
      -- İnternet genelinde gürültü yapıyor mu?
      isTor:          response.data.riot,
      -- Tor çıkış node'u mu?
      name:           response.data.name,
      lastSeen:       response.data.last_seen,
      source:         'greynoise',
    };
  }

  // Cloudflare Radar — Türkiye internet anomalileri
  async getTurkeyInternetStatus(): Promise<CloudflareRadarData> {
    const response = await axios.get(
      'https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries',
      {
        params: {
          location: 'TR',
          aggInterval: '1d',
          dateRange: '7d',
          format: 'json',
        },
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        }
      }
    );

    return response.data.result;
  }
}
```

---

# BÖLÜM 3: CTI PLATFORM MOTORU

## 3.1 IoC Enrichment Pipeline

```typescript
// src/cti/iocEnrichment.ts
// Bir IoC geldiğinde tüm kaynaklardan zenginleştir

export async function enrichIOC(
  type: string,
  value: string
): Promise<EnrichedIOC> {

  const results: EnrichmentResult[] = [];

  // Paralel sorgulama — tüm kaynaklar aynı anda
  const queries: Promise<unknown>[] = [];

  if (type === 'ip') {
    queries.push(
      fortiGuard.getIPReputation(value).catch(() => null),
      talos.getTalosReputation(value).catch(() => null),
      greyNoise.getGreyNoiseContext(value).catch(() => null),
      abuseIPDB.checkIP(value).catch(() => null),
      // AbuseIPDB zaten entegre
    );
  }

  if (type === 'domain' || type === 'url') {
    queries.push(
      fortiGuard.getURLReputation(value).catch(() => null),
      umbrella.getUmbrellaRisk(value).catch(() => null),
      virustotal.checkURL(value).catch(() => null),
      // VirusTotal zaten entegre
    );
  }

  if (type === 'hash_md5' || type === 'hash_sha256') {
    queries.push(
      panOS.checkFileHash(value).catch(() => null),
      checkPoint.getThreatCloudReputation(value, 'file').catch(() => null),
    );
  }

  const queryResults = await Promise.all(queries);

  // Sonuçları birleştir, en yüksek tehdit seviyesini al
  let maxThreatLevel = 'low';
  let aggregatedTags: string[] = [];
  let sources: string[] = [];

  for (const result of queryResults.filter(Boolean)) {
    if (result.threatLevel) {
      if (getThreatScore(result.threatLevel) > getThreatScore(maxThreatLevel)) {
        maxThreatLevel = result.threatLevel;
      }
    }
    if (result.tags) aggregatedTags.push(...result.tags);
    if (result.source) sources.push(result.source);
  }

  // Veritabanına kaydet veya güncelle
  await db.insert(iocRegistry).values({
    type, value,
    threatLevel: maxThreatLevel,
    tags: [...new Set(aggregatedTags)],
    sources: [...new Set(sources)],
    sourceCount: sources.length,
    confidence: calculateConfidence(sources.length, maxThreatLevel),
    lastSeen: new Date(),
  }).onConflictDoUpdate({
    target: [iocRegistry.type, iocRegistry.value],
    set: {
      threatLevel: maxThreatLevel,
      tags: [...new Set(aggregatedTags)],
      sources: sql`array_distinct(sources || ${sources}::text[])`,
      sourceCount: sources.length,
      lastSeen: new Date(),
    }
  });

  return {
    type, value,
    threatLevel: maxThreatLevel,
    tags: aggregatedTags,
    sources,
    enrichedAt: new Date(),
  };
}

function getThreatScore(level: string): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1, clean: 0 }
    [level] ?? 0;
}
```

## 3.2 Otomatik Tarama IoC Korelasyonu

```typescript
// Her domain taraması tamamlandıktan sonra çalışır
export async function correlateWithCTI(
  customerId: number,
  scanResult: DomainScanResult
): Promise<IOCCorrelation[]> {

  const matches: IOCCorrelation[] = [];

  // Taranan değerleri topla
  const valuesToCheck = [
    ...scanResult.openPorts?.map(p => `${scanResult.ip}:${p}`) || [],
    scanResult.ip,
    scanResult.domain,
    ...scanResult.subdomains || [],
    ...scanResult.resolvedIPs || [],
    ...scanResult.mxRecords || [],
    ...scanResult.nsRecords || [],
  ];

  // IoC veritabanında sorgula
  for (const value of valuesToCheck) {
    const iocMatches = await db.select()
      .from(iocRegistry)
      .where(
        and(
          eq(iocRegistry.value, value),
          eq(iocRegistry.isActive, true),
          inArray(iocRegistry.threatLevel, ['critical', 'high', 'medium'])
        )
      );

    for (const ioc of iocMatches) {
      // Eşleşmeyi kaydet
      await db.insert(iocMatches_).values({
        iocId:         ioc.id,
        customerId,
        domain:        scanResult.domain,
        matchType:     detectMatchType(value, scanResult),
        matchedValue:  value,
        severity:      ioc.threatLevel,
        notified:      false,
      });

      matches.push({
        ioc,
        matchedValue: value,
        matchType:    detectMatchType(value, scanResult),
      });

      // IoC eşleşme sayısını artır
      await db.update(iocRegistry)
        .set({ matchCount: sql`match_count + 1` })
        .where(eq(iocRegistry.id, ioc.id));
    }
  }

  // Kritik eşleşme varsa anlık bildirim
  const criticalMatches = matches.filter(m => m.ioc.threatLevel === 'critical');
  if (criticalMatches.length > 0) {
    await sendCriticalIOCAlert(customerId, criticalMatches);
  }

  return matches;
}
```

## 3.3 Tehdit Aktörü Alaka Motoru

```typescript
// Her gece çalışır
export async function updateCustomerThreatRelevance(): Promise<void> {

  const customers = await getActiveCustomers();
  const activeCampaigns = await getActiveCampaigns();

  for (const customer of customers) {
    const scan = await getLatestScan(customer.domain);
    if (!scan) continue;

    for (const campaign of activeCampaigns) {
      let score = 0;
      const factors: string[] = [];

      // Sektör eşleşmesi (+30 puan)
      if (campaign.targetSectors.includes(customer.sector)) {
        score += 30;
        factors.push(`Sektör hedefleniyor: ${customer.sector}`);
      }

      // Ülke eşleşmesi (+20 puan)
      if (campaign.targetCountries.includes('TR')) {
        score += 20;
        factors.push('Türkiye aktif hedef listesinde');
      }

      // TTP-açık örtüşmesi (+25 puan)
      const scanTTPs = scan.findings
        .map(f => FINDING_TO_MITRE_MAP[f.type]?.technique)
        .filter(Boolean);
      const ttpOverlap = campaign.ttps.filter(t => scanTTPs.includes(t));
      if (ttpOverlap.length > 0) {
        score += Math.min(25, ttpOverlap.length * 8);
        factors.push(
          `${ttpOverlap.length} saldırı tekniği mevcut açıklarla örtüşüyor`
        );
      }

      // IoC eşleşmesi — en güçlü sinyal (+25 puan)
      const iocOverlap = await checkCampaignIOCMatch(
        campaign.id, scan.resolvedIPs, scan.domain
      );
      if (iocOverlap > 0) {
        score += 25;
        factors.push(`${iocOverlap} altyapı IoC'si eşleşti`);
      }

      if (score > 20) {
        await db.insert(customerThreatRelevance).values({
          customerId: customer.id,
          campaignId: campaign.id,
          actorId:    campaign.actorId,
          relevanceScore: score,
          matchingFactors: factors,
        }).onConflictDoUpdate({
          target: [customerThreatRelevance.customerId,
                   customerThreatRelevance.campaignId],
          set: { relevanceScore: score, matchingFactors: factors }
        });

        // Yüksek alaka — bildirim gönder
        if (score >= 50) {
          await notifyHighThreatRelevance(customer.id, campaign, score, factors);
        }
      }
    }
  }
}
```

---

# BÖLÜM 4: CTI ADMIN PANEL

## 4.1 CTI Dashboard

```
/admin-panel/cti

Sekmeler:
[ Genel Bakış | IoC Veritabanı | Tehdit Aktörleri |
  Kampanyalar | Müşteri Alaka | Feed Durumu | Vendor Bağlantıları ]

─── GENEL BAKIŞ ──────────────────────────────────────────────
Aktif kampanya:     12    Aktif tehdit aktörü:  47
Son 24s IoC eklenen: 1.247  Müşteri eşleşmesi:   8

Türkiye Tehdit Haritası (Dünya haritası — saldırı kaynakları)
Son 24 saatin en aktif saldırı kaynakları:
  1. Rusya — 34%
  2. Çin — 18%
  3. ABD — 12% (genelde botnet)
  4. İran — 9%
  5. Diğer — 27%

Feed Sağlık Göstergesi:
  FortiGuard: ✅ Aktif (son: 2 saat önce)
  Talos:      ✅ Aktif (son: 1 saat önce)
  USOM:       ✅ Aktif (son: 30 dk önce)
  MISP:       ✅ Aktif (son: 4 saat önce)
  Unit42:     🟡 Uyarı (son: 14 saat önce)
  GreyNoise:  ✅ Aktif

─── IOC VERİTABANI sekmesi ──────────────────────────────────
Toplam: 847.293 IoC  |  Kritik: 12.847  |  Son 24s: +1.247

Filtreler: Tür | Tehdit Seviyesi | Kaynak | Tarih | Etiket

Arama: [IP, domain, hash gir] → Anlık sonuç

─── TEHDIT AKTÖRLERI sekmesi ────────────────────────────────
Kart görünümü — her kart:
┌─────────────────────────────────────────────┐
│ APT28 (Fancy Bear)           🔴 Yüksek     │
│ Rusya menşeli | Casusluk | Son: 3 gün önce │
│ Hedef: Savunma, Hükümet, Enerji            │
│ Türkiye Hedeflemesi: YÜKSEK               │
│ Etkilenen Müşteri: 3                       │
│ [Detay] [Müşterileri Gör]                 │
└─────────────────────────────────────────────┘

─── MÜŞTERİ ALAKA sekmesi ───────────────────────────────────
Alaka Skoru > 50 olan müşteriler:
Müşteri | Kampanya | Alaka Skoru | Faktörler | Bildirim
Acme AS  | TA505 TR | 75         | 3 faktör   | Gönderildi
Beta Ltd | APT28    | 52         | 2 faktör   | Bekliyor
```

## 4.2 Vendor Bağlantı Yönetimi

```
/admin-panel/cti/vendors

Her müşteri için bağlı güvenlik cihazları:

Müşteri: Acme A.Ş.
┌─────────────────────────────────────────────────────────────┐
│ FortiGate 100F               ✅ Bağlı — Son sync: 2 saat   │
│ 192.168.1.1 | API v7.2                                      │
│ Yetenekler: Log çekme ✓  |  IP blok ✓  |  Politika okuma ✓ │
│ [Yeniden Sync] [Bağlantıyı Kes] [Detay]                    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ [+ Yeni Güvenlik Cihazı Ekle]                              │
│ Desteklenen: FortiGate, PAN-OS, Check Point, Cisco ASA/FTD │
└─────────────────────────────────────────────────────────────┘
```

---

# BÖLÜM 5: MÜŞTERİ CTI RAPORU

```typescript
// Her ayın başında aktif müşterilere otomatik gönderilir

export async function generateMonthlyCTIReport(
  customerId: number
): Promise<CTIReport> {

  const customer = await getCustomer(customerId);
  const relevantCampaigns = await getHighRelevanceCampaigns(customerId, 50);
  const iocMatches = await getMonthlyIOCMatches(customerId);
  const sectorStats = await getTurkeyThreatStats(customer.sector);

  const prompt = `
CyberStep CTI Direktörü olarak ${customer.companyName}
için aylık tehdit istihbarat brifing'i hazırla.

MÜŞTERİ: ${customer.companyName} | Sektör: ${customer.sector}

BU AY TÜRKİYE GENEL DURUM:
${JSON.stringify(sectorStats)}

MÜŞTERİYİ ETKİLEYEN KAMPANYALAR:
${relevantCampaigns.map(c => `
  Kampanya: ${c.campaign.name}
  Tehdit Aktörü: ${c.actor?.name || 'Bilinmeyen'}
  Alaka Skoru: ${c.relevanceScore}/100
  Eşleşen Faktörler: ${c.matchingFactors.join(', ')}
  Saldırı Vektörü: ${c.campaign.attackVector}
`).join('\n')}

IOC EŞLEŞMELERİ: ${iocMatches.length} eşleşme (${
  iocMatches.filter(m => m.severity === 'critical').length} kritik)

Brifing formatı:
1. YÖNETİCİ ÖZETİ (3-4 cümle, patron dili)
2. BU AY TÜRKİYE GENEL TEHDİT PROFİLİ
3. SİZİ ETKİLEYEN AKTİF KAMPANYALAR (varsa)
4. IOC EŞLEŞMELERİ (varsa, teknik ama anlaşılır)
5. SEKTÖR KARŞILAŞTIRMA
6. ÖNERİLEN AKSIYONLAR (sıralı)

Ton: Kurumsal, ciddi, panikletmeyen.
Teknik terimleri Türkçe iş diline çevir.
`;

  const content = await callClaude(prompt);
  const pdf = await generateCTIReportPDF(content, customer, relevantCampaigns);

  return { content, pdf, generatedAt: new Date() };
}
```

---

# BÖLÜM 6: CRON JOBS — TÜM FEED'LER

```typescript
// src/scheduler/ctiFeeds.ts

// Her saat — tüm aktif feed'leri güncelle
cron.schedule('0 * * * *', async () => {

  const feeds = [
    // Ücretsiz — her saat
    { name: 'usom',     fn: () => fetchUSOM() },
    { name: 'urlhaus',  fn: () => fetchURLHaus() },
    { name: 'feodo',    fn: () => fetchFeodoTracker() },
    { name: 'greynoise_tr', fn: () => fetchGreyNoiseTR() },

    // Ticari — API key varsa
    { name: 'fortiguard', fn: () => fetchFortiGuardFeed(),
      requiresKey: 'FORTIGUARD_API_KEY' },
    { name: 'talos',    fn: () => fetchTalosIOCs(),
      requiresKey: 'TALOS_API_KEY' },
    { name: 'umbrella', fn: () => fetchUmbrellaFeed(),
      requiresKey: 'UMBRELLA_API_KEY' },
  ];

  for (const feed of feeds) {
    if (feed.requiresKey && !process.env[feed.requiresKey]) continue;

    try {
      const iocs = await feed.fn();
      await bulkUpsertIOCs(iocs);
      await updateFeedStatus(feed.name, 'success', iocs.length);
    } catch (error) {
      await updateFeedStatus(feed.name, 'error', 0, error.message);
    }
  }
});

// Her 6 saatte — tehdit araştırması blog feed'leri
cron.schedule('0 */6 * * *', async () => {
  await fetchTalosAdvisories();
  await fetchUnit42Reports();
  await fetchCPRResearch();
  await fetchFortiGuardBlog();
  // FortiGuard Labs blog RSS feed'i
});

// Her gece 01:00 — müşteri tehdit alaka güncellemesi
cron.schedule('0 1 * * *', async () => {
  await updateCustomerThreatRelevance();
});

// Her gece 02:00 — IoC zenginleştirme (yeni eklenenler için)
cron.schedule('0 2 * * *', async () => {
  const newIOCs = await getUnenrichedIOCs(500);
  for (const ioc of newIOCs) {
    await enrichIOC(ioc.type, ioc.value);
    await sleep(200); // Rate limit
  }
});

// Her ayın 1'i — aylık CTI raporu
cron.schedule('0 8 1 * *', async () => {
  const customers = await getPaidCustomers();
  for (const customer of customers) {
    await generateMonthlyCTIReport(customer.id);
    await sleep(2000);
  }
});
```

---

# BÖLÜM 7: EK ENTEGRASYONLAR

## 7.1 SecurityTrails

```typescript
export async function getSecurityTrailsData(domain: string) {
  const [history, subdomains] = await Promise.all([
    axios.get(`https://api.securitytrails.com/v1/history/${domain}/dns/a`,
      { headers: { 'APIKEY': process.env.SECURITYTRAILS_API_KEY } }),
    axios.get(`https://api.securitytrails.com/v1/domain/${domain}/subdomains`,
      { headers: { 'APIKEY': process.env.SECURITYTRAILS_API_KEY } }),
  ]);

  // 30 günlük cache'e kaydet
  await db.insert(securitytrailsCache).values({
    domain,
    dnsHistory:     history.data.records,
    subdomains:     subdomains.data.subdomains,
    associatedIPs:  extractAllIPs(history.data),
  }).onConflictDoUpdate({
    target: securitytrailsCache.domain,
    set: { dnsHistory: history.data.records,
           subdomains: subdomains.data.subdomains,
           fetchedAt: new Date() }
  });
}
```

## 7.2 Google Search Console (Güvenlik Uyarıları)

```typescript
export async function checkGoogleSafeBrowsing(url: string) {
  const response = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find`
      + `?key=${process.env.GOOGLE_API_KEY}`,
    {
      client: { clientId: 'cyberstep', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING',
                      'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      }
    }
  );
  return response.data.matches?.length > 0;
}
```

## 7.3 E-Fatura Entegrasyonu

```typescript
// GİB e-Arşiv Fatura API'si
// Editel, Logo veya doğrudan GİB entegratörü üzerinden

export async function createEInvoice(invoiceId: number): Promise<string> {
  const invoice = await getInvoiceWithDetails(invoiceId);

  // UBL-TR 2.1 formatında XML oluştur
  const xmlContent = buildUBLTRXML(invoice);

  // Entegratör API'sine gönder (Editel, Mikro vb.)
  const response = await axios.post(
    `${process.env.E_INVOICE_API_URL}/invoices`,
    {
      invoiceType: 'EARCHIVE',
      xmlContent:  Buffer.from(xmlContent).toString('base64'),
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.E_INVOICE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  const gibUUID = response.data.uuid;

  await db.insert(eInvoiceRecords).values({
    invoiceId,
    gibUuid:       gibUUID,
    eInvoiceType:  'e_arsiv',
    xmlContent,
    status:        'sent',
    sentAt:        new Date(),
  });

  return gibUUID;
}
```

## 7.4 Calendly Entegrasyonu

```typescript
export async function createCalendlyMeeting(
  dealId: number,
  customerEmail: string
): Promise<string> {
  // Calendly Event Types API
  const response = await axios.post(
    'https://api.calendly.com/one_off_event_types',
    {
      name:     'CyberStep Demo',
      duration: 30,
      -- 30 dakika
      location: { type: 'zoom' },
      co_hosts: [process.env.CALENDLY_USER_URI],
    },
    { headers: { 'Authorization': `Bearer ${process.env.CALENDLY_API_KEY}` } }
  );

  const bookingUrl = response.data.resource.booking_url;

  // ISR aktivitesine kaydet
  await logActivity(dealId, 'demo_scheduled',
    `Calendly linki gönderildi: ${bookingUrl}`
  );

  return bookingUrl;
}
```

---

# BÖLÜM 8: ENVIRONMENT VARIABLES

```bash
# Güvenlik Vendor API'leri
FORTIGUARD_API_KEY=          # FortiGuard Labs (ticari)
AUTOFOCUS_API_KEY=           # PAN AutoFocus (ticari)
WILDFIRE_API_KEY=            # PAN WildFire
CHECKPOINT_API_KEY=          # Check Point ThreatCloud (ticari)
UMBRELLA_API_KEY=            # Cisco Umbrella Investigate
TALOS_API_KEY=               # Cisco Talos (ticari)
GREYNOISE_API_KEY=           # GreyNoise (Community ücretsiz)

# SIEM & CTI Platformları
MISP_URL=                    # Self-hosted MISP URL
MISP_API_KEY=                # MISP API key
OPENCTI_URL=                 # Self-hosted OpenCTI URL
OPENCTI_API_TOKEN=           # OpenCTI token

# Ek Tarama Servisleri
SECURITYTRAILS_API_KEY=      # SecurityTrails
CENSYS_API_ID=               # Censys
CENSYS_API_SECRET=           # Censys
BINARYEDGE_API_KEY=          # BinaryEdge
CLOUDFLARE_API_TOKEN=        # Cloudflare Radar

# Ödeme
PAPARA_API_KEY=              # Papara Business
E_INVOICE_API_URL=           # e-Fatura entegratörü URL
E_INVOICE_API_KEY=           # e-Fatura entegratörü key
BANK_IBAN=                   # Fatura ödemeleri için

# Üretkenlik
CALENDLY_API_KEY=            # Calendly
CALENDLY_USER_URI=           # Calendly kullanıcı URI

# Analitik
POSTHOG_API_KEY=             # PostHog product analytics
```

---

# BÖLÜM 9: ADMIN MENÜ — TAMAMLAMA

```
─── Tehdit İstihbaratı (CTI) ─────────
  🌐  CTI Dashboard        /admin-panel/cti
  🎯  IoC Veritabanı       /admin-panel/cti/ioc
  👤  Tehdit Aktörleri     /admin-panel/cti/actors
  📢  Kampanyalar          /admin-panel/cti/campaigns
  🔗  Müşteri Alaka        /admin-panel/cti/relevance
  📡  Feed Durumu          /admin-panel/cti/feeds
  🔌  Vendor Bağlantılar   /admin-panel/cti/vendors
  📊  CTI Raporları        /admin-panel/cti/reports
```

---

# BÖLÜM 10: UYGULAMA SIRASI

```
HAFTA 1 — Temel CTI Altyapısı:
  ✓ Veritabanı tabloları
  ✓ IoC registry + enrichment pipeline
  ✓ Ücretsiz feed entegrasyonları (USOM, URLHaus, Feodo, MISP)
  ✓ CTI admin dashboard (temel)

HAFTA 2 — Vendor Entegrasyonları:
  ✓ FortiGuard IP/URL reputation
  ✓ Talos (ücretsiz endpoint)
  ✓ GreyNoise Community
  ✓ Google Safe Browsing
  ✓ Cloudflare Radar TR

HAFTA 3 — Müşteri Firewall Bağlantısı:
  ✓ FortiGate REST API (log çekme + IP blok)
  ✓ PAN-OS API (log çekme + DAG blok)
  ✓ Check Point SmartLog (log çekme)
  ✓ Cisco ASA/FTD (log çekme + ACL blok)
  ✓ Vendor bağlantı yönetim UI'ı

HAFTA 4 — CTI Motor + Aylık Rapor:
  ✓ Tehdit aktörü profilleri (Türkiye odaklı)
  ✓ Müşteri alaka skoru motoru
  ✓ MITRE ATT&CK korelasyonu
  ✓ Aylık CTI raporu (Claude ile)

HAFTA 5 — Ek Entegrasyonlar:
  ✓ SecurityTrails DNS geçmişi
  ✓ e-Fatura GİB entegrasyonu
  ✓ Calendly demo otomasyonu
  ✓ PostHog analytics
```

---

*CyberStep.io — Tam Entegrasyon + CTI Platform — Mayıs 2026*
