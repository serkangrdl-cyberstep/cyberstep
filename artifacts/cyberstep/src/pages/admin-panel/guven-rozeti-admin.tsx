import { useQuery } from "@tanstack/react-query";
import { Shield, Eye, ToggleLeft, ToggleRight, Building2 } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { adminFetchJson } from "@/lib/admin-fetch";

interface BadgeStat {
  id: number;
  companyName: string | null;
  email: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  badgeToken: string | null;
  badgeEnabled: boolean | null;
  badgeImpressionCount: number | null;
}

export default function GuvenRozetiAdmin() {
  const { data: stats = [], isLoading } = useQuery<BadgeStat[]>({
    queryKey: ["admin-badge-stats"],
    queryFn: () => adminFetchJson<BadgeStat[]>("/api/admin-panel/badge-stats"),
  });

  const totalImpressions = stats.reduce((s, r) => s + (r.badgeImpressionCount ?? 0), 0);
  const activeCount = stats.filter(r => r.badgeEnabled).length;

  return (
    <AdminLayout title="Güven Rozeti Yönetimi">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Güven Rozeti</h1>
          <p className="text-muted-foreground text-sm mt-1">Aktif rozetleri olan ücretli müşteriler ve gösterim istatistikleri</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Token Üretilmiş</p>
            <p className="text-2xl font-bold">{stats.length}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Aktif Rozetler</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Toplam Gösterim</p>
            <p className="text-2xl font-bold">{totalImpressions.toLocaleString("tr-TR")}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor...</p>
        ) : stats.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Henüz rozet tokeni üretilmemiş.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Firma</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Durum</th>
                  <th className="text-right px-4 py-3 font-medium flex items-center justify-end gap-1">
                    <Eye className="h-3.5 w-3.5" /> Gösterim
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Token</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.map(row => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">{row.companyName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {row.subscriptionPlan ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.badgeEnabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <ToggleRight className="h-4 w-4" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <ToggleLeft className="h-4 w-4" /> Kapalı
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {(row.badgeImpressionCount ?? 0).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono break-all">
                        {row.badgeToken?.slice(0, 16)}…
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
