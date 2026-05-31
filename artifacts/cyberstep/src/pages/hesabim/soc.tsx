import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, Loader2, ShieldAlert, Ban, Radio, FileDown, Lock, Activity,
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
                    {dashboard.activeCases.map((c) => (
                      <div key={c.id} className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={SEV[c.severity]?.cls}>{SEV[c.severity]?.label}</Badge>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">{STATUS[c.status]}</Badge>
                          {c.slaBreached && <Badge variant="outline" className="border-red-500/40 text-red-300">SLA İhlali</Badge>}
                          <span className="font-mono text-xs text-slate-500 ml-auto">{c.caseNumber}</span>
                        </div>
                        <p className="text-white text-sm font-medium">{c.title}</p>
                        {c.attackNarrative && <p className="text-slate-400 text-sm mt-1 line-clamp-3">{c.attackNarrative}</p>}
                        <p className="text-xs text-slate-500 mt-2">{fmtDate(c.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
