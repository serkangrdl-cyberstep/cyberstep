import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Settings, CreditCard,
  TrendingUp, CheckCircle, Clock,
  BarChart3, DollarSign, Globe, Users,
  Database, ChevronDown, ChevronUp, ExternalLink, Info,
  Activity, AlertCircle, Search, Mail, Zap, ShieldAlert,
  ArrowRight, RefreshCw, Cpu, Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalAssessments: number;
  completedAssessments: number;
  thisMonthAssessments: number;
  lastMonthAssessments: number;
  totalRevenue: number;
  monthRevenue: number;
  totalKdv: number;
  monthKdv: number;
  netRevenue: number;
  avgScore: number;
  riskDistribution: Record<string, number>;
  pendingReviews: number;
  totalCustomers?: number;
  activeSubscriptions?: number;
  totalDomainScans?: number;
  avgDomainScore?: number;
}

interface MonthlyRow { month: string; assessment_count: number; completed_count: number; }
interface PaymentRow { month: string; revenue: number; kdv: number; }

interface PendingReg {
  id: number; fullName: string; email: string;
  companyName: string | null; subscriptionPlan: string | null; createdAt: string;
}
interface PendingRegsData { count: number; recent: PendingReg[]; }

interface DailyData {
  domainScans:      { last24h: number; total: number; };
  leadCandidates:   { last24h: number; total: number; };
  qualifiedLeads:   { last24h: number; total: number; };
  teasersGenerated: { last24h: number; total: number; };
  cronJobs: {
    last24h_runs: number; last24h_errors: number;
    last_run: { job_name: string; status: string; started_at: string; } | null;
  };
  discoveryRuns: { last24h_found: number; last24h_added: number; };
}

interface CriticalCron {
  name: string; label: string;
  lastRunAt: string | null; lastStatus: string | null;
  lastError: string | null; okRuns: number; errorRuns: number;
}

