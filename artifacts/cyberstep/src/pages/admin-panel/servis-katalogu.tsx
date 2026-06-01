import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";

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
};

const CATEGORY_COLORS: Record<string, string> = {
  soc: "bg-red-500/10 text-red-400 border-red-500/20",
  monitoring: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  compliance: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  itsm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
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

export default function ServisKatalogu() {
  const qc = useQueryClient();
  const { toast } = useToast();

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
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              {active} aktif
            </Badge>
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
    </AdminLayout>
  );
}
