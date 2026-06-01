import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, CheckCircle, AlertTriangle, Loader2, ExternalLink, XCircle, TicketCheck, Webhook, Filter, Mail, Clock } from "lucide-react";
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
  totalPendingCases: number;
  customersWithPending: number;
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
  connCheckAlertedAt: string | null;
  lastWebhookAt: string | null;
  webhookEventCount: number;
  incidentCount: number;
  openCount: number;
  pendingCaseCount: number;
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

function ConnStatusBadge({ cfg }: { cfg: SnConfig }) {
  if (cfg.lastSyncError) {
    return (
      <Badge className="text-xs bg-red-500/15 text-red-400 border-red-500/40 flex items-center gap-1">
        <XCircle className="h-3 w-3" /> HATA
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/40 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" /> OK
    </Badge>
  );
}

function ConfigCard({ cfg }: { cfg: SnConfig }) {
  return (
    <div className={`rounded-lg border p-4 ${cfg.lastSyncError ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-800/40"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm">{cfg.companyName ?? cfg.customerEmail}</span>
            <ConnStatusBadge cfg={cfg} />
            <Badge className={`text-xs ${cfg.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
              {cfg.active ? "Aktif" : "Pasif"}
            </Badge>
            <span className="text-xs text-blue-400">{cfg.openCount} açık</span>
            {cfg.pendingCaseCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Clock className="h-3 w-3" />
                {cfg.pendingCaseCount} bekleyen vaka
              </span>
            )}
          </div>
          <code className="text-[11px] text-slate-500 block mt-1">{cfg.instanceUrl}</code>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span>Kullanıcı: <span className="text-slate-300">{cfg.username}</span></span>
            {cfg.assignmentGroup && <span>Grup: <span className="text-slate-300">{cfg.assignmentGroup}</span></span>}
            {cfg.category && <span>Kategori: <span className="text-slate-300">{cfg.category}</span></span>}
          </div>

          {cfg.lastSyncError ? (
            <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/20 p-2 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-300 text-xs break-all">{cfg.lastSyncError}</span>
              </div>
              {cfg.connCheckAlertedAt ? (
                <div className="flex items-center gap-1.5 pl-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Mail className="h-3 w-3" />
                    E-posta Gönderildi
                  </span>
                  <span className="text-slate-500 text-[11px]">{fmtDate(cfg.connCheckAlertedAt)}</span>
                  <span className="text-slate-600 text-[11px]">({timeSince(cfg.connCheckAlertedAt)})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 pl-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/30">
                    <Mail className="h-3 w-3" />
                    Bildirim Bekliyor
                  </span>
                  <span className="text-slate-600 text-[11px]">bir sonraki saatlik kontrolde gönderilecek</span>
                </div>
              )}
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
  );
}

export default function AdminServiceNow() {
  const [activeTab, setActiveTab] = useState<"configs" | "incidents" | "pending">("configs");
  const [errOnly, setErrOnly] = useState(false);

  const { data: summary, isLoading: sLoading } = useQuery<Summary>({
    queryKey: ["admin-sn-summary"],
    queryFn: () => fetch("/api/admin-panel/servicenow/summary", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: configData, isLoading: cLoading } = useQuery<{ configs: SnConfig[] }>({
    queryKey: ["admin-sn-configs", errOnly],
    queryFn: () => fetch(`/api/admin-panel/servicenow/configs${errOnly ? "?errOnly=1" : ""}`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "configs",
    refetchInterval: 60000,
  });

  const { data: pendingData, isLoading: pLoading } = useQuery<{ configs: SnConfig[] }>({
    queryKey: ["admin-sn-pending"],
    queryFn: () => fetch("/api/admin-panel/servicenow/configs?pendingOnly=1", { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "pending",
    refetchInterval: 60000,
  });

  const { data: incidentData, isLoading: iLoading } = useQuery<{ incidents: SnIncident[] }>({
    queryKey: ["admin-sn-incidents"],
    queryFn: () => fetch("/api/admin-panel/servicenow/incidents", { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "incidents",
    refetchInterval: 60000,
  });

  const errorCount = configData?.configs.filter(c => c.lastSyncError).length ?? 0;
  const totalPending = summary?.totalPendingCases ?? 0;

  return (
    <AdminLayout title="ServiceNow Entegrasyonu" description="ITSM incident senkronizasyon yönetimi">
      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Aktif Entegrasyon", value: summary?.activeConfigs ?? 0, icon: <Network className="h-4 w-4 text-blue-400" /> },
          { label: "Açık Incident", value: summary?.openIncidents ?? 0, icon: <TicketCheck className="h-4 w-4 text-yellow-400" /> },
          { label: "Toplam Incident", value: summary?.totalIncidents ?? 0, icon: <CheckCircle className="h-4 w-4 text-emerald-400" /> },
          { label: "Bağlantı Hatası (24s)", value: summary?.syncErrors24h ?? 0, icon: <XCircle className="h-4 w-4 text-red-400" /> },
        ].map(item => (
          <Card key={item.label} className="bg-slate-900 border-slate-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">{item.icon}<span className="text-slate-400 text-xs">{item.label}</span></div>
              <p className="text-2xl font-bold text-white">{sLoading ? "—" : item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bekleyen vaka kartı — ön plana çıkar */}
      <Card className={`mb-6 border ${totalPending > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900"}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className={`h-5 w-5 ${totalPending > 0 ? "text-amber-400" : "text-slate-500"}`} />
              <div>
                <p className="text-sm font-medium text-white">Bekleyen SOC Vakaları</p>
                <p className="text-xs text-slate-400">Son 48 saatte ServiceNow'a iletilemeyen vakalar</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${totalPending > 0 ? "text-amber-400" : "text-slate-500"}`}>
                {sLoading ? "—" : totalPending}
              </p>
              {!sLoading && (summary?.customersWithPending ?? 0) > 0 && (
                <p className="text-xs text-slate-400">{summary!.customersWithPending} müşteride</p>
              )}
            </div>
          </div>
          {!sLoading && totalPending > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-amber-300 text-xs">
                  Bu vakalar ServiceNow bağlantısı kopuk veya hatalı olduğu için iletilemedi.
                  "Bekleyen Vakalar" sekmesinde müşteri bazlı görebilirsiniz.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 24h sync durumu */}
      {!sLoading && (summary?.syncErrors24h ?? 0) > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-red-400 text-sm">Son 24 saatte {summary?.syncErrors24h} sync hatası — tenant yapılandırmalarını kontrol edin.</span>
        </div>
      )}

      {/* Sekmeler */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={activeTab === "configs" ? "default" : "outline"}
          className={activeTab === "configs" ? "bg-blue-600 text-white" : "border-slate-700 text-slate-400"}
          onClick={() => setActiveTab("configs")}
        >
          Entegrasyonlar
        </Button>
        <Button
          size="sm"
          variant={activeTab === "pending" ? "default" : "outline"}
          className={activeTab === "pending"
            ? "bg-amber-600 text-white"
            : totalPending > 0
              ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
              : "border-slate-700 text-slate-400"}
          onClick={() => setActiveTab("pending")}
        >
          <Clock className="h-3 w-3 mr-1" />
          Bekleyen Vakalar
          {totalPending > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-300">
              {totalPending}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "incidents" ? "default" : "outline"}
          className={activeTab === "incidents" ? "bg-blue-600 text-white" : "border-slate-700 text-slate-400"}
          onClick={() => setActiveTab("incidents")}
        >
          Incident'lar
        </Button>
      </div>

      {/* Configs sekmesi */}
      {activeTab === "configs" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">ServiceNow Entegrasyonları</CardTitle>
              <div className="flex items-center gap-2">
                {errorCount > 0 && !errOnly && (
                  <span className="text-xs text-red-400 font-medium">{errorCount} hatalı bağlantı</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-xs gap-1 ${errOnly ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-slate-700 text-slate-400"}`}
                  onClick={() => setErrOnly(v => !v)}
                >
                  <Filter className="h-3 w-3" />
                  {errOnly ? "Tüm Bağlantılar" : "Sadece Hatalı"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : !configData?.configs.length ? (
              <p className="text-slate-500 text-sm text-center py-8">
                {errOnly ? "Hatalı bağlantı bulunamadı." : "Henüz ServiceNow entegrasyonu yok."}
              </p>
            ) : (
              <div className="space-y-3">
                {configData.configs.map(cfg => (
                  <ConfigCard key={cfg.id} cfg={cfg} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bekleyen Vakalar sekmesi */}
      {activeTab === "pending" && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Bekleyen (ServiceNow'a İletilmemiş) Vakalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : !pendingData?.configs.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
                <p className="text-slate-300 font-medium">Bekleyen vaka yok</p>
                <p className="text-slate-500 text-sm">Son 48 saatte tüm SOC vakaları ServiceNow'a iletildi.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-xs mb-4">
                  Son 48 saatte oluşan ve henüz ServiceNow'a iletilemeyen vakalar müşteri bazında gösteriliyor.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-800">
                        <th className="text-left p-3">Müşteri</th>
                        <th className="text-left p-3">Bekleyen Vaka (48s)</th>
                        <th className="text-left p-3">Bağlantı Durumu</th>
                        <th className="text-left p-3">Son Sync</th>
                        <th className="text-left p-3">Toplam Incident</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingData.configs.map(cfg => (
                        <tr key={cfg.id} className="border-b border-slate-800/60">
                          <td className="p-3">
                            <p className="text-white text-sm font-medium">{cfg.companyName ?? cfg.customerEmail}</p>
                            <code className="text-[10px] text-slate-500">{cfg.instanceUrl}</code>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="h-3.5 w-3.5" />
                              {cfg.pendingCaseCount}
                            </span>
                          </td>
                          <td className="p-3">
                            <ConnStatusBadge cfg={cfg} />
                            {cfg.lastSyncError && (
                              <p className="text-red-400 text-[10px] mt-1 max-w-40 truncate" title={cfg.lastSyncError}>
                                {cfg.lastSyncError}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 text-xs">
                            {cfg.lastSyncAt ? fmtDate(cfg.lastSyncAt) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="p-3 text-slate-300 text-sm">{cfg.incidentCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
