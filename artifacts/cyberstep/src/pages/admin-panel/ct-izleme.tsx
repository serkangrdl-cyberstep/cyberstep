import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Shield, Globe, AlertTriangle, CheckCircle2, Loader2, Filter } from "lucide-react";

interface CtEvent {
  id: number;
  domain: string;
  cert_domain: string;
  issuer: string | null;
  sans: string[];
  not_before: string | null;
  not_after: string | null;
  cert_fingerprint: string | null;
  detected_at: string;
  is_suspicious: boolean;
  customer_name: string;
  customer_id: number;
}

interface CtStats {
  total_events: number;
  suspicious_total: number;
  last_24h: number;
  last_7d: number;
  monitored_customers: number;
  monitored_domains: number;
}

function adminFetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

export default function AdminCtIzleme() {
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [domainFilter, setDomainFilter] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin-ct-stats"],
    queryFn: () => adminFetchJson<{ stats: CtStats; topDomains: { domain: string; cnt: number; suspicious: number }[] }>("/api/admin-panel/ct-monitor/stats"),
    refetchInterval: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["admin-ct-events", suspiciousOnly, domainFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (suspiciousOnly) params.set("suspicious", "true");
      if (domainFilter) params.set("domain", domainFilter);
      return adminFetchJson<{ events: CtEvent[] }>(`/api/admin-panel/ct-monitor/events?${params}`);
    },
    refetchInterval: 30_000,
  });

  const stats = statsQuery.data?.stats;
  const events = eventsQuery.data?.events ?? [];
  const topDomains = statsQuery.data?.topDomains ?? [];

  return (
    <AdminLayout title="CT Log İzleme" description="Certstream üzerinden gerçek zamanlı sertifika şeffaflığı izleme">
      <AdminErrorBoundary>
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Toplam Olay", value: stats?.total_events ?? 0, icon: Shield, color: "text-blue-600" },
              { label: "Şüpheli", value: stats?.suspicious_total ?? 0, icon: ShieldAlert, color: "text-red-600" },
              { label: "Son 24 Saat", value: stats?.last_24h ?? 0, icon: AlertTriangle, color: "text-orange-600" },
              { label: "Son 7 Gün", value: stats?.last_7d ?? 0, icon: CheckCircle2, color: "text-green-600" },
              { label: "İzlenen Müşteri", value: stats?.monitored_customers ?? 0, icon: Globe, color: "text-purple-600" },
              { label: "İzlenen Domain", value: stats?.monitored_domains ?? 0, icon: Globe, color: "text-indigo-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>
                    {statsQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : value.toLocaleString("tr-TR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Domains */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">En Aktif Domain'ler</CardTitle>
              </CardHeader>
              <CardContent>
                {topDomains.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Henüz veri yok</p>
                ) : (
                  <div className="space-y-2">
                    {topDomains.map(d => (
                      <div key={d.domain} className="flex items-center gap-2">
                        <span className="text-xs font-mono flex-1 truncate">{d.domain}</span>
                        {d.suspicious > 0 && (
                          <Badge className="text-xs px-1.5 py-0 bg-red-100 text-red-700 border border-red-200">
                            {d.suspicious} şüpheli
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs px-1.5 py-0">{d.cnt}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Events Table */}
            <div className="lg:col-span-2 space-y-3">
              {/* Filters */}
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex gap-3 items-center flex-wrap">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Domain filtrele..."
                      className="h-8 text-xs w-48"
                      value={domainFilter}
                      onChange={e => setDomainFilter(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant={suspiciousOnly ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => setSuspiciousOnly(v => !v)}
                    >
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Sadece Şüpheli
                    </Button>
                    {eventsQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-2 space-y-2">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {eventsQuery.isLoading ? "Yükleniyor..." : "Eşleşen CT olayı bulunamadı"}
                    </p>
                  ) : (
                    events.map(ev => (
                      <div
                        key={ev.id}
                        className={`rounded-lg border p-3 ${ev.is_suspicious ? "bg-red-50/70 border-red-200" : "bg-slate-50/50 border-slate-200"}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 mt-0.5">
                            {ev.is_suspicious
                              ? <ShieldAlert className="h-4 w-4 text-red-500" />
                              : <Shield className="h-4 w-4 text-slate-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs font-semibold truncate">{ev.cert_domain}</span>
                              {ev.is_suspicious && (
                                <Badge className="text-xs px-1.5 py-0 bg-red-100 text-red-700 border border-red-200 shrink-0">Phishing Şüphesi</Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                {new Date(ev.detected_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <span>Müşteri: <strong className="text-foreground">{ev.customer_name}</strong></span>
                              <span>•</span>
                              <span>İzlenen: <span className="font-mono">{ev.domain}</span></span>
                              {ev.issuer && <><span>•</span><span>CA: {ev.issuer}</span></>}
                            </div>
                            {ev.not_after && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Geçerlilik: {new Date(ev.not_after).toLocaleDateString("tr-TR")}
                              </p>
                            )}
                            {Array.isArray(ev.sans) && ev.sans.length > 1 && (
                              <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                                SANs: {ev.sans.slice(0, 4).join(", ")}
                                {ev.sans.length > 4 ? ` +${ev.sans.length - 4} daha` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
