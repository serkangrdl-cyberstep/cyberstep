import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, TrendingUp, Package, BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

interface Payment {
  id: number; planSlug: string; companyName: string; contactName: string; email: string;
  amount: string; currency: string; kdvAmount: string | null; netAmount: string | null;
  iyzicoPaymentId: string | null; status: string; createdAt: string;
}

interface MonthlyPayment { month: string; revenue: number; kdv: number; }
interface ByPlan { plan_slug: string; payment_count: number; total_revenue: number; total_net: number; }
interface MonthlyAssessment { month: string; mini: number; full: number; }

const STATUS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  success: { label: "Başarılı", icon: CheckCircle, cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  failed: { label: "Başarısız", icon: XCircle, cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  pending: { label: "Bekliyor", icon: Clock, cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

const PLAN_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtCur = (n: string | number | null) =>
  n != null ? Number(n).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }) : "—";

const fmtMonth = (m: string) => {
  const [year, month] = m.split("-");
  const names = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${names[parseInt(month)]} ${year?.slice(2)}`;
};

export default function AdminPayments() {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: () => fetch("/api/admin-panel/analytics/payments", { credentials: "include" }).then(r => r.json()),
  });

  const { data: monthlyData } = useQuery<{ payments: MonthlyPayment[] }>({
    queryKey: ["admin-analytics-monthly"],
    queryFn: () => fetch("/api/admin-panel/analytics/monthly", { credentials: "include" }).then(r => r.json()),
  });

  const { data: byPlan = [] } = useQuery<ByPlan[]>({
    queryKey: ["admin-analytics-by-plan"],
    queryFn: () => fetch("/api/admin-panel/analytics/by-plan", { credentials: "include" }).then(r => r.json()),
  });

  const { data: monthlyAssessments = [] } = useQuery<MonthlyAssessment[]>({
    queryKey: ["admin-analytics-monthly-assessments"],
    queryFn: () => fetch("/api/admin-panel/analytics/monthly-assessments", { credentials: "include" }).then(r => r.json()),
  });

  const totalSuccessful = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalKdv = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.kdvAmount ?? 0), 0);
  const totalNet = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.netAmount ?? 0), 0);

  const monthlyChartData = (monthlyData?.payments ?? []).map(row => ({
    month: fmtMonth(row.month),
    "Brüt Ciro": Math.round(row.revenue),
    "Net Gelir": Math.round(row.revenue - row.kdv),
  }));

  const byPlanChart = byPlan.map(r => ({
    name: r.plan_slug,
    Gelir: Math.round(r.total_net),
    "İşlem Sayısı": r.payment_count,
  }));

  const assessmentChart = monthlyAssessments.map(r => ({
    month: fmtMonth(r.month),
    "Mini": r.mini,
    "Tam": r.full,
  }));

  return (
    <AdminLayout title="Ödemeler & Muhasebe" description={`${payments.length} işlem kaydı`}>
      <div className="space-y-8 max-w-7xl">

        {/* ─── Özet Kartlar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Toplam Tahsilat (KDV dahil)", value: fmtCur(totalSuccessful) },
            { label: "KDV Tutarı (%20)", value: fmtCur(totalKdv) },
            { label: "Net Gelir (KDV hariç)", value: fmtCur(totalNet) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="text-slate-400 text-xs mb-2">{label}</div>
              <div className="text-white text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* ─── Aylık Ciro Grafiği ────────────────────────────────────────── */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-white font-semibold">Aylık Ciro (Son 12 Ay)</h2>
          </div>
          {monthlyChartData.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-10">Henüz ödeme verisi yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(v: number) => fmtCur(v)}
                />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar dataKey="Brüt Ciro" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net Gelir" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ─── Pakete Göre Gelir ─────────────────────────────────────── */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Package className="h-4 w-4 text-violet-400" />
              <h2 className="text-white font-semibold">Pakete Göre Net Gelir</h2>
            </div>
            {byPlanChart.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-10">Ödeme verisi yok</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byPlanChart} dataKey="Gelir" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {byPlanChart.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      formatter={(v: number) => fmtCur(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {byPlan.map((r, i) => (
                    <div key={r.plan_slug} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                        <span className="text-slate-300 capitalize">{r.plan_slug}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-semibold">{fmtCur(r.total_net)}</span>
                        <span className="text-slate-500 text-xs ml-2">({r.payment_count} işlem)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ─── Aylık Değerlendirme Türü ──────────────────────────────── */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="h-4 w-4 text-amber-400" />
              <h2 className="text-white font-semibold">Aylık Değerlendirme (Türe Göre)</h2>
            </div>
            {assessmentChart.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-10">Değerlendirme verisi yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={assessmentChart} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} labelStyle={{ color: "#e2e8f0" }} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Bar dataKey="Mini" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tam" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ─── İşlem Tablosu ────────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-white font-semibold">Tüm İşlemler</h2>
          </div>
          {isLoading ? (
            <div className="text-slate-400 text-center py-12">Yükleniyor...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["#", "Firma", "Paket", "Brüt Tutar", "KDV", "Net", "Durum", "Tarih"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {payments.map(p => {
                    const st = STATUS[p.status] ?? STATUS.pending;
                    const StIcon = st.icon;
                    return (
                      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-sm">#{p.id}</td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{p.companyName}</div>
                          <div className="text-slate-400 text-xs">{p.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm capitalize">{p.planSlug}</td>
                        <td className="px-4 py-3 text-white text-sm font-semibold">{fmtCur(p.amount)}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{fmtCur(p.kdvAmount)}</td>
                        <td className="px-4 py-3 text-emerald-400 text-sm font-semibold">{fmtCur(p.netAmount)}</td>
                        <td className="px-4 py-3">
                          <Badge className={st.cls}>
                            <StIcon className="h-3 w-3 mr-1" />{st.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmt(p.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {payments.length === 0 && <div className="text-slate-500 text-sm text-center py-12">Henüz ödeme kaydı yok</div>}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
