import { useQuery } from "@tanstack/react-query";
import { Globe, Shield, AlertTriangle, Activity, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";

interface DnsStats {
  watched: number;
  changes24h: number;
  critical24h: number;
}

interface DnsChangeEvent {
  id: number;
  customer_id: number;
  customer_email: string | null;
  company_name: string | null;
  domain: string;
  record_type: string;
  old_values: unknown;
  new_values: unknown;
  severity: string;
  soc_case_id: number | null;
  soc_case_number: string | null;
  detected_at: string;
}

interface WatchedDomain {
  id: number;
  customer_id: number;
  customer_email: string | null;
  company_name: string | null;
  domain: string;
  is_active: boolean;
  created_at: string;
  last_checked_at: string | null;
  change_count: number;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const SEV_LABELS: Record<string, string> = {
  critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük",
};

function formatValue(type: string, values: unknown): string {
  if (!values || (Array.isArray(values) && values.length === 0)) return "(boş)";
  if (type === "MX") {
    const mx = values as Array<{ priority: number; exchange: string }>;
    return mx.map(r => `${r.priority} ${r.exchange}`).slice(0, 3).join(", ");
  }
  if (type === "TXT") {
    const txt = values as string[][];
    return txt.map(r => r.join("")).slice(0, 2).join(" | ");
  }
  return (values as string[]).slice(0, 4).join(", ");
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminDnsIzleme() {
  const { data: stats } = useQuery<DnsStats>({
    queryKey: ["admin-dns-stats"],
    queryFn: () => fetch("/api/admin-panel/dns-monitor/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: changes = [], isLoading: changesLoading } = useQuery<DnsChangeEvent[]>({
    queryKey: ["admin-dns-changes"],
    queryFn: () => fetch("/api/admin-panel/dns-monitor/changes", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: domains = [] } = useQuery<WatchedDomain[]>({
    queryKey: ["admin-dns-domains"],
    queryFn: () => fetch("/api/admin-panel/dns-monitor/domains", { credentials: "include" }).then(r => r.json()),
  });

  return (
    <AdminLayout title="DNS İzleme">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DNS Değişiklik İzleyici</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Müşterilere ait domain DNS kayıtlarındaki değişiklikler — önem sırasına göre
          </p>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">İzlenen Domain</p>
                <p className="text-2xl font-bold">{stats?.watched ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Değişiklik (24 sa)</p>
                <p className="text-2xl font-bold">{stats?.changes24h ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kritik/Yüksek (24 sa)</p>
                <p className="text-2xl font-bold">{stats?.critical24h ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Değişiklik Geçmişi — önem öncelikli */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              DNS Değişiklikleri
              <span className="text-xs text-muted-foreground font-normal ml-1">
                — kritik/yüksek öncelikli sıralama
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {changesLoading ? (
              <p className="text-sm text-muted-foreground p-6">Yükleniyor...</p>
            ) : changes.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">Henüz DNS değişikliği tespit edilmedi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Önem</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Müşteri</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Domain</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Kayıt</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Eski → Yeni</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">SOC Vaka</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Zaman</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map(c => (
                      <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Badge className={`text-xs border ${SEV_COLORS[c.severity] ?? ""}`}>
                            {SEV_LABELS[c.severity] ?? c.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-xs">{c.company_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.customer_email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{c.domain}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded">{c.record_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[220px]">
                          <p className="font-mono text-muted-foreground truncate">{formatValue(c.record_type, c.old_values)}</p>
                          <p className="font-mono text-emerald-400 truncate">{formatValue(c.record_type, c.new_values)}</p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {c.soc_case_id ? (
                            <a
                              href={`/panel/soc?case=${c.soc_case_id}`}
                              className="flex items-center gap-1 text-primary hover:underline font-mono"
                            >
                              {c.soc_case_number ?? `#${c.soc_case_id}`}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(c.detected_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* İzlenen Domainler */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              İzlenen Domainler ({domains.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">Henüz domain eklenmedi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Müşteri</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Domain</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Durum</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Değişiklik</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Son Kontrol</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Eklenme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-xs">{d.company_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{d.customer_email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{d.domain}</td>
                        <td className="px-4 py-3">
                          <Badge className={d.is_active ? "bg-green-500/20 text-green-400 border-green-500/30 border" : "bg-gray-500/20 text-gray-400 border"}>
                            {d.is_active ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {d.change_count > 0 ? (
                            <span className="text-orange-400">{d.change_count} değişiklik</span>
                          ) : (
                            <span className="text-muted-foreground">Yok</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(d.last_checked_at)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(d.created_at)}</td>
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
