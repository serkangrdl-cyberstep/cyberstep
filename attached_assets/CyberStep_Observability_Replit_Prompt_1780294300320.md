# CyberStep.io — Observability & Monitoring Entegrasyonları
## Replit Agent Promptu — Prometheus/Grafana + Datadog + Azure Monitor

---

## GENEL BAKIŞ

Bu prompt üç bileşen ekler:

1. **Prometheus + Grafana** — CyberStep'in kendi altyapı izleme
   sistemi. Claude maliyeti, cron sağlığı, API performansı,
   SOC metrikleri. Ücretsiz, Docker Compose'a dahil.

2. **Datadog Entegrasyonu** — Müşterinin Datadog hesabından
   webhook ile güvenlik olayları CyberStep SOC'una geliyor.
   Uygulama anomalisi + ağ olayı korelasyonu.

3. **Azure Monitor Entegrasyonu** — Azure Defender, Activity Log,
   NSG Flow Log'larını SOC'a bağlama. KVKK + Azure Turkey North
   uyum kombinasyonu.

Mevcut entegrasyon altyapısı (fortinet_integrations,
fabric_events, customer_integrations tablolarını) temel alır.

---

## BÖLÜM 1: VERİTABANI

```sql
-- Genel observability entegrasyon tablosu
-- (Slack/Teams için de kullanılacak, genişletilebilir)
CREATE TABLE IF NOT EXISTS observability_integrations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  provider varchar(30) NOT NULL,
  -- 'datadog' | 'azure_monitor' | 'grafana_cloud' |
  -- 'new_relic' | 'elastic' | 'splunk'
  display_name varchar(100),
  webhook_token varchar(64) UNIQUE,
  -- Inbound webhook: /api/integrations/{provider}/{token}
  api_key_encrypted text,
  -- Müşteri API key'i (read-only)
  api_endpoint varchar(500),
  -- Datadog: api.datadoghq.com / Azure: management.azure.com
  config jsonb DEFAULT '{}',
  -- Provider'a özel ayarlar
  -- Datadog: {site: 'datadoghq.com', app_key: enc}
  -- Azure: {subscription_id, tenant_id, client_id, client_secret_enc}
  event_types text[] DEFAULT '{}',
  -- Hangi event'leri dinleyeceğiz
  -- ['security_alert', 'anomaly', 'error_rate', 'latency_spike']
  is_active boolean DEFAULT true,
  last_event_at timestamp,
  event_count integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Gelen observability event'leri
CREATE TABLE IF NOT EXISTS observability_events (
  id serial PRIMARY KEY,
  integration_id integer REFERENCES observability_integrations(id),
  customer_id integer REFERENCES customers(id),
  provider varchar(30) NOT NULL,
  event_type varchar(50) NOT NULL,
  -- 'security_alert' | 'anomaly_detected' | 'error_spike' |
  -- 'latency_spike' | 'auth_failure' | 'policy_violation' |
  -- 'resource_change' | 'defender_alert' | 'nsg_anomaly'
  severity varchar(20),
  -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  title varchar(500),
  description text,
  affected_service varchar(255),
  -- Hangi uygulama/servis etkileniyor
  affected_host varchar(255),
  source_ip varchar(50),
  raw_payload jsonb,
  -- Ham webhook payload
  processed boolean DEFAULT false,
  correlated_soc_case_id integer REFERENCES soc_cases(id),
  -- Bu event bir SOC case'e dönüştü mü?
  received_at timestamp DEFAULT now()
);

-- CyberStep'in kendi Prometheus metrikleri için
-- (hangi metrikler kaydedilecek)
CREATE TABLE IF NOT EXISTS platform_metrics_config (
  id serial PRIMARY KEY,
  metric_name varchar(100) UNIQUE NOT NULL,
  -- 'claude_api_calls_total' | 'soc_triage_duration_seconds'
  description varchar(255),
  metric_type varchar(20),
  -- 'counter' | 'gauge' | 'histogram'
  labels text[] DEFAULT '{}',
  -- ['tier', 'customer_id', 'model']
  is_active boolean DEFAULT true
);
```

