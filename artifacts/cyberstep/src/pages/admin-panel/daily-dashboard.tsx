import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Shield, Activity, TrendingUp, Globe, Search, ExternalLink,
  Clock, RefreshCw, AlertCircle, BarChart3, Newspaper, Share2,
  BookOpen, Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CronAlert {
  job_name: string;
  label: string;
  issue: "not_run" | "failed" | "slow";
  last_run: string | null;
  details: string;
}

interface CronHealthResult {
  healthy: boolean;
  checked_at: string;
  summary: { total_jobs: number; successful: number; failed: number; missing: number; slow: number };
  alerts: CronAlert[];
}

interface ShodanPort {
  port: number;
  protocol: string;
  service: string;
  product: string;
  version: string;
}

interface CveSummaryItem {
  service: string;
  cveId: string;
  description: string;
  cvssScore: number;
  wafMitigated?: boolean;
}

interface HibpBreach {
  name: string;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
}

interface ScanRow {
  id: number;
  domain: string;
  email: string | null;
  overallScore: number;
  confidenceScore: number | null;
  confidenceNote: string | null;
  // Shodan
  shodanVulnCount: number;
  shodanOpenPorts: ShodanPort[];
  shodanCountry: string | null;
  shodanIsp: string | null;
  // CVE
  criticalCveCount: number;
  highCveCount: number;
  cveSummary: CveSummaryItem[];
  // WAF
  wafDetected: boolean;
  wafProvider: string | null;
  wafBypassPossible: boolean;
  originIp: string | null;
  wafConfidence: number | null;
  // Subdomains
  ctSubdomainCount: number;
  ctSubdomains: string[];
  // HIBP
  hibpBreachCount: number;
  hibpBreaches: HibpBreach[];
  // Blacklist / rep
  blacklisted: boolean;
  blacklistCount: number;
  virusTotalMalicious: number;
  abuseIpdbScore: number | null;
  urlhausListed: boolean;
  // Meta
  hostingProvider: string | null;
  sector: string | null;
  createdAt: string;
}

interface Scans24h {
  dbTotal: number;
  yesterdayTotal: number;
  yesterdayShodan: number;
  total: number;
  withShodan: number;
  withSubdomains: number;
  withWafDetected: number;
  withBypassRisk: number;
  blacklisted: number;
  criticalCve: number;
  lowScore: number;
  scans: ScanRow[];
}

interface AssessmentRow {
  id: number;
  companyName: string;
  email: string;
  riskLevel: string;
  totalScore: number | null;
  createdAt: string;
}

interface RiskDetail {
  distribution: Record<string, number>;
  assessments: AssessmentRow[];
}

interface MarketingData {
  social: {
    pending: number;
    approvedLast24h: number;
    publishedLast7d: number;
    byPlatform: Record<string, number>;
  };
  bulletin: {
    totalActive: number;
    newLast30d: number;
    lastBulletin: {
      weekNumber: number;
      year: number;
      status: string;
      sentAt: string | null;
      recipientCount: number | null;
      openRate: number | null;
      clickRate: number | null;
    } | null;
  };
  blog: {
    drafts: number;
    publishedLast30d: number;
    total: number;
  };
}

interface DailyAnalytics {
  domainScans: { last24h: number; total: number };
  leadCandidates: { last24h: number; total: number };
  qualifiedLeads: { last24h: number; total: number };
  teasersGenerated: { last24h: number; total: number };
  cronJobs: {
    last24h_runs: number;
    last24h_errors: number;
    last_run: { job_name: string; status: string; started_at: string } | null;
  };
  discoveryRuns: { last24h_found: number; last24h_added: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 45) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-red-500/10 border-red-500/30";
}

