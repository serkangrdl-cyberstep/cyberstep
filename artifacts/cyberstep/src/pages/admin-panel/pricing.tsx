import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, ToggleLeft, ToggleRight, Pencil, X, AlertTriangle, TrendingUp, Info, Trash2, RefreshCw } from "lucide-react";
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
  updatedAt: string;
}

const EMPTY_NEW: Partial<PricingPlan> & { featuresText: string } = {
  slug: "", name: "", price: "0", description: "", featuresText: "", isActive: true, sortOrder: 99,
};

// Kaç ay geçti?
function monthsSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

// Tavsiye edilen enflasyon düzeltme oranı (6 aylık TÜFE tahmini ~%25)
const INFLATION_WARNING_MONTHS = 6;
const SUGGESTED_INFLATION_PCT = 25; // 6 ay için önerilen artış

const PLAN_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  mini:       { label: "Tek Seferlik (Ücretsiz)", color: "bg-slate-700 text-slate-300" },
  full:       { label: "Tek Seferlik",             color: "bg-blue-900/40 text-blue-300" },
  premium:    { label: "Danışmanlık",              color: "bg-violet-900/40 text-violet-300" },
  starter:    { label: "Abonelik / Ay",            color: "bg-emerald-900/40 text-emerald-300" },
  growth:     { label: "Abonelik / Ay",            color: "bg-emerald-900/40 text-emerald-300" },
  enterprise: { label: "Abonelik / Ay",            color: "bg-emerald-900/40 text-emerald-300" },
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PricingPlan> }) =>
      fetch(`/api/admin-panel/pricing/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["public-pricing"] });
      toast({ title: "Güncellendi", description: "Fiyat güncellendi. Güncelleme tarihi sıfırlandı." });
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/pricing/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      qc.invalidateQueries({ queryKey: ["public-pricing"] });
      toast({ title: "Plan silindi" });
      setDeletingId(null);
    },
    onError: () => toast({ title: "Silme hatası", variant: "destructive" }),
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

  // Enflasyon uyarısı: en son güncelleme 6 aydan eskiyse göster
  const oldestUpdate = plans.reduce<string | null>((oldest, p) => {
    if (!oldest) return p.updatedAt;
    return new Date(p.updatedAt) < new Date(oldest) ? p.updatedAt : oldest;
  }, null);
  const monthsOld = oldestUpdate ? monthsSince(oldestUpdate) : 0;
  const showInflationWarning = monthsOld >= INFLATION_WARNING_MONTHS;

  return (
    <AdminLayout title="Fiyatlandırma Yönetimi" description="Paket fiyatlarını ve içeriklerini düzenleyin">
      <div className="max-w-5xl space-y-6">

        {/* ─── Enflasyon Hatırlatıcısı ─────────────────────────────────────────── */}
        {showInflationWarning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300 text-sm mb-1">
                Fiyat Güncelleme Zamanı ({monthsOld} ay geçti)
              </p>
              <p className="text-amber-400/80 text-xs leading-relaxed">
                En eski fiyat güncellemesi <strong>{fmtDate(oldestUpdate!)}</strong> tarihli.
                TÜFE verisine göre son 6 ayda yaklaşık <strong>%{SUGGESTED_INFLATION_PCT}</strong> enflasyon birikti.
                Fiyatları güncellemek için ilgili planın yanındaki düzenleme butonunu kullanın.
              </p>
              <div className="mt-2 text-xs text-amber-400/70 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Öneri: Mevcut fiyatları <strong>%{SUGGESTED_INFLATION_PCT} artırın</strong> — ardından kaydet butonuna tıklayın.
              </div>
            </div>
          </div>
        )}

        {/* ─── Fiyatlandırma Rehberi ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1">Fiyatlandırma Rehberi</p>
            <p>
              <span className="text-slate-300">Tek seferlik planlar</span> (mini/full/premium) — müşteri değerlendirme satın alırken ödediği bedeldir.{" "}
              <span className="text-slate-300">Abonelik planları</span> (starter/growth/enterprise) — aylık SaaS ücreti; ROI Hesaplayıcı ve AI plan yönlendirmesinde kullanılır.
              Fiyatlar KDV hariç, TL cinsindendir. Her 6 ayda bir TÜFE oranında artış önerilir.
            </p>
          </div>
        </div>

        {/* Yeni Plan Butonu */}
        <div className="flex justify-end">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Paket
          </Button>
        </div>

        {/* Yeni Plan Formu */}
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

        {/* Plan Listesi */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-12">Yükleniyor...</div>
        ) : plans.length === 0 ? (
          <div className="text-slate-500 text-center py-12">Henüz fiyat planı yok. "Yeni Paket" ile ekleyin.</div>
        ) : (
          plans.map(plan => {
            const months = monthsSince(plan.updatedAt);
            const planTypeInfo = PLAN_TYPE_LABELS[plan.slug] ?? { label: "Diğer", color: "bg-slate-700 text-slate-300" };
            const needsUpdate = months >= INFLATION_WARNING_MONTHS;

            return (
              <Card key={plan.id} className={`bg-slate-800 ${needsUpdate ? "border-amber-500/30" : "border-slate-700"}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-white text-base">{plan.name}</CardTitle>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-400 text-xs">{plan.slug}</Badge>
                    <Badge className={`text-xs border-0 ${planTypeInfo.color}`}>{planTypeInfo.label}</Badge>
                    <Badge className={plan.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border text-xs" : "bg-slate-700 text-slate-400 text-xs"}>
                      {plan.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                    {needsUpdate && (
                      <Badge className="bg-amber-900/40 text-amber-400 border-amber-500/30 border text-xs flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> {months}a güncellenmedi
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(plan)} className="text-slate-400 hover:text-white h-8 w-8 p-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {deletingId === plan.id ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(plan.id)} disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300 text-xs h-8 px-2">Sil</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)} className="text-slate-400 text-xs h-8 px-2">İptal</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeletingId(plan.id)} className="text-slate-600 hover:text-red-400 h-8 w-8 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {editId === plan.id ? (
                  <CardContent className="space-y-4 pt-2">
                    {/* Enflasyon yardımcı kutusu */}
                    {needsUpdate && (
                      <div className="bg-amber-950/40 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400/80 flex items-start gap-2">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          Bu plan <strong>{months} aydır</strong> güncellenmemiş. TÜFE tahminine göre önerilen yeni fiyat:
                          {" "}<strong className="text-amber-300">
                            {Math.round(Number(plan.price) * (1 + SUGGESTED_INFLATION_PCT / 100)).toLocaleString("tr-TR")} TL
                          </strong>
                          {Number(plan.price) > 0 ? ` (+%${SUGGESTED_INFLATION_PCT})` : ""}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Paket Adı</Label>
                        <Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="bg-slate-700 border-slate-600 text-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">
                          Fiyat (TRY, KDV hariç)
                          {needsUpdate && Number(plan.price) > 0 && (
                            <button
                              type="button"
                              onClick={() => setEditForm(f => ({ ...f, price: String(Math.round(Number(plan.price) * (1 + SUGGESTED_INFLATION_PCT / 100))) }))}
                              className="ml-2 text-amber-400 hover:text-amber-300 text-xs underline inline-flex items-center gap-1"
                            >
                              <RefreshCw className="h-2.5 w-2.5" /> Enflasyon uygula
                            </button>
                          )}
                        </Label>
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
                  <CardContent className="pt-2">
                    <div className="flex items-center gap-6 text-sm mb-3">
                      <div>
                        <span className="text-slate-400">Fiyat: </span>
                        <span className="text-white font-bold text-base">
                          {Number(plan.price) === 0 ? "Ücretsiz" : `${Number(plan.price).toLocaleString("tr-TR")} TL`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Özellik: </span>
                        <span className="text-white">{plan.features.length} adet</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        Son güncelleme: {fmtDate(plan.updatedAt)}
                        {needsUpdate && <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.features.map((f, i) => <Badge key={i} variant="secondary" className="bg-slate-700 text-slate-300 text-xs">{f}</Badge>)}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}

        {/* ─── Hizmet Eşleme Tablosu ─────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Hizmet ve Plan Eşleme Tablosu</CardTitle>
            <p className="text-slate-400 text-sm">Hangi hizmetlerin hangi plana dahil olduğunu gösteren referans tablosu.</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="text-left px-4 py-3 text-slate-300 font-semibold w-2/5">Hizmet / Özellik</th>
                    <th className="text-center px-3 py-3 text-slate-300 font-semibold">Mini (Ücretsiz)</th>
                    <th className="text-center px-3 py-3 text-blue-300 font-semibold">Tam (5.990 TL)</th>
                    <th className="text-center px-3 py-3 text-violet-300 font-semibold">Premium (17.990 TL)</th>
                    <th className="text-center px-3 py-3 text-emerald-400 font-semibold">Starter–Kurumsal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { category: "Değerlendirme", rows: [
                      { label: "Soru sayısı",                  mini: "20",  full: "55",     prem: "55",     sub: "Mini/Tam" },
                      { label: "Güvenlik alanı",               mini: "5",   full: "10",     prem: "10",     sub: "—" },
                      { label: "AI raporu",                    mini: "Gemini", full: "Claude", prem: "Claude", sub: "Claude" },
                      { label: "PDF rapor indirme",            mini: false, full: true,     prem: true,     sub: true },
                      { label: "Sektörel karşılaştırma",       mini: false, full: true,     prem: true,     sub: true },
                      { label: "Uzman danışmanlık görüşmesi",  mini: false, full: "1 saat", prem: "Sınırsız", sub: "Aylık (Kurumsal)" },
                    ]},
                    { category: "Alan Adı Tarama", rows: [
                      { label: "SPF / DMARC / DKIM / MX / SSL",           mini: true,  full: true, prem: true, sub: true },
                      { label: "HIBP sızıntı + kara liste + Shadow IT",   mini: true,  full: true, prem: true, sub: true },
                      { label: "HTTP başlıkları + URLhaus + USOM",        mini: false, full: true, prem: true, sub: "Büyüme+" },
                      { label: "CVE taraması + VirusTotal + AbuseIPDB",   mini: false, full: true, prem: true, sub: "Büyüme+" },
                      { label: "30 günlük otomatik yeniden tarama",       mini: false, full: true, prem: true, sub: true },
                    ]},
                    { category: "Abonelik Özel", rows: [
                      { label: "Sızıntı izleyici sürekli izleme", mini: false, full: false, prem: false, sub: true },
                      { label: "ISR tehdit istihbaratı",           mini: false, full: false, prem: false, sub: "Kurumsal" },
                      { label: "TPRM tedarik zinciri taraması",    mini: false, full: false, prem: false, sub: "Kurumsal" },
                      { label: "White-label raporlama",            mini: false, full: false, prem: false, sub: "Kurumsal" },
                    ]},
                  ].map(({ category, rows }) => (
                    <Fragment key={category}>
                      <tr className="bg-slate-700/50 border-b border-slate-600">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">{category}</td>
                      </tr>
                      {rows.map((row, i) => (
                        <tr key={row.label} className={`border-b border-slate-700 ${i % 2 === 0 ? "bg-slate-800" : "bg-slate-800/50"}`}>
                          <td className="px-4 py-2.5 text-slate-300 text-xs">{row.label}</td>
                          {([row.mini, row.full, row.prem, row.sub] as Array<boolean | string>).map((val, ci) => (
                            <td key={ci} className="px-3 py-2.5 text-center">
                              {typeof val === "boolean"
                                ? val ? <span className="text-emerald-400 text-base">✓</span> : <span className="text-slate-600">—</span>
                                : <span className="text-slate-300 text-xs">{val}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ─── Enflasyon Güncelleme Rehberi ────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              6 Aylık Fiyat Güncelleme Rehberi
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>Türkiye'de enflasyon yüksek seyrettiğinden <strong className="text-slate-300">her 6 ayda bir</strong> fiyatlar gözden geçirilmeli ve TÜFE oranında artırılmalıdır.</p>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: "6 Aylık TÜFE Hedefi", value: "%25 artış", desc: "Mevcut enflasyon ortamı" },
                { label: "Bir Sonraki Güncelleme", value: oldestUpdate ? fmtDate(new Date(new Date(oldestUpdate).setMonth(new Date(oldestUpdate).getMonth() + 6)).toISOString()) : "—", desc: "İlk güncelleme + 6 ay" },
                { label: "Öneri", value: "Her Haziran & Aralık", desc: "Takvim bazlı güncelleme" },
              ].map(({ label, value, desc }) => (
                <div key={label} className="bg-slate-700/40 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className="text-white font-semibold text-sm">{value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
