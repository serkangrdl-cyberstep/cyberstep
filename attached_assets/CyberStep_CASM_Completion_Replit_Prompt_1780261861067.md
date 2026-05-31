# CyberStep.io — CASM Tamamlama
## Remediation Workflow + Attack Path + Kapalı Döngü + Cloud CSPM + GitHub Scanning

---

## BÖLÜM 1: REMEDİATION WORKFLOW

### 1a — Veritabanı

```sql
CREATE TABLE IF NOT EXISTS remediation_tickets (
  id serial PRIMARY KEY,
  ticket_number varchar(30) UNIQUE NOT NULL,
  -- CS-REM-2026-00001

  customer_id integer REFERENCES customers(id),
  finding_id integer,
  -- domain_scan_findings veya assessment_findings'e referans

  -- Bulgu bilgisi (snapshot — bulgu değişse bile ticket sabit kalır)
  finding_title varchar(500) NOT NULL,
  finding_severity varchar(20) NOT NULL,
  finding_description text,
  finding_type varchar(100),
  affected_asset varchar(255),
  -- IP, domain, subdomain, cloud resource

  -- CVSS + Risk skoru (atama anındaki değer)
  cvss_score decimal(3,1),
  epss_score decimal(5,4),
  business_impact varchar(20) DEFAULT 'medium',
  -- 'critical' | 'high' | 'medium' | 'low'
  unified_risk_score decimal(5,2),
  -- Birleşik öncelik skoru (aşağıda hesaplanıyor)

  -- Atama
  assigned_to_name varchar(255),
  assigned_to_email varchar(255),
  assigned_at timestamp,
  due_date date,

  -- Durum
  status varchar(30) DEFAULT 'open',
  -- 'open' | 'in_progress' | 'pending_verification' |
  -- 'verified_fixed' | 'accepted_risk' | 'false_positive' | 'wont_fix'

  -- Çözüm
  resolution_notes text,
  fix_description text,
  -- "Ne yapıldı" — müşteri yazar

  -- Doğrulama
  verification_scan_id integer,
  -- Doğrulama taramasının ID'si
  verified_at timestamp,
  verified_by varchar(50) DEFAULT 'auto',
  -- 'auto' | 'analyst'

  -- SLA
  sla_days integer DEFAULT 30,
  -- Ciddiyete göre: critical=7, high=14, medium=30, low=90
  sla_deadline date,
  sla_breached boolean DEFAULT false,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  closed_at timestamp
);

-- SLA gün sayıları
-- critical: 7 gün, high: 14, medium: 30, low: 90

CREATE TABLE IF NOT EXISTS remediation_comments (
  id serial PRIMARY KEY,
  ticket_id integer REFERENCES remediation_tickets(id),
  author_type varchar(20),
  -- 'customer' | 'analyst' | 'system' | 'auto'
  author_name varchar(255),
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  -- true = sadece analist görür
  created_at timestamp DEFAULT now()
);

-- Otomatik yeniden tarama kuyruğu
CREATE TABLE IF NOT EXISTS verification_scan_queue (
  id serial PRIMARY KEY,
  ticket_id integer REFERENCES remediation_tickets(id),
  customer_id integer REFERENCES customers(id),
  domain varchar(255),
  finding_type varchar(100),
  scheduled_at timestamp,
  -- Müşteri "düzelttim" dediğinde veya due_date geldiğinde
  executed_at timestamp,
  scan_result varchar(30),
  -- 'fixed' | 'still_present' | 'error'
  status varchar(20) DEFAULT 'pending'
);
```

### 1b — Birleşik Risk Öncelik Skoru

