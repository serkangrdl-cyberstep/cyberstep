import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users, Radar, TrendingUp, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface QueueItem {
  id: number;
  domain: string;
  companyName: string | null;
  source: string | null;
  scanStatus: string;
  riskScore: number | null;
  riskLevel: string | null;
  leadScore: number | null;
  contacts: unknown[] | null;
  createdAt: string;
  scannedAt: string | null;
}

interface QueueStats {
  pending: number; scanning: number; scored: number;
  contacted: number; converted: number; skipped: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Bekliyor",     color: "bg-slate-100 text-slate-700",    icon: Clock },
  scanning:  { label: "Taranıyor",    color: "bg-yellow-100 text-yellow-700",   icon: Loader2 },
  scored:    { label: "Puanlandı",    color: "bg-blue-100 text-blue-700",       icon: TrendingUp },
  contacted: { label: "İletişim",     color: "bg-orange-100 text-orange-700",   icon: Users },
  converted: { label: "Dönüştürüldü", color: "bg-green-100 text-green-700",    icon: CheckCircle },
  skipped:   { label: "Atlandı",      color: "bg-red-100 text-red-700",        icon: XCircle },
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-slate-400";
}

export default function LeadGenQueuePage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: items = [], isLoading } = useQuery<QueueItem[]>({
    queryKey: ["lead-gen-queue", filterStatus],
    queryFn: () => {
      const params = filterStatus ? `?status=${filterStatus}` : "";
      return fetch(`/api/lead-gen/queue${params}`, { credentials: "include" }).then(r => r.json());
    },
    refetchInterval: 8000,
  });

  const { data: stats } = useQuery<QueueStats>({
    queryKey: ["lead-gen-queue-stats"],
    queryFn: () => fetch("/api/lead-gen/queue/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 8000,
  });

  const addMutation = useMutation({
    mutationFn: (data: { domain: string; companyName: string }) =>
      fetch("/api/lead-gen/queue", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-gen-queue"] });
      qc.invalidateQueries({ queryKey: ["lead-gen-queue-stats"] });
      setShowAdd(false); setNewDomain(""); setNewCompany("");
    },
  });

  const scoreMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/lead-gen/queue/${id}/score`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-gen-queue"] }),
  });

  const enrichMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/lead-gen/queue/${id}/enrich`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-gen-queue"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/lead-gen/queue/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-gen-queue"] });
      qc.invalidateQueries({ queryKey: ["lead-gen-queue-stats"] });
    },
  });

  const statItems = [
    { key: "pending",   label: "Bekliyor",   color: "text-slate-300" },
    { key: "scanning",  label: "Taranıyor",  color: "text-yellow-400" },
    { key: "scored",    label: "Puanlandı",  color: "text-blue-400" },
    { key: "contacted", label: "İletişim",   color: "text-orange-400" },
    { key: "converted", label: "Dönüştü",    color: "text-green-400" },
    { key: "skipped",   label: "Atlandı",    color: "text-red-400" },
  ];

  return (
    <AdminLayout title="Lead Tarama Kuyruğu" description="Potansiyel müşteri domain tarama ve puanlama">

      <div className="grid grid-cols-6 gap-3 mb-6">
        {statItems.map(s => (
          <Card
            key={s.key}
            className={`bg-slate-800 border-slate-700 cursor-pointer transition-colors ${filterStatus === s.key ? "ring-1 ring-emerald-500" : ""}`}
            onClick={() => setFilterStatus(filterStatus === s.key ? "" : s.key)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{(stats as Record<string, number> | undefined)?.[s.key] ?? 0}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-slate-400 text-sm">{filterStatus ? `Filtre: ${filterStatus}` : "Tüm kayıtlar"} — {items.length} sonuç</div>
        <Button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="h-4 w-4" /> Manuel Ekle
        </Button>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Domain</th>
                <th className="px-4 py-3 text-left">Şirket</th>
                <th className="px-4 py-3 text-left">Kaynak</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3 text-center">Lead Puan</th>
                <th className="px-4 py-3 text-center">Kontak</th>
                <th className="px-4 py-3 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Yükleniyor...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Kayıt yok</td></tr>
              )}
              {items.map(item => {
                const st = STATUS_MAP[item.scanStatus] ?? STATUS_MAP["pending"]!;
                const StatusIcon = st.icon;
                const contactCount = Array.isArray(item.contacts) ? item.contacts.length : 0;
                return (
                  <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-750">
                    <td className="px-4 py-3 text-emerald-400 font-medium">{item.domain}</td>
                    <td className="px-4 py-3 text-slate-300">{item.companyName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{item.source ?? "manual"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                        <StatusIcon className={`h-3 w-3 ${item.scanStatus === "scanning" ? "animate-spin" : ""}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.riskScore !== null ? (
                        <span className={`font-bold ${scoreColor(item.riskScore)}`}>{item.riskScore}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.leadScore !== null ? (
                        <span className={`font-bold text-lg ${scoreColor(item.leadScore)}`}>{item.leadScore}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{contactCount > 0 ? contactCount : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {item.scanStatus === "pending" && (
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs border-slate-600 gap-1"
                            onClick={() => scoreMutation.mutate(item.id)}
                            disabled={scoreMutation.isPending}
                          >
                            <Radar className="h-3 w-3" /> Puan
                          </Button>
                        )}
                        {item.scanStatus === "scored" && contactCount === 0 && (
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs border-blue-600 text-blue-300 gap-1"
                            onClick={() => enrichMutation.mutate(item.id)}
                            disabled={enrichMutation.isPending}
                          >
                            <Users className="h-3 w-3" /> Kontak Bul
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className="h-7 text-xs text-red-400 hover:text-red-300"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Manuel Domain Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-slate-300 text-xs">Domain *</Label>
              <Input value={newDomain} onChange={e => setNewDomain(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="ornek.com.tr" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Şirket Adı</Label>
              <Input value={newCompany} onChange={e => setNewCompany(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Örnek A.Ş." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!newDomain || addMutation.isPending}
              onClick={() => addMutation.mutate({ domain: newDomain, companyName: newCompany })}
            >
              {addMutation.isPending ? "Ekleniyor..." : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
