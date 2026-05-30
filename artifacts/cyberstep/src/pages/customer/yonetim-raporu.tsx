import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Send, CheckCircle2, Clock, Users, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Recipient { id: number; email: string; name?: string; role?: string }
interface BoardReport {
  id: number; reportMonth: number; reportYear: number; status: string;
  generatedAt: string; currentScore?: number; previousScore?: number;
  scoreChange?: number; riskLevel?: string; executiveSummary?: string;
  keyAchievements?: string[]; keyRisks?: Array<{ risk: string; businessImpact: string; urgency: string }>;
  requiredDecisions?: string[]; nextMonthPlan?: string; criticalFindings?: number; highFindings?: number;
}

const MONTH_NAMES = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
const ROLE_OPTIONS = ["CEO","CFO","COO","Yonetim Kurulu Uyesi","Diger"];

function RiskBadge({ level }: { level?: string }) {
  const color = level === "YUKSEK" ? "bg-red-500/20 text-red-400 border-red-500/30"
    : level === "ORTA" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>{level ?? "?"}</span>;
}

function ReportDetail({ report }: { report: BoardReport }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => fetch(`/api/board-report/reports/${report.id}/approve`, { method: "PUT", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-reports"] }); toast({ title: "Rapor onaylandi" }); },
  });

  const sendMutation = useMutation({
    mutationFn: () => fetch(`/api/board-report/reports/${report.id}/send`, { method: "POST", credentials: "include" }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gonderilemedi");
      return j;
    }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["board-reports"] }); toast({ title: `Rapor gonderildi — ${d.sent} alici` }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">{MONTH_NAMES[(report.reportMonth - 1)]} {report.reportYear} Raporu</h3>
          <div className="flex items-center gap-2 mt-1">
            <RiskBadge level={report.riskLevel} />
            <span className="text-xs text-slate-400">Skor: {report.currentScore ?? "?"}/100</span>
            {report.scoreChange !== undefined && (
              <span className={`text-xs flex items-center gap-0.5 ${report.scoreChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {report.scoreChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {report.scoreChange >= 0 ? "+" : ""}{report.scoreChange}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {report.status === "draft" && (
            <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Onayla
            </Button>
          )}
          {report.status === "approved" && (
            <Button size="sm" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="h-3.5 w-3.5 mr-1" />Gonder
            </Button>
          )}
        </div>
      </div>

      {/* Executive summary */}
      {report.executiveSummary && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-2 font-medium">Yonetici Ozeti</p>
            <p className="text-slate-300 text-sm leading-relaxed">{report.executiveSummary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Key achievements */}
        {(report.keyAchievements?.length ?? 0) > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-xs text-emerald-400 mb-2 font-medium">Bu Ay Basarilar</p>
              <ul className="space-y-1">
                {report.keyAchievements!.map((a, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />{a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Key risks */}
        {(report.keyRisks?.length ?? 0) > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-xs text-red-400 mb-2 font-medium">Acik Riskler</p>
              <ul className="space-y-2">
                {report.keyRisks!.map((r, i) => (
                  <li key={i} className="text-xs">
                    <p className="text-slate-300">{r.risk}</p>
                    <p className="text-slate-500">{r.businessImpact} — <span className="text-yellow-400">{r.urgency}</span></p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Required decisions */}
      {(report.requiredDecisions?.length ?? 0) > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-yellow-400 mb-2 font-medium">Yonetim Karari Gerektiren</p>
            <ul className="space-y-1">
              {report.requiredDecisions!.map((d, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />{d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {report.nextMonthPlan && (
        <p className="text-xs text-slate-400">Gelecek ay: <span className="text-slate-300">{report.nextMonthPlan}</span></p>
      )}
    </div>
  );
}

export default function YonetimRaporuPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newRecipient, setNewRecipient] = useState({ email: "", name: "", role: "CEO" });
  const [showAddRecipient, setShowAddRecipient] = useState(false);

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ["board-recipients"],
    queryFn: () => fetch("/api/board-report/recipients", { credentials: "include" }).then(r => r.json()),
  });

  const { data: reports = [] } = useQuery<BoardReport[]>({
    queryKey: ["board-reports"],
    queryFn: () => fetch("/api/board-report/reports", { credentials: "include" }).then(r => r.json()),
  });

  const { data: selectedReport } = useQuery<BoardReport>({
    queryKey: ["board-report", selectedId],
    queryFn: () => fetch(`/api/board-report/reports/${selectedId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedId,
  });

  const addRecipientMutation = useMutation({
    mutationFn: (data: typeof newRecipient) =>
      fetch("/api/board-report/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-recipients"] }); setNewRecipient({ email: "", name: "", role: "CEO" }); setShowAddRecipient(false); },
  });

  const removeRecipientMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/board-report/recipients/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-recipients"] }),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch("/api/board-report/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Olusturulamadi");
        return j as { id: number };
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["board-reports"] });
      setSelectedId(d.id);
      toast({ title: "Rapor olusturuluyor", description: "AI analizi birkaç dakika icinde tamamlanacak. Sayfayi yenileyebilirsiniz." });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const displayReport = selectedId && selectedReport?.id === selectedId ? selectedReport : null;

  return (
    <div className="min-h-screen bg-secondary px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Yonetim Kurulu Raporu</h1>
          <p className="text-slate-400 mt-1">Aylik siber guvenlik brifing raporu — CEO ve yonetim kurulu icin</p>
        </div>

        {/* Recipients */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Alicilar
              </CardTitle>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs"
                onClick={() => setShowAddRecipient(v => !v)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Alici Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recipients.length === 0 && !showAddRecipient && (
              <p className="text-slate-500 text-sm">Henuz alici eklenmemis. Raporu gondermek icin en az 1 alici ekleyin.</p>
            )}
            <div className="space-y-2">
              {recipients.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-slate-300 text-sm">{r.name ?? r.email}</p>
                    <p className="text-xs text-slate-500">{r.email}{r.role ? ` — ${r.role}` : ""}</p>
                  </div>
                  <button onClick={() => removeRecipientMutation.mutate(r.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {showAddRecipient && (
              <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="isim@sirket.com" type="email" value={newRecipient.email}
                    onChange={e => setNewRecipient(v => ({ ...v, email: e.target.value }))}
                    className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                  <input placeholder="Ad Soyad" value={newRecipient.name}
                    onChange={e => setNewRecipient(v => ({ ...v, name: e.target.value }))}
                    className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div className="flex gap-2">
                  <select value={newRecipient.role} onChange={e => setNewRecipient(v => ({ ...v, role: e.target.value }))}
                    className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 text-sm outline-none flex-1">
                    {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <Button size="sm" onClick={() => addRecipientMutation.mutate(newRecipient)}
                    disabled={!newRecipient.email || addRecipientMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white">Ekle</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate */}
        <div className="flex gap-2">
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
            <FileText className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? "Olusturuluyor..." : "Simdi Olustur"}
          </Button>
        </div>

        {/* Report list */}
        {reports.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Raporlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer border ${selectedId === r.id ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-700 hover:border-slate-600"}`}
                    onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-slate-300 text-sm">{MONTH_NAMES[(r.reportMonth - 1)]} {r.reportYear}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RiskBadge level={r.riskLevel} />
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === "sent" ? "bg-blue-500/20 text-blue-400" : r.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                            {r.status === "sent" ? "Gonderildi" : r.status === "approved" ? "Onaylandi" : "Taslak"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs">{r.currentScore ?? "?"}/100</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report detail */}
        {displayReport && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-5">
              {displayReport.status === "draft" && !displayReport.executiveSummary ? (
                <div className="flex items-center gap-3 py-4">
                  <Clock className="h-5 w-5 text-yellow-400 animate-spin" />
                  <div>
                    <p className="text-slate-300 text-sm">Rapor hazirlaniyor...</p>
                    <p className="text-xs text-slate-500">AI analizi birkaç dakika surebilir</p>
                  </div>
                </div>
              ) : (
                <ReportDetail report={displayReport} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
