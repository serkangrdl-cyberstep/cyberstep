import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Server,
  Wifi, ArrowRight, BarChart2, Shield, RefreshCw, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useRequireCustomer } from "@/hooks/use-customer";

const BASE = import.meta.env.BASE_URL;

function apiFetch(path: string) {
  return fetch(`${BASE}api${path}`, { credentials: "include" }).then((r) => r.json());
}

const SEV_COLOR: Record<string, string> = {
  critical: "destructive", high: "destructive", medium: "secondary", low: "outline", info: "outline",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  investigating: <RefreshCw className="h-4 w-4 text-blue-500" />,
  monitoring: <Activity className="h-4 w-4 text-yellow-500" />,
  resolved: <CheckCircle className="h-4 w-4 text-green-500" />,
};

export default function NocDashboard() {
  const { data: customer, isLoading: authLoading } = useRequireCustomer();
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "metrics" | "setup">("overview");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["noc-dashboard"],
    queryFn: () => apiFetch("/portal/noc/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: metrics } = useQuery({
    queryKey: ["noc-metrics", 24],
    queryFn: () => apiFetch("/portal/noc/metrics?hours=24"),
    enabled: activeTab === "metrics",
  });

  const { data: cases } = useQuery({
    queryKey: ["noc-cases"],
    queryFn: () => apiFetch("/portal/noc/cases"),
    enabled: activeTab === "cases",
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!dashboard?.hasIntegration) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Activity className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">AI NOC Servisi</h1>
        <p className="text-muted-foreground">
          7/24 otomatik ağ izleme ve anomali tespiti. Ağınızı pasif olarak izliyoruz —
          hiçbir zaman konfigürasyonunuza dokunmuyoruz.
        </p>
        <Button asChild>
          <Link href="/hesabim/noc-kurulum">NOC Kurulumunu Baslat <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  const integ = dashboard.integration;
  const activeCases: unknown[] = dashboard.activeCases ?? [];
  const recentEvents: unknown[] = dashboard.recentEvents ?? [];

  // Build bandwidth chart data from metrics
  const bandwidthChartData = (() => {
    if (!metrics?.length) return [];
    const byTime: Record<string, Record<string, number>> = {};
    for (const m of metrics as Array<{ recorded_at: string; interface_name: string; metric_type: string; value: string }>) {
      const key = new Date(m.recorded_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      if (!byTime[key]) byTime[key] = {};
      byTime[key][`${m.interface_name}_${m.metric_type}`] = Number(m.value ?? 0);
    }
    return Object.entries(byTime).slice(-48).map(([time, vals]) => ({ time, ...vals }));
  })();

  const uptimePct = Number(integ.uptimeThisMonthPct ?? 100);
  const slaPct = Number(integ.availabilitySlaPct ?? 99.5);
  const slaOk = uptimePct >= slaPct;

  const tabs = [
    { id: "overview", label: "Genel Bakis" },
    { id: "cases", label: `Vakalar (${activeCases.length})` },
    { id: "metrics", label: "Metrikler" },
    { id: "setup", label: "Kurulum" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI NOC Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {integ.nocTier?.toUpperCase()} — {integ.baselineLearning
              ? "Baseline ogrenme sureci (14 gun)"
              : "Tam anomali tespiti aktif"}
          </p>
        </div>
        {integ.baselineLearning && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Clock className="h-3 w-3 mr-1" /> Baseline Ogrenme
          </Badge>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{activeCases.length}</div>
            <div className="text-xs text-muted-foreground">Acik Vaka</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className={`text-2xl font-bold ${slaOk ? "text-green-600" : "text-red-600"}`}>
              %{uptimePct.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Uptime (bu ay)</div>
            <div className="text-xs text-muted-foreground">SLA: %{slaPct}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{integ.totalEvents ?? 0}</div>
            <div className="text-xs text-muted-foreground">Toplam Olay</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{integ.totalAlerts ?? 0}</div>
            <div className="text-xs text-muted-foreground">Bildirim Sayisi</div>
          </CardContent>
        </Card>
      </div>

      {/* SLA progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Uptime SLA Durumu</span>
            <span className={slaOk ? "text-green-600" : "text-red-600"}>
              {slaOk ? "SLA Karsilaniyor" : "SLA Riski"}
            </span>
          </div>
          <Progress value={uptimePct} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>%0</span>
            <span>Hedef: %{slaPct}</span>
            <span>%100</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Recent events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Son Olaylar (24 Saat)</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Son 24 saatte olay tespit edilmedi.
                </div>
              ) : (
                <div className="space-y-2">
                  {(recentEvents as Array<Record<string, unknown>>).slice(0, 10).map((ev) => (
                    <div key={String(ev.id)} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <Badge variant={SEV_COLOR[String(ev.severity)] as "destructive" | "secondary" | "outline"} className="text-xs shrink-0">
                        {String(ev.severity).toUpperCase()}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{String(ev.title ?? ev.event_type)}</div>
                        <div className="text-xs text-muted-foreground">{String(ev.device_name ?? ev.device_ip ?? "")}</div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(String(ev.occurred_at)).toLocaleTimeString("tr-TR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monitored devices */}
          {(integ.monitoredDevices as unknown[])?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Izlenen Cihazlar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(integ.monitoredDevices as Array<Record<string, unknown>>).map((d, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{String(d.name ?? d.ip)}</div>
                        <div className="text-xs text-muted-foreground">{String(d.ip)}</div>
                      </div>
                      {!!d.critical && <Badge variant="outline" className="text-xs">Kritik</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cases Tab */}
      {activeTab === "cases" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NOC Vakalari</CardTitle>
          </CardHeader>
          <CardContent>
            {(cases as unknown[] ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Aktif vaka bulunamadi.</div>
            ) : (
              <div className="space-y-3">
                {(cases as Array<Record<string, unknown>>).map((c) => (
                  <div key={String(c.id)} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      {(STATUS_ICON[String(c.status)] as React.ReactNode) ?? <Activity className="h-4 w-4" />}
                      <span className="font-mono text-sm font-medium">{String(c.case_number)}</span>
                      <Badge variant={SEV_COLOR[String(c.severity)] as "destructive" | "secondary" | "outline"} className="text-xs ml-auto">
                        P{String(c.priority)} — {String(c.severity).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm">{String(c.title)}</div>
                    {!!c.root_cause_analysis && (
                      <div className="text-xs text-muted-foreground">{String(c.root_cause_analysis)}</div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(String(c.created_at)).toLocaleString("tr-TR")}</span>
                      {!!c.sla_deadline && (
                        <span className={new Date(String(c.sla_deadline)) < new Date() ? "text-red-500" : ""}>
                          SLA: {new Date(String(c.sla_deadline)).toLocaleString("tr-TR")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metrics Tab */}
      {activeTab === "metrics" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bant Genisligi Grafigi (Son 24 Saat)</CardTitle>
          </CardHeader>
          <CardContent>
            {bandwidthChartData.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Metrik verisi bulunamadi. FortiGate polling etkinlestirildikten sonra veri toplanmaya baslar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bandwidthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="wan1_bandwidth_in_pct" name="WAN1 In %" stroke="#3b82f6" dot={false} />
                  <Line type="monotone" dataKey="wan1_bandwidth_out_pct" name="WAN1 Out %" stroke="#ef4444" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Tab */}
      {activeTab === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entegrasyon Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">SNMP Trap Token</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{integ.snmpToken}</code>
              <div className="text-xs text-muted-foreground mt-1">
                FortiGate SNMP Trap: <code>snmptrap.cyberstep.io:1162</code> — Community: token degeri
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">HTTP SNMP Endpoint</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                POST /api/noc/snmp-trap/{integ.snmpToken}
              </code>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">NetFlow Token</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{integ.netflowToken}</code>
            </div>
            <Button variant="outline" asChild>
              <Link href="/hesabim/noc-kurulum">Kurulum Sihirbazini Ac <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
