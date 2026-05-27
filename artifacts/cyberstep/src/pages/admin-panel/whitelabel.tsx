import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, ExternalLink, Copy, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface WhiteLabelPartner {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  contactEmail: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

const baseUrl = window.location.origin;

export default function AdminWhitelabel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<WhiteLabelPartner>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", slug: "", logoUrl: "", primaryColor: "#10b981",
    contactEmail: "", description: "",
  });

  const { data: partners = [], isLoading } = useQuery<WhiteLabelPartner[]>({
    queryKey: ["admin-whitelabel"],
    queryFn: () => fetch("/api/admin-panel/whitelabel-partners", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof addForm) =>
      fetch("/api/admin-panel/whitelabel-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, logoUrl: data.logoUrl || undefined, contactEmail: data.contactEmail || undefined, description: data.description || undefined }),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Hata");
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-whitelabel"] });
      setShowAdd(false);
      setAddForm({ name: "", slug: "", logoUrl: "", primaryColor: "#10b981", contactEmail: "", description: "" });
      toast({ title: "Partner oluşturuldu" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WhiteLabelPartner> }) =>
      fetch(`/api/admin-panel/whitelabel-partners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-whitelabel"] });
      setEditId(null);
      toast({ title: "Güncellendi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/whitelabel-partners/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-whitelabel"] });
      toast({ title: "Silindi" });
    },
  });

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${baseUrl}/w/${slug}/assessment/start`);
    toast({ title: "URL kopyalandı" });
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);

  return (
    <AdminLayout title="Beyaz Etiket (Whitelabel)" description="Entegratörler için markalı değerlendirme sayfaları oluşturun">
      <div className="max-w-3xl space-y-6">
        {/* Info box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300">
          <p className="font-medium mb-1">Nasıl Çalışır?</p>
          <p className="text-blue-400/80 leading-relaxed">
            Her entegratör için bir slug oluşturun. Entegratör müşterilerini
            <code className="mx-1 bg-blue-900/40 px-1.5 py-0.5 rounded text-xs">/w/{'<slug>'}/assessment/start</code>
            adresine yönlendirir. Bu sayfa entegratörün logo ve renk temasıyla görünür.
            Fortinet, CrowdStrike gibi partnerlerle iş birliği kurulduğunda her biri için ayrı bir white-label ortam oluşturabilirsiniz.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{partners.length} entegratör partner</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Partner Ekle
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Yeni Whitelabel Partner</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Partner Adı <span className="text-red-400">*</span></label>
                  <Input value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                    placeholder="Acme Teknoloji" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Slug (URL) <span className="text-red-400">*</span></label>
                  <Input value={addForm.slug}
                    onChange={e => setAddForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                    placeholder="acme-teknoloji" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Logo URL</label>
                <Input value={addForm.logoUrl} onChange={e => setAddForm(f => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://partner.com/logo.svg" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Ana Renk</label>
                  <div className="flex gap-2">
                    <input type="color" value={addForm.primaryColor}
                      onChange={e => setAddForm(f => ({ ...f, primaryColor: e.target.value }))}
                      className="h-10 w-12 rounded-md bg-slate-900 border border-slate-600 cursor-pointer" />
                    <Input value={addForm.primaryColor} onChange={e => setAddForm(f => ({ ...f, primaryColor: e.target.value }))}
                      className="bg-slate-900 border-slate-600 text-white font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">İletişim E-postası</label>
                  <Input value={addForm.contactEmail} onChange={e => setAddForm(f => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="partner@acme.com" type="email" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Açıklama (İç Not)</label>
                <Textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Bu partner hakkında not..." className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              {addForm.slug && (
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Oluşturulacak URL:</p>
                  <code className="text-emerald-400 text-xs">{baseUrl}/w/{addForm.slug}/assessment/start</code>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => createMutation.mutate(addForm)}
                disabled={!addForm.name || !addForm.slug || createMutation.isPending}>
                <Check className="h-4 w-4 mr-1" /> Oluştur
              </Button>
              <Button variant="ghost" className="text-slate-400" onClick={() => setShowAdd(false)}>
                <X className="h-4 w-4 mr-1" /> İptal
              </Button>
            </div>
          </div>
        )}

        {/* Partner list */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-8">Yükleniyor...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Henüz whitelabel partner eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map(partner => (
              <div key={partner.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {editId === partner.id ? (
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ad" className="bg-slate-900 border-slate-600 text-white" />
                      <Input value={editForm.logoUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="Logo URL" className="bg-slate-900 border-slate-600 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex gap-2">
                        <input type="color" value={editForm.primaryColor ?? "#10b981"}
                          onChange={e => setEditForm(f => ({ ...f, primaryColor: e.target.value }))}
                          className="h-10 w-12 rounded bg-slate-900 border border-slate-600 cursor-pointer" />
                        <Input value={editForm.primaryColor ?? ""} onChange={e => setEditForm(f => ({ ...f, primaryColor: e.target.value }))}
                          className="bg-slate-900 border-slate-600 text-white font-mono" />
                      </div>
                      <Input value={editForm.contactEmail ?? ""} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                        placeholder="E-posta" className="bg-slate-900 border-slate-600 text-white" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateMutation.mutate({ id: partner.id, data: editForm })}
                        disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Kaydet
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5 mr-1" /> İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {partner.logoUrl ? (
                          <div className="bg-white rounded-lg p-2 h-10 w-16 flex items-center justify-center shrink-0">
                            <img src={partner.logoUrl} alt={partner.name} className="max-h-7 max-w-[52px] object-contain" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: partner.primaryColor + "20" }}>
                            <Building2 className="h-5 w-5" style={{ color: partner.primaryColor }} />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{partner.name}</span>
                            <code className="text-slate-500 text-xs bg-slate-700/50 px-1.5 py-0.5 rounded">{partner.slug}</code>
                            <Badge className={partner.isActive
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                              : "bg-slate-700 text-slate-500 border-slate-600 text-xs"}>
                              {partner.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </div>
                          {partner.contactEmail && (
                            <p className="text-slate-500 text-xs mt-0.5">{partner.contactEmail}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-emerald-400/70 text-xs">/w/{partner.slug}/assessment/start</code>
                            <button onClick={() => copyUrl(partner.slug)} className="text-slate-500 hover:text-slate-300">
                              <Copy className="h-3 w-3" />
                            </button>
                            <a href={`/w/${partner.slug}/assessment/start`} target="_blank" rel="noopener noreferrer"
                              className="text-slate-500 hover:text-emerald-400">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="h-4 w-4 rounded-full border border-slate-600" style={{ backgroundColor: partner.primaryColor }} />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400"
                          onClick={() => updateMutation.mutate({ id: partner.id, data: { isActive: !partner.isActive } })}>
                          {partner.isActive
                            ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                            : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          onClick={() => { setEditId(partner.id); setEditForm(partner); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                          onClick={() => { if (confirm("Silmek istediğinize emin misiniz?")) deleteMutation.mutate(partner.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {partner.description && (
                      <p className="text-slate-500 text-xs mt-3 pl-[52px]">{partner.description}</p>
                    )}
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
