import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, ToggleLeft, ToggleRight, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface PricingPlan {
  id: number; slug: string; name: string; price: string; currency: string;
  description: string; features: string[]; isActive: boolean; sortOrder: number;
}

const EMPTY_NEW: Partial<PricingPlan> & { featuresText: string } = {
  slug: "", name: "", price: "0", description: "", featuresText: "", isActive: true, sortOrder: 99,
};

export default function AdminPricing() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<PricingPlan[]>({
    queryKey: ["admin-pricing"],
    queryFn: () => fetch("/api/admin-panel/pricing", { credentials: "include" }).then(r => r.json()),
  });

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PricingPlan> & { featuresText?: string }>({});
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PricingPlan> }) =>
      fetch(`/api/admin-panel/pricing/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["public-pricing"] });
      toast({ title: "Güncellendi" });
      setEditId(null);
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PricingPlan>) =>
      fetch("/api/admin-panel/pricing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["public-pricing"] });
      toast({ title: "Paket oluşturuldu" });
      setShowNew(false);
      setNewForm({ ...EMPTY_NEW });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const startEdit = (plan: PricingPlan) => {
    setEditId(plan.id);
    setEditForm({ ...plan, featuresText: plan.features.join("\n") });
  };

  const handleSave = () => {
    if (!editId) return;
    const features = (editForm.featuresText ?? "").split("\n").map(f => f.trim()).filter(Boolean);
    updateMutation.mutate({ id: editId, data: { name: editForm.name, price: editForm.price, description: editForm.description, features, isActive: editForm.isActive } });
  };

  const handleCreate = () => {
    if (!newForm.slug || !newForm.name) { toast({ title: "Slug ve ad zorunludur", variant: "destructive" }); return; }
    const features = (newForm.featuresText ?? "").split("\n").map(f => f.trim()).filter(Boolean);
    createMutation.mutate({ slug: newForm.slug, name: newForm.name, price: newForm.price, description: newForm.description, features, isActive: newForm.isActive, sortOrder: newForm.sortOrder });
  };

  return (
    <AdminLayout title="Fiyatlandırma Yönetimi" description="Paket fiyatlarını ve içeriklerini düzenleyin">
      <div className="max-w-5xl space-y-6">
        <div className="flex justify-end">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Paket
          </Button>
        </div>

        {showNew && (
          <Card className="bg-slate-800 border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-white text-base">Yeni Fiyatlandırma Paketi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Slug (tekil, değiştirilemez)</Label>
                  <Input value={newForm.slug ?? ""} onChange={e => setNewForm(f => ({ ...f, slug: e.target.value }))} placeholder="ornek-paket" className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Paket Adı</Label>
                  <Input value={newForm.name ?? ""} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Fiyat (TRY, KDV hariç)</Label>
                  <Input type="number" value={newForm.price ?? "0"} onChange={e => setNewForm(f => ({ ...f, price: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Sıra</Label>
                  <Input type="number" value={newForm.sortOrder ?? 99} onChange={e => setNewForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Açıklama</Label>
                <Input value={newForm.description ?? ""} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Özellikler (her satıra bir özellik)</Label>
                <Textarea value={newForm.featuresText ?? ""} onChange={e => setNewForm(f => ({ ...f, featuresText: e.target.value }))} className="bg-slate-700 border-slate-600 text-white min-h-[100px]" />
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setNewForm(f => ({ ...f, isActive: !f.isActive }))} className="text-slate-300 flex items-center gap-2 text-sm">
                  {newForm.isActive ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 text-slate-500" />}
                  {newForm.isActive ? "Aktif" : "Pasif"}
                </button>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" /> Oluştur
                </Button>
                <Button variant="ghost" onClick={() => { setShowNew(false); setNewForm({ ...EMPTY_NEW }); }} className="text-slate-400">
                  <X className="h-4 w-4 mr-1" /> İptal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-slate-400 text-center py-12">Yükleniyor...</div>
        ) : plans.length === 0 ? (
          <div className="text-slate-500 text-center py-12">Henüz fiyat planı yok. "Yeni Paket" ile ekleyin.</div>
        ) : (
          plans.map(plan => (
            <Card key={plan.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-white">{plan.name}</CardTitle>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-400 text-xs">{plan.slug}</Badge>
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
          ))
        )}
        {/* Hizmet Eşleme Tablosu */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Hizmet ve Plan Eşleme Tablosu</CardTitle>
            <p className="text-slate-400 text-sm">Hangi hizmetlerin hangi plana dahil olduğunu gösteren referans tablosu. Özellikleri düzenlemek için yukarıdaki planları kullanın.</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="text-left px-4 py-3 text-slate-300 font-semibold w-1/2">Hizmet / Özellik</th>
                    <th className="text-center px-4 py-3 text-slate-300 font-semibold">Mini (Ücretsiz)</th>
                    <th className="text-center px-4 py-3 text-emerald-400 font-semibold">Tam (Ücretli)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { category: "Değerlendirme", rows: [
                      { label: "Soru sayısı", mini: "20", full: "55" },
                      { label: "Güvenlik alanı", mini: "5 (A-E)", full: "10 (A-J)" },
                      { label: "Yapay zeka raporu", mini: "Temel", full: "Detaylı" },
                      { label: "PDF rapor indirme", mini: false, full: true },
                      { label: "Sektörel karşılaştırma", mini: false, full: true },
                      { label: "30 günlük yeniden tarama", mini: false, full: true },
                      { label: "Uzman danışmanlık görüşmesi", mini: false, full: true },
                    ]},
                    { category: "Alan Adı Tarama", rows: [
                      { label: "SPF / DMARC / DKIM / MX / SSL", mini: true, full: true },
                      { label: "HIBP veri sızıntısı kontrolü", mini: true, full: true },
                      { label: "Kara liste ve Shadow IT tespiti", mini: true, full: true },
                      { label: "HTTP güvenlik başlıkları analizi", mini: false, full: true },
                      { label: "URLhaus zararlı URL kontrolü", mini: false, full: true },
                      { label: "USOM kara liste domain taraması", mini: false, full: true },
                      { label: "crt.sh Alt Alan Şeffaflığı", mini: false, full: true },
                      { label: "NIST NVD CVE güvenlik açığı taraması", mini: false, full: true },
                    ]},
                    { category: "Uyumluluk", rows: [
                      { label: "KVKK Madde 12 Teknik Tedbir Haritası", mini: false, full: true },
                      { label: "NIST CSF 2.0 Uyum Seviyesi", mini: false, full: true },
                    ]},
                  ].map(({ category, rows }) => (
                    <Fragment key={category}>
                      <tr className="bg-slate-700/50 border-b border-slate-600">
                        <td colSpan={3} className="px-4 py-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">{category}</td>
                      </tr>
                      {rows.map((row, i) => (
                        <tr key={row.label} className={`border-b border-slate-700 ${i % 2 === 0 ? "bg-slate-800" : "bg-slate-800/50"}`}>
                          <td className="px-4 py-2.5 text-slate-300">{row.label}</td>
                          <td className="px-4 py-2.5 text-center">
                            {typeof row.mini === "boolean"
                              ? row.mini ? <span className="text-emerald-400 text-base">✓</span> : <span className="text-slate-600">—</span>
                              : <span className="text-slate-300 text-xs">{row.mini}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {typeof row.full === "boolean"
                              ? row.full ? <span className="text-emerald-400 text-base">✓</span> : <span className="text-slate-600">—</span>
                              : <span className="text-emerald-300 text-xs font-semibold">{row.full}</span>}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
