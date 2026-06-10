import { useState } from "react";
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

interface ScanRow {
  id: number;
  domain: string;
  email: string | null;
  overallScore: number;
  shodanVulnCount: number;
  shodanPortCount: number;
  ctSubdomainCount: number;
  wafDetected: boolean;
  wafProvider: string | null;
  wafBypassPossible: boolean;
  blacklisted: boolean;
  criticalCveCount: number;
  highCveCount: number;
  createdAt: string;
}

interface Scans24h {
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

function Taramalar24h() {
  const { data, isLoading } = useQuery<Scans24h>({
    queryKey: ["admin-scans-24h"],
    queryFn: () => adminFetchJson("/api/admin-panel/analytics/scans-24h"),
    refetchInterval: 120_000,
  });

  const [filter, setFilter] = useState<"all" | "shodan" | "bypass" | "blacklisted" | "lowscore">("all");

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Yükleniyor...</div>;
  if (!data) return null;

  const filtered = data.scans.filter(s => {
    if (filter === "shodan")     return s.shodanVulnCount > 0 || s.shodanPortCount > 0;
    if (filter === "bypass")     return s.wafBypassPossible;
    if (filter === "blacklisted") return s.blacklisted;
    if (filter === "lowscore")   return s.overallScore < 45;
    return true;
  });

  return (
    <section>
      <SectionHeader label="Son 24 Saat — Tarama Aktivitesi" href="/panel/domain-taramalar" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile icon={Globe}   label="Toplam Taranan"  value={data.total}          sub="domain" highlight={data.total > 0} />
        <Tile icon={Search}  label="Shodan Verisi"   value={data.withShodan}     sub="açık port / zafiyet" warn={data.withShodan > 0} />
        <Tile icon={Shield}  label="WAF Bypass Riski" value={data.withBypassRisk} sub="WAF arkası erişim" warn={data.withBypassRisk > 0} />
        <Tile icon={AlertTriangle} label="Kara Liste / Kritik CVE" value={data.blacklisted + data.criticalCve} warn={(data.blacklisted + data.criticalCve) > 0} />
      </div>

      {/* Araç breakdown */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Subdomain Tespiti", value: data.withSubdomains, key: "shodan" as const },
          { label: "WAF Tespit Edilen", value: data.withWafDetected, key: "all" as const },
          { label: "Düşük Skor (<45)", value: data.lowScore, key: "lowscore" as const },
          { label: "Kara Listede", value: data.blacklisted, key: "blacklisted" as const },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => setFilter(f => f === item.key ? "all" : item.key)}
            className={`text-left rounded-lg border p-2.5 transition-colors ${filter === item.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
          >
            <div className="text-lg font-bold text-foreground">{item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </button>
        ))}
      </div>

      {data.total > 0 && (
        <Drilldown label="Domain listesini gör" count={filtered.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Domain</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Skor</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Shodan</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">Subdomain</th>
                  <th className="text-center p-2.5 text-muted-foreground font-medium">WAF</th>
                  <th className="text-left p-2.5 text-muted-foreground font-medium">Tarandı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(0, 100).map(s => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5">
                      <div className="font-mono font-medium text-foreground">{s.domain}</div>
                      {s.email && <div className="text-muted-foreground text-[10px]">{s.email}</div>}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`font-bold ${scoreColor(s.overallScore)}`}>{s.overallScore}</span>
                    </td>
                    <td className="p-2.5 text-center">
                      {s.shodanVulnCount > 0 || s.shodanPortCount > 0 ? (
                        <span className="text-orange-400 font-medium">
                          {s.shodanVulnCount}v / {s.shodanPortCount}p
                        </span>
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
                          {s.wafProvider ?? "WAF"}{s.wafBypassPossible ? " ⚠" : " ✓"}
                        </span>
                      ) : <span className="text-muted-foreground text-[10px]">Yok</span>}
                    </td>
                    <td className="p-2.5 text-muted-foreground">{timeAgo(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <div className="p-2.5 text-center text-xs text-muted-foreground border-t border-border">
                +{filtered.length - 100} daha — tam liste için <a href="/panel/domain-taramalar" className="text-primary hover:underline">domain taramalar</a> sayfasına gidin.
              </div>
            )}
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
      {filtered.length > 0 && (
        <div className="mt-3 rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {activeRisk ? `${RISK_LABEL[activeRisk]} risk — ${filtered.length} değerlendirme` : `Tüm değerlendirmeler (${filtered.length})`}
            </span>
            {activeRisk && (
              <button onClick={() => setActiveRisk(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Filtreyi kaldır
              </button>
            )}
          </div>
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
        </div>
      )}
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