```typescript
// src/services/riskPrioritization.ts

export function calculateUnifiedRiskScore(params: {
  cvssScore: number;        // 0-10
  epssScore: number;        // 0-1 (30 günlük istismar olasılığı)
  businessImpact: string;   // 'critical'|'high'|'medium'|'low'
  isExternallyReachable: boolean;
  hasActiveExploit: boolean;
  threatActorTargeting: boolean; // Aktif kampanya bu açığı kullanıyor mu?
}): number {

  const businessWeight = {
    critical: 1.0, high: 0.8, medium: 0.5, low: 0.3
  }[params.businessImpact] ?? 0.5;

  const baseScore =
    (params.cvssScore / 10) * 0.25 +    // CVSS ağırlığı: %25
    params.epssScore * 0.35 +             // EPSS ağırlığı: %35 (en önemli)
    businessWeight * 0.25 +              // İş etkisi: %25
    (params.isExternallyReachable ? 0.1 : 0) + // Dışarıdan ulaşılabilir: %10
    (params.hasActiveExploit ? 0.05 : 0) +
    (params.threatActorTargeting ? 0.05 : 0);

  return Math.min(100, Math.round(baseScore * 100));
}

// Ciddiyete göre SLA günleri
export function getSLADays(severity: string): number {
  return { critical: 7, high: 14, medium: 30, low: 90 }[severity] ?? 30;
}
```

### 1c — Admin Panel: Remediation Dashboard

```
/admin-panel/remediation

Sekmeler: [ Tüm Ticketlar | Vadesi Geçmiş | Doğrulama Bekleyen | Kapatılanlar ]

Üst metrikler:
┌──────────┬──────────┬──────────┬──────────┐
│  Açık    │  SLA     │ Doğrulama│  Bu Ay   │
│  234     │ Riski:12 │ Bekleyen │ Kapatılan│
│ ticket   │ 🔴       │    8     │    67    │
└──────────┴──────────┴──────────┴──────────┘

Tablo:
Ticket No | Müşteri | Bulgu | Risk Skoru | Atanan | Vade | Durum

Risk Skoru sütunu renkli:
80-100 → kırmızı (acil)
60-79  → turuncu
40-59  → sarı
0-39   → yeşil
```

### 1d — Müşteri Portal: Remediation Takibi

```
/hesabim/bulgularim

"Kapatılması Gereken Açıklar" listesi

Risk Skoru sırasına göre:

┌────────────────────────────────────────────────────────────┐
│ [94] 🔴 DMARC Kaydı Eksik                                 │
│ Etkilenen: acme.com.tr                                      │
│ Risk: E-posta taklit saldırısı                             │
│ Vade: 7 gün (15 Haziran 2026)                              │
│                                                             │
│ [Nasıl Düzeltirim? →]  [Düzelttim →]  [Risk Kabul Et]    │
└────────────────────────────────────────────────────────────┘

"Düzelttim" butonuna basınca:
→ Ne yaptığını yaz (isteğe bağlı)
→ 24 saat içinde otomatik doğrulama taraması
→ Kapatılırsa: tebrikler bildirimi + skor güncelleme
```

### 1e — Kapalı Döngü: Otomatik Doğrulama