---

## BÖLÜM 2: PROMETHEUS METRİK ENDPOİNTİ

```typescript
// src/monitoring/prometheusMetrics.ts
// GET /metrics — Prometheus scrape endpoint'i

import { Registry, Counter, Gauge, Histogram } from 'prom-client';

const register = new Registry();

// ─── CLAUDE AI METRİKLERİ ────────────────────────────────────

export const claudeApiCalls = new Counter({
  name: 'cyberstep_claude_api_calls_total',
  help: 'Total Claude API calls by tier and model',
  labelNames: ['tier', 'model', 'use_case', 'cached'],
  registers: [register],
});

export const claudeTokensUsed = new Counter({
  name: 'cyberstep_claude_tokens_total',
  help: 'Total tokens used by Claude API',
  labelNames: ['tier', 'model', 'type'],
  // type: 'input' | 'output' | 'cached'
  registers: [register],
});

export const claudeCostUSD = new Counter({
  name: 'cyberstep_claude_cost_usd_total',
  help: 'Total estimated Claude API cost in USD',
  labelNames: ['tier', 'model'],
  registers: [register],
});

export const claudeLatency = new Histogram({
  name: 'cyberstep_claude_duration_seconds',
  help: 'Claude API call duration in seconds',
  labelNames: ['tier', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// ─── SOC METRİKLERİ ──────────────────────────────────────────

export const socAlertsTotal = new Counter({
  name: 'cyberstep_soc_alerts_total',
  help: 'Total alerts processed by SOC',
  labelNames: ['action', 'severity', 'tier'],
  // action: 'blocked' | 'triaged' | 'false_positive' | 'escalated'
  registers: [register],
});

export const socQueueDepth = new Gauge({
  name: 'cyberstep_soc_queue_depth',
  help: 'Current number of unprocessed SOC alerts',
  labelNames: ['priority'],
  registers: [register],
});

export const socTriageDuration = new Histogram({
  name: 'cyberstep_soc_triage_seconds',
  help: 'Time to complete alert triage',
  labelNames: ['tier', 'severity'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const socSlaBreaches = new Counter({
  name: 'cyberstep_soc_sla_breaches_total',
  help: 'Total SLA breach events',
  labelNames: ['severity', 'tier'],
  registers: [register],
});

export const socActiveCases = new Gauge({
  name: 'cyberstep_soc_active_cases',
  help: 'Current number of open SOC cases',
  labelNames: ['severity', 'escalation_level'],
  registers: [register],
});

// ─── DOMAIN TARAMA METRİKLERİ ────────────────────────────────

export const domainScansTotal = new Counter({
  name: 'cyberstep_domain_scans_total',
  help: 'Total domain scans initiated',
  labelNames: ['status', 'type'],
  // status: 'success' | 'timeout' | 'error'
  // type: 'free' | 'paid' | 'scheduled' | 'verification'
  registers: [register],
});

export const domainScanDuration = new Histogram({
  name: 'cyberstep_domain_scan_seconds',
  help: 'Domain scan duration in seconds',
  buckets: [5, 10, 20, 30, 60, 120, 300],
  registers: [register],
});

export const scanServiceTimeout = new Counter({
  name: 'cyberstep_scan_service_timeouts_total',
  help: 'Timeouts per external scan service',
  labelNames: ['service'],
  // service: 'shodan' | 'virustotal' | 'hibp' | 'ssl_labs'
  registers: [register],
});

// ─── CRON JOB METRİKLERİ ─────────────────────────────────────

export const cronJobRuns = new Counter({
  name: 'cyberstep_cron_runs_total',
  help: 'Cron job execution count',
  labelNames: ['job_name', 'status'],
  registers: [register],
});

export const cronJobLastRun = new Gauge({
  name: 'cyberstep_cron_last_success_timestamp',
  help: 'Unix timestamp of last successful cron run',
  labelNames: ['job_name'],
  registers: [register],
});

export const cronJobDuration = new Histogram({
  name: 'cyberstep_cron_duration_seconds',
  help: 'Cron job execution duration',
  labelNames: ['job_name'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
  registers: [register],
});

// ─── MÜŞTERİ / İŞ METRİKLERİ ────────────────────────────────

export const activeCustomers = new Gauge({
  name: 'cyberstep_customers_active_total',
  help: 'Number of active customers',
  labelNames: ['plan'],
  registers: [register],
});

export const revenueMonthly = new Gauge({
  name: 'cyberstep_mrr_tl',
  help: 'Monthly Recurring Revenue in TL',
  registers: [register],
});

// ─── FORTINET FABRİC METRİKLERİ ──────────────────────────────

export const fabricEventsReceived = new Counter({
  name: 'cyberstep_fabric_events_total',
  help: 'Total Fortinet Fabric events received',
  labelNames: ['source', 'severity'],
  registers: [register],
});

export const fabricBlocksApplied = new Counter({
  name: 'cyberstep_fabric_blocks_total',
  help: 'Total IP blocks applied via FortiManager',
  labelNames: ['status'],
  // status: 'success' | 'failed'
  registers: [register],
});

// ─── METRİK ENDPOINT ─────────────────────────────────────────

export async function getMetrics(): Promise<string> {
  // Dinamik gauge'ları güncelle
  const [
    queueDepth,
    activeCases,
    customerCounts,
    mrr,
  ] = await Promise.all([
    getSOCQueueDepth(),
    getActiveSOCCases(),
    getCustomerCountsByPlan(),
    getCurrentMRR(),
  ]);

  socQueueDepth.reset();
  queueDepth.forEach(q => {
    socQueueDepth.set({ priority: q.priority }, q.count);
  });

  socActiveCases.reset();
  activeCases.forEach(c => {
    socActiveCases.set(
      { severity: c.severity, escalation_level: c.level },
      c.count
    );
  });

  activeCustomers.reset();
  customerCounts.forEach(c => {
    activeCustomers.set({ plan: c.plan }, c.count);
  });

  revenueMonthly.set(mrr);

  return register.metrics();
}

// Express route
// app.get('/metrics', async (req, res) => {
//   res.set('Content-Type', register.contentType);
//   res.send(await getMetrics());
// });
```

