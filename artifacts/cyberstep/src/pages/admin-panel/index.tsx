import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Settings, CreditCard, TrendingUp, TrendingDown,
  CheckCircle, Clock, BarChart3, DollarSign, Globe, Users,
  Database, ChevronDown, ChevronUp, ExternalLink, Info,
  Activity, AlertCircle, Search, Mail, Zap, ShieldAlert,
  ArrowRight, RefreshCw, Cpu, Target, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalAssessments: number; completedAssessments: number;
  thisMonthAssessments: number; lastMonthAssessments: number;
  totalRevenue: number; monthRevenue: number;
  totalKdv: number; monthKdv: number; netRevenue: number;
  avgScore: number; riskDistribution: Record<string, number>;
  pendingReviews: number; totalCustomers?: number;
  activeSubscriptions?: number; totalDomainScans?: number; avgDomainScore?: number;
}
interface MonthlyRow { month: string; assessment_count: number; completed_count: number; }
interface PaymentRow { month: string; revenue: number; kdv: number; }
interface PendingReg { id: number; fullName: string; email: string; companyName: string | null; subscriptionPlan: string | null; createdAt: string; }
interface PendingRegsData { count: number; recent: PendingReg[]; }
interface DailyData {
  domainScans: { last24h: number; total: number; };
  leadCandidates: { last24h: number; total: number; };
  qualifiedLeads: { last24h: number; total: number; };
  teasersGenerated: { last24h: number; total: number; };
  cronJobs: { last24h_runs: number; last24h_errors: number; last_run: { job_name: string; status: string; started_at: string; } | null; };
  discoveryRuns: { last24h_found: number; last24h_added: number; };
}
interface CriticalCron { name: string; label: string; category: string; lastRunAt: string | null; lastStatus: string | null; lastError: string | null; okRuns: number; errorRuns: number; }
interface OpsCenter {
  leadFunnel: { discovered: number; qualified: number; withContact: number; teaserSent: number; contacted: number; converted: number; };
  criticalCronHealth: CriticalCron[];
  cronSummary: { ok: number; error: number; neverRan: number; total: number; };
  reports: { bulletin: { sentAt: string | null; createdAt: string | null } | null; intelligence: { createdAt: string | null } | null; dailySummary: { generatedAt: string | null } | null; };
  todayScans: number;
  sevenDayScans: { day: string; count: number }[];
  comparisons: { yesterdayScans: number; thisWeekLeads: number; lastWeekLeads: number; };
}
interface ExtendedStats { dailyTrend: { day: string; count: number }[]; }
interface RiskDetailRow { id: number; companyName: string; email: string; riskLevel: string; totalScore: number | null; createdAt: string; }
interface RiskDetailData { distribution: Record<string, number>; assessments: RiskDetailRow[]; }

// ─── Utils ────────────────────────────────────────────────────────────────────

function relTime(iso: string | null | undefined): string {
  if (!iso) return "Hiç çalışmadı";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}
function pctOf(n: number, d: number) { return d === 0 ? 0 : Math.round((n / d) * 100); }
function trendPct(now: number, prev: number) {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
}

// ─── Sparkline (tiny inline area chart) ──────────────────────────────────────

function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (!data.length) return <div className="h-10" />;
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Trend Badge ─────────────────────────────────────────────────────────────

function TrendBadge({ pct: p, label = "dün" }: { pct: number; label?: string }) {
  if (p === 0) return <span className="text-slate-500 text-[11px]">değişim yok</span>;
  const up = p > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{p}% {label}e göre
    </span>
  );
}

// ─── Hero KPI Card ────────────────────────────────────────────────────────────

