import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, Search, ExternalLink, Users } from "lucide-react";

interface OnboardingRow {
  customerId: number;
  email: string;
  name: string;
  serviceSlug: string;
  doneCount: number;
  totalSteps: number;
  lastActivity: string | null;
  allDone: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  "fortinet-fabric":  "Fortinet Fabric",
  "dns-izleme":       "DNS İzleme",
  "ct-log-izleme":    "Sahte Domain Erken Uyarı",
  "ms365":            "Microsoft 365",
  "kvkk-bildirim":    "KVKK Bildirim",
  "servicenow":       "ServiceNow",
  "soc-operasyon":    "SOC Operasyon",
  "observability":    "Observability",
  "__no-service__":   "Servis Atanmamış",
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }

export default function OnboardingDashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: rows = [], isLoading } = useQuery<OnboardingRow[]>({
    queryKey: ["/api/admin-panel/onboarding"],
    queryFn: () => fetch("/api/admin-panel/onboarding", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const services = [...new Set(rows.map(r => r.serviceSlug))].sort();

  const filtered = rows.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    if (filterService !== "all" && r.serviceSlug !== filterService) return false;
    if (filterStatus === "done" && !r.allDone) return false;
    if (filterStatus === "pending" && r.allDone) return false;
    return true;
  });

  const totalDone = rows.filter(r => r.allDone).length;
  const totalPending = rows.filter(r => !r.allDone).length;

  return (
    <AdminLayout
      title="Onboarding Takibi"
      description="Tüm müşterilerin servis onboarding ilerleme durumu"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Toplam Kayıt</p>
            <p className="text-white text-2xl font-bold mt-1">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Tamamlanan</p>
            <p className="text-emerald-400 text-2xl font-bold mt-1">{totalDone}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Devam Eden</p>
            <p className="text-yellow-400 text-2xl font-bold mt-1">{totalPending}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Tamamlanma Oranı</p>
            <p className="text-cyan-400 text-2xl font-bold mt-1">
              {rows.length > 0 ? Math.round((totalDone / rows.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            className="pl-9 bg-slate-900 border-slate-700 text-white h-9"
            placeholder="Müşteri ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9 w-48">
            <SelectValue placeholder="Tüm servisler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Servisler</SelectItem>
            {services.map(s => (
              <SelectItem key={s} value={s}>{SERVICE_LABELS[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9 w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="pending">Devam Eden</SelectItem>
            <SelectItem value="done">Tamamlanan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-0 border-b border-slate-800">
          <CardTitle className="text-slate-200 text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            {filtered.length} kayıt
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="text-slate-400 text-center py-16">Yükleniyor...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="text-slate-500 text-center py-16">
              {rows.length === 0
                ? "Henüz hiçbir müşteri için onboarding başlatılmamış."
                : "Filtre kriterlerine uyan kayıt bulunamadı."}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Müşteri", "Servis", "İlerleme", "Son Aktivite", "Durum", ""].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const pct = row.totalSteps > 0 ? Math.round((row.doneCount / row.totalSteps) * 100) : 0;
                    return (
                      <tr key={`${row.customerId}-${row.serviceSlug}-${i}`} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm">{row.name}</p>
                          <p className="text-slate-500 text-xs">{row.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-sm">{SERVICE_LABELS[row.serviceSlug] ?? row.serviceSlug}</span>
                          <p className="text-slate-600 text-xs font-mono">{row.serviceSlug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full ${row.allDone ? "bg-emerald-500" : "bg-cyan-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {row.doneCount}/{row.totalSteps} adım
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtDate(row.lastActivity)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.allDone
                            ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3" />
                                Hazır
                              </Badge>
                            : <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 text-xs w-fit">
                                Devam Ediyor
                              </Badge>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-300 h-7 text-xs"
                            onClick={() => navigate(`/panel/musteriler/${row.customerId}/onboarding`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Aç
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
