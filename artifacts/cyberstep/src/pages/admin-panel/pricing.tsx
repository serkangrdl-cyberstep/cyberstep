import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Shield, Plus, X, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";

interface PricingPlan {
  id: number; slug: string; name: string; price: string; currency: string;
  description: string; features: string[]; isActive: boolean; sortOrder: number;
}

export default function AdminPricing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  useRequireAdmin();

  const { data: plans = [], isLoading } = useQuery<PricingPlan[]>({
    queryKey: ["admin-pricing"],
    queryFn: () => fetch("/api/admin-panel/pricing", { credentials: "include" }).then(r => r.json()),
  });

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PricingPlan> & { featuresText?: string }>({});

  const startEdit = (plan: PricingPlan) => {
    setEditId(plan.id);
    setEditForm({ ...plan, featuresText: plan.features.join("\n") });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PricingPlan> }) =>
      fetch(`/api/admin-panel/pricing/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pricing"] }); qc.invalidateQueries({ queryKey: ["public-pricing"] }); toast({ title: "Güncellendi" }); setEditId(null); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!editId) return;
    const features = (editForm.featuresText ?? "").split("\n").map(f => f.trim()).filter(Boolean);
    updateMutation.mutate({ id: editId, data: { name: editForm.name, price: editForm.price, description: editForm.description, features, isActive: editForm.isActive } });
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          <span className="font-bold text-white text-sm">CyberStep Admin</span>
        </div>
        <Button variant="ghost" className="justify-start text-slate-300 hover:text-white" onClick={() => navigate("/panel")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Genel Bakış
        </Button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <h1 className="text-xl font-bold text-white">Fiyatlandırma Yönetimi</h1>
          <p className="text-slate-400 text-sm">Paket fiyatlarını ve içeriklerini düzenleyin</p>
        </header>

        <div className="p-8 space-y-6 max-w-5xl">
          {plans.map(plan => (
            <Card key={plan.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-white">{plan.name}</CardTitle>
                  <Badge className={plan.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400"}>
                    {plan.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => startEdit(plan)} className="text-slate-400 hover:text-white">
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardHeader>
              {editId === plan.id ? (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Paket Adı</Label>
                      <Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Fiyat (TRY, KDV hariç)</Label>
                      <Input type="number" value={editForm.price ?? ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Açıklama</Label>
                    <Input value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Özellikler (her satıra bir özellik)</Label>
                    <Textarea value={editForm.featuresText ?? ""} onChange={e => setEditForm(f => ({ ...f, featuresText: e.target.value }))} className="bg-slate-700 border-slate-600 text-white min-h-[120px]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))} className="text-slate-300 flex items-center gap-2 text-sm">
                      {editForm.isActive ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 text-slate-500" />}
                      {editForm.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                      <Save className="h-4 w-4 mr-2" /> Kaydet
                    </Button>
                    <Button variant="ghost" onClick={() => setEditId(null)} className="text-slate-400">İptal</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="flex items-center gap-6 text-sm">
                    <div><span className="text-slate-400">Fiyat: </span><span className="text-white font-semibold">{Number(plan.price) === 0 ? "Ücretsiz" : `${Number(plan.price).toLocaleString("tr-TR")} TL`}</span></div>
                    <div><span className="text-slate-400">Özellik: </span><span className="text-white">{plan.features.length} adet</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.features.map((f, i) => <Badge key={i} variant="secondary" className="bg-slate-700 text-slate-300 text-xs">{f}</Badge>)}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
