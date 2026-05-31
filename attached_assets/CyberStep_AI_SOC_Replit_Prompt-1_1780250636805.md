# CyberStep.io — AI Destekli SOC Servisi
## Replit Agent Promptu — Tam SOC Altyapısı

---

## GENEL BAKIŞ

Bu prompt CyberStep'e üç şey ekler:

1. **AI SOC Motoru** — 4 katmanlı Claude triage, playbook sistemi,
   eskalasyon motoru, SLA takibi

2. **SOC Operatör Paneli** — CyberStep analistinin kullandığı
   gerçek zamanlı dashboard (WebSocket)

3. **Müşteri SOC Dashboard'u** — Müşterinin güvenlik durumunu
   takip ettiği portal

4. **Docker Altyapısı** — Replit'te çalışır, Hetzner'a 1 günde taşınır

Mevcut entegrasyon: FortiGate webhook + FortiAnalyzer syslog
(fabric_events tablosu ve fortinet_integrations zaten mevcut)

---

## BÖLÜM 1: VERİTABANI

```sql
-- ─── SOC CASE MANAGEMENT ─────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_cases (
  id serial PRIMARY KEY,
  case_number varchar(30) UNIQUE NOT NULL,
  -- CS-SOC-2026-00001

  customer_id integer REFERENCES customers(id),

  -- Kaynak olaylar
  trigger_event_ids integer[],
  -- fabric_events id'leri
  correlation_id integer REFERENCES fabric_correlations(id),

  -- Sınıflandırma
  severity varchar(20) NOT NULL,
  -- 'critical' | 'high' | 'medium' | 'low'
  escalation_level integer DEFAULT 0,
  -- 0=otomatik | 1=bildirim | 2=müdahale | 3=acil | 4=kriz
  category varchar(50),
  -- 'ransomware' | 'brute_force' | 'c2_communication' |
  -- 'data_exfiltration' | 'insider_threat' | 'vulnerability' |
  -- 'phishing' | 'malware' | 'ddos' | 'policy_violation' | 'other'

  -- İçerik
  title varchar(500) NOT NULL,
  description text,
  attack_narrative text,
  -- Claude'un patron dilinde açıklaması
  affected_assets text[],
  -- Etkilenen IP'ler, domain'ler, sistemler
  iocs_identified text[],
  -- Tespit edilen IoC'ler
  mitre_techniques text[],

  -- Durum
  status varchar(30) DEFAULT 'open',
  -- 'open' | 'investigating' | 'contained' |
  -- 'eradicated' | 'recovered' | 'closed' | 'false_positive'

  -- Atama
  assigned_to varchar(100),
  -- SOC analist adı veya 'auto'

  -- Playbook
  playbook_id integer REFERENCES soc_playbooks(id),
  playbook_executed_at timestamp,
  playbook_steps_completed integer DEFAULT 0,
  playbook_steps_total integer DEFAULT 0,

  -- SLA
  sla_tier varchar(20),
  -- 'critical_15m' | 'high_1h' | 'medium_4h' | 'low_24h'
  sla_deadline timestamp,
  sla_breached boolean DEFAULT false,
  sla_breached_at timestamp,
  response_time_minutes integer,
  -- İlk triage'dan ilk aksiyona süre

  -- Müşteri iletişimi
  customer_notified_at timestamp,
  customer_acknowledged_at timestamp,
  customer_notification_count integer DEFAULT 0,

  -- Aksiyonlar
  actions_taken jsonb DEFAULT '[]',
  -- [{action, performed_by, performed_at, result}]
  ips_blocked text[],
  auto_remediated boolean DEFAULT false,

  -- Kapanış
  root_cause text,
  lessons_learned text,
  false_positive_reason text,
  closed_at timestamp,
  closed_by varchar(100),
  time_to_resolve_minutes integer,

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Case seri numarası sayacı
CREATE TABLE IF NOT EXISTS soc_case_sequences (
  id serial PRIMARY KEY,
  year integer UNIQUE NOT NULL,
  last_number integer DEFAULT 0
);

-- ─── PLAYBOOK SİSTEMİ ────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_playbooks (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(100) UNIQUE NOT NULL,
  description text,

  -- Tetikleyici koşullar
  trigger_categories text[],
  -- ['ransomware', 'c2_communication']
  trigger_severity text[],
  -- ['critical', 'high']
  trigger_conditions jsonb,
  -- {min_confidence: 70, requires_ioc_match: false}

  -- Adımlar
  steps jsonb NOT NULL,
  -- Aşağıda detaylı format

  -- Kapsam
  auto_execute boolean DEFAULT true,
  -- false ise analist onayı gerekir
  requires_customer_approval boolean DEFAULT false,

  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_by varchar(100),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ─── SOC AKTİVİTE LOGU ───────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_activity_log (
  id serial PRIMARY KEY,
  case_id integer REFERENCES soc_cases(id),
  customer_id integer REFERENCES customers(id),

  actor_type varchar(20) NOT NULL,
  -- 'claude_auto' | 'analyst' | 'customer' | 'system'
  actor_name varchar(100),
  -- 'Claude Haiku' | 'Ahmet K.' | 'customer' | 'cron'

  action_type varchar(50) NOT NULL,
  -- 'case_created' | 'triage_completed' | 'playbook_executed' |
  -- 'ip_blocked' | 'customer_notified' | 'escalated' |
  -- 'note_added' | 'status_changed' | 'case_closed'

  description text,
  details jsonb,
  -- Aksiyona özel detaylar

  created_at timestamp DEFAULT now()
);

-- ─── SLA KONFİGÜRASYON ───────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_sla_config (
  id serial PRIMARY KEY,
  soc_tier varchar(30) NOT NULL,
  -- 'lite' | 'standart' | 'pro'
  severity varchar(20) NOT NULL,
  -- 'critical' | 'high' | 'medium' | 'low'
  response_minutes integer NOT NULL,
  -- İlk bildirime kadar süre
  resolution_hours integer,
  -- Tamamen kapatmaya kadar süre
  escalation_minutes integer,
  -- Bu süre geçerse üst seviyeye eskalasyon
  PRIMARY KEY (soc_tier, severity)
);

INSERT INTO soc_sla_config VALUES
  ('lite',     'critical', 15,  24,  30),
  ('lite',     'high',     60,  48,  120),
  ('lite',     'medium',   240, 168, 480),
  ('lite',     'low',      1440, 720, 2880),
  ('standart', 'critical', 10,  8,   20),
  ('standart', 'high',     30,  24,  60),
  ('standart', 'medium',   120, 72,  240),
  ('standart', 'low',      480, 336, 960),
  ('pro',      'critical', 5,   4,   10),
  ('pro',      'high',     15,  12,  30),
  ('pro',      'medium',   60,  48,  120),
  ('pro',      'low',      240, 168, 480);

-- ─── SOC MÜŞTERİ ABONELİKLERİ ────────────────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS soc_tier varchar(20),
  -- null=yok | 'lite' | 'standart' | 'pro'
  ADD COLUMN IF NOT EXISTS soc_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS soc_activated_at timestamp;

-- ─── CLAUDE MALİYET TAKİBİ ───────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  case_id integer REFERENCES soc_cases(id),

  model varchar(50) NOT NULL,
  -- 'claude-haiku-4-5' | 'claude-sonnet-4-6'
  tier integer NOT NULL,
  -- 0=kural | 1=haiku | 2=sonnet | 3=sonnet_extended
  use_case varchar(50),
  -- 'triage' | 'correlation' | 'playbook' | 'report' | 'escalation'

  input_tokens integer,
  output_tokens integer,
  cached_tokens integer DEFAULT 0,
  -- Prompt cache'den gelen token sayısı

  estimated_cost_usd decimal(10,6),
  was_cached boolean DEFAULT false,
  -- Redis cache'den geldi mi (Claude çağrısı yapılmadı)
  cache_hit boolean DEFAULT false,

  latency_ms integer,
  created_at timestamp DEFAULT now()
);

-- ─── HAFTALIK MALIYET ÖZETI ──────────────────────────────

CREATE OR REPLACE VIEW ai_cost_weekly AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  model,
  use_case,
  COUNT(*) AS calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cached_tokens) AS total_cached_tokens,
  SUM(estimated_cost_usd) AS total_cost_usd,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(CASE WHEN was_cached THEN 1 END) AS cache_hits,
  ROUND(COUNT(CASE WHEN was_cached THEN 1 END) * 100.0 / COUNT(*), 1)
    AS cache_hit_rate_pct
FROM ai_usage_log
GROUP BY DATE_TRUNC('week', created_at), model, use_case
ORDER BY week DESC;
```

