import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Mail, AlertTriangle, CheckCircle, Clock, Building2, Link } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import { adminFetchJson } from "@/lib/admin-fetch";

interface Stats {
  tenantCount: number;
  highRiskSigninCount: number;
  emailThreatCount: number;
  crossCorrelationCount: number;
  errorCount: number;
}

interface Tenant {
  id: number;
  customerId: number;
  azureTenantId: string;
  status: string;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
  companyName: string | null;
  contactEmail: string | null;
}

interface SigninLog {
  id: number;
  customerId: number;
  userPrincipalName: string | null;
  ipAddress: string | null;
  location: { city?: string; countryOrRegion?: string } | null;
  riskLevel: string | null;
  riskDetail: string | null;
  eventTime: string | null;
  correlatedSocCaseId: number | null;
  companyName: string | null;
}

interface EmailAlert {
  id: number;
  customerId: number;
  title: string | null;
  severity: string | null;
  category: string | null;
  description: string | null;
  affectedUser: string | null;
  correlatedSocCaseId: number | null;
  createdAt: string;
  companyName: string | null;
}

const SEV_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  none: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  disconnected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function timeSince(iso: string | null) {
  if (!iso) return "Hiç";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export default function AdminMs365() {
  const { data: statsData } = useQuery<Stats>({
    queryKey: ["admin-ms365-stats"],
    queryFn: () => adminFetchJson("/api/admin-panel/ms365/stats"),
    refetchInterval: 30000,
  });

  const { data: tenantsData } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["admin-ms365-tenants"],
    queryFn: () => adminFetchJson("/api/admin-panel/ms365/tenants"),
    refetchInterval: 60000,
  });

  const { data: logsData } = useQuery<{ logs: SigninLog[] }>({
    queryKey: ["admin-ms365-signin-logs"],
    queryFn: () => adminFetchJson("/api/admin-panel/ms365/signin-logs"),
    refetchInterval: 30000,
  });

  const { data: alertsData } = useQuery<{ alerts: EmailAlert[] }>({
    queryKey: ["admin-ms365-email-alerts"],
    queryFn: () => adminFetchJson("/api/admin-panel/ms365/email-alerts"),
    refetchInterval: 30000,
  });

  const stats = statsData;
  const tenants = tenantsData?.tenants ?? [];
  const logs = logsData?.logs ?? [];
  const alerts = alertsData?.alerts ?? [];

  return (
    <AdminLayout title="Microsoft 365">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-400" />
            Microsoft 365 / Azure AD
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Baglantilar, riskli girisler, e-posta tehditleri ve cross-korelasyon takibi
          </p>
        </div>

        {/* ─── Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Bagli Tenant", value: stats?.tenantCount ?? 0, icon: Building2, color: "text-blue-400" },
            { label: "Yüksek Risk Giris (24s)", value: stats?.highRiskSigninCount ?? 0, icon: Shield, color: "text-red-400" },
            { label: "E-posta Tehdidi (24s)", value: stats?.emailThreatCount ?? 0, icon: Mail, color: "text-orange-400" },
            { label: "Cross-Korelasyon (24s)", value: stats?.crossCorrelationCount ?? 0, icon: Link, color: "text-purple-400" },
            { label: "Hata Durumu", value: stats?.errorCount ?? 0, icon: AlertTriangle, color: "text-yellow-400" },
          ].map(s => (
            <Card key={s.label} className="bg-gray-900 border-gray-800">
              <CardContent className="pt-4 pb-3">
                <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ─── Tenant listesi ────────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Bagli Microsoft 365 Tenantlari ({tenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Henuz bagli tenant yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="pb-2 text-gray-500 font-medium">Musteri</th>
                      <th className="pb-2 text-gray-500 font-medium">Azure Tenant ID</th>
                      <th className="pb-2 text-gray-500 font-medium">Durum</th>
                      <th className="pb-2 text-gray-500 font-medium">Son Sync</th>
                      <th className="pb-2 text-gray-500 font-medium">Hata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td className="py-2.5">
                          <p className="text-white text-xs font-medium">{t.companyName ?? `Musteri #${t.customerId}`}</p>
                          <p className="text-gray-500 text-[11px]">{t.contactEmail}</p>
                        </td>
                        <td className="py-2.5">
                          <code className="text-[11px] text-emerald-400">{t.azureTenantId}</code>
                        </td>
                        <td className="py-2.5">
                          <Badge className={`text-[10px] border ${STATUS_COLORS[t.status] ?? STATUS_COLORS["disconnected"]}`}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-xs text-gray-400">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {timeSince(t.lastSyncAt)}
                        </td>
                        <td className="py-2.5 text-xs text-red-400 max-w-[200px] truncate">
                          {t.syncError ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Riskli girisler ───────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              Son 24 Saatin Yuksek Riskli Giris Gunlukleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Yuksek riskli giris logu yok.</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <Badge className={`text-[10px] border shrink-0 mt-0.5 ${SEV_COLORS[log.riskLevel ?? "none"] ?? SEV_COLORS["none"]}`}>
                      {(log.riskLevel ?? "?").toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{log.userPrincipalName ?? "Bilinmiyor"}</p>
                      <p className="text-xs text-gray-500">
                        {log.companyName} · {log.ipAddress ?? "-"} · {log.location?.countryOrRegion ?? "-"}
                        {log.riskDetail ? ` · ${log.riskDetail}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gray-600">{timeSince(log.eventTime)}</span>
                      {log.correlatedSocCaseId && (
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── E-posta tehditleri ────────────────────────────── */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-orange-400" />
              M365 Defender E-posta Tehditleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">E-posta tehdidi alari yok.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                    <Badge className={`text-[10px] border shrink-0 mt-0.5 ${SEV_COLORS[alert.severity ?? "none"] ?? SEV_COLORS["none"]}`}>
                      {(alert.severity ?? "?").toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{alert.title ?? "Bilinmeyen Alert"}</p>
                      <p className="text-xs text-gray-500">
                        {alert.companyName} · {alert.affectedUser ?? "-"} · {alert.category}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gray-600">{timeSince(alert.createdAt)}</span>
                      {alert.correlatedSocCaseId && (
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
