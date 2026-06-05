import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetchJson } from "@/lib/admin-fetch";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Download, ToggleLeft, ToggleRight, Users, FileText, TrendingUp } from "lucide-react";

interface DemoReport {
  id: number;
  reportType: string;
  demoDomain: string | null;
  demoCompany: string | null;
  demoSector: string | null;
  pdfUrl: string | null;
  displayScore: number | null;
  isActive: boolean;
  downloadCount: number;
  leadCaptures: number;
  generatedAt: string;
}

interface DemoLead {
  id: number;
  reportType: string | null;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string;
}

const REPORT_LABELS: Record<string, string> = {
  easm: "EASM",
  email_security: "E-posta Güvenlik",
  board_report: "Yönetim Kurulu",
  cve_alert: "CVE Alarm",
  tprm: "Tedarikçi Risk",
  threat_intel: "Tehdit İstihbaratı",
};

export default function AdminDemoRaporlar() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [refreshingAll, setRefreshingAll] = useState(false);

  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ["/api/admin/demo-reports"],
    queryFn: () => adminFetchJson<{ reports: DemoReport[] }>("/api/admin/demo-reports"),
  });

  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ["/api/admin/demo-leads"],
    queryFn: () => adminFetchJson<{ leads: DemoLead[]; total: number; withCompany: number }>("/api/admin/demo-leads"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ type, isActive }: { type: string; isActive: boolean }) =>
      adminFetchJson(`/api/admin/demo-reports/${type}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toast({ title: "Durum güncellendi" });
      qc.invalidateQueries({ queryKey: ["/api/admin/demo-reports"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const refreshSingleMutation = useMutation({
    mutationFn: (type: string) =>
      adminFetchJson(`/api/admin/demo-reports/${type}/refresh`, { method: "POST" }),
    onSuccess: (_, type) => {
      toast({ title: "Yenileme başlatıldı", description: REPORT_LABELS[type] ?? type });
      qc.invalidateQueries({ queryKey: ["/api/admin/demo-reports"] });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  async function handleRefreshAll() {
    setRefreshingAll(true);
    try {
      await adminFetchJson("/api/admin/demo-reports/refresh", { method: "POST" });
      toast({ title: "Tüm raporlar yenileniyor", description: "Arka planda çalışıyor..." });
      qc.invalidateQueries({ queryKey: ["/api/admin/demo-reports"] });
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally {
      setRefreshingAll(false);
    }
  }

  const reports = reportsData?.reports ?? [];
  const leads = leadsData?.leads ?? [];
  const totalDownloads = reports.reduce((s, r) => s + r.downloadCount, 0);
  const totalLeads = leadsData?.total ?? 0;

  return (
    <AdminLayout title="Demo Raporlar">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Demo Raporlar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              /demo sayfasında sergilenen örnek raporların yönetimi ve lead takibi.
            </p>
          </div>
          <Button onClick={handleRefreshAll} disabled={refreshingAll} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshingAll ? "animate-spin" : ""}`} />
            Tüm Raporları Yenile
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <FileText className="w-4 h-4" /> Aktif Rapor
            </div>
            <p className="text-2xl font-bold">{reports.filter((r) => r.isActive).length}/{reports.length}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Download className="w-4 h-4" /> Toplam İndirme
            </div>
            <p className="text-2xl font-bold">{totalDownloads}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" /> Lead Toplam
            </div>
            <p className="text-2xl font-bold">{totalLeads}</p>
            <p className="text-xs text-muted-foreground">{leadsData?.withCompany ?? 0} şirket bilgisi var</p>
          </div>
        </div>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">
              <FileText className="w-4 h-4 mr-1.5" />
              Raporlar ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="w-4 h-4 mr-1.5" />
              Leadler ({totalLeads})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4">
            {loadingReports ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : reports.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Henüz rapor yok</p>
                <p className="text-sm mt-1">Tüm Raporları Yenile ile oluşturabilirsiniz.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {REPORT_LABELS &&
                  Object.keys(REPORT_LABELS).map((type) => {
                    const r = reports.find((x) => x.reportType === type);
                    return (
                      <div key={type} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{REPORT_LABELS[type]}</span>
                              <Badge variant="outline" className="text-xs">{type}</Badge>
                              {r ? (
                                <Badge
                                  variant={r.isActive ? "default" : "secondary"}
                                  className={`text-xs ${r.isActive ? "bg-green-100 text-green-700 border-green-200" : ""}`}
                                >
                                  {r.isActive ? "Aktif" : "Pasif"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Henüz oluşturulmadı</Badge>
                              )}
                            </div>
                            {r && (
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                                <span>{r.demoCompany} — {r.demoDomain}</span>
                                <span className="flex items-center gap-1"><Download className="w-3 h-3" />{r.downloadCount}</span>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.leadCaptures} lead</span>
                                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />Skor: {r.displayScore ?? "—"}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {r?.pdfUrl && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={r.pdfUrl} target="_blank" rel="noreferrer">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            )}
                            {r && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleMutation.mutate({ type, isActive: !r.isActive })}
                                disabled={toggleMutation.isPending}
                              >
                                {r.isActive ? (
                                  <ToggleRight className="w-4 h-4" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshSingleMutation.mutate(type)}
                              disabled={refreshSingleMutation.isPending}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leads" className="mt-4">
            {loadingLeads ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : leads.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Henüz lead yok</p>
                <p className="text-sm mt-1">Demo PDF indirenlerin bilgileri burada görünür.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Ad / E-posta</th>
                      <th className="text-left p-3 font-medium">Şirket</th>
                      <th className="text-left p-3 font-medium">Rapor</th>
                      <th className="text-left p-3 font-medium">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3">
                          <p className="font-medium">{lead.name ?? "—"}</p>
                          <p className="text-muted-foreground text-xs">{lead.email}</p>
                        </td>
                        <td className="p-3 text-muted-foreground">{lead.company ?? "—"}</td>
                        <td className="p-3">
                          {lead.reportType ? (
                            <Badge variant="secondary" className="text-xs">
                              {REPORT_LABELS[lead.reportType] ?? lead.reportType}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(lead.createdAt).toLocaleString("tr-TR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
