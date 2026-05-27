import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, GripVertical, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface ConsultingService {
  id: number;
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

const ICON_OPTIONS = [
  { value: "Shield", label: "Kalkan" },
  { value: "Lock", label: "Kilit" },
  { value: "Search", label: "Araştırma" },
  { value: "Users", label: "Eğitim" },
  { value: "AlertTriangle", label: "Uyarı" },
  { value: "FileText", label: "Belge" },
  { value: "Globe", label: "Ağ" },
  { value: "Server", label: "Sunucu" },
  { value: "Code", label: "Yazılım" },
  { value: "Eye", label: "İzleme" },
];

const DEFAULT_SERVICES = [
  { title: "Penetrasyon Testi", description: "Ağ altyapınız ve web uygulamalarınızdaki güvenlik açıklarını gerçek saldırı senaryolarıyla tespit ediyoruz. Kapsamlı raporlama ve aksiyon planıyla birlikte sunulur.", icon: "Search", sortOrder: 0 },
  { title: "Güvenlik Farkındalık Eğitimi", description: "Çalışanlarınızı phishing, sosyal mühendislik ve güncel siber tehditler konusunda bilinçlendiriyoruz. Simülasyon tabanlı eğitimler ve ölçüm raporları dahildir.", icon: "Users", sortOrder: 1 },
  { title: "Olay Müdahale Planlaması", description: "Siber saldırı anında nasıl hareket edeceğinizi önceden belirliyoruz. Kapsamlı olay müdahale planı, iletişim prosedürleri ve tatbikat desteği sağlıyoruz.", icon: "AlertTriangle", sortOrder: 2 },
  { title: "Uyumluluk Danışmanlığı", description: "ISO 27001, KVKK ve GDPR gerekliliklerini karşılamanıza yardımcı oluyoruz. Boşluk analizi, politika geliştirme ve sertifikasyon süreç yönetimi sunuyoruz.", icon: "FileText", sortOrder: 3 },
  { title: "Güvenlik Mimarisi Tasarımı", description: "Zero-trust modeline dayalı modern güvenlik altyapınızı tasarlıyoruz. Ağ segmentasyonu, kimlik yönetimi ve uç nokta güvenlik çözümleri dahildir.", icon: "Shield", sortOrder: 4 },
];

export default function AdminDanismanlik() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ConsultingService>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", description: "", icon: "Shield", sortOrder: 0 });

  const { data: services = [], isLoading } = useQuery<ConsultingService[]>({
    queryKey: ["admin-consulting"],
    queryFn: () => fetch("/api/admin-panel/consulting-services", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof addForm) =>
      fetch("/api/admin-panel/consulting-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-consulting"] });
      setShowAdd(false);
      setAddForm({ title: "", description: "", icon: "Shield", sortOrder: 0 });
      toast({ title: "Oluşturuldu" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ConsultingService> }) =>
      fetch(`/api/admin-panel/consulting-services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-consulting"] });
      setEditId(null);
      toast({ title: "Güncellendi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/consulting-services/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-consulting"] });
      toast({ title: "Silindi" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      Promise.all(DEFAULT_SERVICES.map(s =>
        fetch("/api/admin-panel/consulting-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(s),
        })
      )),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-consulting"] });
      toast({ title: "Örnek hizmetler eklendi" });
    },
  });

  return (
    <AdminLayout title="Danışmanlık Hizmetleri" description="Landing sayfasındaki 3. seviye danışmanlık hizmetlerini yönetin">
      <div className="max-w-3xl space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{services.length} hizmet tanımlı</p>
          <div className="flex gap-2">
            {services.length === 0 && (
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                Örnek Hizmetleri Ekle
              </Button>
            )}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> Yeni Hizmet
            </Button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Yeni Danışmanlık Hizmeti</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Başlık</label>
                <Input
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Penetrasyon Testi"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Açıklama</label>
                <Textarea
                  value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Hizmet açıklaması..."
                  rows={3}
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">İkon</label>
                  <select
                    value={addForm.icon}
                    onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-md px-3 py-2 text-sm outline-none"
                  >
                    {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Sıra</label>
                  <Input
                    type="number"
                    value={addForm.sortOrder}
                    onChange={e => setAddForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => createMutation.mutate(addForm)}
                disabled={!addForm.title || !addForm.description || createMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" /> Kaydet
              </Button>
              <Button variant="ghost" className="text-slate-400" onClick={() => setShowAdd(false)}>
                <X className="h-4 w-4 mr-1" /> İptal
              </Button>
            </div>
          </div>
        )}

        {/* Service list */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-8">Yükleniyor...</div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="mb-2">Henüz danışmanlık hizmeti eklenmemiş.</p>
            <p className="text-sm">Yukarıdaki "Örnek Hizmetleri Ekle" butonunu kullanabilirsiniz.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map(service => (
              <div key={service.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {editId === service.id ? (
                  <div className="p-5 space-y-3">
                    <Input
                      value={editForm.title ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                    <Textarea
                      value={editForm.description ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateMutation.mutate({ id: service.id, data: editForm })}
                        disabled={updateMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Kaydet
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5 mr-1" /> İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <GripVertical className="h-4 w-4 text-slate-600 mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{service.title}</h3>
                          <Badge className={service.isActive
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                            : "bg-slate-700 text-slate-500 border-slate-600 text-xs"}>
                            {service.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed">{service.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white h-8 w-8 p-0"
                        onClick={() => updateMutation.mutate({ id: service.id, data: { isActive: !service.isActive } })}
                        title={service.isActive ? "Devre dışı bırak" : "Etkinleştir"}
                      >
                        {service.isActive
                          ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                          : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white h-8 w-8 p-0"
                        onClick={() => { setEditId(service.id); setEditForm(service); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                        onClick={() => { if (confirm("Silmek istediğinize emin misiniz?")) deleteMutation.mutate(service.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
