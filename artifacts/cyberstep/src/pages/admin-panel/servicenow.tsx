import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, CheckCircle, AlertTriangle, Loader2, ExternalLink, XCircle, TicketCheck, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";

interface Summary {
  totalConfigs: number;
  activeConfigs: number;
  totalIncidents: number;
  openIncidents: number;
  syncSuccess24h: number;
  syncErrors24h: number;
  totalWebhookEvents: number;
  configsWithWebhook: number;
}

interface SnConfig {
  id: number;
  customerId: number;
  customerEmail: string | null;
  companyName: string | null;
  instanceUrl: string;
  username: string;
  assignmentGroup: string | null;
  category: string | null;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastWebhookAt: string | null;
  webhookEventCount: number;
  incidentCount: number;
  openCount: number;
}

interface SnIncident {
  id: number;
  snNumber: string;
  snState: number;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  caseNumber: string;
  caseTitle: string;
  caseStatus: string;
  severity: string;
  companyName: string | null;
}

const SN_STATES: Record<number, string> = {
  1: "Yeni", 2: "Devam Ediyor", 3: "Beklemede", 6: "Çözüldü", 7: "Kapatıldı",
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString("tr-TR") : "-"; }

function timeSince(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export default function AdminServiceNow() {
  const [activeTab, setActiveTab] = useState<"configs" | "incidents">("configs");

  const { data: summary, isLoading: sLoading } = useQuery<Summary>({
    queryKey: ["admin-sn-summary"],
    queryFn: () => fetch("/api/admin-panel/servicenow/summary", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: configData, isLoading: cLoading } = useQuery<{ configs: SnConfig[] }>({
    queryKey: ["admin-sn-configs"],
    queryFn: () => fetch("/api/admin-panel/servicenow/configs", { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "configs",
    refetchInterval: 60000,
  });

  const { data: incidentData, isLoading: iLoading } = useQuery<{ incidents: SnIncident[] }>({
    queryKey: ["admin-sn-incidents"],
    queryFn: () => fetch("/api/admin-panel/servicenow/incidents", { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "incidents",
    refetchInterval: 60000,
  });

  return (
    <AdminLayout title="ServiceNow Entegrasyonu" description="ITSM incident senkronizasyon yönetimi">
      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Aktif Entegrasyon", value: summary?.activeConfigs ?? 0, icon: <Network className="h-4 w-4 text-blue-400" /> },
          { label: "Açık Incident", value: summary?.openIncidents ?? 0, icon: <TicketCheck className="h-4 w-4 text-yellow-400" /> },
          { label: "Toplam Incident", value: summary?.totalIncidents ?? 0, icon: <CheckCircle className="h-4 w-4 text-emerald-400" /> },
          { label: "Toplam Webhook Olayı", value: summary?.totalWebhookEvents ?? 0, icon: <Webhook className="h-4 w-4 text-violet-400" /> },
          { label: "Webhook Aktif Tenant", value: summary?.configsWithWebhook ?? 0, icon: <Webhook className="h-4 w-4 text-emerald-400" /> },
        ].map(item => (
          <Card key={item.label} className="bg-slate-900 border-slate-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">{item.icon}<span className="text-slate-400 text-xs">{item.label}</span></div>
              <p className="text-2xl font-bold text-white">{sLoading ? "—" : item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 24h sync durumu */}
      {!sLoading && (summary?.syncErrors24h ?? 0) > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-red-400 text-sm">Son 24 saatte {summary?.syncErrors24h} sync hatası — tenant yapılandırmalarını kontrol edin.</span>
        </div>
      )}

      {/* Sekmeler */}
      <div className="flex gap-2 mb-4">
        {(["configs", "incidents"] as const).map(tab => (
          <Button
            key={tab}
            size="sm"
            variant={activeTab === tab ? "default" : "outline"}
            className={activeTab === tab ? "bg-blue-600 text-white" : "border-slate-700 text-slate-400"}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "configs" ? "Entegrasyonlar" : "Incident'lar"}
          </Button>
        ))}
      </div>

      {/* Configs sekmesi */}
      {activeTab === "configs" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">ServiceNow Entegrasyonları</CardTitle>
          </CardHeader>
          <CardContent>
            {cLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : !configData?.configs.length ? (
              <p className="text-slate-500 text-sm text-center py-8">Henüz ServiceNow entegrasyonu yok.</p>
            ) : (
              <div className="space-y-3">
                {configData.configs.map(cfg => (
                  <div key={cfg.id} className={`rounded-lg border p-4 ${cfg.lastSyncError ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-800/40"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium text-sm">{cfg.companyName ?? cfg.customerEmail}</span>
                          <Badge className={`text-xs ${cfg.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
                            {cfg.active ? "Aktif" : "Pasif"}
                          </Badge>
                          <span className="text-xs text-blue-400">{cfg.openCount} açık</span>
                        </div>
                        <code className="text-[11px] text-slate-500 block mt-1">{cfg.instanceUrl}</code>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span>Kullanıcı: <span className="text-slate-300">{cfg.username}</span></span>
                          {cfg.assignmentGroup && <span>Grup: <span className="text-slate-300">{cfg.assignmentGroup}</span></span>}
                          {cfg.category && <span>Kategori: <span className="text-slate-300">{cfg.category}</span></span>}
                        </div>
                        {cfg.lastSyncError ? (
                          <div className="flex items-center gap-1 mt-2">
                            <XCircle className="h-3 w-3 text-red-400" />
                            <span className="text-red-400 text-xs">{cfg.lastSyncError.slice(0, 100)}</span>
                          </div>
                        ) : cfg.lastSyncAt ? (
                          <p className="text-slate-600 text-xs mt-1">Son sync: {fmtDate(cfg.lastSyncAt)}</p>
                        ) : null}
                        <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded text-xs ${cfg.lastWebhookAt ? "bg-violet-500/10 border border-violet-500/20" : "bg-slate-800/60 border border-slate-700/40"}`}>
                          <Webhook className={`h-3 w-3 ${cfg.lastWebhookAt ? "text-violet-400" : "text-slate-600"}`} />
                          {cfg.lastWebhookAt ? (
                            <span className="text-slate-300">
                              Webhook: <span className="text-violet-400 font-medium">{timeSince(cfg.lastWebhookAt)}</span>
                              <span className="text-slate-500 ml-1">· {cfg.webhookEventCount} olay</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">Webhook olayı yok</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-white">{cfg.incidentCount}</p>
                        <p className="text-slate-500 text-xs">incident</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 h-7 text-xs mt-1"
                          onClick={() => window.open(cfg.instanceUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Aç
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Incidents sekmesi */}
      {activeTab === "incidents" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">ServiceNow Incident Listesi</CardTitle>
          </CardHeader>
          <CardContent>
            {iLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : !incidentData?.incidents.length ? (
              <p className="text-slate-500 text-sm text-center py-8">Henüz incident kaydı yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-slate-800">
                      <th className="text-left p-3">SN No</th>
                      <th className="text-left p-3">CyberStep Vaka</th>
                      <th className="text-left p-3">Müşteri</th>
                      <th className="text-left p-3">Durum</th>
                      <th className="text-left p-3">SN Durum</th>
                      <th className="text-left p-3">Son Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentData.incidents.map(inc => (
                      <tr key={inc.id} className="border-b border-slate-800/60">
                        <td className="p-3 font-mono text-xs text-blue-400">{inc.snNumber}</td>
                        <td className="p-3">
                          <p className="text-white text-xs font-medium">{inc.caseNumber}</p>
                          <p className="text-slate-500 text-xs truncate max-w-32">{inc.caseTitle}</p>
                        </td>
                        <td className="p-3 text-slate-300 text-xs">{inc.companyName ?? "-"}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${SEV_COLORS[inc.severity] ?? ""}`}>{inc.severity}</Badge>
                        </td>
                        <td className="p-3 text-slate-300 text-xs">{SN_STATES[inc.snState] ?? inc.snState}</td>
                        <td className="p-3 text-slate-500 text-xs">
                          {inc.syncError ? (
                            <span className="text-red-400">{inc.syncError.slice(0, 30)}</span>
                          ) : fmtDate(inc.lastSyncedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