---

## BÖLÜM 3: DOCKER COMPOSE — PROMETHEUS + GRAFANA

```yaml
# docker-compose.yml'e ekle (mevcut servislere ek olarak)

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks: [cyberstep_net]

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: "https://monitor.cyberstep.io"
    ports:
      - "3001:3000"
    restart: unless-stopped
    networks: [cyberstep_net]

volumes:
  prometheus_data:
  grafana_data:
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cyberstep_api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'

  - job_name: 'cyberstep_worker'
    static_configs:
      - targets: ['worker:3001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres_exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis_exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts.yml'
```

```yaml
# alerts.yml — Prometheus alert kuralları
groups:
  - name: cyberstep_critical
    rules:
      - alert: ClaudeAPIHighCost
        expr: rate(cyberstep_claude_cost_usd_total[1h]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Claude maliyeti saatte $1+ geçiyor"

      - alert: SOCQueueDepthHigh
        expr: cyberstep_soc_queue_depth > 100
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "SOC kuyruğu 100+ alert bekliyor"

      - alert: CronJobNotRunning
        expr: time() - cyberstep_cron_last_success_timestamp > 3600
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.job_name }} 1 saattir çalışmadı"

      - alert: DomainScanTimeout
        expr: rate(cyberstep_scan_service_timeouts_total[5m]) > 0.5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.service }} çok fazla timeout"
```

---

## BÖLÜM 4: GRAFANA DASHBOARD'LARI