```typescript
// src/services/verificationScanner.ts

// Müşteri "düzelttim" deyince çalışır
export async function scheduleVerificationScan(
  ticketId: number,
  delayHours: number = 4
): Promise<void> {
  const ticket = await getTicket(ticketId);

  await db.insert(verificationScanQueue).values({
    ticketId,
    customerId: ticket.customerId,
    domain: ticket.affectedAsset,
    findingType: ticket.findingType,
    scheduledAt: new Date(Date.now() + delayHours * 3600 * 1000),
    status: 'pending',
  });

  await db.update(remediationTickets).set({
    status: 'pending_verification',
  }).where(eq(remediationTickets.id, ticketId));
}

// Cron: Her saat doğrulama kuyruğunu işle
cron.schedule('0 * * * *', async () => {
  const due = await db.select()
    .from(verificationScanQueue)
    .where(
      and(
        eq(verificationScanQueue.status, 'pending'),
        lte(verificationScanQueue.scheduledAt, new Date())
      )
    );

  for (const item of due) {
    const result = await runVerificationCheck(item);

    await db.update(verificationScanQueue).set({
      executedAt: new Date(),
      scanResult: result.fixed ? 'fixed' : 'still_present',
      status: 'completed',
    }).where(eq(verificationScanQueue.id, item.id));

    if (result.fixed) {
      // ✅ Kapandı
      await closeTicketAsFixed(item.ticketId);
      await updateCustomerSecurityScore(item.customerId);
      await sendFixedNotification(item.customerId, item.ticketId);
    } else {
      // ❌ Hâlâ açık
      await db.update(remediationTickets).set({
        status: 'open',
      }).where(eq(remediationTickets.id, item.ticketId));

      await addRemediationComment(item.ticketId, {
        authorType: 'auto',
        authorName: 'CyberStep Doğrulama',
        comment: `Otomatik doğrulama taraması: Açık hâlâ mevcut. (${new Date().toLocaleDateString('tr-TR')})`,
      });
    }
  }
});

async function runVerificationCheck(
  item: VerificationScanItem
): Promise<{ fixed: boolean }> {

  // Finding tipine göre spesifik kontrol
  const checks: Record<string, () => Promise<boolean>> = {
    'no_dmarc':       () => checkDMARCExists(item.domain),
    'no_spf':         () => checkSPFExists(item.domain),
    'ssl_expired':    () => checkSSLValid(item.domain),
    'open_rdp_port':  () => checkPortClosed(item.domain, 3389),
    'open_ssh_port':  () => checkPortClosed(item.domain, 22),
    'blacklisted':    () => checkNotBlacklisted(item.domain),
    'leaked_credential': () => checkNoNewLeaks(item.domain),
  };

  const checkFn = checks[item.findingType];
  if (!checkFn) {
    // Spesifik kontrol yoksa genel domain tarama
    const scan = await runDomainScan(item.domain);
    const finding = scan.findings.find(f => f.type === item.findingType);
    return { fixed: !finding };
  }

  return { fixed: await checkFn() };
}
```

---

## BÖLÜM 2: ATTACK PATH VİZUALİZASYON

### 2a — Veritabanı

```sql
CREATE TABLE IF NOT EXISTS attack_paths (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  scan_id integer,

  -- Path özeti
  path_name varchar(255),
  -- "RDP + Sızmış Şifre + Yamasız Sistem"
  severity varchar(20),
  -- Combined severity
  confidence integer,
  -- 0-100

  -- Kill chain aşamaları
  stages jsonb NOT NULL,
  -- [{stage, technique_id, technique_name, finding_ids, description}]

  -- Finansal etki tahmini
  estimated_damage_tl decimal(12,2),

  -- Görselleştirme
  mermaid_diagram text,
  -- Mermaid.js graph syntax

  -- Claude analizi
  narrative text,
  single_fix_recommendation text,
  -- "Sadece şunu kapat, bu path kapanır"

  created_at timestamp DEFAULT now()
);
```

### 2b — Attack Path Analiz Motoru

```typescript
// src/services/attackPathAnalyzer.ts

export async function analyzeAttackPaths(
  customerId: number,
  scanId: number
): Promise<AttackPath[]> {

  const findings = await getScanFindings(scanId);
  const iocMatches = await getCustomerIOCMatches(customerId);
  const leaks = await getCustomerLeaks(customerId);

  const prompt = `
Sen offensive security uzmanısın.
Aşağıdaki güvenlik bulgularını analiz et ve
gerçekçi saldırı yollarını (attack paths) belirle.

BULGULAR:
${findings.map(f =>
  `[${f.severity}] ${f.type}: ${f.title} — ${f.affectedAsset}`
).join('\n')}

SIZMA VERİLERİ:
${leaks.length > 0 ? leaks.map(l =>
  `Sızmış: ${l.email} (${l.source})`
).join('\n') : 'Tespit edilmedi'}

IOC EŞLEŞMELERİ:
${iocMatches.length > 0 ? iocMatches.map(m =>
  `${m.ip} → ${m.tags.join(',')}`
).join('\n') : 'Yok'}

