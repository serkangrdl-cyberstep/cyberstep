import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, ExternalLink, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface TechPartner {
  id: number;
  name: string;
  logoUrl: string;
  websiteUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

const WELL_KNOWN = [
  { name: "Microsoft", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/2048px-Microsoft_logo.svg.png", websiteUrl: "https://microsoft.com" },
  { name: "CrowdStrike", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Crowdstrike_logo.svg/2560px-Crowdstrike_logo.svg.png", websiteUrl: "https://crowdstrike.com" },
  { name: "Fortinet", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Fortinet_logo.svg/2560px-Fortinet_logo.svg.png", websiteUrl: "https://fortinet.com" },
  { name: "Palo Alto Networks", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Palo_alto_networks_logo.svg/2560px-Palo_alto_networks_logo.svg.png", websiteUrl: "https://paloaltonetworks.com" },
];

export default function AdminPartnerlar() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TechPartner>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", logoUrl: "", websiteUrl: "", sortOrder: 0 });

  const { data: partners = [], isLoading } = useQuery<TechPartner[]>({
    queryKey: ["admin-tech-partners"],
    queryFn: () => fetch("/api/admin-panel/tech-partners", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; logoUrl: string; websiteUrl?: string; sortOrder: number }) =>
      fetch("/api/admin-panel/tech-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tech-partners"] });
      setShowAdd(false);
      setAddForm({ name: "", logoUrl: "", websiteUrl: "", sortOrder: 0 });
      toast({ title: "Ortak eklendi" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TechPartner> }) =>
      fetch(`/api/admin-panel/tech-partners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tech-partners"] });
      setEditId(null);
      toast({ title: "Güncellendi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/tech-partners/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tech-partners"] });
      toast({ title: "Silindi" });
    },
  });

  const addWellKnown = (partner: typeof WELL_KNOWN[0]) => {
    createMutation.mutate({ ...partner, sortOrder: partners.length });
  };

  return (
    <AdminLayout title="Teknoloji Ortakları" description="Landing sayfasında gösterilecek global teknoloji iş ortaklarını yönetin">
      <div className="max-w-3xl space-y-6">
        {/* Well-known partners quick-add */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-300 text-sm font-medium mb-3">Hızlı Ekle — Bilinen Partnerler</p>
          <div className="flex flex-wrap gap-2">
            {WELL_KNOWN.map(p => (
              <button
                key={p.name}
                onClick={() => addWellKnown(p)}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 hover:text-white text-xs transition-colors"
              >
                <Plus className="h-3 w-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{partners.length} ortak tanımlı</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Ortak Ekle
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-3">
            <h3 className="text-white font-medium">Yeni Teknoloji Ortağı</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ortak Adı</label>
                <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Fortinet" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Logo URL (SVG/PNG)</label>
                <Input value={addForm.logoUrl} onChange={e => setAddForm(f => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://example.com/logo.svg" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Website URL (isteğe bağlı)</label>
                <Input value={addForm.websiteUrl} onChange={e => setAddForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://fortinet.com" className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
            </div>
            {addForm.logoUrl && (
              <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                <img src={addForm.logoUrl} alt="Logo önizleme" className="h-8 object-contain max-w-[120px]"
                  onError={(e) => (e.currentTarget.style.display = "none")} />
                <span className="text-slate-400 text-xs">Logo önizleme</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => createMutation.mutate({ name: addForm.name, logoUrl: addForm.logoUrl, websiteUrl: addForm.websiteUrl || undefined, sortOrder: addForm.sortOrder })}
                disabled={!addForm.name || !addForm.logoUrl || createMutation.isPending}>
                <Check className="h-4 w-4 mr-1" /> Kaydet
              </Button>
              <Button variant="ghost" className="text-slate-400" onClick={() => { setShowAdd(false); setAddForm({ name: "", logoUrl: "", websiteUrl: "", sortOrder: 0 }); }}>
                <X className="h-4 w-4 mr-1" /> İptal
              </Button>
            </div>
          </div>
        )}

        {/* Partner grid */}
        {isLoading ? (
          <div className="text-slate-400 text-center py-8">Yükleniyor...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Henüz teknoloji ortağı eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {partners.map(partner => (
              <div key={partner.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {editId === partner.id ? (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="İsim" className="bg-slate-900 border-slate-600 text-white" />
                      <Input value={editForm.logoUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="Logo URL" className="bg-slate-900 border-slate-600 text-white" />
                    </div>
                    <Input value={editForm.websiteUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, websiteUrl: e.target.value }))}
                      placeholder="Website URL" className="bg-slate-900 border-slate-600 text-white" />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateMutation.mutate({ id: partner.id, data: editForm })}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Kaydet
                      </Button>
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5 mr-1" /> İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-white rounded-lg p-2 h-12 w-24 flex items-center justify-center shrink-0">
                        <img src={partner.logoUrl} alt={partner.name} className="max-h-8 max-w-[80px] object-contain"
                          onError={(e) => { (e.currentTarget.style.display = "none"); }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{partner.name}</span>
                          <Badge className={partner.isActive
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                            : "bg-slate-700 text-slate-500 border-slate-600 text-xs"}>
                            {partner.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        {partner.websiteUrl && (
                          <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <ExternalLink className="h-3 w-3" /> {partner.websiteUrl}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