```typescript
// grafana/dashboards/cyberstep-soc.json
// Bu dashboard'u Grafana'ya import et

// Dashboard 1: SOC Komuta Merkezi
// Panel'ler:
// - Alert kuyruğu derinliği (Gauge, gerçek zamanlı)
// - Saatlik triage oranı (Time series)
// - Tier dağılımı (Pie chart: Katman 0/1/2/3)
// - SLA breach sayısı (Counter)
// - Aktif case'ler severity bazlı (Bar chart)
// - Son 24s en çok alert üreten müşteriler

// Dashboard 2: Claude AI Maliyet İzleme
// Panel'ler:
// - Saatlik maliyet (Time series, $)
// - Tier bazlı çağrı dağılımı (Stacked bar)
// - Cache hit rate (Gauge, hedef: >%30)
// - Model bazlı latency (Heatmap)
// - Aylık projeksiyon (Stat panel)

// Dashboard 3: Platform Sağlık
// Panel'ler:
// - Tüm cron job'ların son çalışma zamanı (Table)
// - API endpoint latency (Heatmap)
// - DB yavaş sorgu sayısı (Time series)
// - Error rate (Time series)
// - Fortinet fabric event akışı (Time series)

// Dashboard 4: İş Metrikleri
// Panel'ler:
// - MRR trendi (Time series, TL)
// - Aktif müşteri plan dağılımı (Pie)
// - Günlük domain tarama sayısı
// - Dönüşüm hunisi (Funnel chart)
```

---

## BÖLÜM 5: DATADOG ENTEGRASYONU

### 5a — Inbound Webhook (Müşteri → CyberStep)

```typescript
// POST /api/integrations/datadog/:token
// Müşteri Datadog'da Action → Webhook olarak CyberStep URL'ini tanımlar

router.post('/datadog/:token', async (req, res) => {
  const integration = await getIntegrationByToken(req.params.token, 'datadog');
  if (!integration) return res.status(200).json({ ok: true });

  const payload = req.body;

  // Datadog webhook format:
  // {
  //   id: "monitor-alert-xxx",
  //   title: "High error rate on auth-service",
  //   type: "monitor alert" | "event alert",
  //   message: "Error rate exceeded threshold",
  //   severity: "CRITICAL" | "WARNING" | "INFO",
  //   hostname: "prod-web-01",
  //   tags: ["service:auth", "env:prod"],
  //   url: "https://app.datadoghq.com/monitors/123",
  //   date: 1748695200
  // }

  const event = normalizeDatadogEvent(payload);

  await db.insert(observabilityEvents).values({
    integrationId: integration.id,
    customerId: integration.customerId,
    provider: 'datadog',
    eventType: event.type,
    severity: event.severity,
    title: event.title,
    description: event.description,
    affectedService: event.service,
    affectedHost: event.hostname,
    rawPayload: payload,
    receivedAt: new Date(),
  });

  // İstatistik güncelle
  await db.update(observabilityIntegrations).set({
    lastEventAt: new Date(),
    eventCount: sql`event_count + 1`,
  }).where(eq(observabilityIntegrations.id, integration.id));

  // SOC'a tetikle — kritik ise anlık
  if (['CRITICAL', 'ERROR'].includes(payload.severity)) {
    setImmediate(() => correlateWithSOC(integration.customerId, event));
  }

  res.status(200).json({ ok: true });
});

function normalizeDatadogEvent(payload: DatadogWebhook): NormalizedEvent {
  const severityMap: Record<string, string> = {
    'CRITICAL': 'critical', 'ERROR': 'high',
    'WARNING': 'medium', 'INFO': 'low',
  };

  const typeMap: Record<string, string> = {
    'monitor alert': 'anomaly_detected',
    'error tracking alert': 'error_spike',
    'security signal': 'security_alert',
    'apm alert': 'latency_spike',
  };

  // Tag'lerden service ve env çıkar
  const tags = Object.fromEntries(
    (payload.tags || [])
      .filter(t => t.includes(':'))
      .map(t => t.split(':'))
  );

  return {
    type: typeMap[payload.type] || 'anomaly_detected',
    severity: severityMap[payload.severity] || 'medium',
    title: payload.title,
    description: payload.message,
    service: tags.service,
    hostname: payload.hostname,
    datadogUrl: payload.url,
  };
}
```

### 5b — Datadog API Sorgusu (Read-Only, İsteğe Bağlı)