GÖREV: Bu bulgular birleştirilerek nasıl saldırı yapılır?
Gerçekçi 1-3 saldırı senaryosu belirle.

Her senaryo için JSON:
{
  "path_name": "Kısa isim (maks 5 kelime)",
  "severity": "critical|high|medium",
  "confidence": 0-100,
  "stages": [
    {
      "stage": "1",
      "mitre_technique": "T1190",
      "technique_name": "Exploit Public-Facing Application",
      "finding_used": "Bulgu başlığı",
      "description": "Saldırgan bu adımda ne yapar (1 cümle)",
      "finding_type": "no_dmarc"
    }
  ],
  "narrative": "Patron dilinde 3-4 cümle saldırı hikayesi",
  "estimated_damage_tl": 250000,
  "single_fix": "Sadece şunu kapat, bu path tamamen kapanır",
  "mermaid": "graph LR\n  A[Saldırgan] -->|DMARC Yok| B[Sahte E-posta]\n  B --> ..."
}

Sadece JSON array döndür.
`;

  const response = await callClaude(prompt, {
    model: 'claude-sonnet-4-6',
    maxTokens: 3000,
  });

  const paths = JSON.parse(response);

  // Veritabanına kaydet
  for (const path of paths) {
    await db.insert(attackPaths).values({
      customerId,
      scanId,
      pathName: path.path_name,
      severity: path.severity,
      confidence: path.confidence,
      stages: path.stages,
      estimatedDamageTl: path.estimated_damage_tl,
      mermaidDiagram: path.mermaid,
      narrative: path.narrative,
      singleFixRecommendation: path.single_fix,
    });
  }

  return paths;
}
```

### 2c — Frontend: Attack Path Görselleştirme

