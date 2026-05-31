import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";

interface RevenueStats {
  mrr: string | number;
  arr: string | number;
  active_paying: number;
  total_all_time: string;
  overdue_count: number;
  overdue_amount: string;
  outstanding: string;
  monthlyRevenue: Array<{ month: string; revenue: string; billed: string; invoice_count: number; customers: number }>;
  customers: { total: number; active: number; new_30d: number };
}

function fmt(n: string | number) {
  return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 0 });
}

export default function AdminGelir() {
  const { data, isLoading } = useQuery<RevenueStats>({
    queryKey: ["/api/crm/revenue/stats"],
    queryFn: () => fetch("/api/crm/revenue/stats", { credentials: "include" }).then(r => r.json()),
  });

  const monthlyChart = (data?.monthlyRevenue ?? []).map(m => ({
    month: m.month.slice(5),
    tahsilat: Number(m.revenue),
    kesildi: Number(m.billed),
  }));

  return (
    <AdminLayout title="Gelir ve MRR Panosu" description="Aylık tekrarlayan gelir, ARR ve tahsilat takibi">
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Yükleniyor...</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "MRR", value: `₺${fmt(data?.mrr ?? 0)}`, icon: TrendingUp, color: "text-cyan-400" },
              { label: "ARR", value: `₺${fmt(data?.arr ?? 0)}`, icon: TrendingUp, color: "text-emerald-400" },
              { label: "Aktif Müşteri", value: `${data?.active_paying ?? 0}`, icon: Users, color: "text-blue-400" },
              { label: "Toplam Gelir", value: `₺${fmt(data?.total_all_time ?? 0)}`, icon: DollarSign, color: "text-purple-400" },
            ].map(k => (
              <Card key={k.label} className="bg-slate-900 border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <k.icon className={`h-5 w-5 ${k.color}`} />
                    <div>
                      <p className="text-slate-400 text-xs">{k.label}</p>
                      <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overdue alert */}
          {(data?.overdue_count ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">
                <strong>{data?.overdue_count}</strong> adet vadesi geçmiş fatura — toplam{" "}
                <strong>₺{fmt(data?.overdue_amount ?? 0)}</strong> tahsil bekliyor.
              </p>
            </div>
          )}

          {/* Monthly revenue chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-base">Aylık Gelir Trendi</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#7B8FAF" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#7B8FAF" tick={{ fontSize: 11 }} tickFormatter={v => `₺${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(v: number) => [`₺${v.toLocaleString("tr-TR")}`, ""]}
                  />
                  <Bar dataKey="tahsilat" fill="#10b981" name="Tahsilat" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="kesildi" fill="#334155" name="Kesilen" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Toplam Müşteri", value: data?.customers?.total ?? 0 },
              { label: "Aktif Müşteri", value: data?.customers?.active ?? 0 },
              { label: "Son 30 Gün Yeni", value: data?.customers?.new_30d ?? 0 },
            ].map(s => (
              <Card key={s.label} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-slate-400 text-xs mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly table */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-base">Aylık Detay</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-800">{["Ay","Tahsilat","Kesilen","Fatura Sayısı","Müşteri"].map(h => <th key={h} className="text-left text-slate-400 text-xs px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {[...(data?.monthlyRevenue ?? [])].reverse().map(m => (
                      <tr key={m.month} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white font-mono text-xs">{m.month}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">₺{fmt(m.revenue)}</td>
                        <td className="px-4 py-3 text-slate-300">₺{fmt(m.billed)}</td>
                        <td className="px-4 py-3 text-slate-300">{m.invoice_count}</td>
                        <td className="px-4 py-3 text-slate-300">{m.customers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