---

## BÖLÜM 2: PLAYBOOK MOTORU

### Playbook Format (JSON)

```typescript
// Her playbook JSON'da tanımlı — kod değil
// YAML'a da dönüştürülebilir, aynı mantık

const PLAYBOOK_RANSOMWARE: PlaybookDefinition = {
  id: 1,
  name: 'Ransomware İlk Belirtisi',
  slug: 'ransomware-initial',
  trigger_categories: ['ransomware', 'c2_communication'],
  trigger_severity: ['critical', 'high'],
  trigger_conditions: { min_confidence: 65 },
  auto_execute: true,

  steps: [
    {
      step: 1,
      name: 'Kaynak IP Blok',
      type: 'action',
      action: 'block_ip',
      params: { ip_field: 'source_ip', duration_hours: 72 },
      on_failure: 'continue',
      // Blok başarısız olsa bile devam et
    },
    {
      step: 2,
      name: 'Anlık Müşteri Bildirimi',
      type: 'notify',
      channels: ['whatsapp', 'email'],
      priority: 'immediate',
      template: 'ransomware_alert',
      params: {
        message_template: `
🚨 KRİTİK GÜVENLİK UYARISI

{customer_company} ağında fidye yazılımı belirtisi tespit edildi.

Etkilenen sistem: {affected_asset}
Tespit zamanı: {detected_at}
Kaynak IP: {source_ip} — BLOKE EDİLDİ

Yapılması gerekenler:
1. BT/IT ekibinizi hemen bilgilendirin
2. Şüpheli sistemleri ağdan izole edin
3. Yedekleri kontrol edin

CyberStep SOC ekibi incelemeye devam ediyor.
Case No: {case_number}
        `
      },
    },
    {
      step: 3,
      name: 'Case Aç',
      type: 'create_case',
      params: {
        category: 'ransomware',
        priority: 'critical',
        title_template: 'Olası Fidye Yazılımı: {source_ip} → {affected_asset}',
      },
    },
    {
      step: 4,
      name: 'Komşu IP Tarama',
      type: 'scan',
      params: {
        target: 'source_ip_neighborhood',
        // /24 bloğundaki IP'leri tara
        scan_type: 'threat_check',
      },
      async: true, // Background'da çalışsın, bloklama
    },
    {
      step: 5,
      name: 'IoC Zenginleştirme',
      type: 'enrich',
      params: {
        enrich_field: 'source_ip',
        sources: ['fortiguard', 'talos', 'greynoise', 'abuseipdb'],
      },
      async: true,
    },
    {
      step: 6,
      name: '15 Dakika Sonra Doğrulama',
      type: 'verify',
      delay_minutes: 15,
      params: {
        check: 'ip_still_active',
        on_true: 'escalate_to_level_3',
        on_false: 'update_case_contained',
      },
    },
  ],
};
```