```tsx
// src/components/AttackPathVisualization.tsx
// pnpm add mermaid

import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';

export function AttackPathCard({ path }: { path: AttackPath }) {
  const diagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (diagramRef.current && path.mermaidDiagram) {
      mermaid.initialize({
        theme: 'dark',
        themeVariables: {
          primaryColor: '#060D1A',
          primaryTextColor: '#E8EDF5',
          primaryBorderColor: '#00C8FF',
          lineColor: '#00C8FF',
          background: '#0A1628',
          edgeLabelBackground: '#0A1628',
        },
        securityLevel: 'loose',
      });
      mermaid.render('diagram-' + path.id, path.mermaidDiagram)
        .then(({ svg }) => {
          if (diagramRef.current) diagramRef.current.innerHTML = svg;
        });
    }
  }, [path]);

  return (
    <div className="attack-path-card">
      <div className="path-header">
        <SeverityBadge severity={path.severity} />
        <h3>{path.pathName}</h3>
        <span className="confidence">Güven: %{path.confidence}</span>
      </div>

      {/* Mermaid Diyagramı */}
      <div ref={diagramRef} className="mermaid-diagram" />

      {/* Saldırı Anlatısı */}
      <div className="narrative">
        <p>{path.narrative}</p>
      </div>

      {/* Finansal Etki */}
      <div className="damage-estimate">
        Tahmini Hasar: ₺{path.estimatedDamageTl.toLocaleString('tr-TR')}
      </div>

      {/* Tek Çözüm */}
      <div className="single-fix highlight">
        <span>💡 Bu tek adımla bu saldırı yolu kapanır:</span>
        <p>{path.singleFixRecommendation}</p>
        <button onClick={() => createRemediationTicket(path)}>
          Düzeltmeyi Başlat →
        </button>
      </div>

      {/* Aşama Listesi */}
      <div className="stages">
        {path.stages.map((stage, i) => (
          <div key={i} className="stage-item">
            <span className="stage-num">{stage.stage}</span>
            <div className="stage-content">
              <span className="technique">{stage.mitre_technique}</span>
              <span className="desc">{stage.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## BÖLÜM 3: CLOUD CSPM (AWS + AZURE)

### 3a — Veritabanı

```sql
CREATE TABLE IF NOT EXISTS cloud_connections (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  provider varchar(20) NOT NULL,
  -- 'aws' | 'azure' | 'gcp'
  account_id varchar(100),
  -- AWS Account ID, Azure Subscription ID
  account_name varchar(255),
  access_type varchar(30) DEFAULT 'read_only',
  -- 'read_only' (sadece bu)
  credentials_encrypted text,
  -- AWS: Access Key + Secret (read-only IAM)
  -- Azure: App Registration Client ID + Secret
  regions text[] DEFAULT '{}',
  -- Taranacak region'lar
  last_scanned_at timestamp,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_findings (
  id serial PRIMARY KEY,
  connection_id integer REFERENCES cloud_connections(id),
  customer_id integer REFERENCES customers(id),
  provider varchar(20),
  region varchar(50),
  resource_type varchar(50),
  -- 's3_bucket' | 'security_group' | 'iam_user' | 'rds' | 'storage_blob'
  resource_id varchar(500),
  resource_name varchar(255),
  finding_type varchar(100),
  -- 'public_s3_bucket' | 'open_security_group' | 'mfa_not_enabled' |
  -- 'unencrypted_storage' | 'public_snapshot' | 'overprivileged_role'
  severity varchar(20),
  title varchar(500),
  description text,
  remediation_steps text,
  -- "Bu kaynağı nasıl düzeltirsin"
  is_fixed boolean DEFAULT false,
  first_seen_at timestamp DEFAULT now(),
  last_seen_at timestamp DEFAULT now()
);
```

### 3b — AWS CSPM Tarayıcı

```typescript
// src/integrations/awsCSPM.ts
import AWS from 'aws-sdk';

export class AWSCSPMScanner {

  constructor(
    private accessKeyId: string,
    private secretAccessKey: string,
    private regions: string[]
  ) {}

  async runFullScan(): Promise<CloudFinding[]> {
    const findings: CloudFinding[] = [];

    // Her kontrol paralel çalışsın
    const checks = await Promise.allSettled([
      this.checkPublicS3Buckets(),
      this.checkOpenSecurityGroups(),
      this.checkIAMUsers(),
      this.checkUnencryptedRDS(),
      this.checkPublicSnapshots(),
      this.checkCloudTrailEnabled(),
      this.checkRootAccountMFA(),
    ]);

    for (const result of checks) {
      if (result.status === 'fulfilled') {
        findings.push(...result.value);
      }
    }

    return findings;
  }

  private async checkPublicS3Buckets(): Promise<CloudFinding[]> {
    const s3 = new AWS.S3({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: 'us-east-1',
    });

    const findings: CloudFinding[] = [];
    const { Buckets } = await s3.listBuckets().promise();

    for (const bucket of Buckets || []) {
      try {
        const acl = await s3.getBucketAcl({
          Bucket: bucket.Name!
        }).promise();

        const isPublic = acl.Grants?.some(
          g => g.Grantee?.URI?.includes('AllUsers')
        );

        if (isPublic) {
          findings.push({
            provider: 'aws',
            resourceType: 's3_bucket',
            resourceId: bucket.Name!,
            resourceName: bucket.Name!,
            findingType: 'public_s3_bucket',
            severity: 'critical',
            title: `S3 Bucket Herkese Açık: ${bucket.Name}`,
            description: 'Bu bucket internetten herkes tarafından okunabilir. İçindeki tüm dosyalar erişilebilir.',
            remediationSteps: `AWS Console → S3 → ${bucket.Name} → Permissions → Block Public Access → Enable all`,
          });
        }
      } catch (e) { /* bucket erişim hatası */ }
    }

    return findings;
  }

  private async checkOpenSecurityGroups(): Promise<CloudFinding[]> {
    const findings: CloudFinding[] = [];

    for (const region of this.regions) {
      const ec2 = new AWS.EC2({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region,
      });

      const { SecurityGroups } = await ec2.describeSecurityGroups().promise();

      for (const sg of SecurityGroups || []) {
        for (const rule of sg.IpPermissions || []) {
          const isOpenToAll = rule.IpRanges?.some(r => r.CidrIp === '0.0.0.0/0');
          const criticalPorts = [22, 3389, 1433, 3306, 5432, 27017, 6379];

          if (isOpenToAll && rule.FromPort &&
              criticalPorts.includes(rule.FromPort)) {
            findings.push({
              provider: 'aws',
              region,
              resourceType: 'security_group',
              resourceId: sg.GroupId!,
              resourceName: sg.GroupName!,
              findingType: 'open_security_group',
              severity: 'high',
              title: `Güvenlik Grubu ${sg.GroupName}: Port ${rule.FromPort} herkese açık`,
              description: `${rule.FromPort} portu internetten herhangi bir IP'ye açık.`,
              remediationSteps: `AWS Console → EC2 → Security Groups → ${sg.GroupName} → Inbound Rules → Port ${rule.FromPort} kuralını kısıtla`,
            });
          }
        }
      }
    }

    return findings;
  }

  private async checkRootAccountMFA(): Promise<CloudFinding[]> {
    const iam = new AWS.IAM({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    });

    const summary = await iam.getAccountSummary().promise();
    const mfaEnabled = summary.SummaryMap?.AccountMFAEnabled === 1;

    if (!mfaEnabled) {
      return [{
        provider: 'aws',
        resourceType: 'iam_user',
        resourceId: 'root',
        resourceName: 'Root Account',
        findingType: 'mfa_not_enabled',
        severity: 'critical',
        title: 'AWS Root Hesabında MFA Aktif Değil',
        description: 'Root hesabı en yüksek yetkiye sahip. MFA olmadan ele geçirilmesi tüm AWS ortamını tehlikeye atar.',
        remediationSteps: 'AWS Console → IAM → Dashboard → Activate MFA on your root account',
      }];
    }
    return [];
  }
}
```

### 3c — Müşteri Cloud Bağlantı Sayfası

```
/hesabim/cloud-guvenlik

Cloud Hesabı Bağla:

  AWS:
  Gerekli: Read-Only IAM kullanıcısı
  İzinler: SecurityAudit policy (AWS managed, read-only)

  Kurulum (5 dakika):
  1. AWS Console → IAM → Users → Create User
  2. Policies → Attach: SecurityAudit (AWS managed)
  3. Access Keys → Create → Kopyala

  Access Key ID:     [___________________]
  Secret Access Key: [___________________]
  Taranacak Region:  [✓] eu-central-1  [✓] eu-west-1  [ ] us-east-1

  [Bağlantıyı Test Et]  [Kaydet]

  ⚠️ Güvenlik Notu:
  Yalnızca Read-Only erişim. Hiçbir şeyi değiştiremez,
  silemez veya oluşturamayız. İstediğinizde iptal edin.
```

---

## BÖLÜM 4: GITHUB/GITLAB SECRETS SCANNING

### 4a — Veritabanı

```sql
CREATE TABLE IF NOT EXISTS code_secrets_findings (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  platform varchar(20) NOT NULL,
  -- 'github' | 'gitlab' | 'bitbucket'
  repo_url varchar(500) NOT NULL,
  repo_name varchar(255),
  repo_visibility varchar(20),
  -- 'public' | 'private' (sadece public taranır)
  file_path varchar(500),
  commit_hash varchar(64),
  line_number integer,
  secret_type varchar(100),
  -- 'aws_access_key' | 'api_key_generic' | 'private_key' |
  -- 'password_in_code' | 'connection_string' | 'jwt_secret' |
  -- 'github_token' | 'stripe_key' | 'sendgrid_key'
  secret_preview varchar(50),
  -- İlk 4 ve son 4 karakter: "AKIA...X7Y2"
  severity varchar(20) DEFAULT 'high',
  is_verified boolean DEFAULT false,
  -- Gerçekten çalışıyor mu?
  is_revoked boolean DEFAULT false,
  -- Müşteri revoke etti mi?
  discovered_at timestamp DEFAULT now()
);
```

### 4b — GitHub OSINT Tarayıcı

```typescript
// src/integrations/githubScanner.ts
// Sadece PUBLIC repo'lar — authorization gerektirmez

const SECRET_PATTERNS = [
  { type: 'aws_access_key',   pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { type: 'aws_secret_key',   pattern: /[0-9a-zA-Z/+]{40}/, severity: 'high' },
  { type: 'github_token',     pattern: /ghp_[0-9a-zA-Z]{36}/, severity: 'critical' },
  { type: 'stripe_live_key',  pattern: /sk_live_[0-9a-zA-Z]{24}/, severity: 'critical' },
  { type: 'sendgrid_key',     pattern: /SG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}/, severity: 'high' },
  { type: 'private_key',      pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, severity: 'critical' },
  { type: 'jwt_secret',       pattern: /jwt[_-]?secret\s*[=:]\s*["']([^"']{8,})/, severity: 'high' },
  { type: 'db_connection',    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/, severity: 'high' },
  { type: 'db_connection',    pattern: /postgresql:\/\/[^:]+:[^@]+@/, severity: 'high' },
  { type: 'generic_api_key',  pattern: /api[_-]?key\s*[=:]\s*["']([a-zA-Z0-9_\-]{20,})/, severity: 'medium' },
];

export async function scanGitHubOrg(
  orgOrUser: string,
  customerId: number
): Promise<CodeSecretsFinding[]> {

  const findings: CodeSecretsFinding[] = [];

  // GitHub Search API — ücretsiz, rate limited
  // 30 istek/dakika authenticated, 10 unauthenticated
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    : {};

  // Org'un public repo'larını bul
  const reposResponse = await axios.get(
    `https://api.github.com/users/${orgOrUser}/repos`,
    { params: { type: 'public', per_page: 100 }, headers }
  );

  for (const repo of reposResponse.data) {

    // GitHub Code Search API
    for (const pattern of SECRET_PATTERNS) {

      try {
        const searchResponse = await axios.get(
          'https://api.github.com/search/code',
          {
            params: {
              q: `${pattern.type.replace('_', ' ')} repo:${repo.full_name}`,
              per_page: 10,
            },
            headers,
          }
        );

        for (const item of searchResponse.data.items || []) {
          // Ham dosya içeriğini al
          const fileResponse = await axios.get(item.url, { headers });
          const content = Buffer.from(
            fileResponse.data.content, 'base64'
          ).toString('utf8');

          const matches = content.match(pattern.pattern);
          if (matches) {
            const secret = matches[0];
            const preview = secret.length > 8
              ? `${secret.slice(0, 4)}...${secret.slice(-4)}`
              : '****';

            findings.push({
              customerId,
              platform: 'github',
              repoUrl: repo.html_url,
              repoName: repo.full_name,
              repoVisibility: 'public',
              filePath: item.path,
              secretType: pattern.type,
              secretPreview: preview,
              severity: pattern.severity,
            });
          }
        }

        await sleep(2000); // Rate limit
      } catch (e) { continue; }
    }
  }

  return findings;
}
```

### 4c — Admin UI: Secrets Dashboard

```
/admin-panel/code-security

Bu Ay Taranan: 847 repo  |  Bulunan Secret: 23  |  Kritik: 4

Tablo:
Şirket | Repo | Secret Tipi | Ciddiyet | Dosya | Durum

Kritik bulunan → anlık müşteri bildirimi:
"acme-corp/backend reposunda AWS Access Key tespit edildi.
 Hemen revoke edin! Detay: [link]"
```

---

## BÖLÜM 5: BİRLEŞİK RISK SKORU API

```typescript
// GET /api/portal/risk-priority
// Müşterinin tüm açıklarını risk skoruna göre sıralı döndür

export async function getRiskPrioritizedFindings(
  customerId: number
): Promise<PrioritizedFinding[]> {

  const [scanFindings, remTickets, cloudFindings, codeFindings] =
    await Promise.all([
      getOpenScanFindings(customerId),
      getOpenRemediationTickets(customerId),
      getOpenCloudFindings(customerId),
      getOpenCodeFindings(customerId),
    ]);

  const activeCampaigns = await getRelevantCampaigns(customerId);
  const activeCampaignTTPs = activeCampaigns.flatMap(c => c.ttps);

  const allFindings = [
    ...scanFindings.map(f => ({ ...f, source: 'domain_scan' })),
    ...cloudFindings.map(f => ({ ...f, source: 'cloud_cspm' })),
    ...codeFindings.map(f => ({ ...f, source: 'code_secrets' })),
  ];

  return allFindings.map(finding => {
    const unifiedScore = calculateUnifiedRiskScore({
      cvssScore:            finding.cvssScore || 5,
      epssScore:            finding.epssScore || 0.1,
      businessImpact:       finding.businessImpact || 'medium',
      isExternallyReachable: finding.isExternal !== false,
      hasActiveExploit:     finding.hasExploit || false,
      threatActorTargeting: activeCampaignTTPs.includes(
        FINDING_TO_MITRE_MAP[finding.type]?.technique
      ),
    });

    return { ...finding, unifiedRiskScore: unifiedScore };
  }).sort((a, b) => b.unifiedRiskScore - a.unifiedRiskScore);
}
```

---

## BÖLÜM 6: CRON JOB'LAR

```typescript
// Her gece 02:00 — attack path analizi güncelle
cron.schedule('0 2 * * *', async () => {
  const customers = await getActiveCustomers();
  for (const c of customers) {
    const latestScan = await getLatestScan(c.id);
    if (latestScan) await analyzeAttackPaths(c.id, latestScan.id);
    await sleep(3000);
  }
});

// Her gece 03:00 — cloud CSPM taraması
cron.schedule('0 3 * * *', async () => {
  const connections = await getActiveCloudConnections();
  for (const conn of connections) {
    const scanner = new AWSCSPMScanner(
      decrypt(conn.credentialsEncrypted),
      conn.regions
    );
    const findings = await scanner.runFullScan();
    await saveCloudFindings(conn.id, findings);
    await sleep(5000);
  }
});

// Her Pazar 04:00 — GitHub secrets tarama
cron.schedule('0 4 * * 0', async () => {
  const customers = await getCustomersWithGitHub();
  for (const c of customers) {
    const findings = await scanGitHubOrg(c.githubOrg, c.id);
    if (findings.length > 0) {
      await saveCodeFindings(c.id, findings);
      await notifyCodeSecrets(c.id, findings);
    }
    await sleep(10000);
  }
});

// Her saat — remediation doğrulama kuyruğu
cron.schedule('0 * * * *', async () => {
  await processVerificationQueue();
});

// Her gece SLA kontrol
cron.schedule('0 8 * * *', async () => {
  await checkRemediationSLABreaches();
});
```

---

## API ROTALAR

```
POST /api/portal/findings/:id/remediate  — Ticket aç
POST /api/portal/tickets/:id/fixed       — "Düzelttim" bildir
GET  /api/portal/tickets                 — Ticket listesi
GET  /api/portal/attack-paths            — Saldırı yolları
POST /api/portal/cloud/connect           — Cloud bağla
GET  /api/portal/cloud/findings          — Cloud bulgular
GET  /api/portal/risk-priority           — Birleşik risk listesi
GET  /api/admin/remediation              — Admin remediation dashboard
GET  /api/admin/cloud-cspm               — Admin cloud özeti
GET  /api/admin/code-secrets             — Admin secrets özeti
```

---

*CyberStep.io CASM Tamamlama Promptu — 31 Mayıs 2026*