```typescript
// Müşteri read-only API key verirse aktif sorgulama yapılabilir
// SOC case incelenirken ek bağlam toplamak için

export async function queryDatadogContext(
  integration: ObservabilityIntegration,
  timeRange: { from: Date; to: Date },
  service?: string
): Promise<DatadogContext> {

  const config = integration.config as DatadogConfig;
  const headers = {
    'DD-API-KEY': decrypt(config.apiKeyEncrypted),
    'DD-APPLICATION-KEY': decrypt(config.appKeyEncrypted),
    'Content-Type': 'application/json',
  };

  // Son X saatte auth hataları var mı?
  const logsResponse = await axios.post(
    `https://api.${config.site}/api/v2/logs/events/search`,
    {
      filter: {
        query: `status:error ${service ? `service:${service}` : ''} @http.status_code:(401 OR 403)`,
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
      },
      page: { limit: 50 },
    },
    { headers }
  );

  // Anomaly detection aktif monitor'ler
  const monitorsResponse = await axios.get(
    `https://api.${config.site}/api/v1/monitor`,
    {
      params: { type: 'anomaly', with_downtimes: 0 },
      headers,
    }
  );

  return {
    recentAuthErrors: logsResponse.data.data?.length || 0,
    activeAnomalies: monitorsResponse.data
      .filter(m => m.overall_state === 'Alert')
      .map(m => ({ name: m.name, state: m.overall_state })),
  };
}
```

### 5c — Kurulum Sayfası

```
/hesabim/entegrasyonlarim → Datadog kartı

Datadog Entegrasyonu:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Webhook URL (Inbound):
  https://cyberstep.io/api/integrations/datadog/[TOKEN]
  [Kopyala]

  Datadog'da yapılacak:
  1. Monitors → New Monitor veya Alerts
  2. Notification: @webhook-cyberstep
  3. Webhook URL olarak yukarıdaki adresi girin
  4. "Test Gönder" ile test edin

  Hangi olayları gönderelim?
  [✓] Güvenlik sinyalleri (APM Security)
  [✓] Anomali tespiti alertleri
  [✓] Hata oranı spike'ları
  [ ] Latency alertleri
  [ ] Info level alertler

  [Bağlantıyı Test Et] [Kaydet]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Opsiyonel — Datadog'dan aktif sorgulama için:
  API Key (Read-Only):     [___________________]
  Application Key:         [___________________]
  Datadog Site:            ○ datadoghq.com  ○ datadoghq.eu
  [Kaydet]
```

---

## BÖLÜM 6: AZURE MONITOR ENTEGRASYONU

### 6a — Inbound Webhook (Azure Action Groups)

```typescript
// POST /api/integrations/azure/:token
// Azure Monitor Action Groups → Webhook olarak CyberStep

router.post('/azure/:token', async (req, res) => {
  // Azure imzasını doğrula
  const signature = req.headers['x-ms-notification-signature'];
  const isValid = verifyAzureSignature(req.body, signature);
  if (!isValid) return res.status(200).json({ ok: true });

  const integration = await getIntegrationByToken(req.params.token, 'azure_monitor');
  if (!integration) return res.status(200).json({ ok: true });

  const payload = req.body;

  // Azure payload tipleri:
  // 1. Activity Log Alert
  // 2. Metric Alert
  // 3. Service Health Alert
  // 4. Azure Defender for Cloud Alert

  const event = normalizeAzureEvent(payload);

  await db.insert(observabilityEvents).values({
    integrationId: integration.id,
    customerId: integration.customerId,
    provider: 'azure_monitor',
    eventType: event.type,
    severity: event.severity,
    title: event.title,
    description: event.description,
    affectedService: event.resource,
    affectedHost: event.resourceGroup,
    sourceIp: event.sourceIp,
    rawPayload: payload,
  });

  if (['critical', 'high'].includes(event.severity)) {
    setImmediate(() => correlateWithSOC(integration.customerId, event));
  }

  res.status(200).json({ ok: true });
});

