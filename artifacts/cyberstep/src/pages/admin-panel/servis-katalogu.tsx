import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Check, X, ToggleLeft, ToggleRight, Plus } from "lucide-react";

interface ServiceCatalogItem {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  monthlyPriceTl: string;
  setupFeeTl: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  soc: "SOC & Güvenlik",
  monitoring: "İzleme",
  compliance: "Uyumluluk",
  itsm: "ITSM",
  easm: "Saldırı Yüzeyi (EASM)",
  "threat-intel": "Tehdit İstihbaratı",
  "email-security": "E-posta Güvenlik",
  tprm: "Tedarikçi Riski",
  assessment: "Değerlendirme & Test",
};

const CATEGORY_COLORS: Record<string, string> = {
  soc: "bg-red-500/10 text-red-400 border-red-500/20",
  monitoring: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  compliance: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  itsm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  easm: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "threat-intel": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "email-security": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  tprm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  assessment: "bg-green-500/10 text-green-400 border-green-500/20",
};

function fmtTL(val: string | number) {
  return new Intl.NumberFormat("tr-TR").format(Number(val));
}

function EditableRow({ item, onSave }: { item: ServiceCatalogItem; onSave: (slug: string, data: Partial<ServiceCatalogItem>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [price, setPrice] = useState(item.monthlyPriceTl);
  const [desc, setDesc] = useState(item.shortDescription);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(item.slug, { label, monthlyPriceTl: price, shortDescription: desc });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(item.label);
    setPrice(item.monthlyPriceTl);
    setDesc(item.shortDescription);
    setEditing(false);
  };

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <code className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{item.slug}</code>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <Input value={label} onChange={e => setLabel(e.target.value)} className="h-8 text-sm bg-slate-800 border-slate-700 text-white w-48" />
        ) : (
          <span className="text-white text-sm font-medium">{item.label}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <Textarea value={desc} onChange={e => setDesc(e.target.value)} className="text-sm bg-slate-800 border-slate-700 text-white w-64 h-16 resize-none" />
        ) : (
          <span className="text-slate-400 text-sm line-clamp-2">{item.shortDescription}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <Input value={price} onChange={e => setPrice(e.target.value)} className="h-8 text-sm bg-slate-800 border-slate-700 text-white w-28 text-right" />
        ) : (
          <span className="text-white text-sm font-semibold">{fmtTL(item.monthlyPriceTl)} TL</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[item.category] ?? "bg-slate-700 text-slate-300 border-slate-600"}`}>
          {CATEGORY_LABELS[item.category] ?? item.category}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onSave(item.slug, { isActive: !item.isActive })}
          className="text-slate-400 hover:text-white transition-colors"
          title={item.isActive ? "Pasife al" : "Aktife al"}
        >
          {item.isActive
            ? <ToggleRight className="h-5 w-5 text-emerald-400" />
            : <ToggleLeft className="h-5 w-5 text-slate-500" />}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex gap-1.5 justify-end">
            <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-300">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={handleCancel} className="text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-slate-500 hover:text-slate-300">
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

interface NewServiceForm {
  slug: string;
  label: string;
  shortDescription: string;
  monthlyPriceTl: string;
  setupFeeTl: string;
  category: string;
}

const EMPTY_NEW: NewServiceForm = { slug: "", label: "", shortDescription: "", monthlyPriceTl: "0", setupFeeTl: "0", category: "monitoring" };

export default function ServisKatalogu() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newSvc, setNewSvc] = useState<NewServiceForm>(EMPTY_NEW);

  const { data: services = [], isLoading } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["admin-service-catalog"],
    queryFn: () => fetch("/api/admin-panel/service-catalog", { credentials: "include" }).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: Partial<ServiceCatalogItem> }) =>
      fetch(`/api/admin-panel/service-catalog/${slug}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => { if (!r.ok) throw new Error("Güncelleme başarısız"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-catalog"] });
      toast({ title: "Güncellendi" });
    },
    onError: () => toast({ title: "Hata", description: "Güncelleme yapılamadı", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: NewServiceForm) =>
      fetch("/api/admin-panel/service-catalog", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          label: data.label,
          shortDescription: data.shortDescription,
          monthlyPriceTl: data.monthlyPriceTl,
          setupFeeTl: data.setupFeeTl,
          category: data.category,
          sortOrder: 99,
          isActive: true,
        }),
      }).then(r => { if (!r.ok) throw new Error("Eklenemedi"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-catalog"] });
      setShowAdd(false);
      setNewSvc(EMPTY_NEW);
      toast({ title: "Servis eklendi" });
    },
    onError: () => toast({ title: "Hata", description: "Servis eklenemedi", variant: "destructive" }),
  });

  const handleSave = async (slug: string, data: Partial<ServiceCatalogItem>) => {
    await updateMutation.mutateAsync({ slug, data });
  };

  const active = services.filter(s => s.isActive).length;
  const totalMrr = services.filter(s => s.isActive).reduce((sum, s) => sum + Number(s.monthlyPriceTl), 0);

  return (
    <AdminLayout title="Servis Kataloğu" description="Kurumsal güvenlik servislerini yönet">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Toplam Servis", value: services.length },
            { label: "Aktif Servis", value: active },
            { label: "Maks. Aylık Gelir Potansiyeli", value: `${fmtTL(totalMrr)} TL` },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Servis Listesi</h2>
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                {active} aktif
              </Badge>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Yeni Servis Ekle
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-500">Yükleniyor...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Slug", "Servis Adı", "Açıklama", "Aylık Fiyat", "Kategori", "Durum", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map(item => (
                    <EditableRow key={item.slug} item={item} onSave={handleSave} />
                  ))}
                </tbody>
              </table>
              {services.length === 0 && (
                <div className="p-10 text-center text-slate-500">Henüz servis yok. Seed verisi eklenmemiş olabilir.</div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-600">
          Servis adı, açıklama ve fiyatı satır üzerindeki kalem simgesine tıklayarak düzenleyebilirsiniz. Aktif/pasif durumunu toggle butonuyla değiştirebilirsiniz.
        </p>
      </div>

      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Servis Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Slug</Label>
                <Input className="bg-slate-800 border-slate-700 text-white mt-1 font-mono text-sm" maxLength={80} value={newSvc.slug} onChange={e => setNewSvc(p => ({ ...p, slug: e.target.value }))} placeholder="dns-izleme" />
              </div>
              <div>
                <Label className="text-slate-300">Kategori</Label>
                <Select value={newSvc.category} onValueChange={v => setNewSvc(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soc">SOC & Güvenlik</SelectItem>
                    <SelectItem value="monitoring">İzleme</SelectItem>
                    <SelectItem value="compliance">Uyumluluk</SelectItem>
                    <SelectItem value="itsm">ITSM</SelectItem>
                    <SelectItem value="easm">Saldırı Yüzeyi (EASM)</SelectItem>
                    <SelectItem value="threat-intel">Tehdit İstihbaratı</SelectItem>
                    <SelectItem value="email-security">E-posta Güvenlik</SelectItem>
                    <SelectItem value="tprm">Tedarikçi Riski</SelectItem>
                    <SelectItem value="assessment">Değerlendirme & Test</SelectItem>
                    <SelectItem value="response">Müdahale</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Servis Adı</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1" maxLength={120} value={newSvc.label} onChange={e => setNewSvc(p => ({ ...p, label: e.target.value }))} placeholder="DNS İzleme" />
            </div>
            <div>
              <Label className="text-slate-300">Kısa Açıklama</Label>
              <Textarea className="bg-slate-800 border-slate-700 text-white mt-1 text-sm" rows={2} maxLength={400} value={newSvc.shortDescription} onChange={e => setNewSvc(p => ({ ...p, shortDescription: e.target.value }))} placeholder="Alan adı kayıt değişikliklerini anlık izle..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Aylık Fiyat (TL)</Label>
                <Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" value={newSvc.monthlyPriceTl} onChange={e => setNewSvc(p => ({ ...p, monthlyPriceTl: e.target.value }))} />
              </div>
              <div>
                <Label className="text-slate-300">Kurulum Ücreti (TL)</Label>
                <Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" value={newSvc.setupFeeTl} onChange={e => setNewSvc(p => ({ ...p, setupFeeTl: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-slate-700" onClick={() => { setShowAdd(false); setNewSvc(EMPTY_NEW); }}>Vazgec</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createMutation.mutate(newSvc)} disabled={createMutation.isPending || !newSvc.slug || !newSvc.label}>
                {createMutation.isPending ? "Ekleniyor..." : "Ekle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