interface OpsCenter {
  leadFunnel: {
    discovered: number; qualified: number; withContact: number;
    teaserSent: number; contacted: number; converted: number;
  };
  criticalCronHealth: CriticalCron[];
  reports: {
    bulletin:     { sentAt: string | null; createdAt: string | null } | null;
    intelligence: { createdAt: string | null } | null;
    dailySummary: { generatedAt: string | null } | null;
  };
  todayScans: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string | null | undefined): string {
  if (!iso) return "Hiç çalışmadı";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)} dk önce`;
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function pct(n: number, d: number) {
  if (d === 0) return "—";
  return `%${Math.round((n / d) * 100)}`;
}

// ─── Otomasyon Sağlığı ────────────────────────────────────────────────────────

function CronHealthGrid({ crons }: { crons: CriticalCron[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {crons.map((c) => {
        const isOk      = c.lastStatus === "ok";
        const isError   = c.lastStatus === "error";
        const neverRan  = !c.lastRunAt;
        const borderCls = isError ? "border-red-500/50" : neverRan ? "border-slate-600" : "border-slate-700";
        const iconCls   = isError ? "text-red-400" : neverRan ? "text-slate-500" : "text-emerald-400";
        const statusTxt = isError ? "Hata" : neverRan ? "Hiç çalışmadı" : "OK";
        const statusBg  = isError ? "bg-red-500/20 text-red-400 border-red-500/30"
          : neverRan ? "bg-slate-700 text-slate-400 border-slate-600"
          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        return (
          <div key={c.name} className={`bg-slate-900 border ${borderCls} rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-300 text-xs font-medium truncate pr-2">{c.label}</span>
              <Cpu className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />
            </div>
            <Badge className={`text-[10px] px-1.5 py-0 mb-1.5 ${statusBg}`}>{statusTxt}</Badge>
            <p className="text-slate-500 text-[10px] leading-tight">{relTime(c.lastRunAt)}</p>
            {isError && c.lastError && (
              <p className="text-red-400 text-[10px] mt-1 line-clamp-1 leading-tight">{c.lastError}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Lead Hunisi ─────────────────────────────────────────────────────────────

function LeadFunnelSection({ funnel }: { funnel: OpsCenter["leadFunnel"] }) {
  const steps = [
    { label: "Keşfedilen",     value: funnel.discovered,  color: "bg-sky-500",     from: null                },
    { label: "Nitelendirilen", value: funnel.qualified,   color: "bg-violet-500",  from: funnel.discovered   },
    { label: "Kontak Var",     value: funnel.withContact, color: "bg-indigo-500",  from: funnel.qualified    },
    { label: "Teaser Gönderildi", value: funnel.teaserSent, color: "bg-amber-500", from: funnel.withContact  },
    { label: "İletişime Geçildi", value: funnel.contacted,  color: "bg-orange-500",from: funnel.teaserSent   },
    { label: "Dönüşüm",        value: funnel.converted,   color: "bg-emerald-500", from: funnel.contacted    },
  ];
  const maxVal = Math.max(1, funnel.discovered);
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-slate-400 text-xs text-right">{s.label}</div>
          <div className="flex-1 relative">
            <div className="h-7 bg-slate-800 rounded-md overflow-hidden">
              <div
                className={`h-full ${s.color} rounded-md transition-all`}
                style={{ width: `${Math.max(2, (s.value / maxVal) * 100)}%` }}
              />
            </div>
          </div>
          <div className="w-14 shrink-0 text-right">
            <span className="text-white text-sm font-bold">{s.value.toLocaleString("tr-TR")}</span>
          </div>
          <div className="w-10 shrink-0 text-right">
            <span className="text-slate-500 text-xs">
              {s.from !== null ? pct(s.value, s.from) : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Rapor Durumu ────────────────────────────────────────────────────────────

function ReportStatusCards({ reports }: { reports: OpsCenter["reports"] }) {
  const cards = [
    {
      label: "Günlük Özet",
      lastAt: reports.dailySummary?.generatedAt ?? null,
      icon: BarChart3,
      color: "text-sky-400",
      href: "/panel/gunluk-ozet",
      schedule: "Her sabah 08:00",
    },
    {
      label: "Haftalık Bülten",
      lastAt: reports.bulletin?.sentAt ?? reports.bulletin?.createdAt ?? null,
      icon: Mail,
      color: "text-violet-400",
      href: "/panel/bulletin",
      schedule: "Her Cuma 08:00",
    },
    {
      label: "Aylık İstihbarat",
      lastAt: reports.intelligence?.createdAt ?? null,
      icon: Globe,
      color: "text-emerald-400",
      href: "/panel/intelligence",
      schedule: "Her ayın 1'i",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
        <a key={c.label} href={c.href}
          className="group bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg p-4 transition-colors block">
          <div className="flex items-center justify-between mb-3">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
          <p className="text-white text-sm font-medium mb-1">{c.label}</p>
          <p className="text-slate-400 text-xs mb-2">{relTime(c.lastAt)}</p>
          <p className="text-slate-600 text-[10px]">{c.schedule}</p>
        </a>
      ))}
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color = "text-emerald-400" }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-xs">{title}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        {sub && <div className="text-slate-500 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

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

  const { data: daily, dataUpdatedAt } = useQuery<DailyData>({
    queryKey: ["admin-daily"],
    queryFn: () => fetch("/api/admin-panel/analytics/daily", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: pendingRegs } = useQuery<PendingRegsData>({
    queryKey: ["admin-pending-regs"],
    queryFn: () => fetch("/api/admin-panel/analytics/pending-registrations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: ops, isLoading: opsLoading } = useQuery<OpsCenter>({
    queryKey: ["admin-ops-center"],
    queryFn: () => fetch("/api/admin-panel/analytics/ops-center", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const fmt     = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
  const fmtCur  = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  const riskColors: Record<string, string> = { "Kritik": "#dc2626", "Yüksek": "#ea580c", "Orta": "#d97706", "Düşük": "#16a34a" };
  const riskData = Object.entries(overview?.riskDistribution ?? {}).map(([name, value]) => ({ name, value, fill: riskColors[name] ?? "#64748b" }));

  const chartData = (monthly?.monthly ?? []).map(m => {
    const pay = monthly?.payments?.find(p => p.month === m.month);
    return { month: m.month.slice(5), assessments: m.assessment_count, gelir: pay?.revenue ?? 0 };
  });

  const cronErrors = (ops?.criticalCronHealth ?? []).filter(c => c.lastStatus === "error").length;
  const cronNever  = (ops?.criticalCronHealth ?? []).filter(c => !c.lastRunAt).length;

  return (
    <AdminLayout title="Operasyon Merkezi" description="Otomasyon sağlığı, lead hunisi ve platform durumu">
      <div className="space-y-8">

        {/* ─── Bekleyen kayıtlar + uyarı bantları ─── */}
        <div className="flex flex-wrap gap-2">
          {(overview?.pendingReviews ?? 0) > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Clock className="h-3 w-3 mr-1" />{overview?.pendingReviews} bekleyen rapor incelemesi
            </Badge>
          )}
          {cronErrors > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              <AlertCircle className="h-3 w-3 mr-1" />{cronErrors} kritik cron hatası
            </Badge>
          )}
          {cronNever > 0 && (
            <Badge className="bg-slate-600/60 text-slate-400 border-slate-600">
              <Cpu className="h-3 w-3 mr-1" />{cronNever} cron hiç çalışmadı
            </Badge>
          )}
        </div>

        {/* ─── Bekleyen kayıtlar ─── */}
        {(pendingRegs?.count ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                Bekleyen Kayıtlar
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5">{pendingRegs?.count ?? 0}</Badge>
              </h2>
              <button onClick={() => navigate("/panel/musteriler")} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                Tümünü Gör
              </button>
            </div>
            <div className="space-y-2">
              {(pendingRegs?.recent ?? []).slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{r.fullName}</p>
                    <p className="text-slate-400 text-xs">{r.email}{r.companyName ? ` — ${r.companyName}` : ""}</p>
                  </div>
                  <div className="text-right">
                    {r.subscriptionPlan && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] mb-1">{r.subscriptionPlan}</Badge>
                    )}
                    <p className="text-slate-500 text-[11px]">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Üst KPI şeridi: 5 kritik sayı ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            Bugün
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard title="Domain Tarama"      value={ops?.todayScans ?? daily?.domainScans.last24h ?? 0}
              sub={`Toplam: ${fmt(daily?.domainScans.total ?? 0)}`} icon={Globe} color="text-emerald-400" />
            <StatCard title="Yeni Lead Adayı"    value={daily?.leadCandidates.last24h ?? 0}
              sub={`Toplam: ${fmt(daily?.leadCandidates.total ?? 0)}`} icon={Search} color="text-sky-400" />
            <StatCard title="Qualify Edilen"     value={daily?.qualifiedLeads.last24h ?? 0}
              sub={`Toplam: ${fmt(daily?.qualifiedLeads.total ?? 0)}`} icon={CheckCircle} color="text-violet-400" />
            <StatCard title="Teaser Üretilen"    value={daily?.teasersGenerated.last24h ?? 0}
              sub={`Toplam: ${fmt(daily?.teasersGenerated.total ?? 0)}`} icon={Mail} color="text-amber-400" />
            <StatCard title="Cron Çalışma"       value={daily?.cronJobs.last24h_runs ?? 0}
              sub={`${daily?.cronJobs.last24h_errors ?? 0} hata`} icon={Activity}
              color={( daily?.cronJobs.last24h_errors ?? 0) > 0 ? "text-red-400" : "text-emerald-400"} />
          </div>
          {dataUpdatedAt > 0 && (
            <p className="text-slate-600 text-xs mt-2 text-right">
              Son güncelleme: {new Date(dataUpdatedAt).toLocaleTimeString("tr-TR")}
            </p>
          )}
        </div>

        {/* ─── Otomasyon Sağlığı ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-violet-400" />
              Kritik Otomasyon Sağlığı
              {cronErrors > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5">{cronErrors} hata</Badge>
              )}
            </h2>
            <button onClick={() => navigate("/panel/cron-ayarlari")}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
              Tüm Cron'lar <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {opsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-700 rounded-lg p-3 h-20 animate-pulse" />
              ))}
            </div>
          ) : (
            <CronHealthGrid crons={ops?.criticalCronHealth ?? []} />
          )}
        </div>

        {/* ─── Lead Hunisi ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-sky-400" />
              Lead Dönüşüm Hunisi
              {ops?.leadFunnel.discovered ? (
                <span className="text-slate-500 text-xs font-normal">
                  {ops.leadFunnel.converted} dönüşüm / {ops.leadFunnel.discovered} keşif
                  = {pct(ops.leadFunnel.converted, ops.leadFunnel.discovered)}
                </span>
              ) : null}
            </h2>
            <div className="flex items-center gap-3">
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
              {opsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-7 bg-slate-700 rounded animate-pulse" />
                  ))}
                </div>
              ) : ops?.leadFunnel ? (
                <LeadFunnelSection funnel={ops.leadFunnel} />
              ) : (
                <p className="text-slate-500 text-sm text-center py-6">Henüz lead verisi yok</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Rapor Durumu ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
              Periyodik Rapor Durumu
            </h2>
          </div>
          {opsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 bg-slate-800 rounded-lg border border-slate-700 animate-pulse" />
              ))}
            </div>
          ) : ops?.reports ? (
            <ReportStatusCards reports={ops.reports} />
          ) : null}
        </div>

        {/* ─── Gelir KPI'ları ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Gelir & Abonelik
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Toplam Gelir (KDV dahil)" value={fmtCur(overview?.totalRevenue ?? 0)}     sub={`Bu ay: ${fmtCur(overview?.monthRevenue ?? 0)}`}     icon={TrendingUp}  color="text-emerald-400" />
            <StatCard title="Net Gelir (KDV hariç)"    value={fmtCur(overview?.netRevenue ?? 0)}       sub="Tüm zamanlar"                                          icon={DollarSign}  color="text-blue-400" />
            <StatCard title="Aktif Abonelik"            value={fmt(overview?.activeSubscriptions ?? 0)} sub={`${fmt(overview?.totalCustomers ?? 0)} toplam müşteri`}  icon={CheckCircle} color="text-violet-400" />
            <StatCard title="Bu Ay Değerlendirme"       value={fmt(overview?.thisMonthAssessments ?? 0)} sub={`Ort. skor: %${Math.round(overview?.avgScore ?? 0)}`}  icon={FileText}    color="text-amber-400" />
          </div>
        </div>

        {/* ─── Grafikler ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Aylık Değerlendirme & Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                  <Bar dataKey="assessments" name="Değerlendirme" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Risk Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                {riskData.map(({ name, value, fill }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: fill }} />
                    <div className="flex-1 text-slate-300 text-sm">{name}</div>
                    <div className="text-white font-semibold text-sm w-8 text-right">{value}</div>
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: fill, width: `${Math.min(100, (value / Math.max(1, overview?.totalAssessments ?? 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {riskData.length === 0 && <div className="text-slate-500 text-sm text-center py-8">Henüz veri yok</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Hızlı Linkler ─── */}
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-slate-400" />
            Hızlı Erişim
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Domain Taramaları",   desc: "Tarama geçmişi, analitik",          href: "/panel/domain-taramalar",  icon: Globe,        color: "text-emerald-400" },
              { label: "Müşteri Yönetimi",    desc: "Abonelikler, plan atamaları",       href: "/panel/musteriler",        icon: Users,        color: "text-sky-400" },
              { label: "Growth Engine",       desc: "Tetikleyiciler, kampanyalar",       href: "/panel/growth-engine",     icon: TrendingUp,   color: "text-violet-400" },
              { label: "Tech Intelligence",   desc: "Sektörel teknoloji dağılımı",       href: "/panel/tech-intelligence", icon: Cpu,          color: "text-amber-400" },
              { label: "CTI İstihbarat",      desc: "VulnCheck KEV, tehdit besleme",     href: "/panel/cti-istihbarat",    icon: ShieldAlert,  color: "text-red-400" },
              { label: "Gelir Analitik",      desc: "MRR, ARR, fatura durumu",           href: "/panel/gelir",             icon: DollarSign,   color: "text-emerald-400" },
              { label: "Değerlendirmeler",    desc: "Tüm anket sonuçları",              href: "/panel/degerlendirmeler",  icon: FileText,     color: "text-slate-400" },
              { label: "Ayarlar",             desc: "Site, fiyat, entegrasyon",         href: "/panel/ayarlar",           icon: Settings,     color: "text-slate-400" },
            ].map(({ label, desc, href, icon: Icon, color }) => (
              <button key={href} onClick={() => navigate(href)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-emerald-500/40 hover:bg-slate-750 transition-all group">
                <Icon className={`h-5 w-5 ${color} mb-2`} />
                <div className="text-white font-medium text-xs mb-0.5">{label}</div>
                <div className="text-slate-500 text-[11px]">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Veri Kaynakları (collapse) ─── */}
        <DataSourcesCard />
      </div>
    </AdminLayout>
  );
}

// ─── Data Sources Accordion ──────────────────────────────────────────────────

const DATA_SOURCES: { tool: string; desc: string; sources: { name: string; url: string; note: string }[] }[] = [
  {
    tool: "KVKK Ceza Simülatörü",
    desc: "İdari para cezası hesaplamada kullanılan taban rakamlar ve ağırlaştırıcı/hafifletici koşul çarpanları",
    sources: [
      { name: "KVK Kurul Karar Özetleri", url: "https://www.kvkk.gov.tr/Icerik/5673/Karar-Ozetleri", note: "Resmi kurul kararları — taban ceza aralıkları" },
      { name: "Resmi Gazete (mevzuat.gov.tr)", url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6698&MevzuatTur=1&MevzuatTertip=5", note: "6698 sayılı KVKK Kanunu — Madde 18 yaptırımlar" },
      { name: "KVK Rehber Dokümanlar", url: "https://www.kvkk.gov.tr/Icerik/4570/Rehberler", note: "Ceza hesaplama metodolojisi referansı" },
    ],
  },
  {
    tool: "Siber Sigorta Prim Hesaplayıcı",
    desc: "Prim aralığı tahmini için kullanılan sektör piyasa verileri ve risk çarpanları",
    sources: [
      { name: "Türkiye Sigorta Birliği İstatistikleri", url: "https://www.tsb.org.tr/istatistikler.aspx", note: "Türkiye siber sigorta prim verileri" },
      { name: "IBM Cost of Data Breach Report", url: "https://www.ibm.com/reports/data-breach", note: "Sektörel ortalama olay maliyetleri (küresel)" },
    ],
  },
  {
    tool: "Sektörel Kıyaslama Aracı",
    desc: "Sektör bazında güvenlik olgunluk skorları, olay oranları ve ortalama maliyet rakamları",
    sources: [
      { name: "IBM Cost of Data Breach Report", url: "https://www.ibm.com/reports/data-breach", note: "Yıllık sektörel ihlal maliyeti raporu" },
      { name: "Verizon DBIR", url: "https://www.verizon.com/business/resources/reports/dbir/", note: "Sektör olay dağılımı" },
      { name: "ENISA SME Threat Landscape", url: "https://www.enisa.europa.eu/topics/cyber-threats/threats-and-trends", note: "AB KOBİ tehdit peyzajı" },
    ],
  },
  {
    tool: "Alan Adı Tarama",
    desc: "Domain taramada harici API'lerin hesapladığı risk skorları ve kullandığı veri kaynakları",
    sources: [
      { name: "Have I Been Pwned (HIBP)", url: "https://haveibeenpwned.com/API/v3", note: "E-posta/domain sızıntı veritabanı" },
      { name: "VirusTotal API", url: "https://developers.virustotal.com/reference/overview", note: "Domain reputasyon ve zararlı yazılım taraması" },
      { name: "AbuseIPDB", url: "https://www.abuseipdb.com/api", note: "IP kötüye kullanım geçmişi skoru" },
      { name: "USOM (BTK)", url: "https://www.usom.gov.tr", note: "Türkiye kara liste ve tehdit istihbarat verileri" },
    ],
  },
];

function DataSourcesCard() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <Card className="bg-slate-800 border-slate-700">
      <button className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-400" />
              <CardTitle className="text-white text-base">Araç Veri Kaynakları ve Hesaplama Metodolojisi</CardTitle>
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 font-medium">Sadece Admin</span>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
          <p className="text-slate-400 text-xs pt-1">Müşterilere sunulan hesaplama araçlarının dayandığı kaynak ve metodoloji bilgisi.</p>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-sky-300 text-xs leading-relaxed">
              Aşağıdaki rakamlar hesaplama modeli için baz alınmıştır. Gerçek değerler güncel mevzuat ve piyasa koşullarına göre periyodik olarak doğrulanmalıdır.
            </p>
          </div>
          {DATA_SOURCES.map((ds) => (
            <div key={ds.tool} className="border border-slate-700 rounded-lg overflow-hidden">
              <button className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [ds.tool]: !e[ds.tool] }))}>
                <div>
                  <p className="text-white text-sm font-medium">{ds.tool}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{ds.desc}</p>
                </div>
                {expanded[ds.tool] ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0 ml-3" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-3" />}
              </button>
              {expanded[ds.tool] && (
                <div className="border-t border-slate-700 px-4 py-3 bg-slate-900/50 space-y-2">
                  {ds.sources.map((src) => (
                    <div key={src.url} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-200 text-xs font-medium">{src.name}</span>
                          <span className="text-slate-500 text-xs">—</span>
                          <span className="text-slate-400 text-xs">{src.note}</span>
                        </div>
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 text-[11px] break-all transition-colors">{src.url}</a>
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
