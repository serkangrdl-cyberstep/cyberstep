import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, AlertOctagon, XCircle, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceHealth {
  id: number; serviceName: string; displayName: string;
  currentStatus: string; uptime30d: string; lastCheckedAt: string;
}
interface Incident {
  id: number; title: string; description: string; severity: string;
  affectedServices: string[]; status: string; startedAt: string; resolvedAt: string | null;
}

const STATUS_OPTS = [
  { value: "operational",    label: "Çalışıyor",     color: "text-emerald-400" },
  { value: "degraded",       label: "Yavaşlamış",    color: "text-yellow-400" },
  { value: "partial_outage", label: "Kısmi Kesinti", color: "text-orange-400" },
  { value: "major_outage",   label: "Büyük Kesinti", color: "text-red-400" },
];
const INCIDENT_STATUS_OPTS = ["investigating","identified","monitoring","resolved"];
const SEVERITY_OPTS = ["minor","major","critical"];
const SERVICES_LIST = ["domain-scan","ai-reports","customer-portal","api","email","admin-panel"];

export default function AdminStatusPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: "", description: "", severity: "minor", affectedServices: [] as string[] });

  const { data: services } = useQuery<ServiceHealth[]>({
    queryKey: ["admin-status-services"],
    queryFn: () => fetch("/api/admin/status/services", { credentials: "include" }).then(r => r.json()),
  });

  const { data: incidents } = useQuery<Incident[]>({
    queryKey: ["admin-status-incidents"],
    queryFn: () => fetch("/api/admin/status/incidents", { credentials: "include" }).then(r => r.json()),
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ name, status }: { name: string; status: string }) =>
      fetch(`/api/admin/status/services/${name}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: status }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-status-services"] }); toast({ title: "Güncellendi" }); },
  });

  const createIncidentMutation = useMutation({
    mutationFn: (body: typeof newIncident) =>
      fetch("/api/admin/status/incidents", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-status-incidents"] });
      setShowIncidentForm(false);
      setNewIncident({ title: "", description: "", severity: "minor", affectedServices: [] });
      toast({ title: "Olay oluşturuldu" });
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/admin/status/incidents/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-status-incidents"] }); toast({ title: "Olay güncellendi" }); },
  });

  const statusConfig: Record<string, string> = {
    operational: "text-emerald-400", degraded: "text-yellow-400",
    partial_outage: "text-orange-400", major_outage: "text-red-400",
  };

  return (
    <AdminLayout title="Sistem Durumu" description="Servis sağlığı ve olay yönetimi">
      <div className="space-y-6">

        {/* Services */}
        <Card className="bg-slate-800/40 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Servis Durumları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {services?.map(svc => (
              <div key={svc.serviceName} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-700">
                <div>
                  <p className="font-medium text-white text-sm">{svc.displayName}</p>
                  <p className={`text-xs mt-0.5 ${statusConfig[svc.currentStatus] ?? "text-slate-400"}`}>
                    {STATUS_OPTS.find(o => o.value === svc.currentStatus)?.label ?? svc.currentStatus}
                    {" · "}{parseFloat(svc.uptime30d).toFixed(2)}% uptime
                  </p>
                </div>
                <select
                  value={svc.currentStatus}
                  onChange={e => updateServiceMutation.mutate({ name: svc.serviceName, status: e.target.value })}
                  className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-2 py-1"
                >
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Incidents */}
        <Card className="bg-slate-800/40 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-base">Olaylar</CardTitle>
            <Button size="sm" onClick={() => setShowIncidentForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Yeni Olay
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showIncidentForm && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <input
                  placeholder="Olay başlığı"
                  value={newIncident.title}
                  onChange={e => setNewIncident(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <textarea
                  placeholder="Açıklama"
                  value={newIncident.description}
                  onChange={e => setNewIncident(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none"
                />
                <div className="flex gap-3">
                  <select
                    value={newIncident.severity}
                    onChange={e => setNewIncident(p => ({ ...p, severity: e.target.value }))}
                    className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-2 py-1"
                  >
                    {SEVERITY_OPTS.map(s => <option key={s} value={s}>{s === "minor" ? "Küçük" : s === "major" ? "Büyük" : "Kritik"}</option>)}
                  </select>
                  <select
                    multiple
                    value={newIncident.affectedServices}
                    onChange={e => setNewIncident(p => ({ ...p, affectedServices: Array.from(e.target.selectedOptions, o => o.value) }))}
                    className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-2 py-1 flex-1"
                  >
                    {SERVICES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => createIncidentMutation.mutate(newIncident)} disabled={!newIncident.title}>Oluştur</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowIncidentForm(false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {incidents?.length === 0 && <p className="text-slate-400 text-sm py-4 text-center">Henüz olay kaydı yok.</p>}
            {incidents?.map(inc => (
              <div key={inc.id} className="flex items-start justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-700">
                <div>
                  <p className="font-medium text-white text-sm">{inc.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(inc.startedAt).toLocaleDateString("tr-TR")}
                    {" · "}
                    <Badge variant="outline" className="text-[10px] py-0">{inc.severity}</Badge>
                  </p>
                </div>
                <select
                  value={inc.status}
                  onChange={e => updateIncidentMutation.mutate({ id: inc.id, status: e.target.value })}
                  className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-2 py-1"
                >
                  {INCIDENT_STATUS_OPTS.map(s => (
                    <option key={s} value={s}>
                      {s === "investigating" ? "İnceleniyor" : s === "identified" ? "Tespit" : s === "monitoring" ? "İzleniyor" : "Çözüldü"}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