function normalizeAzureEvent(payload: AzureAlertPayload): NormalizedEvent {
  // Azure Defender for Cloud alert tipi
  if (payload.data?.context?.activityLog?.category === 'Security') {
    return {
      type: 'security_alert',
      severity: mapAzureSeverity(payload.data.context.activityLog.level),
      title: payload.data.context.activityLog.operationName,
      description: payload.data.context.activityLog.description,
      resource: payload.data.context.activityLog.resourceId,
      resourceGroup: extractResourceGroup(payload.data.context.activityLog.resourceId),
    };
  }

  // Metric Alert (CPU, network anomaly)
  if (payload.data?.context?.condition) {
    return {
      type: 'anomaly_detected',
      severity: payload.data.status === 'Activated' ? 'medium' : 'info',
      title: payload.data.context.name,
      description: `${payload.data.context.condition.allOf[0]?.metricName}: ${payload.data.context.condition.allOf[0]?.metricValue}`,
      resource: payload.data.context.resourceName,
      resourceGroup: payload.data.context.resourceGroupName,
    };
  }

  return {
    type: 'resource_change',
    severity: 'low',
    title: payload.data?.context?.activityLog?.operationName || 'Azure Event',
    description: JSON.stringify(payload.data?.context),
    resource: '',
    resourceGroup: '',
  };
}

function mapAzureSeverity(level: string): string {
  return {
    'Critical': 'critical', 'Error': 'high',
    'Warning': 'medium', 'Informational': 'low',
  }[level] || 'medium';
}
```

### 6b — Microsoft Security Graph API (Defender for Cloud)

```typescript
// Müşteri Service Principal verirse aktif sorgulama
// "Security Reader" rolü yeterli — hiçbir şeyi değiştiremez

