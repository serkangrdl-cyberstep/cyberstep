import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle, Loader2, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";

interface Summary {
  totalIntegrations: number;
  events24h: number;
  correlated24h: number;
}

interface AdminIntegration {
  id: number;
  customerId: number;
  customerEmail: string | null;
  provider: string;
  displayName: string | null;
  isActive: boolean;
  lastEventAt: string | null;
  eventCount: number;
  createdAt: string;
}

interface AdminEvent {
  id: number;
  customerId: number;
  customerEmail: string | null;
  provider: string;
  eventType: string;
  severity: string | null;
  title: string | null;
  affectedService: string | null;
  processed: boolean;
  correlatedSocCaseId: number | null;
  receivedAt: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const PROVIDER_LABELS: Record<string, string> = {
  datadog: "Datadog",
  azure_monitor: "Azure Monitor",
  cloudflare: "Cloudflare",
};

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

type TabKey = "overview" | "datadog" | "azure" | "cloudflare" | "metrics";

export default function AdminObservability() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);

  const { data: sumData } = useQuery<Summary>({
    queryKey: ["admin-obs-summary"],
    queryFn: () => fetch("/api/admin-panel/observability/summary", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: intData, isLoading: intLoading } = useQuery<{ integrations: AdminIntegration[] }>({
    queryKey: ["admin-obs-integrations"],
    queryFn: () => fetch("/api/admin-panel/observability/integrations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: evData, isLoading: evLoading } = useQuery<{ events: AdminEvent[] }>({
    queryKey: ["admin-obs-events", providerFilter],
    queryFn: () => {
      const url = providerFilter
        ? `/api/admin-panel/observability/events?provider=${providerFilter}`
        : "/api/admin-panel/observability/events";
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
    refetchInterval: 15000,
  });

  const summary = sumData;
  const integrations = intData?.integrations ?? [];
  const events = evData?.events ?? [];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Genel Bakis" },
    { key: "datadog", label: "Datadog" },
    { key: "azure", label: "Azure Monitor" },
    { key: "cloudflare", label: "Cloudflare" },
    { key: "metrics", label: "Platform Metrikleri" },
  ];

  return (
    <AdminLayout title="Observability & Monitoring">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Observability & Monitoring</h1>
          <p className="text-gray-400 text-sm mt-1">Datadog + Azure Monitor entegrasyonlari ve platform metrikleri.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-gray-800 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Genel Bakis ─────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Bagli Entegrasyon", value: summary?.totalIntegrations ?? "-" },
                { label: "Son 24s Event", value: summary?.events24h ?? "-" },
                { label: "SOC'a Yonlendirilen", value: summary?.correlated24h ?? "-" },
              ].map(stat => (
                <Card key={stat.label} className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Tum Entegrasyonlar</CardTitle>
              </CardHeader>
              <CardContent>
                {intLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                ) : integrations.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Henuz entegrasyon yok.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left pb-2">Musteri</th>
                        <th className="text-left pb-2">Provider</th>
                        <th className="text-left pb-2">Ad</th>
                        <th className="text-right pb-2">Events</th>
                        <th className="text-right pb-2">Son Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.map(integ => (
                        <tr key={integ.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="py-2 text-gray-300 text-xs">{integ.customerEmail ?? `#${integ.customerId}`}</td>
                          <td className="py-2">
                            <Badge className="bg-gray-800 text-gray-300 text-[10px]">
                              {PROVIDER_LABELS[integ.provider] ?? integ.provider}
                            </Badge>
                          </td>
                          <td className="py-2 text-gray-400 text-xs">{integ.displayName}</td>
                          <td className="py-2 text-right text-gray-400">{integ.eventCount}</td>
                          <td className="py-2 text-right text-gray-500 text-xs">
                            {integ.lastEventAt ? timeSince(integ.lastEventAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Datadog / Azure / Cloudflare Eventleri ──────── */}
        {(tab === "datadog" || tab === "azure" || tab === "cloudflare") && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={providerFilter === (tab === "datadog" ? "datadog" : tab === "azure" ? "azure_monitor" : "cloudflare") ? "default" : "outline"}
                onClick={() => setProviderFilter(tab === "datadog" ? "datadog" : tab === "azure" ? "azure_monitor" : "cloudflare")}
                className="border-gray-700"
              >
                {tab === "datadog" ? "Datadog" : tab === "azure" ? "Azure Monitor" : "Cloudflare"} Eventleri
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProviderFilter(undefined)} className="text-gray-400">
                Tumunu Goster
              </Button>
            </div>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-400" /> Event Akisi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                ) : events.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Henuz event yok.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-gray-800/60 last:border-0">
                        <Badge className={`text-[10px] shrink-0 border ${SEV_COLORS[ev.severity ?? "info"] ?? SEV_COLORS["info"]}`}>
                          {(ev.severity ?? "info").toUpperCase()}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{ev.title ?? ev.eventType}</p>
                          <p className="text-xs text-gray-500">
                            {ev.customerEmail ?? `#${ev.customerId}`}
                            {" · "}{PROVIDER_LABELS[ev.provider] ?? ev.provider}
                            {ev.affectedService ? ` · ${ev.affectedService}` : ""}
                            {" · "}{timeSince(ev.receivedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ev.correlatedSocCaseId && (
                            <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                              SOC #{ev.correlatedSocCaseId}
                            </span>
                          )}
                          {ev.processed && !ev.correlatedSocCaseId && (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Platform Metrikleri ──────────────────────────── */}
        {tab === "metrics" && (
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" /> Prometheus Metrikleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-400">
                  Prometheus scrape endpoint aktif. Grafana veya baska bir araciyla baglanabilirsiniz.
                </p>
                <div className="border border-gray-800 rounded p-4 bg-gray-950/50 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Scrape Endpoint:</p>
                    <code className="text-emerald-400 text-sm">{window.location.origin}/api/metrics</code>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-400">Mevcut metrikler:</p>
                    <p>· cyberstep_claude_api_calls_total — Claude API cagri sayaci</p>
                    <p>· cyberstep_claude_cost_usd_total — Tahmini maliyet</p>
                    <p>· cyberstep_soc_alerts_total — SOC alert sayaci</p>
                    <p>· cyberstep_soc_active_cases — Acik SOC case sayisi</p>
                    <p>· cyberstep_domain_scans_total — Domain tarama sayaci</p>
                    <p>· cyberstep_cron_last_success_timestamp — Cron saglik kontrolu</p>
                    <p>· cyberstep_fabric_events_total — Fortinet Fabric eventleri</p>
                    <p>· cyberstep_observability_events_total — Obs entegrasyon eventleri</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 text-gray-400 hover:text-white"
                  onClick={() => window.open("/api/metrics", "_blank")}
                >
                  Metrikleri Goster
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
