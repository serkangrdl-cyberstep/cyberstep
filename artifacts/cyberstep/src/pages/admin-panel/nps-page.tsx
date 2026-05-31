import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface NpsStats { total_sent: number; total_responded: number; avg_score: string; promoters: number; passives: number; detractors: number; nps_score: string; }
interface NpsSurvey { id: number; customer_id: number; full_name: string; company_name: string; email: string; score: number | null; category: string | null; feedback_text: string | null; sent_at: string; responded_at: string | null; }

const CAT_LABELS: Record<string, { label: string; color: string }> = {
  promoter: { label: "Destekçi", color: "text-emerald-400" },
  passive: { label: "Pasif", color: "text-yellow-400" },
  detractor: { label: "Eleştirmen", color: "text-red-400" },
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }

export default function AdminNps() {
  const { toast } = useToast();
  const [sendId, setSendId] = useState("");

  const { data: stats } = useQuery<NpsStats>({ queryKey: ["/api/crm/nps/stats"], queryFn: () => fetch("/api/crm/nps/stats", { credentials: "include" }).then(r => r.json()) });
  const { data: surveys = [] } = useQuery<NpsSurvey[]>({ queryKey: ["/api/crm/nps"], queryFn: () => fetch("/api/crm/nps", { credentials: "include" }).then(r => r.json()) });

  const sendNps = useMutation({
    mutationFn: (customerId: number) => fetch("/api/crm/nps/send", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId }) }).then(r => r.json()),
    onSuccess: (d) => { if (d.ok) toast({ title: "NPS anketi gönderildi" }); else toast({ title: d.error ?? "Hata", variant: "destructive" }); setSendId(""); },
  });

  const npsScore = Number(stats?.nps_score ?? 0);

  return (
    <AdminLayout title="NPS Takibi" description="Müşteri memnuniyeti ve Net Tavsiye Skoru">
      {/* NPS Score */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 text-center">
            <p className={`text-4xl font-black ${npsScore >= 50 ? "text-emerald-400" : npsScore >= 0 ? "text-yellow-400" : "text-red-400"}`}>{npsScore}</p>
            <p className="text-slate-400 text-xs mt-1">NPS Skoru</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800"><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-white">{stats?.total_responded ?? 0}/{stats?.total_sent ?? 0}</p><p className="text-slate-400 text-xs mt-1">Yanıt / Gönderilen</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-800"><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-white">{stats?.avg_score ?? "-"}</p><p className="text-slate-400 text-xs mt-1">Ortalama Skor</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-emerald-400">Destekçi</span><span className="text-white">{stats?.promoters ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-yellow-400">Pasif</span><span className="text-white">{stats?.passives ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-red-400">Eleştirmen</span><span className="text-white">{stats?.detractors ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual send */}
      <Card className="bg-slate-900 border-slate-800 mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-slate-400 text-xs mb-1 block">Müşteri ID ile NPS gönder</label>
              <Input className="bg-slate-800 border-slate-700 text-white" placeholder="Müşteri ID" value={sendId} onChange={e => setSendId(e.target.value)} />
            </div>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => sendNps.mutate(Number(sendId))} disabled={!sendId || sendNps.isPending}>
              <Send className="h-4 w-4 mr-2" /> Gönder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Survey list */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-base">Anket Sonuçları</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800">{["Müşteri","Skor","Kategori","Yorum","Gönderildi","Yanıtlandı"].map(h => <th key={h} className="text-left text-slate-400 text-xs px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {surveys.map(s => {
                  const cat = s.category ? CAT_LABELS[s.category] : null;
                  return (
                    <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3"><div className="text-white text-xs font-medium">{s.company_name ?? s.full_name}</div><div className="text-slate-500 text-xs">{s.email}</div></td>
                      <td className="px-4 py-3">
                        {s.score !== null ? (
                          <span className={`text-lg font-bold ${s.score >= 9 ? "text-emerald-400" : s.score >= 7 ? "text-yellow-400" : "text-red-400"}`}>{s.score}</span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-4 py-3">{cat ? <span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span> : <span className="text-slate-600 text-xs">Bekliyor</span>}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="text-slate-300 text-xs truncate">{s.feedback_text ?? "-"}</p></td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(s.sent_at)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.responded_at ? fmtDate(s.responded_at) : <span className="text-slate-600">Yanıt yok</span>}</td>
                    </tr>
                  );
                })}
                {surveys.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-12">Henüz anket gönderilmedi</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