export class AzureSecurityReader {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private tenantId: string,
    private clientId: string,
    private clientSecretEncrypted: string
  ) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await axios.post(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: decrypt(this.clientSecretEncrypted),
        scope: 'https://management.azure.com/.default',
      })
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
    return this.accessToken;
  }

  // Azure Defender Security Alerts
  async getSecurityAlerts(
    subscriptionId: string,
    since: Date
  ): Promise<AzureSecurityAlert[]> {
    const token = await this.getToken();
    const response = await axios.get(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Security/alerts`,
      {
        params: {
          'api-version': '2022-01-01',
          '$filter': `properties/timeGeneratedUtc ge ${since.toISOString()}`,
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.value.map(alert => ({
      id: alert.name,
      displayName: alert.properties.alertDisplayName,
      severity: alert.properties.severity,
      description: alert.properties.description,
      remediationSteps: alert.properties.remediationSteps,
      attackedResourceId: alert.properties.compromisedEntity,
      status: alert.properties.status,
      timeGenerated: new Date(alert.properties.timeGeneratedUtc),
    }));
  }

  // Azure Activity Log — Kim ne yaptı?
  async getActivityLog(
    subscriptionId: string,
    since: Date
  ): Promise<AzureActivityEvent[]> {
    const token = await this.getToken();
    const response = await axios.get(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/microsoft.insights/eventtypes/management/values`,
      {
        params: {
          'api-version': '2015-04-01',
          '$filter': `eventTimestamp ge '${since.toISOString()}'
            and category eq 'Administrative'`,
          '$select': 'eventTimestamp,caller,operationName,resourceId,status',
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Şüpheli operasyonları filtrele
    const suspiciousOps = [
      'Microsoft.Network/networkSecurityGroups/write',
      'Microsoft.Storage/storageAccounts/write',
      'Microsoft.KeyVault/vaults/write',
      'Microsoft.Authorization/roleAssignments/write',
      'Microsoft.Compute/virtualMachines/extensions/write',
    ];

    return response.data.value
      .filter(e => suspiciousOps.some(op => e.operationName?.value?.startsWith(op)))
      .map(e => ({
        timestamp: new Date(e.eventTimestamp),
        caller: e.caller,
        operation: e.operationName?.localizedValue,
        resourceId: e.resourceId,
        status: e.status?.value,
      }));
  }
}
```

### 6c — Azure Kurulum Sayfası

```
/hesabim/entegrasyonlarim → Azure Monitor kartı

Azure Monitor Entegrasyonu:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ADIM 1: Action Group Webhook

  Webhook URL:
  https://cyberstep.io/api/integrations/azure/[TOKEN]
  [Kopyala]

  Azure Portal'da:
  Monitor → Alerts → Action Groups → + Create
  Action Type: Webhook → URL'yi girin

  Hangi alert'leri bağlayın:
  [✓] Microsoft Defender for Cloud
  [✓] Activity Log — Administrative işlemler
  [✓] Metric alertler (CPU/Network anomali)
  [ ] Service Health

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ADIM 2 (Opsiyonel): Aktif Sorgulama

  Service Principal (Security Reader rolü yeterli):
  Tenant ID:       [____________________]
  Client ID:       [____________________]
  Client Secret:   [____________________]
  Subscription ID: [____________________]

  [Test Et] [Kaydet]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  KVKK Notu: Azure Turkey North bölgesinde
  çalışıyorsanız verileriniz Türkiye'de kalır.
```

---

## BÖLÜM 7: SOC KORELASYONu — OBSERVABİLİTY + GÜVENLİK

```typescript
// src/soc/observabilityCorrelation.ts
// Observability event'i gelince SOC'la nasıl birleşiyor?

export async function correlateWithSOC(
  customerId: number,
  obsEvent: NormalizedObservabilityEvent
): Promise<void> {

  // Son 30 dakikada aynı müşteride başka event var mı?
  const recentFabricEvents = await db
    .select()
    .from(fabricEvents)
    .where(
      and(
        eq(fabricEvents.customerId, customerId),
        gte(fabricEvents.occurredAt,
            new Date(Date.now() - 30 * 60 * 1000))
      )
    )
    .limit(20);

  const recentSOCCases = await db
    .select()
    .from(socCases)
    .where(
      and(
        eq(socCases.customerId, customerId),
        inArray(socCases.status, ['open', 'investigating']),
        gte(socCases.createdAt,
            new Date(Date.now() - 2 * 60 * 60 * 1000))
      )
    );

  // Mevcut açık SOC case varsa buna yeni bilgi olarak ekle
  if (recentSOCCases.length > 0) {
    const latestCase = recentSOCCases[0];
    await addSOCCaseNote(latestCase.id, {
      source: `${obsEvent.provider} (${obsEvent.affectedService})`,
      content: `Eş zamanlı observability eventi: ${obsEvent.title}. `
        + `Servis: ${obsEvent.affectedService}. `
        + `Bu olay ${obsEvent.provider}'dan geliyor ve SOC olayıyla zaman örtüşüyor.`,
      isAutomatic: true,
    });
    return;
  }

  // Fabric event'le korelasyon var mı?
  if (recentFabricEvents.length > 0 || obsEvent.severity === 'critical') {
    const prompt = `
SOC analisti olarak aşağıdaki iki veri kaynağını değerlendir.

OBSERVABİLİTY (${obsEvent.provider.toUpperCase()}):
  Servis: ${obsEvent.affectedService}
  Olay: ${obsEvent.title}
  Açıklama: ${obsEvent.description}
  Ciddiyet: ${obsEvent.severity}

SON 30 DAKİKA GÜVENLİK OLAYLARI (${recentFabricEvents.length} adet):
${recentFabricEvents.slice(0, 5).map(e =>
  `${e.eventType}: ${e.sourceIp} → ${e.destinationIp}:${e.destinationPort}`
).join('\n')}

Bu iki kaynak arasında anlamlı bir korelasyon var mı?
Uygulama anomalisi ile ağ olayları aynı zaman diliminde mi?

JSON: { "correlated": true/false, "confidence": 0-100,
        "narrative": "1-2 cümle Türkçe", "severity": "critical|high|medium|low" }
`;

    const response = await callClaude(prompt, {
      model: 'claude-haiku-4-5',
      maxTokens: 200,
    });

    const result = JSON.parse(response);

    if (result.correlated && result.confidence > 60) {
      // Yeni SOC case aç
      await createSOCCase({
        customerId,
        severity: result.severity,
        category: 'anomaly',
        title: `${obsEvent.provider} Anomalisi + Ağ Olayı: ${obsEvent.affectedService}`,
        description: result.narrative,
        attackNarrative: result.narrative,
      });
    }
  }
}
```

---

## BÖLÜM 8: ADMİN PANELİ

```
/panel/observability

Sekmeler:
[ Genel Bakış | Datadog | Azure Monitor | Platform Metrikleri ]

─── GENEL BAKIŞ ────────────────────────────────────────────
Bağlı entegrasyon: 4
Son 24s gelen event: 127
SOC'a dönüşen: 8
False positive: 3

─── DATADOG sekmesi ─────────────────────────────────────────
Aktif bağlantılar:
  Müşteri A — 3 webhook, son event: 2 saat önce
  Müşteri B — 1 webhook, son event: 45 dk önce

Event akışı (gerçek zamanlı):
  14:23 Müşteri A  | HIGH | Auth error rate spike
  14:18 Müşteri B  | CRITICAL | Anomaly: auth-service
  ...

─── AZURE MONITOR sekmesi ──────────────────────────────────
Aktif bağlantılar:
  Müşteri C — Defender + Activity Log
  son event: 1 saat önce

Defender alert akışı:
  VM üzerinde şüpheli PowerShell — HIGH
  ...

─── PLATFORM METRİKLERİ sekmesi ────────────────────────────
Grafana iframe embed:
  [Claude AI Maliyet Dashboard'u]
  [SOC Komuta Merkezi]
  [Platform Sağlık]
```

---

## BÖLÜM 9: API ROTALAR

```
POST /api/integrations/datadog/:token     — Datadog webhook
POST /api/integrations/azure/:token       — Azure Monitor webhook
POST /api/integrations/generic/:token     — Genel webhook

GET  /api/portal/integrations/observability        — Bağlı entegrasyonlar
POST /api/portal/integrations/observability        — Yeni entegrasyon ekle
DELETE /api/portal/integrations/observability/:id  — Sil
POST /api/portal/integrations/observability/:id/test — Test event gönder

GET  /metrics                             — Prometheus scrape endpoint
GET  /health                             — Health check (Docker)

GET  /api/admin/observability/events      — Event stream
GET  /api/admin/observability/correlations — Korelasyon listesi
```

---

## BÖLÜM 10: ENVIRONMENT VARIABLES

```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=
GRAFANA_URL=https://monitor.cyberstep.io

# Prometheus
PROMETHEUS_PORT=9090

# Azure (webhook imza doğrulama için)
AZURE_WEBHOOK_SECRET=

# Datadog (opsiyonel — kendi monitoring için)
DD_API_KEY=
DD_APP_KEY=
DD_SITE=datadoghq.com
```

---

## UYGULAMA SIRASI

```
SPRINT 1 (Prometheus + Grafana):
  ✓ /metrics endpoint'i ekle
  ✓ Mevcut koda metrik enstrümantasyonu ekle
    (claude çağrıları, cron job'lar, domain tarama)
  ✓ docker-compose.yml'e Prometheus + Grafana ekle
  ✓ 3 temel dashboard: SOC, AI maliyet, Platform sağlık
  ✓ Alert rules: Claude maliyet, SOC kuyruk, cron durumu
  Test: /metrics endpoint çalışıyor, Grafana veri görüyor

SPRINT 2 (Datadog):
  ✓ observability_integrations + observability_events tablolar
  ✓ POST /api/integrations/datadog/:token endpoint
  ✓ normalizeDatadogEvent() fonksiyonu
  ✓ correlateWithSOC() entegrasyonu
  ✓ Müşteri kurulum sayfası (/hesabim/entegrasyonlarim)
  Test: Datadog'dan test webhook gönder → SOC'ta görün

SPRINT 3 (Azure Monitor):
  ✓ POST /api/integrations/azure/:token endpoint
  ✓ Azure imza doğrulama
  ✓ normalizeAzureEvent() fonksiyonu
  ✓ AzureSecurityReader servisi (opsiyonel)
  ✓ Müşteri kurulum sayfası
  Test: Azure Action Group → test alert → SOC'ta görün
```

---

*CyberStep.io — Observability & Monitoring Entegrasyonları — Mayıs 2026*
