import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";
import { useRequireAdmin } from "@/hooks/use-admin";

interface BadgeAdvantage {
  id: number;
  title: string;
  partnerName: string;
  description: string;
  discountPercent: number | null;
  badgeText: string | null;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

type FormState = {
  title: string;
  partnerName: string;
  description: string;
  discountPercent: string;
  badgeText: string;
  logoUrl: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  partnerName: "",
  description: "",
  discountPercent: "",
  badgeText: "",
  logoUrl: "",
  sortOrder: "0",
};

export default function AdminRozetAvantajlari() {
  const { data: admin } = useRequireAdmin();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: advantages, isLoading } = useQuery<BadgeAdvantage[]>({
    queryKey: ["admin-badge-advantages"],
    queryFn: () =>
      fetch("/api/admin-panel/badge-advantages", { credentials: "include" }).then(r => r.json()),
    enabled: !!admin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        partnerName: form.partnerName,
        description: form.description,
        discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined,
        badgeText: form.badgeText || undefined,
        logoUrl: form.logoUrl || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const url = editingId
        ? `/api/admin-panel/badge-advantages/${editingId}`
        : "/api/admin-panel/badge-advantages";
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-badge-advantages"] });
      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`/api/admin-panel/badge-advantages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error("Hata");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-badge-advantages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin-panel/badge-advantages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Hata");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-badge-advantages"] });
      setDeleteId(null);
    },
  });

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (a: BadgeAdvantage) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      partnerName: a.partnerName,
      description: a.description,
      discountPercent: a.discountPercent?.toString() ?? "",
      badgeText: a.badgeText ?? "",
      logoUrl: a.logoUrl ?? "",
      sortOrder: a.sortOrder.toString(),
    });
    setModalOpen(true);
  };

  const list = Array.isArray(advantages) ? advantages : [];

  return (
    <AdminLayout
      title="Rozet Avantajları"
      description="CyberStep Doğrulandı rozeti sahiplerine sunulan özel avantajlar"
    >
      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">
                {editingId ? "Avantajı Düzenle" : "Yeni Avantaj Ekle"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "title", label: "Avantaj Başlığı *", placeholder: "Siber Güvenlik Sigortasında %15 İndirim" },
                { key: "partnerName", label: "İş Ortağı / Firma Adı *", placeholder: "AXA Sigorta" },
                { key: "badgeText", label: "Kısa Etiket", placeholder: "Sigorta İndirimi" },
                { key: "logoUrl", label: "Logo URL (isteğe bağlı)", placeholder: "https://..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-slate-400">{label}</label>
                  <input
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder={placeholder}
                    value={form[key as keyof FormState]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Açıklama *</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  placeholder="Rozet sahibi firmalara sunulan özel avantajın detayları..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">İndirim Oranı (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="15"
                    value={form.discountPercent}
                    onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Sıralama</label>
                  <input
                    type="number"
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="0"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  />
                </div>
              </div>

              {saveMutation.isError && (
                <p className="text-red-400 text-xs">{(saveMutation.error as Error).message}</p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" size="sm" className="text-slate-400"
                  onClick={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}
                  disabled={saveMutation.isPending}>
                  İptal
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!form.title || !form.partnerName || !form.description || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-white font-semibold">Bu avantajı silmek istediğinizden emin misiniz?</h3>
            <p className="text-slate-400 text-sm">Bu işlem geri alınamaz.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setDeleteId(null)}>İptal</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteId!)}>
                {deleteMutation.isPending ? "Siliniyor..." : "Sil"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <p className="text-slate-400 text-sm">
            Buraya girilen avantajlar ana pazarlama sayfasında ve müşteri raporlarında gösterilir.
          </p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Avantaj Ekle
        </Button>
      </div>

      {isLoading || !admin ? (
        <div className="text-slate-400 text-center py-16">Yükleniyor...</div>
      ) : (
        <div className="grid gap-4">
          {list.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-12 text-center text-slate-500">
                Henüz avantaj eklenmedi. İş ortağı anlaşmalarınızı buraya ekleyin.
              </CardContent>
            </Card>
          ) : (
            list.map(a => (
              <Card key={a.id} className={`bg-slate-800 border-slate-700 ${!a.isActive ? "opacity-50" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-semibold text-sm">{a.title}</span>
                        {a.discountPercent && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            %{a.discountPercent} İndirim
                          </Badge>
                        )}
                        {a.badgeText && (
                          <Badge variant="outline" className="text-xs text-slate-300 border-slate-600">
                            {a.badgeText}
                          </Badge>
                        )}
                        {!a.isActive && (
                          <Badge variant="outline" className="text-xs text-slate-500 border-slate-700">Pasif</Badge>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mb-1">{a.partnerName}</p>
                      <p className="text-slate-300 text-sm">{a.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                        className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                        title={a.isActive ? "Pasife al" : "Aktife al"}
                      >
                        {a.isActive
                          ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                          : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(a.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </AdminLayout>
  );
}
