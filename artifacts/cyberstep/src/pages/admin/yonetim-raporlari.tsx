import { useQuery } from "@tanstack/react-query";
import { FileText, Send, CheckCircle2, Clock, Users } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminBoardReport {
  id: number; customerId: number; reportMonth: number; reportYear: number;
  status: string; generatedAt: string; currentScore?: number; riskLevel?: string;
  sentToEmails?: string[]; criticalFindings?: number;
}

const MONTH_NAMES = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: "Taslak",     color: "text-slate-400" },
  approved: { label: "Onaylandi",  color: "text-emerald-400" },
  sent:     { label: "Gonderildi", color: "text-blue-400" },
};

const RISK_COLOR: Record<string, string> = {
  YUKSEK: "text-red-400",
  ORTA:   "text-yellow-400",
  DUSUK:  "text-emerald-400",
};

export default function AdminYonetimRaporlariPage() {
  const { data: reports = [], isLoading } = useQuery<AdminBoardReport[]>({
    queryKey: ["admin-board-reports"],
    queryFn: () => fetch("/api/admin/board-reports", { credentials: "include" }).then(r => r.json()),
  });

  const total = reports.length;
  const sent = reports.filter(r => r.status === "sent").length;
  const approved = reports.filter(r => r.status === "approved").length;
  const draft = reports.filter(r => r.status === "draft").length;

  return (
    <AdminLayout title="Yonetim Kurulu Raporlari" description="Musteri YK brifing raporlari">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam", value: total, color: "text-white" },
          { label: "Gonderildi", value: sent, color: "text-blue-400" },
          { label: "Onaylandi", value: approved, color: "text-emerald-400" },
          { label: "Taslak", value: draft, color: "text-slate-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tum Raporlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400 text-sm">Yukleniyor...</p>
          ) : reports.length === 0 ? (
            <p className="text-slate-400 text-sm">Henuz YK raporu olusturulmadi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="text-left pb-2">Musteri ID</th>
                    <th className="text-left pb-2">Donem</th>
                    <th className="text-left pb-2">Durum</th>
                    <th className="text-left pb-2">Risk</th>
                    <th className="text-left pb-2">Skor</th>
                    <th className="text-left pb-2">Kritik</th>
                    <th className="text-left pb-2">Alicilar</th>
                    <th className="text-left pb-2">Olusturuldu</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => {
                    const statusCfg = STATUS_CONFIG[r.status] ?? { label: r.status, color: "text-slate-400" };
                    return (
                      <tr key={r.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                        <td className="py-2.5 pr-4 text-slate-300">#{r.customerId}</td>
                        <td className="py-2.5 pr-4 text-slate-300">
                          {MONTH_NAMES[(r.reportMonth - 1)]} {r.reportYear}
                        </td>
                        <td className={`py-2.5 pr-4 font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </td>
                        <td className={`py-2.5 pr-4 font-medium ${RISK_COLOR[r.riskLevel ?? ""] ?? "text-slate-400"}`}>
                          {r.riskLevel ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-300">{r.currentScore ?? "—"}/100</td>
                        <td className="py-2.5 pr-4">
                          {(r.criticalFindings ?? 0) > 0 ? (
                            <span className="text-red-400 font-semibold">{r.criticalFindings}</span>
                          ) : <span className="text-slate-500">0</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.status === "sent" ? (
                            <span className="text-blue-400 flex items-center gap-1">
                              <Send className="h-3 w-3" />{(r.sentToEmails ?? []).length} alici
                            </span>
                          ) : r.status === "approved" ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />Hazir
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />Taslak
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500 text-xs">
                          {new Date(r.generatedAt).toLocaleDateString("tr-TR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
