import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Server, Users, Shield, BarChart2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { AdminLayout } from "../../components/admin-layout";

const BASE = import.meta.env.BASE_URL;

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());
}

const SEV_COLOR: Record<string, string> = {
  critical: "destructive", high: "destructive", medium: "secondary", low: "outline",
};

const PRI_LABEL: Record<number, string> = { 1: "P1 Kritik", 2: "P2 Yuksek", 3: "P3 Orta", 4: "P4 Dusuk" };
const PRI_COLOR: Record<number, string> = { 1: "destructive", 2: "destructive", 3: "secondary", 4: "outline" };

export default function AdminNoc() {
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "customers" | "events" | "correlations">("overview");
  const qc = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["admin-noc-dashboard"],
    queryFn: () => apiFetch("/admin/noc/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: customers } = useQuery({
    queryKey: ["admin-noc-customers"],
    queryFn: () => apiFetch("/admin/noc/customers"),
    enabled: activeTab === "customers",
  });

  const { data: cases } = useQuery({
    queryKey: ["admin-noc-cases"],
    queryFn: () => apiFetch("/admin/noc/cases"),
    enabled: activeTab === "cases",
  });

  const { data: events } = useQuery({
    queryKey: ["admin-noc-events"],
    queryFn: () => apiFetch("/admin/noc/events"),
    enabled: activeTab === "events",
    refetchInterval: 15_000,
  });

  const { data: correlations } = useQuery({
    queryKey: ["admin-noc-correlations"],
    queryFn: () => apiFetch("/admin/noc/correlations"),
    enabled: activeTab === "correlations",
  });

  const updateCaseMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/admin/noc/cases/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-noc-cases"] });
      qc.invalidateQueries({ queryKey: ["admin-noc-dashboard"] });
    },
  });

  const tabs = [
    { id: "overview", label: "Genel Bakis" },
    { id: "cases", label: "Vakalar" },
    { id: "customers", label: "Musteri Aglari" },
    { id: "events", label: "Olay Akisi" },
    { id: "correlations", label: "SOC-NOC Korelasyon" },
  ] as const;

  return (
    <AdminLayout title="NOC Operasyon Merkezi" description="AI destekli ag izleme — pasif model">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">NOC Operasyon Merkezi</h1>
            <p className="text-sm text-muted-foreground">AI destekli ag izleme — pasif model</p>
          </div>
        </div>

        {/* KPI */}
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{dashboard?.totalCustomers ?? 0}</div>
                    <div className="text-xs text-muted-foreground">NOC Musterisi</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-2xl font-bold">{dashboard?.openCases ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Acik Vaka</div>
                    <div className="text-xs text-muted-foreground">
                      P1:{dashboard?.caseSummary?.p1 ?? 0} P2:{dashboard?.caseSummary?.p2 ?? 0} P3:{dashboard?.caseSummary?.p3 ?? 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold">{dashboard?.learningCount ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Baseline Ogrenimde</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">
                      {(dashboard?.activeCases ?? []).filter((c: Record<string, unknown>) => c.is_security_related).length}
                    </div>
                    <div className="text-xs text-muted-foreground">SOC Korelasyonu</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <h3 className="font-medium">Acik Vakalar</h3>
            {(dashboard?.activeCases ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">Aktif P1/P2 vakası yok.</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(dashboard?.activeCases ?? []).map((c: Record<string, unknown>) => (
                  <Card key={String(c.id)} className={c.priority === 1 ? "border-red-500" : c.priority === 2 ? "border-orange-500" : ""}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <Badge variant={PRI_COLOR[Number(c.priority)] as "destructive" | "secondary" | "outline"} className="text-xs shrink-0">
                          {String(PRI_LABEL[Number(c.priority)] ?? `P${String(c.priority)}`)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm font-medium">{String(c.case_number)}</div>
                          <div className="text-sm">{String(c.title)}</div>
                          {!!c.root_cause_analysis && (
                            <div className="text-xs text-muted-foreground mt-1">{String(c.root_cause_analysis)}</div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateCaseMut.mutate({ id: Number(c.id), status: "investigating" })}
                          >
                            Incele
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-600"
                            onClick={() => updateCaseMut.mutate({ id: Number(c.id), status: "resolved" })}
                          >
                            Kapat
                          </Button>
                        </div>
                      </div>
                      {!!c.sla_deadline && (
                        <div className={`text-xs mt-2 ${new Date(String(c.sla_deadline)) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          SLA: {new Date(String(c.sla_deadline)).toLocaleString("tr-TR")}
                          {new Date(String(c.sla_deadline)) < new Date() && " — IHLAL"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cases Tab */}
        {activeTab === "cases" && (
          <div className="space-y-2">
            {(cases ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Vaka bulunamadi.</div>
            ) : (
              (cases as Array<Record<string, unknown>>).map((item) => {
                const c = (item.case_ ?? item) as Record<string, unknown>;
                return (
                  <Card key={String(c.id)}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={SEV_COLOR[String(c.severity)] as "destructive" | "secondary" | "outline"} className="text-xs">
                          {String(c.severity).toUpperCase()}
                        </Badge>
                        <span className="font-mono text-sm">{String(c.case_number)}</span>
                        <span className="text-sm flex-1 truncate">{String(c.title)}</span>
                        <span className="text-xs text-muted-foreground">{String(item.company ?? "")}</span>
                        <Badge variant="outline" className="text-xs">{String(c.status)}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === "customers" && (
          <div className="space-y-2">
            {(customers ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">NOC musterisi bulunamadi.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Musteri</th>
                      <th className="px-4 py-2 text-left font-medium">Tier</th>
                      <th className="px-4 py-2 text-left font-medium">Durum</th>
                      <th className="px-4 py-2 text-left font-medium">Uptime</th>
                      <th className="px-4 py-2 text-left font-medium">Olaylar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(customers as Array<Record<string, unknown>>).map((item, i) => {
                      const integ = (item.integration ?? item) as Record<string, unknown>;
                      return (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium">{String(item.company ?? "—")}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs">{String(integ.noc_tier ?? "lite").toUpperCase()}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            {integ.baseline_learning ? (
                              <Badge variant="secondary" className="text-xs">Ogrenme</Badge>
                            ) : (
                              <Badge variant="default" className="text-xs">Aktif</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">%{Number(integ.uptime_this_month_pct ?? 100).toFixed(1)}</td>
                          <td className="px-4 py-2">{String(integ.total_events ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-2">
            {(events ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Son 1 saatte olay bulunamadi.</div>
            ) : (
              <div className="space-y-1">
                {(events as Array<Record<string, unknown>>).map((ev) => (
                  <div key={String(ev.id)} className="flex items-start gap-3 py-2 border-b">
                    <Badge variant={SEV_COLOR[String(ev.severity)] as "destructive" | "secondary" | "outline"} className="text-xs shrink-0">
                      {String(ev.severity).toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{String(ev.title ?? ev.event_type)}</div>
                      <div className="text-xs text-muted-foreground">{String(ev.device_name ?? ev.device_ip ?? "")} — {String(ev.source)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(String(ev.occurred_at)).toLocaleTimeString("tr-TR")}
                    </div>
                    <Badge variant={ev.processed ? "outline" : "secondary"} className="text-xs shrink-0">
                      {ev.processed ? "Islendi" : "Bekliyor"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Correlations Tab */}
        {activeTab === "correlations" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              SOC ile iliskilendirilmis NOC vakalari — guvenligi etkileyen ag olaylari.
            </p>
            {(correlations ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Henuz korelasyon bulunamadi.</div>
            ) : (
              (correlations as Array<Record<string, unknown>>).map((c) => (
                <Card key={String(c.id)} className="border-orange-500/50">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-orange-500" />
                      <span className="font-mono text-sm font-medium">{String(c.case_number)}</span>
                      <Badge variant="destructive" className="text-xs ml-auto">SOC-NOC</Badge>
                    </div>
                    <div className="text-sm">{String(c.title)}</div>
                    {!!c.root_cause_analysis && (
                      <div className="text-xs text-muted-foreground mt-1">{String(c.root_cause_analysis)}</div>
                    )}
                    {!!c.related_soc_case_id && (
                      <div className="text-xs text-muted-foreground mt-1">
                        SOC Case ID: {String(c.related_soc_case_id)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