### Playbook Executor

```typescript
// src/soc/playbookExecutor.ts

export async function executePlaybook(
  playbookId: number,
  caseId: number,
  context: PlaybookContext
): Promise<PlaybookResult> {

  const playbook = await getPlaybook(playbookId);
  const results: StepResult[] = [];

  await updateCase(caseId, {
    playbookId,
    playbookExecutedAt: new Date(),
    playbookStepsTotal: playbook.steps.length,
  });

  await logSOCActivity(caseId, {
    actorType: 'claude_auto',
    actorName: 'Playbook Engine',
    actionType: 'playbook_executed',
    description: `Playbook başlatıldı: ${playbook.name}`,
  });

  for (const step of playbook.steps) {
    try {
      // Async adımlar background'da çalışır
      if (step.async) {
        setImmediate(() => executeStep(step, context, caseId));
        continue;
      }

      // Delayed adımlar scheduler'a verilir
      if (step.delay_minutes) {
        await scheduleDelayedStep(step, context, caseId);
        continue;
      }

      const result = await executeStep(step, context, caseId);
      results.push(result);

      await updateCase(caseId, {
        playbookStepsCompleted: results.filter(r => r.success).length,
      });

      // Hata varsa ve "abort" tanımlıysa dur
      if (!result.success && step.on_failure === 'abort') {
        break;
      }

    } catch (e) {
      logger.error(`Playbook step ${step.step} failed`, e);
      if (step.on_failure === 'abort') break;
    }
  }

  return { playbookId, caseId, results, completedAt: new Date() };
}

async function executeStep(
  step: PlaybookStep,
  context: PlaybookContext,
  caseId: number
): Promise<StepResult> {

  const resolvedParams = resolveTemplateParams(step.params, context);

  switch (step.type) {
    case 'action':
      if (step.action === 'block_ip') {
        const success = await blockIPViaFortiManager(
          context.customerId,
          resolvedParams.ip,
          `SOC Playbook: ${context.caseNumber}`
        );
        await logSOCActivity(caseId, {
          actorType: 'claude_auto',
          actionType: 'ip_blocked',
          description: `IP bloke edildi: ${resolvedParams.ip}`,
          details: { ip: resolvedParams.ip, success },
        });
        return { step: step.step, success, data: { ip: resolvedParams.ip } };
      }
      break;

    case 'notify':
      await sendSOCNotification(
        context.customerId,
        caseId,
        resolvedParams,
        step.channels
      );
      await updateCase(caseId, { customerNotifiedAt: new Date() });
      return { step: step.step, success: true };

    case 'create_case':
      // Case zaten oluşturulmuş, sadece güncelle
      await updateCase(caseId, {
        category: resolvedParams.category,
        title: resolvedParams.title,
      });
      return { step: step.step, success: true };

    case 'enrich':
      const enrichResult = await enrichIOC('ip', resolvedParams.ip);
      return { step: step.step, success: true, data: enrichResult };

    case 'scan':
      // Async scan kuyruğuna ekle
      await queueDomainScan(context.customerId, resolvedParams);
      return { step: step.step, success: true };

    case 'verify':
      const isStillActive = await verifyThreatActive(resolvedParams);
      if (isStillActive && resolvedParams.on_true === 'escalate_to_level_3') {
        await escalateCase(caseId, 3);
      }
      return { step: step.step, success: true, data: { isStillActive } };
  }

  return { step: step.step, success: false };
}

// Template değişkenlerini doldur
function resolveTemplateParams(
  params: Record<string, unknown>,
  context: PlaybookContext
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = value
        .replace('{source_ip}', context.sourceIp || '')
        .replace('{affected_asset}', context.affectedAsset || '')
        .replace('{customer_company}', context.customerName || '')
        .replace('{case_number}', context.caseNumber || '')
        .replace('{detected_at}', new Date().toLocaleString('tr-TR'));
    }
  }
  return resolved;
}
```

---

## BÖLÜM 3: CLAUDE TRIAGE PİPELİNE

```typescript
// src/soc/claudeTriage.ts
// 4 Katmanlı filtre — her alert buradan geçer

export async function triageAlert(
  event: FabricEvent,
  customerId: number
): Promise<TriageResult> {

  // ─── KATMAN 0: KURAL MOTORU (Claude yok, $0) ──────────

  // Bilinen iyi IP'ler
  const whitelist = await getCustomerWhitelist(customerId);
  if (whitelist.includes(event.sourceIp)) {
    await logTriageSkip(event.id, 0, 'whitelist');
    return { level: 0, action: 'skip', reason: 'Whitelist' };
  }

  // Tekrarlayan alert — batch'e al
  const recentSameAlert = await getRecentSameAlert(
    customerId, event.sourceIp, event.eventType, 5
  );
  if (recentSameAlert) {
    await addToBatch(customerId, event.id);
    return { level: 0, action: 'batch', reason: 'Duplicate suppression' };
  }

  // Zaten bloke IP
  const isBlocked = await checkIPAlreadyBlocked(customerId, event.sourceIp);
  if (isBlocked) {
    await logTriageSkip(event.id, 0, 'already_blocked');
    return { level: 0, action: 'skip', reason: 'Already blocked' };
  }

  // Bilinen IoC + otomatik blok izni var
  const knownIOC = await checkIOCRegistry(event.sourceIp);
  const integration = await getIntegration(customerId);

  if (knownIOC && knownIOC.threatLevel === 'critical' &&
      integration?.autoBlockEnabled) {
    await executeImmediateBlock(customerId, event, knownIOC);
    return {
      level: 0,
      action: 'auto_block',
      reason: `Known IoC: ${knownIOC.tags.join(', ')}`
    };
  }

  // ─── KATMAN 1: CLAUDE HAIKU (hızlı karar, ucuz) ───────

  const haikusPrompt = `
