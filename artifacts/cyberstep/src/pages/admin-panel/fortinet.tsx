import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Summary {
  total: number;
  connected: number;
  autoBlock: number;
  totalEvents: number;
  totalCorrelations: number;
  totalBlocks: number;
}

interface Stream {
  id: number;
  status: "pending" | "connected" | "error" | "disabled";
  demoMode: boolean;
  autoBlockEnabled: boolean;
  fmStatus: "unconfigured" | "ok" | "error";
  eventsReceived: number;
  correlationsCount: number;
  blocksCount: number;
  fabricDevices: Array<{ name: string }>;
  lastEventAt: string | null;
}

interface AdminCorrelation {
  id: number;
  customerId: number;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  autoBlocked: boolean;
  createdAt: string;
}

const SEV: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Bağlı", cls: "border-emerald-500/40 text-emerald-300" },
  pending: { label: "Bekliyor", cls: "border-yellow-500/40 text-yellow-300" },
  error: { label: "Hata", cls: "border-red-500/40 text-red-300" },
  disabled: { label: "Devre Dışı", cls: "border-slate-600 text-slate-400" },
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

export default function AdminFortinet() {
  const { data: summary } = useQuery<Summary>({
    queryKey: ["admin-fabric-summary"],
    queryFn: () => fetch("/api/admin/fabric/summary", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: streams = [] } = useQuery<Stream[]>({
    queryKey: ["admin-fabric-streams"],
    queryFn: () => fetch("/api/admin/fabric/streams", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: correlations = [] } = useQuery<AdminCorrelation[]>({
    queryKey: ["admin-fabric-correlations"],
    queryFn: () => fetch("/api/admin/fabric/correlations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const stat = (label: string, value: number | undefined) => (
    <Card className="bg-slate-800/40 border-slate-700">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="Fortinet Security Fabric" description="Müşteri entegrasyonları, olay akışı ve AI korelasyon izleme">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stat("Entegrasyon", summary?.total)}
          {stat("Bağlı", summary?.connected)}
          {stat("Otomatik Engelleme", summary?.autoBlock)}
          {stat("Toplam Olay", summary?.totalEvents)}
          {stat("Korelasyon", summary?.totalCorrelations)}
          {stat("Engellenen IP", summary?.totalBlocks)}
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-lg">Entegrasyonlar</CardTitle></CardHeader>
          <CardContent className="p-0">
            {streams.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">Henüz entegrasyon yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left p-3">Müşteri</th><th className="text-left p-3">Durum</th><th className="text-left p-3">FortiManager</th>
                    <th className="text-left p-3">Olay</th><th className="text-left p-3">Korelasyon</th><th className="text-left p-3">Engel</th>
                    <th className="text-left p-3">Cihaz</th><th className="text-left p-3">Son Olay</th>
                  </tr></thead>
                  <tbody>
                    {streams.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800/60 text-slate-300">
                        <td className="p-3">#{s.id}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={STATUS[s.status]?.cls}>{STATUS[s.status]?.label}</Badge>
                          {s.demoMode && <Badge variant="outline" className="ml-1 border-blue-500/40 text-blue-300">Demo</Badge>}
                        </td>
                        <td className="p-3">
                          {s.autoBlockEnabled
                            ? <span className={s.fmStatus === "ok" ? "text-emerald-400" : "text-red-400"}>{s.fmStatus === "ok" ? "Aktif" : "Hata"}</span>
                            : <span className="text-slate-500">Kapalı</span>}
                        </td>
                        <td className="p-3">{s.eventsReceived}</td>
                        <td className="p-3">{s.correlationsCount}</td>
                        <td className="p-3">{s.blocksCount}</td>
                        <td className="p-3">{s.fabricDevices.length}</td>
                        <td className="p-3 text-xs text-slate-500">{fmtDate(s.lastEventAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-lg">Son Korelasyonlar</CardTitle></CardHeader>
          <CardContent className="p-0">
            {correlations.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">Henüz korelasyon yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left p-3">Önem</th><th className="text-left p-3">Başlık</th><th className="text-left p-3">Müşteri</th>
                    <th className="text-left p-3">Güven</th><th className="text-left p-3">Engel</th><th className="text-left p-3">Zaman</th>
                  </tr></thead>
                  <tbody>
                    {correlations.map((c) => (
                      <tr key={c.id} className="border-b border-slate-800/60 text-slate-300">
                        <td className="p-3"><Badge variant="outline" className={SEV[c.severity]}>{c.severity}</Badge></td>
                        <td className="p-3">{c.title}</td>
                        <td className="p-3">#{c.customerId}</td>
                        <td className="p-3">%{c.confidence}</td>
                        <td className="p-3">{c.autoBlocked ? <span className="text-red-400">Evet</span> : <span className="text-slate-500">Hayır</span>}</td>
                        <td className="p-3 text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
