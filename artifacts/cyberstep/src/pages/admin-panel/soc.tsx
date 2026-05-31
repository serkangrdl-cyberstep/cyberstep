import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, ShieldAlert, Radio, X } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface SocCase {
  id: number;
  caseNumber: string;
  customerId: number;
  severity: "critical" | "high" | "medium" | "low";
  escalationLevel: number;
  category: string;
  title: string;
  description: string | null;
  attackNarrative: string | null;
  affectedAssets: string[];
  mitreTechniques: Array<{ id: string; name: string }>;
  status: "open" | "investigating" | "resolved" | "closed" | "false_positive";
  assignedTo: string;
  slaTier: string | null;
  slaDeadline: string | null;
  slaBreached: boolean;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

interface ActivityRow {
  id: number;
  caseId: number;
  actorType: string;
  actorName: string | null;
  actionType: string;
  description: string | null;
  createdAt: string;
}

interface DashboardData {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  slaBreached: number;
  last24h: number;
  activeCases: SocCase[];
  recentCases: SocCase[];
}

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: "Kritik", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "Yüksek", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  medium: { label: "Orta", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  low: { label: "Düşük", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const STATUS: Record<string, string> = {
  open: "Açık",
  investigating: "İnceleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
  false_positive: "Yanlış Alarm",
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

interface LiveEvent { type: string; caseId?: number; customerId?: number | null; ts: string; }

export default function AdminSoc() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [wsConnected, setWsConnected] = useState(false);
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [demoCustomerId, setDemoCustomerId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ["soc-admin-dashboard"],
    queryFn: () => fetch("/api/admin/soc/dashboard", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/soc`);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data as string) as LiveEvent & { data?: { hello?: string } };
        if (ev.data?.hello) return;
        setLiveFeed((prev) => [ev, ...prev].slice(0, 30));
        qc.invalidateQueries({ queryKey: ["soc-admin-dashboard"] });
        if (selectedId && ev.caseId === selectedId) {
          qc.invalidateQueries({ queryKey: ["soc-admin-case", selectedId] });
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demo = useMutation({
    mutationFn: (customerId: number) => fetch("/api/admin/soc/demo/trigger", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    }).then(r => r.json()),
    onSuccess: (d: { ok?: boolean; error?: string; eventsCreated?: number }) => {
      if (d.ok) {
        toast({ title: "Demo tetiklendi", description: `${d.eventsCreated} olay üretildi ve triyaj edildi.` });
        qc.invalidateQueries({ queryKey: ["soc-admin-dashboard"] });
      } else {
        toast({ title: "Demo tetiklenemedi", description: d.error ?? "Hata oluştu.", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Hata", description: "Demo tetiklenemedi.", variant: "destructive" }),
  });

  const eventLabel = (t: string) => ({
    new_alert: "Yeni uyarı", case_created: "Vaka açıldı", case_updated: "Vaka güncellendi",
    case_closed: "Vaka kapatıldı", sla_warning: "SLA uyarısı", escalation: "Eskalasyon",
    playbook_progress: "Playbook adımı",
  }[t] ?? t);

  const stat = (label: string, value: number | undefined, accent?: string) => (
    <Card className="bg-slate-800/40 border-slate-700">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value ?? "—"}</p>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="SOC Operasyon Merkezi" description="Yapay zeka destekli triyaj, vaka yönetimi ve canlı tehdit akışı">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={wsConnected ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-400"}>
              <Radio className={`h-3 w-3 mr-1 ${wsConnected ? "text-emerald-400" : "text-slate-500"}`} />
              {wsConnected ? "Canlı bağlı" : "Bağlantı yok"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input value={demoCustomerId} onChange={(e) => setDemoCustomerId(e.target.value)} placeholder="Müşteri ID"
              className="bg-slate-800 border-slate-700 text-white w-32 h-9" />
            <Button size="sm" variant="outline" className="border-slate-700"
              onClick={() => { const id = Number(demoCustomerId); if (id > 0) demo.mutate(id); }}
              disabled={demo.isPending || !demoCustomerId}>
              {demo.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />} Demo Tetikle
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {stat("Toplam Vaka", dashboard?.total)}
          {stat("Açık", dashboard?.open, "text-yellow-400")}
          {stat("Kritik", dashboard?.critical, "text-red-400")}
          {stat("Yüksek", dashboard?.high, "text-orange-400")}
          {stat("SLA İhlali", dashboard?.slaBreached, "text-red-400")}
          {stat("Son 24s", dashboard?.last24h)}
          {stat("Çözüldü", dashboard?.resolved, "text-emerald-400")}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
            <CardHeader><CardTitle className="text-white text-lg">Aktif Vakalar</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!dashboard?.activeCases?.length ? (
                <p className="text-slate-400 text-sm py-8 text-center">Aktif vaka yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                      <th className="text-left p-3">Vaka</th><th className="text-left p-3">Önem</th><th className="text-left p-3">Başlık</th>
                      <th className="text-left p-3">Müşteri</th><th className="text-left p-3">Durum</th><th className="text-left p-3">SLA</th><th className="text-left p-3">Zaman</th>
                    </tr></thead>
                    <tbody>
                      {dashboard.activeCases.map((c) => (
                        <tr key={c.id} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/40 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                          <td className="p-3 font-mono text-xs">{c.caseNumber}</td>
                          <td className="p-3"><Badge variant="outline" className={SEV[c.severity]?.cls}>{SEV[c.severity]?.label}</Badge></td>
                          <td className="p-3">{c.title}</td>
                          <td className="p-3">#{c.customerId}</td>
                          <td className="p-3">{STATUS[c.status]}</td>
                          <td className="p-3">{c.slaBreached ? <span className="text-red-400">İhlal</span> : <span className="text-slate-500">{c.slaTier ?? "-"}</span>}</td>
                          <td className="p-3 text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><Radio className="h-4 w-4 text-emerald-400" /> Canlı Akış</CardTitle></CardHeader>
            <CardContent>
              {liveFeed.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">Henüz canlı olay yok.</p>
              ) : (
                <ul className="space-y-2 max-h-[420px] overflow-y-auto">
                  {liveFeed.map((ev, i) => (
                    <li key={i} className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                      <span className="text-slate-300">{eventLabel(ev.type)}{ev.caseId ? ` · #${ev.caseId}` : ""}</span>
                      <span className="text-slate-500">{new Date(ev.ts).toLocaleTimeString("tr-TR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedId !== null && <CaseDrawer caseId={selectedId} onClose={() => setSelectedId(null)} />}
    </AdminLayout>
  );
}

function CaseDrawer({ caseId, onClose }: { caseId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateLevel, setEscalateLevel] = useState(1);
  const [closeReason, setCloseReason] = useState("");

  const { data, isLoading } = useQuery<{ case: SocCase; activity: ActivityRow[] }>({
    queryKey: ["soc-admin-case", caseId],
    queryFn: () => fetch(`/api/admin/soc/cases/${caseId}`, { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["soc-admin-case", caseId] });
    qc.invalidateQueries({ queryKey: ["soc-admin-dashboard"] });
  };

  const addNote = useMutation({
    mutationFn: () => fetch(`/api/admin/soc/cases/${caseId}/note`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Not eklendi" }); setNote(""); invalidate(); },
  });

  const acknowledge = useMutation({
    mutationFn: () => fetch(`/api/admin/soc/cases/${caseId}`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "investigating", acknowledge: true }),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Vaka üstlenildi" }); invalidate(); },
  });

  const escalate = useMutation({
    mutationFn: () => fetch(`/api/admin/soc/cases/${caseId}/escalate`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: escalateLevel, reason: escalateReason }),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Vaka eskale edildi" }); setEscalateReason(""); invalidate(); },
  });

  const closeCase = useMutation({
    mutationFn: (falsePositive: boolean) => fetch(`/api/admin/soc/cases/${caseId}/close`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: closeReason || "Operatör tarafından kapatıldı", falsePositive }),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Vaka kapatıldı" }); invalidate(); onClose(); },
  });

  const c = data?.case;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-400" /> Vaka Detayı</h2>
          <Button variant="ghost" size="icon" className="text-slate-400" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {isLoading || !c ? (
          <div className="flex items-center gap-2 text-slate-400 p-6"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...</div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-slate-400">{c.caseNumber}</span>
                <Badge variant="outline" className={SEV[c.severity]?.cls}>{SEV[c.severity]?.label}</Badge>
                <Badge variant="outline" className="border-slate-600 text-slate-300">{STATUS[c.status]}</Badge>
                {c.escalationLevel > 0 && <Badge variant="outline" className="border-red-500/40 text-red-300">Seviye {c.escalationLevel}</Badge>}
              </div>
              <h3 className="text-lg font-semibold text-white">{c.title}</h3>
              <p className="text-xs text-slate-500 mt-1">Müşteri #{c.customerId} · {fmtDate(c.createdAt)} · Atanan: {c.assignedTo}</p>
            </div>

            {c.attackNarrative && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-xs text-slate-400 mb-1">Saldırı Senaryosu</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.attackNarrative}</p>
              </div>
            )}

            {c.description && <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.description}</p>}

            {c.affectedAssets?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Etkilenen Varlıklar / IP</p>
                <div className="flex flex-wrap gap-1.5">{c.affectedAssets.map((a) => <Badge key={a} variant="outline" className="border-slate-700 text-slate-300 font-mono text-xs">{a}</Badge>)}</div>
              </div>
            )}

            {c.mitreTechniques?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">MITRE ATT&CK</p>
                <div className="flex flex-wrap gap-1.5">{c.mitreTechniques.map((m) => <Badge key={m.id} variant="outline" className="border-blue-500/30 text-blue-300 text-xs">{m.id} · {m.name}</Badge>)}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" className="border-slate-700" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending || !!c.acknowledgedAt}>
                {c.acknowledgedAt ? "Üstlenildi" : "Üstlen"}
              </Button>
            </div>

            <div className="rounded-lg border border-slate-700 p-4 space-y-3">
              <p className="text-sm font-medium text-white">Eskalasyon</p>
              <div className="flex gap-2">
                <select value={escalateLevel} onChange={(e) => setEscalateLevel(Number(e.target.value))} className="bg-slate-800 border border-slate-700 text-white rounded-md px-2 text-sm">
                  {[1, 2, 3, 4].map((l) => <option key={l} value={l}>Seviye {l}</option>)}
                </select>
                <Input value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} placeholder="Eskalasyon nedeni" className="bg-slate-800 border-slate-700 text-white" />
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-300" onClick={() => escalate.mutate()} disabled={escalate.isPending || !escalateReason}>Eskale Et</Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 p-4 space-y-3">
              <p className="text-sm font-medium text-white">Not Ekle</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Analist notu..." className="bg-slate-800 border-slate-700 text-white" rows={2} />
              <Button size="sm" variant="outline" className="border-slate-700" onClick={() => addNote.mutate()} disabled={addNote.isPending || !note}>Not Kaydet</Button>
            </div>

            <div className="rounded-lg border border-slate-700 p-4 space-y-3">
              <p className="text-sm font-medium text-white">Vakayı Kapat</p>
              <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Kapatma nedeni" className="bg-slate-800 border-slate-700 text-white" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-300" onClick={() => closeCase.mutate(false)} disabled={closeCase.isPending}>Çözüldü Olarak Kapat</Button>
                <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => closeCase.mutate(true)} disabled={closeCase.isPending}>Yanlış Alarm</Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-2">Etkinlik Zaman Çizelgesi</p>
              {!data?.activity?.length ? (
                <p className="text-slate-500 text-sm">Kayıt yok.</p>
              ) : (
                <ul className="space-y-2">
                  {data.activity.map((a) => (
                    <li key={a.id} className="text-xs border-l-2 border-slate-700 pl-3 py-0.5">
                      <span className="text-slate-300">{a.description ?? a.actionType}</span>
                      <span className="text-slate-500 block">{a.actorName ?? a.actorType} · {fmtDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