const RISK_ORDER = ["kritik", "yüksek", "orta", "düşük"];
const RISK_LABEL: Record<string, string> = { kritik: "Kritik", yüksek: "Yüksek", orta: "Orta", düşük: "Düşük" };
const RISK_COLOR: Record<string, string> = {
  kritik: "text-red-400 border-red-500/30 bg-red-500/10",
  yüksek: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  orta:   "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  düşük:  "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, href, status }: { label: string; href?: string; status?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-0.5 h-4 bg-primary rounded-full" />
        <h2 className="text-xs font-bold text-primary uppercase tracking-[0.18em]">{label}</h2>
        {status}
      </div>
      {href && (
        <a href={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          Detay <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ─── Collapsible drilldown wrapper ────────────────────────────────────────────

function Drilldown({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-primary hover:underline"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label}{count !== undefined ? ` (${count})` : ""}
      </button>
      {open && <div className="mt-3 rounded-xl border border-border overflow-hidden">{children}</div>}
    </div>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function Tile({
  label, value, sub, icon: Icon, warn, highlight, dim,
}: {
  label: string; value: string | number; sub?: string;
  icon?: React.ElementType; warn?: boolean; highlight?: boolean; dim?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 ${
      warn      ? "border-red-800 bg-red-950/20" :
      highlight ? "border-primary/40 bg-primary/5" :
      dim       ? "border-border/40 bg-muted/30" :
                  "border-border bg-card"
    }`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`h-3.5 w-3.5 ${warn ? "text-red-400" : "text-primary"}`} />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${warn ? "text-red-400" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── 1. Otomasyon Sağlığı ─────────────────────────────────────────────────────

function OtomasyonSagligi() {
  const { data, isLoading } = useQuery<CronHealthResult>({
    queryKey: ["admin-cron-health-dashboard"],
    queryFn: () => adminFetchJson("/api/admin-panel/cron/health"),
    refetchInterval: 60_000,
  });
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const { summary, alerts } = data;
  const failedAlerts  = alerts.filter(a => a.issue === "failed");
  const missingAlerts = alerts.filter(a => a.issue === "not_run");
  const slowAlerts    = alerts.filter(a => a.issue === "slow");

  const issueIcon = (issue: CronAlert["issue"]) =>
    issue === "failed"  ? <XCircle className="h-4 w-4 text-red-400 shrink-0" /> :
    issue === "not_run" ? <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" /> :
                         <Clock className="h-4 w-4 text-yellow-400 shrink-0" />;

  const issueLabel = (issue: CronAlert["issue"]) =>
    issue === "failed" ? "Hata" : issue === "not_run" ? "Çalışmadı" : "Yavaş";

  const issueBadge = (issue: CronAlert["issue"]) =>
    issue === "failed"  ? "bg-red-500/20 text-red-400 border-red-500/30" :
    issue === "not_run" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                          "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  return (
    <section>
      <SectionHeader
        label="Otomasyon Sağlığı"
        href="/panel/cron-ayarlari"
        status={
          summary.failed + summary.missing > 0
            ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">{summary.failed + summary.missing} sorun</Badge>
            : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Sağlıklı</Badge>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile icon={Activity}    label="Toplam Job" value={summary.total_jobs} />
        <Tile icon={CheckCircle} label="Yeşil"      value={summary.successful} highlight={summary.successful > 0} />
        <Tile icon={XCircle}     label="Hatalı"     value={summary.failed}    warn={summary.failed > 0} />
        <Tile icon={AlertCircle} label="Çalışmadı"  value={summary.missing}   warn={summary.missing > 0} />
      </div>

      {alerts.length > 0 && (
        <Drilldown label="Sorunlu job'ları göster" count={alerts.length}>
          <div className="divide-y divide-border">
            {[...failedAlerts, ...missingAlerts, ...slowAlerts].map(alert => {
              const isExpanded = expandedJob === alert.job_name;
              return (
                <div key={alert.job_name} className="p-3">
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : alert.job_name)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    {issueIcon(alert.issue)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{alert.label}</span>
                        <Badge variant="outline" className={`text-[10px] border ${issueBadge(alert.issue)}`}>
                          {issueLabel(alert.issue)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{alert.job_name}</span>
                      </div>
                      {/* Özet mesaj — her zaman görünür */}
                      <p className={`text-xs text-muted-foreground mt-0.5 ${isExpanded ? "" : "line-clamp-1"}`}>
                        {alert.details}
                      </p>
                      {!isExpanded && alert.details.length > 80 && (
                        <span className="text-xs text-primary">Tamamını gör</span>
                      )}
                      {isExpanded && (
                        <div className="mt-2 rounded-lg bg-muted/50 border border-border p-2.5">
                          <p className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                            {alert.details}
                          </p>
                          {alert.last_run && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              Son çalışma: {fmtDate(alert.last_run)} ({timeAgo(alert.last_run)})
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </Drilldown>
      )}
    </section>
  );
}

// ─── 2. Son 24 Saat Taramalar ─────────────────────────────────────────────────

function ScanDetailPanel({ s }: { s: ScanRow }) {
  const hasPorts  = s.shodanOpenPorts.length > 0;
  const hasCves   = s.cveSummary.length > 0;
  const hasSubs   = s.ctSubdomains.length > 0;
  const hasBreaches = s.hibpBreaches.length > 0;
  const nothing   = !hasPorts && !hasCves && !hasSubs && !hasBreaches && !s.wafBypassPossible && !s.blacklisted;

  if (nothing) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground bg-muted/20">
        Bu domain için ek bulgu kaydedilmedi.
      </div>
    );
  }

  return (
    <div className="bg-muted/10 border-t border-border px-4 py-3 space-y-3 text-xs">

      {/* Üst meta satırı */}
      <div className="flex flex-wrap gap-4 text-muted-foreground">
        {s.email && <span>İletişim: <span className="text-foreground font-medium">{s.email}</span></span>}
        {s.sector && <span>Sektör: <span className="text-foreground">{s.sector}</span></span>}
        {s.hostingProvider && <span>Hosting: <span className="text-foreground">{s.hostingProvider}</span></span>}
        {s.shodanCountry && <span>Lokasyon: <span className="text-foreground">{s.shodanCountry} {s.shodanIsp ? `— ${s.shodanIsp}` : ""}</span></span>}
        {s.confidenceScore != null && (
          <span>Güven skoru: <span className={`font-bold ${s.confidenceScore >= 70 ? "text-emerald-400" : s.confidenceScore >= 40 ? "text-yellow-400" : "text-red-400"}`}>{s.confidenceScore}</span>
            {s.confidenceNote && <span className="text-muted-foreground"> ({s.confidenceNote})</span>}
          </span>
        )}
      </div>

      {/* WAF Bypass */}
      {s.wafBypassPossible && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-2.5">
          <div className="font-bold text-red-400 mb-1">WAF Bypass Riski</div>
          <div className="text-muted-foreground">
            Koruyucu: <span className="text-foreground">{s.wafProvider ?? "Bilinmiyor"}</span>
            {s.wafConfidence != null && <span className="ml-2">Güven: {s.wafConfidence}%</span>}
            {s.originIp && <span className="ml-3">Gerçek IP: <span className="font-mono text-orange-400">{s.originIp}</span></span>}
          </div>
        </div>
      )}

      {/* Kara liste */}
      {s.blacklisted && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-2.5">
          <div className="font-bold text-red-400 mb-1">Kara Listede ({s.blacklistCount} liste)</div>
          <div className="flex flex-wrap gap-2 text-muted-foreground">
            {s.urlhausListed && <span className="text-red-400">URLhaus</span>}
            {s.virusTotalMalicious > 0 && <span className="text-red-400">VirusTotal: {s.virusTotalMalicious} zararlı</span>}
            {s.abuseIpdbScore != null && s.abuseIpdbScore > 0 && <span className="text-orange-400">AbuseIPDB: {s.abuseIpdbScore}%</span>}
          </div>
        </div>
      )}

      {/* CVE'ler */}
      {hasCves && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">
            CVE Bulguları
            {s.criticalCveCount > 0 && <span className="ml-2 text-red-400">({s.criticalCveCount} kritik</span>}
            {s.highCveCount > 0 && <span className={s.criticalCveCount > 0 ? "" : "ml-2"}>{s.criticalCveCount > 0 ? ", " : "("}{s.highCveCount} yüksek</span>}
            {(s.criticalCveCount > 0 || s.highCveCount > 0) && <span>)</span>}
          </div>
          <div className="space-y-1">
            {s.cveSummary.slice(0, 8).map((cve, i) => (
              <div key={i} className="flex items-start gap-2 rounded bg-muted/30 px-2 py-1.5">
                <span className={`shrink-0 font-mono font-bold ${cve.cvssScore >= 9 ? "text-red-400" : cve.cvssScore >= 7 ? "text-orange-400" : "text-yellow-400"}`}>
                  {cve.cvssScore.toFixed(1)}
                </span>
                <span className="font-mono text-primary shrink-0">{cve.cveId}</span>
                <span className="text-muted-foreground">{cve.service && <span className="text-foreground">[{cve.service}] </span>}{cve.description}</span>
                {cve.wafMitigated && <span className="ml-auto shrink-0 text-emerald-400 text-[10px]">WAF azaltıyor</span>}
              </div>
            ))}
            {s.cveSummary.length > 8 && (
              <div className="text-muted-foreground text-[10px] pl-2">+{s.cveSummary.length - 8} CVE daha...</div>
            )}
          </div>
        </div>
      )}

      {/* Açık portlar */}
      {hasPorts && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">Açık Portlar ({s.shodanOpenPorts.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {s.shodanOpenPorts.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border border-orange-800 bg-orange-950/30 px-2 py-0.5 font-mono">
                <span className="text-orange-400 font-bold">{p.port}</span>
                <span className="text-muted-foreground">{p.protocol}</span>
                {p.product && <span className="text-foreground">{p.product}{p.version ? ` ${p.version}` : ""}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Subdomain'ler */}
      {hasSubs && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">
            Subdomain'ler ({s.ctSubdomainCount} toplam{s.ctSubdomainCount > s.ctSubdomains.length ? `, ${s.ctSubdomains.length} gösteriliyor` : ""})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.ctSubdomains.map((sub, i) => (
              <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">{sub}</span>
            ))}
          </div>
        </div>
      )}

      {/* HIBP ihlaller */}
      {hasBreaches && (
        <div>
          <div className="font-semibold text-foreground mb-1.5">Veri İhlali ({s.hibpBreachCount} kayıt)</div>
          <div className="space-y-1">
            {s.hibpBreaches.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-3 rounded bg-muted/30 px-2 py-1">
                <span className="font-medium text-foreground">{b.name}</span>
                <span className="text-muted-foreground">{b.breachDate}</span>
                <span className="text-orange-400">{b.pwnCount.toLocaleString("tr-TR")} hesap</span>
                <span className="text-muted-foreground text-[10px]">{b.dataClasses.slice(0, 3).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Taramalar24h() {
  const { data, isLoading } = useQuery<Scans24h>({
    queryKey: ["admin-scans-24h"],
    queryFn: () => adminFetchJson("/api/admin-panel/analytics/scans-24h"),
    refetchInterval: 120_000,
  });

  const [filter, setFilter]     = useState<"all" | "shodan" | "bypass" | "blacklisted" | "lowscore">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const filtered = data.scans.filter(s => {
    if (filter === "shodan")      return s.shodanVulnCount > 0 || s.shodanOpenPorts.length > 0;
    if (filter === "bypass")      return s.wafBypassPossible;
    if (filter === "blacklisted") return s.blacklisted;
    if (filter === "lowscore")    return s.overallScore < 45;
    return true;
  });

  return (
    <section>
      <SectionHeader label="Domain Tarama Aktivitesi" href="/panel/domain-taramalar" />

      {/* Üst 4 ana stat — DB toplam prominent */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile icon={Globe}         label="DB'de Toplam"       value={data.dbTotal}           sub="domain scan kaydı" highlight />
        <Tile icon={Clock}         label="Son 24 Saat"         value={data.total}             sub="yeni tarama" highlight={data.total > 0} />
        <Tile icon={Activity}      label="Dün Taranan"         value={data.yesterdayTotal}    sub={`Shodan verili: ${data.yesterdayShodan}`} />
        <Tile icon={AlertTriangle} label="Kara Liste / CVE"    value={data.blacklisted + data.criticalCve} warn={(data.blacklisted + data.criticalCve) > 0} />
      </div>

      {/* Filtre butonları */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { label: "Shodan Verisi", value: data.withShodan, key: "shodan" as const, warn: data.withShodan > 0 },
          { label: "WAF Bypass Riski", value: data.withBypassRisk, key: "bypass" as const, warn: data.withBypassRisk > 0 },
          { label: "Düşük Skor (<45)", value: data.lowScore, key: "lowscore" as const, warn: false },
          { label: "Kara Listede", value: data.blacklisted, key: "blacklisted" as const, warn: data.blacklisted > 0 },
        ] as const).map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(f => f === item.key ? "all" : item.key)}
            className={`text-left rounded-lg border p-2.5 transition-colors ${
              filter === item.key
                ? "border-primary bg-primary/10"
                : item.warn
                  ? "border-orange-800 bg-orange-950/20 hover:border-orange-600"
                  : "border-border hover:border-primary/40"
            }`}
          >
            <div className={`text-lg font-bold ${item.warn && item.value > 0 ? "text-orange-400" : "text-foreground"}`}>{item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </button>
        ))}
      </div>

      {data.total > 0 && (
        <Drilldown label={`Domain listesini gör (en riskli önce)`} count={filtered.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-2.5 text-muted-foreground font-medium w-6" />
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Domain</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Skor</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">CVE</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Portlar</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Subdomain</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">WAF</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">İhlal</th>
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Tarandı</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(s => {
                  const isOpen = expanded.has(s.id);
                  const hasBulgu = s.shodanOpenPorts.length > 0 || s.cveSummary.length > 0 || s.ctSubdomains.length > 0 || s.hibpBreaches.length > 0 || s.wafBypassPossible || s.blacklisted;
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleExpand(s.id)}
                        className={`border-b border-border transition-colors cursor-pointer select-none ${isOpen ? "bg-muted/30" : "hover:bg-muted/20"}`}
                      >
                        <td className="p-2.5 text-center">
                          {hasBulgu
                            ? (isOpen ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)
                            : <span className="text-muted-foreground/30 text-[10px]">—</span>}
                        </td>
                        <td className="p-2.5">
                          <div className="font-mono font-medium text-slate-100">{s.domain}</div>
                          {s.email && <div className="text-slate-400 text-[10px]">{s.email}</div>}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`font-bold text-sm ${scoreColor(s.overallScore)}`}>{s.overallScore}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          {s.criticalCveCount > 0 || s.highCveCount > 0 ? (
                            <span className="font-medium">
                              {s.criticalCveCount > 0 && <span className="text-red-400">{s.criticalCveCount}K</span>}
                              {s.criticalCveCount > 0 && s.highCveCount > 0 && <span className="text-muted-foreground"> / </span>}
                              {s.highCveCount > 0 && <span className="text-orange-400">{s.highCveCount}Y</span>}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.shodanOpenPorts.length > 0 ? (
                            <span className="text-orange-400 font-medium">{s.shodanOpenPorts.length}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.ctSubdomainCount > 0
                            ? <span className="text-primary">{s.ctSubdomainCount}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.wafDetected ? (
                            <span className={`text-[10px] font-medium ${s.wafBypassPossible ? "text-red-400" : "text-emerald-400"}`}>
                              {s.wafProvider ?? "WAF"}{s.wafBypassPossible ? " !" : " ✓"}
                            </span>
                          ) : <span className="text-muted-foreground text-[10px]">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {s.hibpBreachCount > 0
                            ? <span className="text-orange-400 font-medium">{s.hibpBreachCount}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">{timeAgo(s.createdAt)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border">
                          <td colSpan={9} className="p-0">
                            <ScanDetailPanel s={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <div className="p-2.5 text-center text-xs text-muted-foreground border-t border-border">
                +{filtered.length - 100} daha — tam liste için <a href="/panel/domain-taramalar" className="text-primary hover:underline">domain taramalar</a> sayfasına gidin.
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-muted/20 border-t border-border text-[10px] text-muted-foreground">
            Satıra tıklayarak ayrıntılı bulguları (portlar, CVE'ler, subdomain'ler, veri ihlalleri) görüntüleyebilirsiniz.
          </div>
        </Drilldown>
      )}
    </section>
  );
}

// ─── 3. Risk Dağılımı ─────────────────────────────────────────────────────────

function RiskDagilimi() {
  const { data, isLoading } = useQuery<RiskDetail>({
    queryKey: ["admin-risk-detail"],
    queryFn: () => adminFetchJson("/api/admin-panel/analytics/risk-detail"),
    staleTime: 5 * 60_000,
  });

  const [activeRisk, setActiveRisk] = useState<string | null>(null);

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const dist = data.distribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const filtered = activeRisk ? data.assessments.filter(a => a.riskLevel === activeRisk) : data.assessments;

  return (
    <section>
      <SectionHeader label="Risk Dağılımı" href="/panel/degerlendirmeler"
        status={<span className="text-xs text-muted-foreground">{total} değerlendirme</span>}
      />

      {/* Risk bar kartları — tıklanınca filtreler */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RISK_ORDER.map(level => {
          const cnt = dist[level] ?? 0;
          const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
          const isActive = activeRisk === level;
          return (
            <button
              key={level}
              onClick={() => setActiveRisk(isActive ? null : level)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isActive ? `border-primary ring-1 ring-primary ${RISK_COLOR[level]}` : `border-border bg-card hover:border-primary/40`
              }`}
            >
              <div className={`text-2xl font-bold ${RISK_COLOR[level].split(" ")[0]}`}>{cnt}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{RISK_LABEL[level]}</div>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    level === "kritik" ? "bg-red-500" : level === "yüksek" ? "bg-orange-500" : level === "orta" ? "bg-yellow-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{pct}%</div>
            </button>
          );
        })}
      </div>

      {/* Drilldown tablo */}
      <div className="mt-3 rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {activeRisk
              ? `${RISK_LABEL[activeRisk]} risk — ${filtered.length} değerlendirme`
              : `Tüm değerlendirmeler (${filtered.length})`}
          </span>
          {activeRisk && (
            <button onClick={() => setActiveRisk(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Filtreyi kaldır
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {activeRisk
              ? `${RISK_LABEL[activeRisk]} riskli tamamlanmış değerlendirme bulunamadı.`
              : "Henüz tamamlanmış değerlendirme yok."}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Şirket</th>
                  <th className="text-left p-2.5 text-muted-foreground font-medium">E-posta</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Risk</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Skor</th>
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(0, 100).map(a => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium text-foreground">{a.companyName}</td>
                    <td className="p-2.5 text-muted-foreground">{a.email}</td>
                    <td className="p-2.5 text-center">
                      <Badge variant="outline" className={`text-[10px] border ${RISK_COLOR[a.riskLevel] ?? ""}`}>
                        {RISK_LABEL[a.riskLevel] ?? a.riskLevel}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`font-bold ${scoreColor(a.totalScore ?? 0)}`}>
                        {a.totalScore ?? "—"}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground">{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── 4. Pipeline (Son 24 Saat) ────────────────────────────────────────────────

function Pipeline24h() {
  const { data, isLoading } = useQuery<DailyAnalytics>({
    queryKey: ["admin-daily-analytics"],
    queryFn: () => adminFetchJson("/api/admin-panel/analytics/daily"),
    refetchInterval: 120_000,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const hasErrors = data.cronJobs.last24h_errors > 0;

  return (
    <section>
      <SectionHeader label="Pipeline — Son 24 Saat"
        status={hasErrors
          ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">{data.cronJobs.last24h_errors} cron hatası</Badge>
          : null}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile icon={Activity}     label="Cron Çalışma"   value={data.cronJobs.last24h_runs}    sub="son 24s" highlight />
        <Tile icon={XCircle}      label="Cron Hatası"    value={data.cronJobs.last24h_errors}  warn={hasErrors} sub={hasErrors ? "Otomasyon sağlığı'na bak" : "hata yok"} />
        <Tile icon={Globe}        label="Domain Tarama"  value={data.domainScans.last24h}       sub={`toplam: ${data.domainScans.total}`} />
        <Tile icon={Search}       label="Aday Lead"      value={data.leadCandidates.last24h}    sub={`toplam: ${data.leadCandidates.total}`} />
        <Tile icon={CheckCircle}  label="Nitelendirilen" value={data.qualifiedLeads.last24h}    sub="lead" highlight={data.qualifiedLeads.last24h > 0} />
        <Tile icon={TrendingUp}   label="Teaser Oluştu"  value={data.teasersGenerated.last24h}  sub="e-posta" highlight={data.teasersGenerated.last24h > 0} />
      </div>
      {data.cronJobs.last_run && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-3 w-3" />
          Son cron: <span className="font-mono">{data.cronJobs.last_run.job_name}</span>
          <Badge variant="outline" className={`text-[10px] border ${data.cronJobs.last_run.status === "ok" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {data.cronJobs.last_run.status}
          </Badge>
          <span>{timeAgo(data.cronJobs.last_run.started_at)}</span>
        </div>
      )}
      {hasErrors && (
        <a href="/panel/cron-ayarlari" className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:underline">
          <AlertTriangle className="h-3 w-3" />
          Hataları görmek için Otomasyon Sağlığı bölümünü veya Cron Ayarları sayfasını açın
        </a>
      )}
    </section>
  );
}

// ─── 5. Pazarlama & İçerik ────────────────────────────────────────────────────

function PazarlamaIcerik() {
  const { data, isLoading } = useQuery<MarketingData>({
    queryKey: ["admin-marketing"],
    queryFn: () => adminFetchJson("/api/admin-panel/analytics/marketing"),
    staleTime: 5 * 60_000,
    refetchInterval: 300_000,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const lb = data.bulletin.lastBulletin;
  const platforms = Object.entries(data.social.byPlatform);

  return (
    <section>
      <SectionHeader label="Pazarlama & İçerik" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sosyal medya */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Sosyal Medya</h3>
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Onay Bekleyen</span>
              <span className={`text-sm font-bold ${data.social.pending > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {data.social.pending}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Bugün Onaylanan</span>
              <span className="text-sm font-bold text-foreground">{data.social.approvedLast24h}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Son 7g Yayınlanan</span>
              <span className={`text-sm font-bold ${data.social.publishedLast7d > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                {data.social.publishedLast7d}
              </span>
            </div>
          </div>
          {platforms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {platforms.map(([p, cnt]) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                  {p} {cnt}
                </span>
              ))}
            </div>
          )}
          <a href="/panel/sosyal-medya" className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Sosyal medya paneli
          </a>
        </div>

        {/* Bülten */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">CISO Bülteni</h3>
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Aktif Abone</span>
              <span className="text-sm font-bold text-foreground">{data.bulletin.totalActive.toLocaleString("tr-TR")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Son 30g Yeni</span>
              <span className={`text-sm font-bold ${data.bulletin.newLast30d > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                +{data.bulletin.newLast30d}
              </span>
            </div>
            {lb && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Son Bülten</span>
                  <Badge variant="outline" className={`text-[10px] border ${lb.status === "sent" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"}`}>
                    H{lb.weekNumber}/{lb.year} — {lb.status === "sent" ? "Gönderildi" : lb.status}
                  </Badge>
                </div>
                {lb.recipientCount != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Alıcı / Açılma</span>
                    <span className="text-xs font-bold text-foreground">
                      {lb.recipientCount.toLocaleString("tr-TR")}
                      {lb.openRate != null && <span className="text-primary"> · %{lb.openRate.toFixed(1)}</span>}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <a href="/panel/bulletin" className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Bülten paneli
          </a>
        </div>

        {/* Blog */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Blog</h3>
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Taslak</span>
              <span className={`text-sm font-bold ${data.blog.drafts > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                {data.blog.drafts}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Son 30g Yayınlanan</span>
              <span className={`text-sm font-bold ${data.blog.publishedLast30d > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                {data.blog.publishedLast30d}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Toplam Yazı</span>
              <span className="text-sm font-bold text-foreground">{data.blog.total}</span>
            </div>
          </div>
          <a href="/panel/blog" className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Blog yönetimi
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── 6. Kenar Bar — Hızlı Linkler ─────────────────────────────────────────────

const QUICK_LINKS = [
  { label: "Domain Taramalar",  href: "/panel/domain-taramalar" },
  { label: "Cron Ayarları",     href: "/panel/cron-ayarlari" },
  { label: "Değerlendirmeler",  href: "/panel/degerlendirmeler" },
  { label: "Müşteri Sağlığı",   href: "/panel/saglik" },
  { label: "CVE İzleme",        href: "/panel/cve" },
  { label: "Lead Keşif",        href: "/panel/lead-discovery" },
  { label: "Platform Sağlık",   href: "/panel/platform-saglik" },
  { label: "Analizler",         href: "/panel/analizler" },
];

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function DailyDashboard() {
  return (
    <AdminLayout
      title="Son 24 Saat"
      description="Operasyon özeti — tarama aktivitesi, otomasyon sağlığı, risk dağılımı, pipeline"
    >
      <div className="flex gap-6">
        {/* Ana içerik */}
        <div className="flex-1 min-w-0 space-y-8 max-w-5xl">

          {/* Otomasyon Sağlığı — En kritik, en üstte */}
          <OtomasyonSagligi />

          <div className="border-t border-border" />

          {/* Tarama Aktivitesi */}
          <Taramalar24h />

          <div className="border-t border-border" />

          {/* Risk Dağılımı */}
          <RiskDagilimi />

          <div className="border-t border-border" />

          {/* Pipeline */}
          <Pipeline24h />

          <div className="border-t border-border" />

          {/* Pazarlama & İçerik */}
          <PazarlamaIcerik />

        </div>

        {/* Kenar — Hızlı Linkler */}
        <aside className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-6 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Hızlı Erişim</p>
            {QUICK_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <BarChart3 className="h-3 w-3 shrink-0" />
                {l.label}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
