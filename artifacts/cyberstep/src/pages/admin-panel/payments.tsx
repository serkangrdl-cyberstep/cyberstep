import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAdmin } from "@/hooks/use-admin";

interface Payment {
  id: number; planSlug: string; companyName: string; contactName: string; email: string;
  amount: string; currency: string; kdvAmount: string | null; netAmount: string | null;
  iyzicoPaymentId: string | null; status: string; createdAt: string;
}

const STATUS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  success: { label: "Başarılı", icon: CheckCircle, cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  failed: { label: "Başarısız", icon: XCircle, cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  pending: { label: "Bekliyor", icon: Clock, cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export default function AdminPayments() {
  const [, navigate] = useLocation();
  useRequireAdmin();

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: () => fetch("/api/admin-panel/analytics/payments", { credentials: "include" }).then(r => r.json()),
  });

  const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const fmtCur = (n: string | null) => n ? Number(n).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }) : "—";

  const totalSuccessful = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalKdv = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.kdvAmount ?? 0), 0);
  const totalNet = payments.filter(p => p.status === "success").reduce((sum, p) => sum + Number(p.netAmount ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          <span className="font-bold text-white text-sm">CyberStep Admin</span>
        </div>
        <Button variant="ghost" className="justify-start text-slate-300 hover:text-white" onClick={() => navigate("/panel")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Genel Bakış
        </Button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <h1 className="text-xl font-bold text-white">Ödemeler & Muhasebe</h1>
          <p className="text-slate-400 text-sm">{payments.length} işlem kaydı</p>
        </header>

        <div className="p-8 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Toplam Tahsilat (KDV dahil)", value: fmtCur(String(totalSuccessful)) },
              { label: "KDV Tutarı (%20)", value: fmtCur(String(totalKdv)) },
              { label: "Net Gelir (KDV hariç)", value: fmtCur(String(totalNet)) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="text-slate-400 text-xs mb-2">{label}</div>
                <div className="text-white text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          <Card className="bg-slate-800 border-slate-700">
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
      </main>
    </div>
  );
}