Alert: ${event.eventType}
Kaynak IP: ${event.sourceIp}
Tehdit: ${event.threatName}
Ciddiyet: ${event.threatSeverity}
Aksiyon: ${event.actionTaken}

Sadece JSON: {"real": true/false, "confidence": 0-100, "reason": "tek cümle"}
`;

  const [haikuResponse, haikuCost] = await callClaudeWithCost(
    haikusPrompt,
    'claude-haiku-4-5',
    { maxTokens: 100, systemPrompt: SOC_HAIKU_SYSTEM }
  );

  await logAIUsage({
    customerId,
    model: 'claude-haiku-4-5',
    tier: 1,
    useCase: 'triage',
    ...haikuCost,
  });

  const haikuResult = JSON.parse(haikuResponse);

  // Haiku "gerçek değil" dedi → güven düşük ise skip
  if (!haikuResult.real && haikuResult.confidence > 80) {
    return {
      level: 1,
      action: 'false_positive',
      confidence: haikuResult.confidence,
      reason: haikuResult.reason,
    };
  }

  // Haiku belirsiz veya düşük ciddiyet → sadece log
  if (haikuResult.confidence < 50 &&
      !['critical', 'high'].includes(event.threatSeverity)) {
    return {
      level: 1,
      action: 'log_and_watch',
      confidence: haikuResult.confidence,
    };
  }

  // ─── KATMAN 2: CLAUDE SONNET (tam analiz) ─────────────

  const customer = await getCustomer(customerId);
  const recentEvents = await getRecentEvents(customerId, 60); // Son 1 saat
  const externalFindings = await getLatestFindings(customerId);
  const iocContext = knownIOC
    ? `Bilinen IoC: ${knownIOC.tags.join(', ')} [${knownIOC.sources.join(', ')}]`
    : 'IoC veritabanında bulunamadı';

  const sonnetPrompt = `
Sen CyberStep AI SOC'un Tier-1 analistisin.

MÜŞTERİ: ${customer.companyName} (${customer.sector})

ANA OLAY:
${JSON.stringify(event, null, 2)}

SON 1 SAATTE DİĞER OLAYLAR (${recentEvents.length} adet):
${recentEvents.slice(0, 5).map(e =>
  `${e.eventType}: ${e.sourceIp} → ${e.destinationIp}:${e.destinationPort}`
).join('\n')}

IOC BAĞLAMI: ${iocContext}

DIŞ TARAMA BULGULARI (son):
${externalFindings.slice(0, 3).map(f =>
  `[${f.severity}] ${f.title}`
).join('\n')}

JSON YANIT:
{
  "is_real_threat": true/false,
  "confidence": 0-100,
  "severity": "critical|high|medium|low",
  "category": "kategori",
  "escalation_level": 0-4,
  "attack_narrative": "patron dilinde 2-3 cümle",
  "playbook_slug": "çalıştırılacak playbook slug veya null",
  "recommended_actions": ["aksiyon1", "aksiyon2"],
  "customer_message": "müşteriye 1-2 cümle Türkçe mesaj",
  "should_notify": true/false,
  "false_positive_probability": 0-100
}
`;

  const [sonnetResponse, sonnetCost] = await callClaudeWithCost(
    sonnetPrompt,
    'claude-sonnet-4-6',
    { maxTokens: 800, systemPrompt: SOC_SONNET_SYSTEM }
  );

  await logAIUsage({
    customerId,
    model: 'claude-sonnet-4-6',
    tier: 2,
    useCase: 'triage',
    ...sonnetCost,
  });

  const analysis = JSON.parse(sonnetResponse);

  if (!analysis.is_real_threat) {
    return {
      level: 2,
      action: 'false_positive',
      confidence: analysis.confidence,
      analysis,
    };
  }

  // ─── KATMAN 3: AKSIYON VE CASE OLUŞTURMA ──────────────

  const caseNumber = await generateCaseNumber();
  const slaConfig = await getSLAConfig(
    customer.socTier || 'lite',
    analysis.severity
  );

  const [soc_case] = await db.insert(socCases).values({
    caseNumber,
    customerId,
    triggerEventIds: [event.id],
    severity: analysis.severity,
    escalationLevel: analysis.escalation_level,
    category: analysis.category,
    title: `${analysis.category.toUpperCase()}: ${event.sourceIp} → ${event.destinationIp}`,
    description: analysis.attack_narrative,
    attackNarrative: analysis.attack_narrative,
    affectedAssets: [event.destinationIp, event.deviceHostname].filter(Boolean),
    mitreTechniques: [],
    status: 'open',
    assignedTo: 'auto',
    slaTier: `${analysis.severity}_${slaConfig.response_minutes}m`,
    slaDeadline: new Date(Date.now() + slaConfig.response_minutes * 60 * 1000),
  }).returning();

  // Playbook çalıştır
  if (analysis.playbook_slug) {
    const playbook = await getPlaybookBySlug(analysis.playbook_slug);
    if (playbook) {
      setImmediate(() => executePlaybook(playbook.id, soc_case.id, {
        customerId,
        caseNumber,
        sourceIp: event.sourceIp,
        affectedAsset: event.destinationIp,
        customerName: customer.companyName,
      }));
    }
  }

  // Bildirim gerekiyorsa gönder
  if (analysis.should_notify) {
    await sendSOCNotification(customerId, soc_case.id, {
      message: analysis.customer_message,
      severity: analysis.severity,
      caseNumber,
    }, ['whatsapp', 'email']);
  }

  return {
    level: 2,
    action: 'case_created',
    caseId: soc_case.id,
    caseNumber,
    severity: analysis.severity,
    analysis,
  };
}

// ─── SYSTEM PROMPT'LAR (CACHE'LENECEk) ─────────────────

const SOC_HAIKU_SYSTEM = `
Sen CyberStep SOC'un hızlı triage asistanısın.
Sadece "gerçek tehdit mi, değil mi?" kararını ver.
Cevabın her zaman geçerli JSON olmalı.
Hızlı ve kesin ol.
`.trim();

const SOC_SONNET_SYSTEM = `
Sen CyberStep SOC'un kıdemli Tier-1 güvenlik analistisin.
Türkiye odaklı bir siber güvenlik platformunda çalışıyorsun.
FortiGate log'larını, MITRE ATT&CK çerçevesini ve
Türkiye'deki tehdit aktörlerini iyi bilirsin.
Yanıtların her zaman geçerli JSON olmalı.
Patron dilinde açıklamalar yaz — teknik jargon yok.
`.trim();
```

