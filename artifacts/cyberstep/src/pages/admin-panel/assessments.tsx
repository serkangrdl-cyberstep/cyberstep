import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, ExternalLink, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAdmin } from "@/hooks/use-admin";

interface Assessment {
  id: number; companyName: string; contactName: string; email: string;
  sector: string; employeeCount: string; assessmentType: string; status: string;
  totalScore: number | null; maxScore: number | null; riskLevel: string | null;
  redAlarmCount: number | null; createdAt: string; completedAt: string | null;
}

const RISK_COLORS: Record<string, string> = {
  "Kritik": "bg-red-500/20 text-red-400 border-red-500/30",
  "Yüksek": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Orta": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Düşük": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function AdminAssessments() {
  const [, navigate] = useLocation();
  useRequireAdmin();

  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["admin-assessments"],
    queryFn: () => fetch("/api/admin-panel/analytics/assessments", { credentials: "include" }).then(r => r.json()),
  });

  const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

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
          <h1 className="text-xl font-bold text-white">Değerlendirmeler</h1>
          <p className="text-slate-400 text-sm">Tüm anket sonuçları ({assessments.length} kayıt)</p>
        </header>

        <div className="p-8">
          {isLoading ? (
            <div className="text-slate-400 text-center py-16">Yükleniyor...</div>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {["#", "Firma", "İletişim", "Sektör", "Tür", "Skor", "Risk", "Durum", "Tarih", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {assessments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-sm">#{a.id}</td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{a.companyName}</div>
                          <div className="text-slate-400 text-xs">{a.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{a.contactName}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{a.sector}</td>
                        <td className="px-4 py-3">
                          <Badge className={a.assessmentType === "mini" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-violet-500/20 text-violet-400 border-violet-500/30"}>
                            {a.assessmentType === "mini" ? "Mini" : "Tam"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-white text-sm font-semibold">
                          {a.totalScore != null ? `%${Math.round((a.totalScore / (a.maxScore ?? 1)) * 100)}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.riskLevel ? <Badge className={RISK_COLORS[a.riskLevel] ?? "bg-slate-700 text-slate-400"}>{a.riskLevel}</Badge> : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {a.status === "report_ready" ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="h-3 w-3" /> Rapor Hazır</span>
                          ) : a.status === "completed" ? (
                            <span className="flex items-center gap-1 text-amber-400 text-xs"><Clock className="h-3 w-3" /> Tamamlandı</span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 text-xs"><AlertTriangle className="h-3 w-3" /> Devam Ediyor</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmt(a.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 w-7 p-0" onClick={() => window.open(`/assessment/${a.id}/report`, "_blank")}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assessments.length === 0 && <div className="text-slate-500 text-sm text-center py-12">Henüz değerlendirme yok</div>}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
