import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Target, Globe, TrendingUp, Archive } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Campaign {
  id: number;
  name: string;
  targetSectors: string[] | null;
  targetCities: string[] | null;
  targetEmployeeMin: number | null;
  targetEmployeeMax: number | null;
  sources: string[] | null;
  status: string;
  domainsFound: number;
  domainsScanned: number;
  leadsImported: number;
  dealsCreated: number;
  dealsWon: number;
  createdAt: string;
}

const SECTORS = ["Sağlık", "Finans", "Perakende", "Bilişim", "İmalat", "Lojistik", "Eğitim", "İnşaat", "Enerji"];
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya"];

export default function LeadGenCampaignsPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    targetSectors: string[];
    targetCities: string[];
    targetEmployeeMin: string;
    targetEmployeeMax: string;
  }>({ name: "", targetSectors: [], targetCities: [], targetEmployeeMin: "10", targetEmployeeMax: "500" });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["lead-gen-campaigns"],
    queryFn: () => fetch("/api/lead-gen/campaigns", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; targetSectors: string[]; targetCities: string[]; targetEmployeeMin: number; targetEmployeeMax: number }) =>
      fetch("/api/lead-gen/campaigns", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-gen-campaigns"] });
      setShowNew(false);
      setForm({ name: "", targetSectors: [], targetCities: [], targetEmployeeMin: "10", targetEmployeeMax: "500" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/lead-gen/campaigns/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-gen-campaigns"] }),
  });

  function toggleItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  }

  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leadsImported, 0);
  const totalWon = campaigns.reduce((sum, c) => sum + c.dealsWon, 0);

  return (
    <AdminLayout title="Lead Kampanyaları" description="Otomatik lead üretim kampanyaları">

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-emerald-400">{activeCampaigns.length}</div>
            <div className="text-slate-400 text-xs mt-1">Aktif Kampanya</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-400">{totalLeads}</div>
            <div className="text-slate-400 text-xs mt-1">Toplam Lead</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-yellow-400">{totalWon}</div>
            <div className="text-slate-400 text-xs mt-1">Kazanılan Deal</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-semibold">Kampanyalar</h2>
        <Button onClick={() => setShowNew(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="text-slate-400 text-sm">Yükleniyor...</div>}
        {!isLoading && campaigns.length === 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-8 text-center text-slate-400">Henüz kampanya yok</CardContent>
          </Card>
        )}
        {campaigns.map(c => (
          <Card key={c.id} className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium">{c.name}</h3>
                    <Badge className={c.status === "active" ? "bg-green-900/40 text-green-400 border-green-700" : "bg-slate-700 text-slate-400"}>
                      {c.status === "active" ? "Aktif" : "Arşiv"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                    {c.targetSectors?.length ? (
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> {c.targetSectors.join(", ")}
                      </span>
                    ) : null}
                    {c.targetCities?.length ? (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {c.targetCities.join(", ")}
                      </span>
                    ) : null}
                    {c.targetEmployeeMin && (
                      <span>{c.targetEmployeeMin}–{c.targetEmployeeMax} çalışan</span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: "Bulunan Domain", value: c.domainsFound },
                      { label: "Taranan", value: c.domainsScanned },
                      { label: "Lead", value: c.leadsImported },
                      { label: "Deal", value: c.dealsCreated },
                      { label: "Kazanıldı", value: c.dealsWon },
                    ].map(stat => (
                      <div key={stat.label} className="bg-slate-700/50 rounded px-2 py-1.5 text-center">
                        <div className="text-white font-bold text-lg">{stat.value}</div>
                        <div className="text-slate-400 text-xs">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  <span className="text-slate-500 text-xs">
                    {format(new Date(c.createdAt), "d MMM yyyy", { locale: tr })}
                  </span>
                  {c.status === "active" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 gap-1"
                      onClick={() => archiveMutation.mutate(c.id)}>
                      <Archive className="h-3 w-3" /> Arşivle
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader><DialogTitle>Yeni Kampanya Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 text-xs">Kampanya Adı *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="2025 İstanbul Finans Kampanyası" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs mb-2 block">Hedef Sektörler</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, targetSectors: toggleItem(f.targetSectors, s) }))}
                    className={`px-2 py-1 rounded text-xs transition-colors ${form.targetSectors.includes(s) ? "bg-emerald-700 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-xs mb-2 block">Hedef Şehirler</Label>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, targetCities: toggleItem(f.targetCities, c) }))}
                    className={`px-2 py-1 rounded text-xs transition-colors ${form.targetCities.includes(c) ? "bg-blue-700 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Min Çalışan</Label>
                <Input value={form.targetEmployeeMin} onChange={e => setForm(f => ({ ...f, targetEmployeeMin: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1" type="number" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Max Çalışan</Label>
                <Input value={form.targetEmployeeMax} onChange={e => setForm(f => ({ ...f, targetEmployeeMax: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1" type="number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>İptal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.name || createMutation.isPending}
              onClick={() => createMutation.mutate({
                ...form,
                targetEmployeeMin: parseInt(form.targetEmployeeMin) || 10,
                targetEmployeeMax: parseInt(form.targetEmployeeMax) || 500,
              })}
            >
              {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