---

## BÖLÜM 4: ESKALASYON MOTORU

```typescript
// src/soc/escalationEngine.ts

export async function escalateCase(
  caseId: number,
  targetLevel: number,
  reason?: string
): Promise<void> {

  const soc_case = await getCase(caseId);
  const customer = await getCustomer(soc_case.customerId);

  // Seviye 0-2: Otomatik
  // Seviye 3: İş saatlerinde analist araması
  // Seviye 4: 7/24 kriz yönetimi

  const escalationActions: Record<number, () => Promise<void>> = {

    1: async () => {
      // Müşteriye bildirim + WhatsApp
      await sendSOCNotification(soc_case.customerId, caseId, {
        message: `[${soc_case.caseNumber}] Güvenlik olayı tespit edildi ve inceleniyor.`,
        severity: soc_case.severity,
      }, ['email', 'whatsapp']);
    },

    2: async () => {
      // Kritik bildirim + müşteriden teyit bekle
      await sendSOCNotification(soc_case.customerId, caseId, {
        message: `[${soc_case.caseNumber}] ACİL: Müdahale gerekiyor. 30 dakika içinde teyit verin.`,
        severity: 'high',
        requiresAcknowledgment: true,
      }, ['whatsapp', 'email', 'slack']);

      // 30 dakika sonra teyit gelmezse seviye 3'e
      await scheduleEscalationCheck(caseId, 30);
    },

    3: async () => {
      // Admin'e anlık bildirim — analist devreye giriyor
      await sendAdminAlert({
        type: 'soc_escalation_level3',
        case: soc_case,
        customer,
        message: `LEVEL 3 ESKALASYon: ${customer.companyName} — ${soc_case.title}`,
      });

      // Müşteriye "ekibimiz sizi arayacak" bildirimi
      await sendSOCNotification(soc_case.customerId, caseId, {
        message: `[${soc_case.caseNumber}] Uzman ekibimiz durumu inceliyor, kısa sürede iletişime geçeceğiz.`,
        severity: 'critical',
      }, ['whatsapp', 'email']);

      // Case'i aktif analiste ata
      await updateCase(caseId, {
        assignedTo: await getOnCallAnalyst(),
        status: 'investigating',
      });
    },

    4: async () => {
      // Kriz modu — tüm kanallar aktif
      await sendAdminAlert({
        type: 'soc_crisis',
        case: soc_case,
        customer,
        priority: 'CRITICAL',
      });

      // Sanal CISO aktive et (varsa)
      if (customer.socTier === 'pro') {
        await activateVirtualCISO(soc_case.customerId, caseId);
      }

      // Müşteri CISO/IT direktörüne direkt arama talebi
      await createCallRequest(soc_case.customerId, caseId, 'immediate');
    },
  };

  await escalationActions[targetLevel]?.();

  await updateCase(caseId, { escalationLevel: targetLevel });
  await logSOCActivity(caseId, {
    actorType: 'system',
    actionType: 'escalated',
    description: `Level ${targetLevel} eskalasyon${reason ? ': ' + reason : ''}`,
  });
}

// SLA deadline kontrolü — her 5 dakikada
export async function checkSLABreaches(): Promise<void> {
  const breachingCases = await db.select()
    .from(socCases)
    .where(
      and(
        inArray(socCases.status, ['open', 'investigating']),
        eq(socCases.slaBreahed, false),
        lte(socCases.slaDeadline, new Date())
      )
    );

  for (const soc_case of breachingCases) {
    await db.update(socCases).set({
      slaBreached: true,
      slaBreachedAt: new Date(),
    }).where(eq(socCases.id, soc_case.id));

    // SLA ihlali → otomatik eskalasyon
    const nextLevel = Math.min(soc_case.escalationLevel + 1, 4);
    await escalateCase(soc_case.id, nextLevel, 'SLA ihlali');

    await logSOCActivity(soc_case.id, {
      actorType: 'system',
      actionType: 'escalated',
      description: `SLA ihlali — ${soc_case.slaTier}`,
    });
  }
}
```

---

## BÖLÜM 5: SOC OPERATÖR PANELİ

