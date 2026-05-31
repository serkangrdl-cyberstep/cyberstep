import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Building2, User, Mail, Phone } from "lucide-react";

interface JobApp {
  id: number; full_name: string; email: string; phone: string;
  cv_file_name: string | null; position: string | null; message: string | null;
  status: string; is_corporate_email: boolean; created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:       { label: "Yeni",         color: "bg-blue-500" },
  reviewed:  { label: "İncelendi",    color: "bg-yellow-500" },
  contacted: { label: "İletişime Geçildi", color: "bg-purple-500" },
  rejected:  { label: "Reddedildi",   color: "bg-red-500" },
};

export default function AdminKariyer() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: apps = [], isLoading } = useQuery<JobApp[]>({
    queryKey: ["admin-job-apps"],
    queryFn: async () => {
      const res = await fetch("/api/admin/job-applications", { credentials: "include" });
      if (!res.ok) throw new Error("Yüklenemedi");
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-job-apps"] }),
  });

  const downloadCv = async (app: JobApp) => {
    const res = await fetch(`/api/admin/job-applications/${app.id}/cv`, { credentials: "include" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = app.cv_file_name ?? `cv-${app.id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);

  return (
    <AdminLayout title="Kariyer Başvuruları">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Kariyer Başvuruları</h1>
            <p className="text-slate-400 text-sm mt-1">Toplam {apps.length} başvuru</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "new", "reviewed", "contacted", "rejected"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                {s === "all" ? "Tümü" : STATUS_LABELS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-slate-400">Yükleniyor...</p>}

        <div className="space-y-3">
          {filtered.map(app => (
            <div key={app.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{app.full_name}</span>
                    <Badge className={`${STATUS_LABELS[app.status]?.color ?? "bg-slate-500"} text-white text-xs px-2 py-0.5`}>
                      {STATUS_LABELS[app.status]?.label ?? app.status}
                    </Badge>
                    {app.is_corporate_email && (
                      <Badge className="bg-emerald-600 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Kurumsal E-posta → Lead
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{app.email}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{app.phone}</span>
                    {app.position && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{app.position}</span>}
                    <span>{new Date(app.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                  {app.message && (
                    <p className="text-sm text-slate-300 bg-slate-700/50 rounded-lg p-3 mt-2">{app.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {app.cv_file_name && (
                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                      onClick={() => downloadCv(app)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> CV İndir
                    </Button>
                  )}
                  <select value={app.status}
                    onChange={e => updateStatus.mutate({ id: app.id, status: e.target.value })}
                    className="bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-lg px-2 py-1.5">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center text-slate-500 py-12">Başvuru bulunamadı.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