function HeroCard({
  title, value, sub, trend, trendLabel, sparkData, sparkColor, sparkId, icon: Icon, accentColor,
}: {
  title: string; value: string; sub?: string;
  trend?: number; trendLabel?: string;
  sparkData?: number[]; sparkColor?: string; sparkId?: string;
  icon: React.ElementType; accentColor: string;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg bg-slate-700/60`}>
            <Icon className={`h-4 w-4 ${accentColor}`} />
          </div>
          {trend !== undefined && <TrendBadge pct={trend} label={trendLabel} />}
        </div>
        <div className="text-2xl font-bold text-white tracking-tight mb-0.5">{value}</div>
        {sub && <div className="text-slate-500 text-[11px]">{sub}</div>}
        {sparkData && sparkData.length > 1 && sparkColor && sparkId && (
          <div className="mt-3 -mx-1">
            <Sparkline data={sparkData} color={sparkColor} id={sparkId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cron Donut ───────────────────────────────────────────────────────────────

function CronDonut({ ok, error, neverRan }: { ok: number; error: number; neverRan: number }) {
  const data = [
    { name: "OK",          value: ok,      color: "#10b981" },
    { name: "Hata",        value: error,   color: "#ef4444" },
    { name: "Çalışmadı",   value: neverRan,color: "#475569" },
  ].filter(d => d.value > 0);
  const total = ok + error + neverRan;
  if (total === 0) return null;
  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={26} outerRadius={38} dataKey="value" strokeWidth={0}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute text-center pointer-events-none">
        <div className="text-emerald-400 text-sm font-bold">{ok}</div>
        <div className="text-slate-500 text-[9px]">/{total}</div>
      </div>
    </div>
  );
}

// ─── Lead Funnel ─────────────────────────────────────────────────────────────

function FunnelViz({ funnel }: { funnel: OpsCenter["leadFunnel"] }) {
  const steps = [
    { label: "Keşfedilen",     value: funnel.discovered,  colorClass: "bg-sky-500/80",     hex: "#0ea5e9" },
    { label: "Nitelendirilen", value: funnel.qualified,   colorClass: "bg-violet-500/80",  hex: "#8b5cf6" },
    { label: "Kontak Var",     value: funnel.withContact, colorClass: "bg-indigo-500/80",  hex: "#6366f1" },
    { label: "Teaser Gönderildi",value: funnel.teaserSent,colorClass: "bg-amber-500/80",  hex: "#f59e0b" },
    { label: "İletişim",       value: funnel.contacted,   colorClass: "bg-orange-500/80",  hex: "#f97316" },
    { label: "Dönüşüm",        value: funnel.converted,   colorClass: "bg-emerald-500/80", hex: "#10b981" },
  ];
  const max = Math.max(1, funnel.discovered);
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const drop = prev !== null && prev > 0 ? pctOf(s.value, prev) : null;
        const width = Math.max(8, pctOf(s.value, max));
        return (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-[120px] shrink-0 text-right text-slate-400 text-[11px] leading-tight">{s.label}</div>
            <div className="flex-1 h-6 bg-slate-700/40 rounded overflow-hidden relative">
              <div className={`h-full ${s.colorClass} rounded transition-all duration-500`} style={{ width: `${width}%` }} />
            </div>
            <div className="w-12 shrink-0 text-right text-white text-xs font-semibold tabular-nums">
              {s.value.toLocaleString("tr-TR")}
            </div>
            <div className="w-10 shrink-0 text-right">
              {drop !== null ? (
                <span className={`text-[10px] font-medium ${drop >= 50 ? "text-emerald-400" : drop >= 25 ? "text-amber-400" : "text-red-400"}`}>
                  %{drop}
                </span>
              ) : <span className="text-slate-600 text-[10px]">—</span>}
            </div>
          </div>
        );
      })}
      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between text-xs">
        <span className="text-slate-500">Toplam dönüşüm oranı</span>
        <span className="font-bold text-emerald-400">
          %{pctOf(funnel.converted, funnel.discovered)}
          <span className="text-slate-500 font-normal ml-1">({funnel.converted} / {funnel.discovered})</span>
        </span>
      </div>
    </div>
  );
}

// ─── Cron Health Grid ─────────────────────────────────────────────────────────

const CRON_CATEGORY_COLORS: Record<string, string> = {
  lead:   "border-sky-700/60 bg-sky-950/20",
  scan:   "border-emerald-700/60 bg-emerald-950/20",
  intel:  "border-violet-700/60 bg-violet-950/20",
  crm:    "border-amber-700/60 bg-amber-950/20",
  report: "border-indigo-700/60 bg-indigo-950/20",
};

function CronGrid({ crons }: { crons: CriticalCron[] }) {
  return (
    <div className="space-y-1.5">
      {crons.map((c) => {
        const isOk    = c.lastStatus === "ok";
        const isError = c.lastStatus === "error";
        const catCls  = CRON_CATEGORY_COLORS[c.category] ?? "border-slate-700 bg-slate-900";
        return (
          <div key={c.name} className={`border ${catCls} rounded-lg px-3 py-2 flex items-center gap-2`}>
            <div className={`h-2 w-2 rounded-full shrink-0 ${isOk ? "bg-emerald-400" : isError ? "bg-red-500" : "bg-slate-600"}`} />
            <span className="text-slate-300 text-xs flex-1 truncate">{c.label}</span>
            {isError && c.lastError && (
              <span className="text-red-400 text-[10px] truncate max-w-[80px]">{c.lastError}</span>
            )}
            <span className="text-slate-600 text-[10px] shrink-0">{relTime(c.lastRunAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Report Status ────────────────────────────────────────────────────────────

function ReportCard({ label, lastAt, schedule, href, icon: Icon, color }: {
  label: string; lastAt: string | null; schedule: string; href: string;
  icon: React.ElementType; color: string;
}) {
  const stale = !lastAt || (Date.now() - new Date(lastAt).getTime() > 8 * 24 * 60 * 60 * 1000);
  return (
    <a href={href} className="group bg-slate-800/80 border border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-all block">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg bg-slate-700/60`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <Badge className={stale
          ? "bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]"
          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"}>
          {stale ? "Eski" : "Güncel"}
        </Badge>
      </div>
      <p className="text-white text-sm font-semibold mb-1">{label}</p>
      <p className="text-slate-400 text-xs mb-0.5">{relTime(lastAt)}</p>
      <p className="text-slate-600 text-[10px] flex items-center gap-1">
        <Clock className="h-3 w-3" />{schedule}
      </p>
    </a>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const DarkTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value.toLocaleString("tr-TR")}
        </p>
      ))}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => fetch("/api/admin-panel/analytics/overview", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: monthly } = useQuery<{ monthly: MonthlyRow[]; payments: PaymentRow[] }>({
    queryKey: ["admin-monthly"],
    queryFn: () => fetch("/api/admin-panel/analytics/monthly", { credentials: "include" }).then(r => r.json()),
  });
  const { data: daily } = useQuery<DailyData>({
    queryKey: ["admin-daily"],
    queryFn: () => fetch("/api/admin-panel/analytics/daily", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });
  const { data: pendingRegs } = useQuery<PendingRegsData>({
    queryKey: ["admin-pending-regs"],
    queryFn: () => fetch("/api/admin-panel/analytics/pending-registrations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });
  const { data: ops } = useQuery<OpsCenter>({
    queryKey: ["admin-ops-center"],
    queryFn: () => fetch("/api/admin-panel/analytics/ops-center", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });
  const { data: extStats } = useQuery<ExtendedStats>({
    queryKey: ["admin-domain-extended"],
    queryFn: () => fetch("/api/admin-panel/domain-scans/stats/extended", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 120000,
  });

  const [activeRisk, setActiveRisk] = useState<string | null>(null);
  const { data: riskDetail, isLoading: riskDetailLoading } = useQuery<RiskDetailData>({
    queryKey: ["admin-risk-detail"],
    queryFn: () => fetch("/api/admin-panel/analytics/risk-detail", { credentials: "include" }).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const fmtCur = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
  const fmt    = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));

  // Sparkline data from monthly
  const revSparkData  = (monthly?.payments ?? []).map(p => p.revenue);
  const assSparkData  = (monthly?.monthly  ?? []).map(m => m.assessment_count);
  const scanSparkData = (ops?.sevenDayScans ?? []).map(d => d.count);

  // Trend comparisons
  const scanTrend = trendPct(ops?.todayScans ?? 0, ops?.comparisons.yesterdayScans ?? 0);
  const leadTrend = trendPct(ops?.comparisons.thisWeekLeads ?? 0, ops?.comparisons.lastWeekLeads ?? 0);
  const revTrend  = trendPct(overview?.monthRevenue ?? 0, overview?.lastMonthAssessments ?? 0);

  // Revenue + assessment combined chart
  const combinedChart = (monthly?.monthly ?? []).map(m => {
    const pay = monthly?.payments?.find(p => p.month === m.month);
    return { month: m.month.slice(5), assessments: m.assessment_count, gelir: Math.round((pay?.revenue ?? 0) / 1000) };
  });

  // Risk donut
  const riskColors: Record<string, string> = { "Kritik": "#dc2626", "Yüksek": "#ea580c", "Orta": "#f59e0b", "Düşük": "#10b981" };
  const riskDonut = Object.entries(overview?.riskDistribution ?? {}).map(([name, value]) => ({
    name, value, fill: riskColors[name] ?? "#64748b",
  }));

  // 30-day scan area chart
  const scanTrend30 = (extStats?.dailyTrend ?? []).map(d => ({ day: d.day, count: d.count }));

  const cronOkPct = ops?.cronSummary
    ? Math.round((ops.cronSummary.ok / Math.max(1, ops.cronSummary.total)) * 100)
    : null;
  const hasCronError = (ops?.cronSummary?.error ?? 0) > 0;

  return (
    <AdminLayout title="Operasyon Merkezi" description="AI+otomasyon sağlığı, lead hunisi, gelir ve platform durumu">
      <div className="space-y-8">

        {/* ─── Alert bar ─── */}
        {((overview?.pendingReviews ?? 0) > 0 || hasCronError || (pendingRegs?.count ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2">
            {(overview?.pendingReviews ?? 0) > 0 && (
              <button onClick={() => navigate("/panel/degerlendirmeler")}
                className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">
                <Clock className="h-3.5 w-3.5" /> {overview?.pendingReviews} bekleyen rapor
              </button>
            )}
            {hasCronError && (
              <button onClick={() => navigate("/panel/cron-ayarlari")}
                className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">
                <AlertCircle className="h-3.5 w-3.5" /> {ops?.cronSummary.error} kritik cron hatası
              </button>
            )}
            {(pendingRegs?.count ?? 0) > 0 && (
              <button onClick={() => navigate("/panel/musteriler")}
                className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs px-3 py-1.5 rounded-lg hover:bg-sky-500/20 transition-colors">
                <Users className="h-3.5 w-3.5" /> {pendingRegs?.count} bekleyen kayıt
              </button>
            )}
          </div>
        )}

        {/* ─── Hero KPI Row ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-400" />
            Özet Göstergeler
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <HeroCard
              title="Bu Ay Gelir"
              value={fmtCur(overview?.monthRevenue ?? 0)}
              sub={`Toplam: ${fmtCur(overview?.totalRevenue ?? 0)}`}
              trend={trendPct(overview?.monthRevenue ?? 0, (overview?.totalRevenue ?? 0) - (overview?.monthRevenue ?? 0) > 0 ? (overview?.totalRevenue ?? 0) - (overview?.monthRevenue ?? 0) : 0)}
              trendLabel="geçen ay"
              sparkData={revSparkData} sparkColor="#10b981" sparkId="sg-rev"
              icon={DollarSign} accentColor="text-emerald-400"
            />
            <HeroCard
              title="Domain Tarama — Bugün"
              value={fmt(ops?.todayScans ?? daily?.domainScans.last24h ?? 0)}
              sub={`Toplam: ${fmt(daily?.domainScans.total ?? 0)}`}
              trend={scanTrend} trendLabel="dün"
              sparkData={scanSparkData} sparkColor="#0ea5e9" sparkId="sg-scan"
              icon={Globe} accentColor="text-sky-400"
            />
            <HeroCard
              title="Yeni Lead — Bu Hafta"
              value={fmt(ops?.comparisons.thisWeekLeads ?? 0)}
              sub={`Toplam keşfedilen: ${fmt(ops?.leadFunnel.discovered ?? 0)}`}
              trend={leadTrend} trendLabel="geçen hafta"
              sparkData={assSparkData} sparkColor="#8b5cf6" sparkId="sg-lead"
              icon={Search} accentColor="text-violet-400"
            />
            <HeroCard
              title="Aktif Abonelik"
              value={fmt(overview?.activeSubscriptions ?? 0)}
              sub={`${fmt(overview?.totalCustomers ?? 0)} toplam müşteri`}
              icon={Users} accentColor="text-amber-400"
            />
            <HeroCard
              title="Cron Başarı"
              value={cronOkPct !== null ? `%${cronOkPct}` : "—"}
              sub={`${ops?.cronSummary.ok ?? 0} OK · ${ops?.cronSummary.error ?? 0} Hata · ${ops?.cronSummary.neverRan ?? 0} Çalışmadı`}
              icon={hasCronError ? AlertCircle : CheckCircle}
              accentColor={hasCronError ? "text-red-400" : "text-emerald-400"}
            />
          </div>
        </div>

        {/* ─── 30-Day Domain Scan Trend (full-width area chart) ─── */}
        {scanTrend30.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-400" />
                30 Günlük Domain Tarama Trendi
              </h2>
              <button onClick={() => navigate("/panel/domain-taramalar")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                Tüm İstatistikler <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 pt-5">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={scanTrend30} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="gradScan30" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area type="monotone" dataKey="count" name="Tarama" stroke="#0ea5e9" strokeWidth={2} fill="url(#gradScan30)" dot={false} activeDot={{ r: 4, fill: "#0ea5e9" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Lead Funnel + Cron Health (2 columns) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Lead Funnel */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400" />
                Lead Dönüşüm Hunisi
              </h2>
              <div className="flex gap-3">
                <button onClick={() => navigate("/panel/lead-discovery")}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                  Keşif <ArrowRight className="h-3 w-3" />
                </button>
                <button onClick={() => navigate("/panel/lead-gen/queue")}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                  Kuyruk <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                {ops?.leadFunnel ? (
                  <FunnelViz funnel={ops.leadFunnel} />
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-6 bg-slate-700 rounded animate-pulse" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Otomasyon Sağlığı */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-violet-400" />
                Kritik Otomasyon Sağlığı
              </h2>
              <button onClick={() => navigate("/panel/cron-ayarlari")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                Tümü <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-700">
                  {ops?.cronSummary && (
                    <CronDonut ok={ops.cronSummary.ok} error={ops.cronSummary.error} neverRan={ops.cronSummary.neverRan} />
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-slate-300 text-xs">{ops?.cronSummary.ok ?? 0} Başarılı</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-slate-300 text-xs">{ops?.cronSummary.error ?? 0} Hatalı</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-slate-600" />
                      <span className="text-slate-300 text-xs">{ops?.cronSummary.neverRan ?? 0} Hiç çalışmadı</span>
                    </div>
                  </div>
                </div>
                {ops?.criticalCronHealth ? (
                  <CronGrid crons={ops.criticalCronHealth} />
                ) : (
                  <div className="space-y-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-8 bg-slate-700 rounded animate-pulse" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ─── Revenue + Assessment Trend (12 months) ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Gelir & Değerlendirme Trendi — Son 12 Ay
            </h2>
            <button onClick={() => navigate("/panel/gelir")}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
              Gelir Detayı <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 pt-5">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={combinedChart} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#94a3b8" }} />
                  <Line yAxisId="left" type="monotone" dataKey="assessments" name="Değerlendirme" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="gelir" name="Gelir (₺K)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ─── Risk Distribution + Pipeline stats ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Risk donut */}
          <div>
            <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              Risk Dağılımı
              <span className="text-slate-500 font-normal text-xs ml-1">— dilime tıkla → detay</span>
            </h2>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5">
                {riskDonut.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={riskDonut}
                          cx="50%" cy="50%"
                          innerRadius={40} outerRadius={64}
                          dataKey="value"
                          strokeWidth={2} stroke="#1e293b"
                          cursor="pointer"
                          onClick={(entry) => {
                            const name = (entry as { name?: string }).name;
                            if (name) setActiveRisk(activeRisk === name ? null : name);
                          }}
                        >
                          {riskDonut.map((d) => (
                            <Cell
                              key={d.name}
                              fill={d.fill}
                              opacity={activeRisk && activeRisk !== d.name ? 0.35 : 1}
                              stroke={activeRisk === d.name ? "#fff" : "#1e293b"}
                              strokeWidth={activeRisk === d.name ? 2 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {riskDonut.map(({ name, value, fill }) => (
                        <button
                          key={name}
                          onClick={() => setActiveRisk(activeRisk === name ? null : name)}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all text-left ${
                            activeRisk === name
                              ? "bg-slate-700 ring-1 ring-slate-500"
                              : "hover:bg-slate-700/50"
                          }`}
                        >
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fill }} />
                          <span className={`text-sm flex-1 ${activeRisk === name ? "text-white font-medium" : "text-slate-300"}`}>{name}</span>
                          <span className="text-white font-bold text-sm tabular-nums">{value}</span>
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ background: fill, width: `${Math.min(100, pctOf(value, overview?.totalAssessments ?? 1))}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-slate-600 text-sm">Henüz veri yok</div>
                )}

                {/* Drill-down tablo */}
                {activeRisk && (
                  <div className="mt-4 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-700/40 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-medium text-white">
                        {activeRisk} risk —{" "}
                        {riskDetailLoading
                          ? "yükleniyor..."
                          : `${(riskDetail?.assessments ?? []).filter(a => a.riskLevel === activeRisk).length} değerlendirme`}
                      </span>
                      <button onClick={() => setActiveRisk(null)} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                        Kapat
                      </button>
                    </div>
                    {riskDetailLoading ? (
                      <div className="px-4 py-4 text-xs text-slate-500">Yükleniyor...</div>
                    ) : (
                      <div className="overflow-x-auto max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="text-left p-2.5 text-slate-400 font-medium">Şirket</th>
                              <th className="text-left p-2.5 text-slate-400 font-medium">E-posta</th>
                              <th className="text-center p-2.5 text-slate-400 font-medium">Skor</th>
                              <th className="text-left p-2.5 text-slate-400 font-medium">Tarih</th>
                              <th className="p-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {(riskDetail?.assessments ?? [])
                              .filter(a => a.riskLevel === activeRisk)
                              .slice(0, 50)
                              .map(a => (
                                <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                                  <td className="p-2.5 font-medium text-slate-200">{a.companyName}</td>
                                  <td className="p-2.5 text-slate-400">{a.email}</td>
                                  <td className="p-2.5 text-center">
                                    <span className={`font-bold ${
                                      (a.totalScore ?? 0) < 40 ? "text-red-400" :
                                      (a.totalScore ?? 0) < 70 ? "text-amber-400" :
                                      "text-emerald-400"
                                    }`}>{a.totalScore ?? "—"}</span>
                                  </td>
                                  <td className="p-2.5 text-slate-500">
                                    {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                                  </td>
                                  <td className="p-2.5">
                                    <a href={`/panel/degerlendirmeler`} className="text-sky-400 hover:text-sky-300 transition-colors">
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            {(riskDetail?.assessments ?? []).filter(a => a.riskLevel === activeRisk).length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-500">Bu risk seviyesinde değerlendirme yok</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pipeline 24h bar chart */}
          <div>
            <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-sky-400" />
              Son 24 Saat Pipeline
            </h2>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={[
                      { name: "Tarama",  v: daily?.domainScans.last24h      ?? 0, fill: "#0ea5e9" },
                      { name: "Aday",    v: daily?.leadCandidates.last24h    ?? 0, fill: "#8b5cf6" },
                      { name: "Qualify", v: daily?.qualifiedLeads.last24h    ?? 0, fill: "#6366f1" },
                      { name: "Teaser",  v: daily?.teasersGenerated.last24h  ?? 0, fill: "#f59e0b" },
                      { name: "Cron",    v: daily?.cronJobs.last24h_runs     ?? 0, fill: "#10b981" },
                      { name: "Hata",    v: daily?.cronJobs.last24h_errors   ?? 0, fill: "#ef4444" },
                    ]}
                    margin={{ top: 5, right: 5, bottom: 0, left: -15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="v" name="Adet" radius={[3, 3, 0, 0]}>
                      {[
                        { fill: "#0ea5e9" }, { fill: "#8b5cf6" }, { fill: "#6366f1" },
                        { fill: "#f59e0b" }, { fill: "#10b981" }, { fill: "#ef4444" },
                      ].map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700">
                  {[
                    { label: "Tarama",  v: daily?.domainScans.last24h ?? 0,     color: "text-sky-400"     },
                    { label: "Qualify", v: daily?.qualifiedLeads.last24h ?? 0,  color: "text-indigo-400"  },
                    { label: "Cron OK", v: (daily?.cronJobs.last24h_runs ?? 0) - (daily?.cronJobs.last24h_errors ?? 0), color: "text-emerald-400" },
                  ].map(({ label, v, color }) => (
                    <div key={label} className="text-center">
                      <div className={`text-lg font-bold ${color}`}>{v}</div>
                      <div className="text-slate-600 text-[10px]">{label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ─── Report Status ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-indigo-400" />
            Periyodik Rapor Durumu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ReportCard label="Günlük Özet"       lastAt={ops?.reports.dailySummary?.generatedAt ?? null}             schedule="Her sabah 08:00"    href="/panel/gunluk-ozet"  icon={BarChart3} color="text-sky-400"    />
            <ReportCard label="Haftalık Bülten"   lastAt={ops?.reports.bulletin?.sentAt ?? ops?.reports.bulletin?.createdAt ?? null} schedule="Her Cuma 08:00"     href="/panel/bulletin"     icon={Mail}      color="text-violet-400" />
            <ReportCard label="Aylık İstihbarat"  lastAt={ops?.reports.intelligence?.createdAt ?? null}                schedule="Her ayın 1'i"      href="/panel/intelligence" icon={Shield}    color="text-emerald-400" />
          </div>
        </div>

        {/* ─── Quick Access ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-slate-400" />
            Hızlı Erişim
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Domain Taramaları",  desc: "Tarama geçmişi, analitik",      href: "/panel/domain-taramalar",  icon: Globe,        color: "text-emerald-400" },
              { label: "Müşteri Yönetimi",   desc: "Abonelikler, plan atamaları",   href: "/panel/musteriler",        icon: Users,        color: "text-sky-400"     },
              { label: "Growth Engine",      desc: "Tetikleyiciler, kampanyalar",   href: "/panel/growth-engine",     icon: TrendingUp,   color: "text-violet-400"  },
              { label: "Tech Intelligence",  desc: "Sektörel teknoloji dağılımı",   href: "/panel/tech-intelligence", icon: Cpu,          color: "text-amber-400"   },
              { label: "CTI İstihbarat",     desc: "VulnCheck KEV, tehdit besleme", href: "/panel/cti-istihbarat",    icon: ShieldAlert,  color: "text-red-400"     },
              { label: "Gelir Analitik",     desc: "MRR, ARR, fatura durumu",       href: "/panel/gelir",             icon: DollarSign,   color: "text-emerald-400" },
              { label: "Değerlendirmeler",   desc: "Tüm anket sonuçları",           href: "/panel/degerlendirmeler",  icon: FileText,     color: "text-slate-400"   },
              { label: "Ayarlar",            desc: "Site, fiyat, entegrasyon",      href: "/panel/ayarlar",           icon: Settings,     color: "text-slate-400"   },
            ].map(({ label, desc, href, icon: Icon, color }) => (
              <button key={href} onClick={() => navigate(href)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-slate-500 hover:bg-slate-800/80 transition-all group">
                <Icon className={`h-5 w-5 ${color} mb-2`} />
                <div className="text-white font-medium text-xs mb-0.5">{label}</div>
                <div className="text-slate-500 text-[11px]">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Data Sources accordion ─── */}
        <DataSourcesCard />
      </div>
    </AdminLayout>
  );
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

const DATA_SOURCES = [
  {
    tool: "KVKK Ceza Simülatörü", desc: "İdari para cezası hesaplamada kullanılan taban rakamlar",
    sources: [
      { name: "KVK Kurul Karar Özetleri", url: "https://www.kvkk.gov.tr/Icerik/5673/Karar-Ozetleri", note: "Resmi kurul kararları" },
      { name: "Resmi Gazete (mevzuat.gov.tr)", url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5", note: "6698 sayılı KVKK — Madde 18" },
    ],
  },
  {
    tool: "Alan Adı Tarama", desc: "Domain risk skorları ve harici API veri kaynakları",
    sources: [
      { name: "Have I Been Pwned", url: "https://haveibeenpwned.com/API/v3", note: "Sızıntı veritabanı" },
      { name: "VirusTotal API", url: "https://developers.virustotal.com/reference/overview", note: "Domain reputasyon" },
      { name: "AbuseIPDB", url: "https://www.abuseipdb.com/api", note: "IP kötüye kullanım skoru" },
      { name: "USOM (BTK)", url: "https://www.usom.gov.tr", note: "Türkiye kara liste" },
    ],
  },
  {
    tool: "Sektörel Kıyaslama", desc: "Sektör bazlı güvenlik olgunluk ve maliyet verileri",
    sources: [
      { name: "IBM Cost of Data Breach", url: "https://www.ibm.com/reports/data-breach", note: "Yıllık sektörel ihlal maliyeti" },
      { name: "Verizon DBIR", url: "https://www.verizon.com/business/resources/reports/dbir/", note: "Sektör olay dağılımı" },
      { name: "ENISA SME Threat Landscape", url: "https://www.enisa.europa.eu/topics/cyber-threats/threats-and-trends", note: "AB KOBİ tehdit peyzajı" },
    ],
  },
];

function DataSourcesCard() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <Card className="bg-slate-800 border-slate-700">
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-400" />
              <CardTitle className="text-white text-base">Araç Veri Kaynakları & Metodoloji</CardTitle>
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">Sadece Admin</span>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
          <p className="text-slate-500 text-xs pt-1">Müşterilere sunulan hesaplama araçlarının dayandığı kaynak ve metodoloji bilgisi.</p>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-sky-300 text-xs">Aşağıdaki rakamlar periyodik olarak güncel mevzuat ve piyasa koşullarına göre doğrulanmalıdır.</p>
          </div>
          {DATA_SOURCES.map(ds => (
            <div key={ds.tool} className="border border-slate-700 rounded-lg overflow-hidden">
              <button className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded(e => ({ ...e, [ds.tool]: !e[ds.tool] }))}>
                <div>
                  <p className="text-white text-sm font-medium">{ds.tool}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{ds.desc}</p>
                </div>
                {expanded[ds.tool] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {expanded[ds.tool] && (
                <div className="border-t border-slate-700 px-4 py-3 bg-slate-900/50 space-y-2">
                  {ds.sources.map(src => (
                    <div key={src.url} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-200 text-xs font-medium">{src.name}</span>
                          <span className="text-slate-500 text-xs">— {src.note}</span>
                        </div>
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 text-[11px] transition-colors">{src.url}</a>
                      </div>
                      <ExternalLink className="h-3 w-3 text-slate-600 shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
