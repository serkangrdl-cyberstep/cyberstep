import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, Loader2, ShieldAlert, Ban, Radio, FileDown, Lock, Activity,
  ScrollText, AlertTriangle, Clock, CheckCircle, Network, ExternalLink,
  WifiOff, RefreshCw, Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

interface SocCase {
  id: number;
  caseNumber: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  attackNarrative: string | null;
  affectedAssets: string[];
  status: "open" | "investigating" | "resolved" | "closed" | "false_positive";
  slaBreached: boolean;
  createdAt: string;
}

interface DashboardData {
  socTier: "none" | "lite" | "standart" | "pro";
  socEnabled: boolean;
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

interface BlockAction {
  id: number;
  ip: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

interface OutageWindow {
  outageStart: string;
  outageEnd: string | null;
  durationMinutes: number | null;
  totalCasesDuringOutage: number;
  transferredCases: number;
  stillMissingCases: number;
  lastError: string | null;
  recovered: boolean;
}

interface OutageSummary {
  hasConfig: boolean;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  connCheckAlertedAt: string | null;
  outages: OutageWindow[];
  pendingSyncErrors: number;
}

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: "Kritik", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "Yüksek", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  medium: { label: "Orta", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  low: { label: "Düşük", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const STATUS: Record<string, string> = {
  open: "Açık", investigating: "İnceleniyor", resolved: "Çözüldü", closed: "Kapatıldı", false_positive: "Yanlış Alarm",
};

const TIER: Record<string, string> = { lite: "Lite", standart: "Standart", pro: "Pro", none: "Yok" };

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

export default function SocDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customer } = useRequireCustomer();
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/giris"; },
  });

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["soc-portal-dashboard"],
    queryFn: () => fetch("/api/portal/soc/dashboard", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
    refetchInterval: 30000,
  });

  const enabled = !!dashboard?.socEnabled;

  const { data: blocks = [] } = useQuery<BlockAction[]>({
    queryKey: ["soc-portal-blocks"],
    queryFn: () => fetch("/api/portal/soc/blocked-ips", { credentials: "include" }).then(r => r.json()).then((d) => d.blocks ?? []),
    enabled: !!customer && enabled,
    refetchInterval: 30000,
  });

  interface SnIncidentMap { snNumber: string; snState: number; instanceUrl: string }
  const { data: snIncidents } = useQuery<{ incidents: Array<{ socCaseId: number; snNumber: string; snState: number; instanceUrl: string }> }>({
    queryKey: ["soc-sn-incidents"],
    queryFn: () => fetch("/api/integrations/servicenow/incidents", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && enabled,
    refetchInterval: 60000,
  });
  const snMap = new Map<number, SnIncidentMap>();
  for (const inc of snIncidents?.incidents ?? []) {
    snMap.set(inc.socCaseId, { snNumber: inc.snNumber, snState: inc.snState, instanceUrl: inc.instanceUrl });
  }
  const SN_STATE_LABEL: Record<number, string> = { 1: "Yeni", 2: "Devam", 3: "Beklemede", 6: "Çözüldü", 7: "Kapatıldı" };

  const { data: outageSummary } = useQuery<OutageSummary>({
    queryKey: ["soc-sn-outage-summary"],
    queryFn: () => fetch("/api/integrations/servicenow/outage-summary", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && enabled,
    refetchInterval: 120000,
  });

  interface PendingCase {
    id: number;
    caseNumber: string;
    title: string;
    severity: string;
    category: string;
    status: string;
    createdAt: string;
  }
  const { data: pendingCasesData, refetch: refetchPending } = useQuery<{ hasConfig: boolean; cases: PendingCase[] }>({
    queryKey: ["soc-sn-pending-cases"],
    queryFn: () => fetch("/api/integrations/servicenow/pending-cases", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer && enabled && !!outageSummary?.hasConfig,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!enabled) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/portal/soc`);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data as string) as { data?: { hello?: string } };
        if (ev.data?.hello) return;
        qc.invalidateQueries({ queryKey: ["soc-portal-dashboard"] });
        qc.invalidateQueries({ queryKey: ["soc-portal-blocks"] });
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [enabled, qc]);

  const weeklyReport = useMutation({
    mutationFn: () => fetch("/api/portal/soc/reports/weekly", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (d: { ok: boolean; message: string }) => toast({ title: d.ok ? "Rapor gönderildi" : "Gönderilemedi", description: d.message, variant: d.ok ? "default" : "destructive" }),
    onError: () => toast({ title: "Hata", description: "Rapor gönderilemedi.", variant: "destructive" }),
  });

  if (!customer) return null;

  const header = (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            <span className="font-bold text-lg text-white">CyberStep.io</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            <Link href="/hesabim" className="text-slate-400 hover:text-white text-sm transition-colors">Hesabım</Link>
            <Link href="/raporlarim" className="text-slate-400 hover:text-white text-sm transition-colors">Raporlarım</Link>
            <Link href="/hesabim/fortinet-entegrasyonu" className="text-slate-400 hover:text-white text-sm transition-colors">Fortinet</Link>
            <Link href="/hesabim/soc" className="text-white text-sm font-medium">SOC</Link>
          </nav>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => logout.mutate()}>
          <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
        </Button>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-secondary">
      {header}
      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-emerald-400" /> AI Destekli SOC
            </h1>
            <p className="text-slate-400 mt-1">7/24 yapay zeka destekli güvenlik operasyon merkezi: tehdit triyajı, otomatik müdahale ve vaka yönetimi.</p>
          </div>
          {enabled && (
            <Badge variant="outline" className={wsConnected ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-400"}>
              <Radio className={`h-3 w-3 mr-1 ${wsConnected ? "text-emerald-400" : "text-slate-500"}`} />
              {wsConnected ? "Canlı" : "Çevrimdışı"}
            </Badge>
          )}
        </div>

        {isLoading || !dashboard ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...</div>
        ) : !enabled ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center space-y-4">
              <Lock className="h-10 w-10 text-slate-600 mx-auto" />
              <div>
                <p className="text-white font-medium">SOC servisi hesabınızda etkin değil</p>
                <p className="text-slate-400 text-sm mt-1">AI Destekli SOC ile tehditler otomatik triyaj edilir, kritik olaylarda anında bilgilendirilirsiniz. Etkinleştirmek için bizimle iletişime geçin.</p>
              </div>
              <Link href="/iletisim"><Button className="bg-emerald-600 hover:bg-emerald-500">Servisi Etkinleştir</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">Plan: {TIER[dashboard.socTier]}</Badge>
              <Button size="sm" variant="outline" className="border-slate-700" onClick={() => weeklyReport.mutate()} disabled={weeklyReport.isPending}>
                {weeklyReport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />} Haftalık Raporu E-postala
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={<Activity className="h-4 w-4" />} label="Son 24 Saat" value={dashboard.last24h} />
              <StatCard icon={<ShieldAlert className="h-4 w-4" />} label="Açık Vaka" value={dashboard.open} accent="text-yellow-400" />
              <StatCard icon={<ShieldAlert className="h-4 w-4" />} label="Kritik" value={dashboard.critical} accent="text-red-400" />
              <StatCard icon={<Ban className="h-4 w-4" />} label="Engellenen IP" value={blocks.length} />
            </div>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white text-lg">Aktif Vakalar</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!dashboard.activeCases?.length ? (
                  <p className="text-slate-400 text-sm py-8 text-center">Aktif güvenlik vakası yok. Sistemleriniz izleniyor.</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {dashboard.activeCases.map((c) => {
                      const sn = snMap.get(c.id);
                      return (
                        <div key={c.id} className="p-4">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className={SEV[c.severity]?.cls}>{SEV[c.severity]?.label}</Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">{STATUS[c.status]}</Badge>
                            {c.slaBreached && <Badge variant="outline" className="border-red-500/40 text-red-300">SLA İhlali</Badge>}
                            {sn && (
                              <a
                                href={`${sn.instanceUrl}/nav_to.do?uri=incident_list.do?sysparm_query=number=${sn.snNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[10px] font-mono text-violet-400 hover:text-violet-300 border border-violet-500/30 bg-violet-500/10 rounded px-1.5 py-0.5"
                              >
                                <Network className="h-2.5 w-2.5" />
                                <span>{sn.snNumber}</span>
                                <span className="text-violet-300/70">·</span>
                                <span>{SN_STATE_LABEL[sn.snState] ?? `S${sn.snState}`}</span>
                                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                              </a>
                            )}
                            <span className="font-mono text-xs text-slate-500 ml-auto">{c.caseNumber}</span>
                          </div>
                          <p className="text-white text-sm font-medium">{c.title}</p>
                          {c.attackNarrative && <p className="text-slate-400 text-sm mt-1 line-clamp-3">{c.attackNarrative}</p>}
                          <p className="text-xs text-slate-500 mt-2">{fmtDate(c.createdAt)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <KvkkSection customerId={customer.id} />

            {pendingCasesData?.hasConfig && (pendingCasesData?.cases?.length ?? 0) > 0 && (
              <PendingCasesSection
                cases={pendingCasesData.cases}
                onRetried={() => {
                  void refetchPending();
                  qc.invalidateQueries({ queryKey: ["soc-sn-incidents"] });
                  qc.invalidateQueries({ queryKey: ["soc-sn-outage-summary"] });
                }}
              />
            )}

            {outageSummary?.hasConfig && (
              <ServiceNowOutageSection summary={outageSummary} />
            )}

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white text-lg">Engellenen IP Adresleri</CardTitle></CardHeader>
              <CardContent className="p-0">
                {blocks.length === 0 ? (
                  <p className="text-slate-400 text-sm py-8 text-center">Henüz engellenen IP yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                        <th className="text-left p-3">IP</th><th className="text-left p-3">Neden</th><th className="text-left p-3">Durum</th><th className="text-left p-3">Zaman</th>
                      </tr></thead>
                      <tbody>
                        {blocks.map((b) => (
                          <tr key={b.id} className="border-b border-slate-800/60 text-slate-300">
                            <td className="p-3 font-mono text-xs">{b.ip}</td>
                            <td className="p-3">{b.reason ?? "-"}</td>
                            <td className="p-3">{b.status}</td>
                            <td className="p-3 text-xs text-slate-500">{fmtDate(b.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

interface KvkkNotif {
  id: number; socCaseId: number; caseNumber: string; caseTitle: string;
  status: string; btkReferenceNo: string | null; deadline72h: string;
  sentAt: string | null; aiReasoning: string | null; urgency: string | null;
}

const KVKK_STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Taslak",        cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  sent:     { label: "Gönderildi",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  tracking: { label: "Takipte",       cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  closed:   { label: "Kapatıldı",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

function KvkkCountdown({ deadline }: { deadline: string }) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return <span className="text-red-400 font-semibold text-xs">Süre Doldu</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const cls = h < 24 ? "text-red-400" : h < 48 ? "text-yellow-400" : "text-emerald-400";
  return <span className={`${cls} font-semibold text-xs`}>{h}s {m}d kaldı</span>;
}

function KvkkSection({ customerId: _customerId }: { customerId: number }) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ notifications: KvkkNotif[] }>({
    queryKey: ["kvkk-notifications"],
    queryFn: () => fetch("/api/portal/kvkk/notifications", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const notifications = (data?.notifications ?? []).filter(n => n.status !== "closed");
  if (!isLoading && notifications.length === 0) return null;

  async function updateStatus(id: number, status: string, btkRefNo?: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/portal/kvkk/notifications/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, btkReferenceNo: btkRefNo }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      await qc.invalidateQueries({ queryKey: ["kvkk-notifications"] });
      toast({ title: "KVKK bildirimi güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Güncelleme başarısız", variant: "destructive" });
    } finally { setUpdatingId(null); }
  }

  return (
    <Card className="bg-slate-900 border-red-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-red-400" />
          KVKK 12. Madde Bildirimleri
        </CardTitle>
        <p className="text-slate-400 text-sm">Veri ihlali bildirimi gerektirebilecek vakalar — 72 saat yasal süreniz vardır.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        ) : (
          notifications.map((n) => {
            const isOverdue = new Date(n.deadline72h).getTime() < Date.now();
            return (
              <div key={n.id} className={`rounded-lg border p-4 space-y-3 ${isOverdue && n.status === "draft" ? "border-red-500/50 bg-red-500/5" : "border-slate-700 bg-slate-800/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{n.caseNumber}</span>
                      <Badge className={`text-xs ${KVKK_STATUS[n.status]?.cls ?? ""}`}>{KVKK_STATUS[n.status]?.label ?? n.status}</Badge>
                      {n.btkReferenceNo && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" />BTK: {n.btkReferenceNo}</span>}
                    </div>
                    <p className="text-white text-sm font-medium mt-1">{n.caseTitle}</p>
                    {n.aiReasoning && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{n.aiReasoning}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <KvkkCountdown deadline={n.deadline72h} />
                    </div>
                    {isOverdue && n.status === "draft" && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                        <span className="text-red-400 text-xs">Bildirim yapılmadı</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 text-xs h-7"
                    onClick={() => window.open(`/api/portal/kvkk/notifications/${n.id}/pdf`, "_blank")}
                  >
                    <FileDown className="h-3 w-3 mr-1" /> Mektup PDF
                  </Button>
                  {n.status === "draft" && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-500 text-xs h-7"
                      disabled={updatingId === n.id}
                      onClick={() => updateStatus(n.id, "sent")}
                    >
                      {updatingId === n.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                      Gönderildi Olarak İşaretle
                    </Button>
                  )}
                  {n.status === "sent" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/40 text-yellow-400 text-xs h-7"
                      disabled={updatingId === n.id}
                      onClick={() => updateStatus(n.id, "tracking")}
                    >
                      Takibe Al
                    </Button>
                  )}
                  {(n.status === "sent" || n.status === "tracking") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-400 text-xs h-7"
                      disabled={updatingId === n.id}
                      onClick={() => {
                        const refNo = prompt("BTK Takip Numarası girin:");
                        if (refNo) updateStatus(n.id, "closed", refNo);
                      }}
                    >
                      Kapatıldı (BTK Ref. No Gir)
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">{icon}{label}</div>
        <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

interface PendingCaseRow {
  id: number;
  caseNumber: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  createdAt: string;
}

function PendingCasesSection({ cases, onRetried }: { cases: PendingCaseRow[]; onRetried: () => void }) {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState<Set<number>>(new Set());
  const [retryingAll, setRetryingAll] = useState(false);

  async function retryCase(id: number) {
    setRetrying(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/integrations/servicenow/pending-cases/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (data.ok) {
        toast({ title: "Aktarıldı", description: data.message });
        onRetried();
      } else {
        toast({ title: "Aktarılamadı", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Hata", description: "Bağlantı hatası oluştu.", variant: "destructive" });
    } finally {
      setRetrying(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function retryAll() {
    setRetryingAll(true);
    let succeeded = 0;
    let failed = 0;
    for (const c of cases) {
      try {
        const res = await fetch(`/api/integrations/servicenow/pending-cases/${c.id}/retry`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json()) as { ok: boolean };
        if (data.ok) succeeded++; else failed++;
      } catch {
        failed++;
      }
    }
    setRetryingAll(false);
    toast({
      title: `Toplu aktarım tamamlandı`,
      description: `${succeeded} başarılı, ${failed} başarısız`,
      variant: failed > 0 ? "destructive" : "default",
    });
    onRetried();
  }

  return (
    <Card className="bg-slate-900 border-orange-500/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            ServiceNow'a Aktarılamayan Vakalar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-xs">
              {cases.length} aktarılmamış
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10 text-xs h-7"
              disabled={retryingAll}
              onClick={() => void retryAll()}
            >
              {retryingAll
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Aktarılıyor...</>
                : <><RefreshCw className="h-3 w-3 mr-1" /> Tümünü Yeniden Gönder</>}
            </Button>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Bu vakalar ServiceNow'a henüz iletilmedi. Bağlantı sorunu varsa düzelttikten sonra yeniden gönderebilirsiniz.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800">
          {cases.map((c) => {
            const sev = SEV[c.severity];
            const isRetrying = retrying.has(c.id);
            return (
              <div key={c.id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={sev?.cls ?? ""}>{sev?.label ?? c.severity}</Badge>
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">{STATUS[c.status] ?? c.status}</Badge>
                    <span className="font-mono text-xs text-slate-500">{c.caseNumber}</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-slate-500">{fmtDate(c.createdAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs h-7 shrink-0"
                  disabled={isRetrying || retryingAll}
                  onClick={() => void retryCase(c.id)}
                >
                  {isRetrying
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gönderiliyor</>
                    : <><Send className="h-3 w-3 mr-1" /> Yeniden Gönder</>}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function fmtDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

function ServiceNowOutageSection({ summary }: { summary: OutageSummary }) {
  // An ongoing outage = most recent outage window is not recovered,
  // confirmed by a current lastSyncError on the config.
  const latestOutage = summary.outages[0];
  const isCurrentlyDown = !!summary.lastSyncError && latestOutage !== undefined && !latestOutage.recovered;

  // Fallback: if conn-check log is sparse/absent, derive last-alerted time from
  // connCheckAlertedAt (set by the automated check cron when a failure was detected).
  const lastAlertTs = summary.connCheckAlertedAt;

  return (
    <Card className={`bg-slate-900 ${isCurrentlyDown ? "border-red-500/40" : "border-slate-800"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Network className="h-5 w-5 text-violet-400" />
            ServiceNow Bağlantı Geçmişi
          </CardTitle>
          <div className="flex items-center gap-2">
            {summary.pendingSyncErrors > 0 && (
              <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {summary.pendingSyncErrors} bekleyen iletim hatası
              </Badge>
            )}
            {isCurrentlyDown ? (
              <Badge variant="outline" className="border-red-500/40 text-red-300 text-xs">
                <WifiOff className="h-3 w-3 mr-1" /> Bağlantı Kesik
              </Badge>
            ) : summary.lastSyncAt ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Bağlı
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="space-y-0.5 mt-1">
          {summary.lastSyncAt && (
            <p className="text-slate-400 text-xs">Son başarılı senkronizasyon: {fmtDate(summary.lastSyncAt)}</p>
          )}
          {lastAlertTs && !summary.lastSyncAt && (
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-400" />
              Son uyarı zamanı: {fmtDate(lastAlertTs)}
            </p>
          )}
          {lastAlertTs && isCurrentlyDown && (
            <p className="text-orange-400 text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Kesinti uyarısı gönderildi: {fmtDate(lastAlertTs)}
            </p>
          )}
          {summary.lastSyncError && (
            <p className="text-red-400 text-xs truncate">Hata: {summary.lastSyncError}</p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {summary.outages.length === 0 ? (
          <div className="py-4 text-center space-y-1">
            <p className="text-slate-400 text-sm">Kayıtlı bağlantı kesintisi yok.</p>
            {lastAlertTs && (
              <p className="text-slate-500 text-xs">
                Önceki uyarı: {fmtDate(lastAlertTs)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {summary.outages.map((outage, idx) => {
              const ongoing = outage.outageEnd === null;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 space-y-3 ${ongoing ? "border-red-500/40 bg-red-500/5" : "border-slate-700 bg-slate-800/40"}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ongoing ? (
                          <Badge variant="outline" className="border-red-500/40 text-red-300 text-xs">
                            <WifiOff className="h-3 w-3 mr-1" /> Devam Ediyor
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" /> Kurtarıldı
                          </Badge>
                        )}
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(outage.outageStart)}
                          {outage.outageEnd && <> &rarr; {fmtDate(outage.outageEnd)}</>}
                        </span>
                        <span className="text-slate-500 text-xs">({fmtDuration(outage.durationMinutes)})</span>
                      </div>
                      {outage.lastError && (
                        <p className="text-slate-400 text-xs line-clamp-1 truncate">{outage.lastError}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold leading-none ${outage.stillMissingCases > 0 ? "text-orange-400" : "text-slate-400"}`}>
                        {outage.stillMissingCases}
                      </p>
                      <p className="text-slate-500 text-xs">kaçırılan vaka</p>
                    </div>
                  </div>

                  {outage.totalCasesDuringOutage > 0 && (
                    <div className="flex items-center gap-4 pt-1 border-t border-slate-700/60">
                      <div className="text-xs text-slate-400">
                        <span className="font-medium text-white">{outage.totalCasesDuringOutage}</span> vaka kesinti sırasında oluştu
                      </div>
                      {outage.transferredCases > 0 && (
                        <div className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          {outage.transferredCases} aktarıldı
                        </div>
                      )}
                      {outage.stillMissingCases > 0 && (
                        <div className="flex items-center gap-1 text-xs text-orange-400">
                          <AlertTriangle className="h-3 w-3" />
                          {outage.stillMissingCases} aktarılmadı
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
