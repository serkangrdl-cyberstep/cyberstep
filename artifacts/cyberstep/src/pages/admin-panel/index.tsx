import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Settings, CreditCard, FileText, Users,
  LogOut, Shield, TrendingUp, AlertTriangle, CheckCircle, Clock,
  BarChart3, DollarSign, ChevronRight, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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
}

interface MonthlyRow { month: string; assessment_count: number; completed_count: number; }
interface PaymentRow { month: string; revenue: number; kdv: number; }

function StatCard({ title, value, sub, icon: Icon, color = "text-emerald-400" }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm">{title}</span>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className={`text-3xl font-bold text-white mb-1`}>{value}</div>
        {sub && <div className="text-slate-500 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: admin, isLoading: adminLoading } = useRequireAdmin();

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => fetch("/api/admin-panel/analytics/overview", { credentials: "include" }).then(r => r.json()),
    enabled: !!admin,
    refetchInterval: 30000,
  });

  const { data: monthly } = useQuery<{ monthly: MonthlyRow[]; payments: PaymentRow[] }>({
    queryKey: ["admin-monthly"],
    queryFn: () => fetch("/api/admin-panel/analytics/monthly", { credentials: "include" }).then(r => r.json()),
    enabled: !!admin,
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); navigate("/panel/giris"); },
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Yükleniyor...</div>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
  const fmtCur = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  const riskColors: Record<string, string> = { "Kritik": "#dc2626", "Yüksek": "#ea580c", "Orta": "#d97706", "Düşük": "#16a34a" };
  const riskData = Object.entries(overview?.riskDistribution ?? {}).map(([name, value]) => ({ name, value, fill: riskColors[name] ?? "#64748b" }));

  const chartData = (monthly?.monthly ?? []).map(m => {
    const pay = monthly?.payments?.find(p => p.month === m.month);
    return { month: m.month.slice(5), assessments: m.assessment_count, gelir: pay?.revenue ?? 0 };
  });

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            <span className="font-bold text-white">CyberStep Admin</span>
          </div>
          <div className="text-slate-400 text-xs mt-1">{admin?.email}</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: LayoutDashboard, label: "Genel Bakış", href: "/panel" },
            { icon: FileText, label: "Değerlendirmeler", href: "/panel/degerlendiirmeler" },
            { icon: DollarSign, label: "Ödemeler", href: "/panel/odemeler" },
            { icon: Settings, label: "Site Ayarları", href: "/panel/ayarlar" },
            { icon: CreditCard, label: "Fiyatlandırma", href: "/panel/fiyatlar" },
            { icon: Users, label: "Soru Yönetimi", href: "/panel/sorular" },
            { icon: Shield, label: "2FA Güvenlik", href: "/panel/totp" },
          ].map(({ icon: Icon, label, href }) => (
            <button key={href} onClick={() => navigate(href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm text-left">
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Genel Bakış</h1>
            <p className="text-slate-400 text-sm">Platform istatistikleri ve muhasebe</p>
          </div>
          {(overview?.pendingReviews ?? 0) > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Clock className="h-3 w-3 mr-1" />
              {overview?.pendingReviews} bekleyen rapor
            </Badge>
          )}
        </header>

        <div className="p-8 space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Toplam Değerlendirme" value={fmt(overview?.totalAssessments ?? 0)} sub={`Bu ay: ${fmt(overview?.thisMonthAssessments ?? 0)}`} icon={FileText} />
            <StatCard title="Toplam Gelir (KDV dahil)" value={fmtCur(overview?.totalRevenue ?? 0)} sub={`Bu ay: ${fmtCur(overview?.monthRevenue ?? 0)}`} icon={TrendingUp} color="text-emerald-400" />
            <StatCard title="Toplam KDV" value={fmtCur(overview?.totalKdv ?? 0)} sub={`Bu ay: ${fmtCur(overview?.monthKdv ?? 0)}`} icon={DollarSign} color="text-blue-400" />
            <StatCard title="Net Gelir (KDV hariç)" value={fmtCur(overview?.netRevenue ?? 0)} sub="Tüm zamanlar" icon={CheckCircle} color="text-violet-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StatCard title="Tamamlanan Raporlar" value={fmt(overview?.completedAssessments ?? 0)} icon={CheckCircle} color="text-emerald-400" />
            <StatCard title="Bekleyen İnceleme" value={fmt(overview?.pendingReviews ?? 0)} icon={Clock} color="text-amber-400" />
            <StatCard title="Ortalama Skor" value={`%${Math.round(overview?.avgScore ?? 0)}`} icon={BarChart3} color="text-blue-400" />
          </div>

          {/* Charts */}
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

          {/* Quick links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Değerlendirmeleri Yönet", desc: "Tüm anket sonuçlarını görüntüle", href: "/panel/degerlendiirmeler", icon: FileText },
              { label: "Site Ayarlarını Düzenle", desc: "Hakkımızda, İletişim, KVKK", href: "/panel/ayarlar", icon: Settings },
              { label: "Fiyatları Güncelle", desc: "Paket fiyatları ve içerikleri", href: "/panel/fiyatlar", icon: CreditCard },
            ].map(({ label, desc, href, icon: Icon }) => (
              <button key={href} onClick={() => navigate(href)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-left hover:border-emerald-500/40 hover:bg-slate-750 transition-all group">
                <Icon className="h-6 w-6 text-emerald-400 mb-3" />
                <div className="text-white font-medium text-sm mb-1">{label}</div>
                <div className="text-slate-400 text-xs flex items-center gap-1">{desc} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