```
/admin-panel/soc

Real-time WebSocket bağlantısı — sayfa yenileme gerekmez

─── ÜST BANT — ANLİK METRİKLER ─────────────────────────
[🔴 Kritik: 2] [🟠 Yüksek: 7] [🟡 Orta: 12] [🟢 Düşük: 34]
Aktif case: 55   SLA Riski: 3   Bugün kapanan: 28
Triage/saat: 143  Auto-çözüm: %87  Eskalasyon: %4

─── ANA ALAN (2 sütun) ───────────────────────────────────

SOL: CANLI ALERT AKIŞI          SAĞ: AKTİF CASE LİSTESİ

[Filtre: Tüm | Kritik | Benim]  [Sırala: SLA | Ciddiyet | Müşteri]

━━━━━━━━━━━━━━━━━━━━━━━━━       ┌────────────────────────────────┐
🔴 CRITICAL — 2 dk önce         │ CS-SOC-2026-00892              │
Acme Finans — Botnet C2          │ 🔴 Ransomware İlk Belirtisi    │
185.220.x.x → 10.0.0.15:443     │ Acme Finans | SLA: 8 dk ⚠️    │
AUTO BLOCKED ✓                   │ Atanan: Claude Auto            │
[Detay] [Case Aç] [Eskalasyon]  │ [İncele →]                     │
                                  └────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━       ┌────────────────────────────────┐
🟠 HIGH — 5 dk önce             │ CS-SOC-2026-00891              │
Beta Tech — Brute Force          │ 🟠 Credential Stuffing         │
91.108.x.x → 443 (847 deneme)   │ Beta Tech | SLA: 45 dk ✓      │
MONITORING                       │ Atanan: Ahmet K.               │
[Detay] [Case Aç]               │ [İncele →]                     │
                                  └────────────────────────────────┘

─── CASE DETAY PANELİ (sağ panel tıklandığında) ─────────

Case: CS-SOC-2026-00892
Ciddiyet: 🔴 KRİTİK
Müşteri: Acme Finans A.Ş.
Açılış: 14:23:07 | SLA: 14:38:07 (8 dk)

Attack Narrative:
"185.220.101.45 IP adresi, FortiGuard tarafından
aktif Botnet C2 grubu olarak işaretlenmiş. Bu IP
bu sabah 9-14 arasında Acme ağında 3 farklı
sisteme bağlantı kurmuş..."

Playbook: Botnet C2 İzolasyon — %60 tamamlandı
  ✅ Adım 1: IP Bloke edildi
  ✅ Adım 2: Müşteri bildirildi
  ⏳ Adım 3: IoC zenginleştirme (devam ediyor)
  ⬜ Adım 4: 15 dk doğrulama

Aktivite Zaman Çizelgesi:
14:23:07 Claude Haiku — Gerçek tehdit onaylandı (güven: 94%)
14:23:09 Claude Sonnet — Tam analiz tamamlandı
14:23:11 Playbook başlatıldı: botnet-c2
14:23:12 IP bloke edildi: FortiManager ✓
14:23:15 WhatsApp bildirimi gönderildi
14:23:45 Müşteri okudu ✓

[Not Ekle] [Eskalasyon] [Kapat] [Raporla]
```

### WebSocket Implementasyonu

```typescript
// src/soc/socWebSocket.ts
import { WebSocketServer } from 'ws';

export function initSOCWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/soc' });

  wss.on('connection', (ws, req) => {
    // Admin auth kontrolü
    const token = extractWSToken(req);
    if (!isValidAdminToken(token)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // İlk bağlantıda mevcut durumu gönder
    sendSOCSnapshot(ws);

    ws.on('close', () => {
      socClients.delete(ws);
    });

    socClients.add(ws);
  });
}

// Yeni event geldiğinde tüm SOC operatörlerine yayınla
export function broadcastToSOC(event: SOCWebSocketEvent): void {
  const message = JSON.stringify(event);
  for (const client of socClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Event tipleri:
// new_alert, case_created, case_updated, case_closed,
// sla_warning, escalation, playbook_progress
```

---

## BÖLÜM 6: MÜŞTERİ SOC DASHBOARD'U

```typescript
// /hesabim/soc

// Müşteri SOC paketi varsa bu sayfayı göster
```

```
/hesabim/soc

┌──────────────────────────────────────────────────────────┐
│ Güvenlik Durumu: 🟢 Normal     Son güncelleme: 2 dk önce │
│ AI SOC Standart Paketi         SLA Garantisi: 30 dk      │
└──────────────────────────────────────────────────────────┘

Son 24 Saat Özeti:
┌──────────┬──────────┬──────────┬──────────┐
│ İzlenen  │Engellenen│ Alert    │ Case     │
│ 14.847   │    23    │   156    │    2     │
│ olay     │ IP       │ analiz   │ açıldı   │
└──────────┴──────────┴──────────┴──────────┘

Aktif Case'ler:
┌──────────────────────────────────────────────────────────┐
│ CS-SOC-2026-00892 🟠 İnceleniyor                        │
│ Credential stuffing girişimi tespit edildi               │
│ Durum: Ekibimiz inceliyor | SLA: ✓                      │
│ [Detay Gör →]                                           │
└──────────────────────────────────────────────────────────┘

Engellenen IP'ler (son 7 gün):
IP            | Neden           | Tarih        | Durum
──────────────────────────────────────────────────────────
185.220.101.45 | Botnet C2       | Dün 14:23    | Bloke ✓
91.108.56.182  | RDP Brute Force | 2 gün önce   | Bloke ✓
...

Haftalık SOC Raporu:
[PDF İndir] [E-posta Gönder]
```

---

## BÖLÜM 7: HAFTALIK SOC RAPORU (OTOMATİK)

```typescript
export async function generateWeeklySOCReport(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);
  const weekCases = await getWeekCases(customerId);
  const weekStats = await getWeekStats(customerId);

  const prompt = `
CyberStep SOC'un Haftalık Güvenlik Raporu.
${customer.companyName} yöneticisine gönderilecek.

HAFTALIK İSTATİSTİKLER:
${JSON.stringify(weekStats)}

BU HAFTA'NIN CASE'LERİ:
${weekCases.map(c =>
  `${c.caseNumber} | ${c.severity} | ${c.category} | ${c.status}`
).join('\n')}

Rapor bölümleri:
1. YÖNETİCİ ÖZETİ (3-4 cümle, patron dili)
2. BU HAFTA NELER OLDU (tehdit istatistikleri)
3. ENGELLEDİKLERİMİZ (en önemli 3 olay, somut)
4. SİSTEM SAĞLIĞI (skor trendi)
5. ÖNÜMÜZDEKİ HAFTA (dikkat edilecekler)

Ton: Güvence verici, teknik olmayan, sonuç odaklı.
Format: Patron bitirir bitmez anlasın.
`;

  const reportContent = await callClaude(prompt);
  const pdf = await generateSOCReportPDF(reportContent, customer, weekStats);

  await sendEmail({
    to: customer.email,
    subject: `[CyberStep SOC] Haftalık Güvenlik Raporu — ${getWeekLabel()}`,
    html: buildSOCReportEmailHTML(reportContent),
    attachments: [{ filename: `SOC_Raporu_${getWeekLabel()}.pdf`, content: pdf }],
  });
}
```

---

## BÖLÜM 8: CRON JOB'LAR

```typescript
// Her 5 dakikada — triage kuyruğu
cron.schedule('*/5 * * * *', async () => {
  const unprocessed = await getUntriageEvents(50);
  for (const event of unprocessed) {
    await triageAlert(event, event.customerId);
    await sleep(100);
  }
});

// Her 5 dakikada — SLA kontrol
cron.schedule('*/5 * * * *', async () => {
  await checkSLABreaches();
});

// Her 15 dakikada — batch alert korelasyon
cron.schedule('*/15 * * * *', async () => {
  await processBatchedAlerts();
});

// Her sabah 08:00 — gece özeti + shift raporu
cron.schedule('0 8 * * *', async () => {
  await generateNightShiftSummary();
});

// Her Pazartesi 09:00 — haftalık müşteri raporu
cron.schedule('0 9 * * 1', async () => {
  const socCustomers = await getSOCCustomers();
  for (const c of socCustomers) {
    await generateWeeklySOCReport(c.id);
    await sleep(2000);
  }
});

// Her ay 1'i — aylık AI maliyet raporu
cron.schedule('0 8 1 * *', async () => {
  await generateMonthlyAICostReport();
});
```

---

## BÖLÜM 9: AI MALİYET DASHBOARD'U

```
/admin-panel/ai-costs

Bu Ay:
  Toplam Claude çağrısı: 28.473
  Toplam harcama: $312.47
  Cache sayesinde tasarruf: $89.23
  Ortalama response: 423ms

Tier Dağılımı:
  Tier 0 (Kural):   18.234 alert   %64   $0
  Tier 1 (Haiku):    6.847 alert   %24   $48.23
  Tier 2 (Sonnet):   2.891 alert   %10   $198.45
  Tier 3 (Extended):   501 alert    %2   $65.79

Müşteri Bazlı Maliyet:
  Acme Finans:  $42.33 (yüksek tehdit hacmi)
  Beta Tech:    $28.17
  Gamma Ltd:    $12.44
  ...

Redis Cache Performansı:
  Cache hit rate:   %34
  Tasarruf edilen çağrı: 4.231
  Tasarruf: $89.23

Aylık Projeksiyon:
  Mevcut hız: $312 → Tahmini ay sonu: $387
  Gelir/AI oranı: %0.28 ✓ (hedef: <%1)
```

---

## BÖLÜM 10: DOCKER ALTYAPISI

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.9'

services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { memory: 512M }

  worker:
    build: .
    command: node dist/socWorker.js
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped
    deploy:
      resources:
        limits: { memory: 1G }
        # SOC korelasyon daha fazla RAM istiyor

  syslog:
    build: .
    command: node dist/syslogServer.js
    ports:
      - "5514:5514/tcp"
      - "5515:5515/udp"
    env_file: .env
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

---

## BÖLÜM 11: HEALTH CHECK + METRİKLER

```typescript
// GET /health — Docker healthcheck + load balancer
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDB(),
    redis: await checkRedis(),
    soc_worker: await checkSOCWorker(),
    syslog_server: await checkSyslogServer(),
  };

  const healthy = Object.values(checks).every(Boolean);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
  });
});

// GET /metrics — Prometheus uyumlu
app.get('/metrics', async (req, res) => {
  const metrics = await collectMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP cyberstep_soc_cases_total Total SOC cases
# TYPE cyberstep_soc_cases_total counter
cyberstep_soc_cases_total{status="open"} ${metrics.openCases}
cyberstep_soc_cases_total{status="closed"} ${metrics.closedCases}

# HELP cyberstep_ai_calls_total Total Claude API calls
# TYPE cyberstep_ai_calls_total counter
cyberstep_ai_calls_total{tier="0"} ${metrics.tier0Calls}
cyberstep_ai_calls_total{tier="1"} ${metrics.tier1Calls}
cyberstep_ai_calls_total{tier="2"} ${metrics.tier2Calls}

# HELP cyberstep_ai_cost_usd Total AI cost in USD
# TYPE cyberstep_ai_cost_usd gauge
cyberstep_ai_cost_usd ${metrics.totalAICostUSD}

# HELP cyberstep_sla_breaches_total SLA breaches
# TYPE cyberstep_sla_breaches_total counter
cyberstep_sla_breaches_total ${metrics.slaBreaaches}

# HELP cyberstep_customers_active Active customers
# TYPE cyberstep_customers_active gauge
cyberstep_customers_active ${metrics.activeCustomers}

# HELP cyberstep_soc_customers Active SOC customers
# TYPE cyberstep_soc_customers gauge
cyberstep_soc_customers{tier="lite"} ${metrics.socLite}
cyberstep_soc_customers{tier="standart"} ${metrics.socStandart}
cyberstep_soc_customers{tier="pro"} ${metrics.socPro}
  `.trim());
});
```

---

## BÖLÜM 12: API ROTALAR

```
─── SOC OPERATIONS ─────────────────────────────────────────
GET  /api/admin/soc/dashboard          — Operatör dashboard verisi
GET  /api/admin/soc/cases              — Case listesi (filtreli)
GET  /api/admin/soc/cases/:id          — Case detayı
PUT  /api/admin/soc/cases/:id          — Case güncelle
POST /api/admin/soc/cases/:id/escalate — Eskalasyon
POST /api/admin/soc/cases/:id/close    — Kapat
POST /api/admin/soc/cases/:id/note     — Not ekle

─── PLAYBOOK ────────────────────────────────────────────────
GET  /api/admin/soc/playbooks          — Playbook listesi
POST /api/admin/soc/playbooks          — Yeni playbook
PUT  /api/admin/soc/playbooks/:id      — Düzenle
POST /api/admin/soc/playbooks/:id/test — Test çalıştır

─── AI MALİYET ──────────────────────────────────────────────
GET  /api/admin/soc/ai-costs           — Maliyet dashboard
GET  /api/admin/soc/ai-costs/weekly    — Haftalık özet
GET  /api/admin/soc/ai-costs/customer  — Müşteri bazlı

─── MÜŞTERİ PORTAL ─────────────────────────────────────────
GET  /api/portal/soc/dashboard         — Müşteri SOC dashboard
GET  /api/portal/soc/cases             — Müşterinin case'leri
GET  /api/portal/soc/cases/:id         — Case detayı
GET  /api/portal/soc/blocked-ips       — Blok listesi
GET  /api/portal/soc/reports/weekly    — Haftalık rapor

─── WEBSOCKET ───────────────────────────────────────────────
WS   /ws/soc                           — SOC operatör real-time
WS   /ws/portal/soc                    — Müşteri real-time
```

---

## BÖLÜM 13: ENVIRONMENT VARIABLES

```bash
# SOC
SOC_AUTO_BLOCK_DEFAULT=true
SOC_MIN_CONFIDENCE_AUTO_BLOCK=70
SOC_BATCH_INTERVAL_MINUTES=15
SOC_TRIAGE_BATCH_SIZE=50

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_SOC_CACHE_TTL=3600
# 1 saat — aynı IP tekrar gelirse cache'den

# AI Cost Limits
AI_MONTHLY_BUDGET_USD=500
AI_DAILY_ALERT_USD=20
# Bu limiti geçince admin'e uyarı

# Docker
APP_VERSION=1.0.0
NODE_ENV=production

# Prometheus
METRICS_ENABLED=true
METRICS_PORT=9090
```

---

## BÖLÜM 14: HAZIR PLAYBOOK'LAR — SEED DATA

```sql
INSERT INTO soc_playbooks
  (name, slug, description, trigger_categories,
   trigger_severity, steps, auto_execute) VALUES

('Ransomware İlk Belirtisi', 'ransomware-initial',
 'C2 iletişimi veya şifreleme davranışı',
 ARRAY['ransomware','c2_communication'],
 ARRAY['critical','high'],
 '[
   {"step":1,"type":"action","action":"block_ip","params":{"duration_hours":72}},
   {"step":2,"type":"notify","channels":["whatsapp","email"],"priority":"immediate"},
   {"step":3,"type":"create_case","params":{"category":"ransomware"}},
   {"step":4,"type":"enrich","async":true},
   {"step":5,"type":"verify","delay_minutes":15}
 ]', true),

('RDP Brute Force', 'rdp-brute-force',
 'RDP portuna yoğun başarısız giriş',
 ARRAY['brute_force'],
 ARRAY['high','medium'],
 '[
   {"step":1,"type":"action","action":"block_ip","params":{"duration_hours":24}},
   {"step":2,"type":"notify","channels":["email"],"priority":"normal"},
   {"step":3,"type":"create_case","params":{"category":"brute_force"}},
   {"step":4,"type":"verify","delay_minutes":60}
 ]', true),

('Botnet C2 İletişimi', 'botnet-c2',
 'İç ağdan bilinen C2 sunucusuna bağlantı',
 ARRAY['botnet_c2','c2_communication'],
 ARRAY['critical','high'],
 '[
   {"step":1,"type":"action","action":"block_ip"},
   {"step":2,"type":"notify","channels":["whatsapp","email","slack"],"priority":"immediate"},
   {"step":3,"type":"create_case","params":{"category":"botnet_c2"}},
   {"step":4,"type":"scan","params":{"target":"affected_subnet"},"async":true},
   {"step":5,"type":"verify","delay_minutes":10}
 ]', true),

('Yeni Kritik CVE', 'critical-cve-alert',
 'EPSS yüksek yeni CVE + etkilenen teknoloji',
 ARRAY['vulnerability'],
 ARRAY['critical'],
 '[
   {"step":1,"type":"notify","channels":["email"],"priority":"normal"},
   {"step":2,"type":"create_case","params":{"category":"vulnerability"}},
   {"step":3,"type":"enrich","params":{"check_exploit_db":true},"async":true}
 ]', true);
```

---

*CyberStep.io — AI SOC Servisi — 31 Mayıs 2026*
