import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAdmin } from "@/hooks/use-admin";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink,
  Image, Mail, Phone, UserCircle, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface Contact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface TechPartner {
  id: number;
  name: string;
  logoUrl: string;
  websiteUrl: string | null;
  salesRepName: string | null;
  salesRepEmail: string | null;
  additionalContacts: Contact[];
  isActive: boolean;
  sortOrder: number;
}

interface Distributor {
  id: number;
  vendorId: number;
  name: string;
  contactName: string | null;
  contactEmail: string;
  phone: string | null;
  notes: string | null;
  additionalContacts: Contact[];
  isActive: boolean;
}

interface IsrVendor {
  id: number;
  name: string;
  displayName: string;
  distributors: Distributor[];
}

const WELL_KNOWN = [
  { name: "Microsoft", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/2048px-Microsoft_logo.svg.png", websiteUrl: "https://microsoft.com" },
  { name: "CrowdStrike", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Crowdstrike_logo.svg/2560px-Crowdstrike_logo.svg.png", websiteUrl: "https://crowdstrike.com" },
  { name: "Fortinet", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Fortinet_logo.svg/2560px-Fortinet_logo.svg.png", websiteUrl: "https://fortinet.com" },
  { name: "Palo Alto Networks", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Palo_alto_networks_logo.svg/2560px-Palo_alto_networks_logo.svg.png", websiteUrl: "https://paloaltonetworks.com" },
];

const EMPTY_FORM = {
  name: "", logoUrl: "", websiteUrl: "",
  salesRepName: "", salesRepEmail: "",
  additionalContacts: [] as Contact[],
};
const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "", role: "" };
const EMPTY_DIST = { name: "", contactName: "", contactEmail: "", phone: "", notes: "", additionalContacts: [] as Contact[] };

export default function AdminPartnerlar() {
  const { data: admin } = useRequireAdmin();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialog, setDialog] = useState<{ open: boolean; editing?: TechPartner }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);

  const [distDialog, setDistDialog] = useState<{ open: boolean; partnerId?: number; partnerName?: string; editing?: Distributor }>({ open: false });
  const [dForm, setDForm] = useState(EMPTY_DIST);

  const { data: partners = [], isLoading } = useQuery<TechPartner[]>({
    queryKey: ["admin-tech-partners"],
    queryFn: () => fetch("/api/admin-panel/tech-partners", { credentials: "include" }).then(r => r.json()),
  });

  const { data: isrVendors = [] } = useQuery<IsrVendor[]>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
  });

  const isrVendorByName = (partnerName: string) =>
    isrVendors.find(v => v.name.toLowerCase() === partnerName.toLowerCase() || v.displayName.toLowerCase() === partnerName.toLowerCase());

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, logoUrl: form.logoUrl, websiteUrl: form.websiteUrl || null,
        salesRepName: form.salesRepName || null, salesRepEmail: form.salesRepEmail || null,
        additionalContacts: form.additionalContacts,
        sortOrder: dialog.editing?.sortOrder ?? partners.length,
      };
      if (dialog.editing) {
        return fetch(`/api/admin-panel/tech-partners/${dialog.editing.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/tech-partners", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tech-partners"] });
      setDialog({ open: false });
      toast({ title: dialog.editing ? "Güncellendi" : "Ortak eklendi" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetch(`/api/admin-panel/tech-partners/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tech-partners"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/tech-partners/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tech-partners"] }); toast({ title: "Silindi" }); },
  });

  const saveDistMutation = useMutation({
    mutationFn: async () => {
      let vendorId: number | undefined;
      const existing = distDialog.partnerName ? isrVendorByName(distDialog.partnerName) : undefined;
      if (existing) {
        vendorId = existing.id;
      } else {
        const slug = (distDialog.partnerName ?? "vendor").toLowerCase().replace(/\s+/g, "-");
        const res = await fetch("/api/admin-panel/isr/vendors", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: slug, displayName: distDialog.partnerName ?? slug }),
        }).then(r => r.json());
        vendorId = res.id;
      }

      if (distDialog.editing) {
        return fetch(`/api/admin-panel/isr/distributors/${distDialog.editing.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(dForm),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/isr/distributors", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dForm, vendorId }),
      }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["isr-vendors"] });
      setDistDialog({ open: false });
      toast({ title: distDialog.editing ? "Distribütör güncellendi" : "Distribütör eklendi" });
    },
  });

  const deleteDistMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/isr/distributors/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isr-vendors"] }),
  });

  const openNew = (preset?: Partial<typeof EMPTY_FORM>) => {
    setForm({ ...EMPTY_FORM, ...preset });
    setDialog({ open: true });
  };

  const openEdit = (p: TechPartner) => {
    setForm({
      name: p.name, logoUrl: p.logoUrl, websiteUrl: p.websiteUrl ?? "",
      salesRepName: p.salesRepName ?? "", salesRepEmail: p.salesRepEmail ?? "",
      additionalContacts: p.additionalContacts ?? [],
    });
    setDialog({ open: true, editing: p });
  };

  const openDist = (partnerName: string, editing?: Distributor) => {
    setDForm(editing
      ? { name: editing.name, contactName: editing.contactName ?? "", contactEmail: editing.contactEmail, phone: editing.phone ?? "", notes: editing.notes ?? "", additionalContacts: editing.additionalContacts ?? [] }
      : EMPTY_DIST);
    setDistDialog({ open: true, partnerName, editing });
  };

  const addContact = () => setForm(f => ({ ...f, additionalContacts: [...f.additionalContacts, { ...EMPTY_CONTACT }] }));
  const removeContact = (i: number) => setForm(f => ({ ...f, additionalContacts: f.additionalContacts.filter((_, idx) => idx !== i) }));
  const updateContact = (i: number, field: keyof Contact, value: string) =>
    setForm(f => ({ ...f, additionalContacts: f.additionalContacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }));

  const addDistContact = () => setDForm(f => ({ ...f, additionalContacts: [...f.additionalContacts, { ...EMPTY_CONTACT }] }));
  const removeDistContact = (i: number) => setDForm(f => ({ ...f, additionalContacts: f.additionalContacts.filter((_, idx) => idx !== i) }));
  const updateDistContact = (i: number, field: keyof Contact, value: string) =>
    setDForm(f => ({ ...f, additionalContacts: f.additionalContacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }));

  return (
    <AdminLayout title="Teknoloji Ortakları" description="Landing sayfasında gösterilecek global teknoloji iş ortaklarını yönetin">
      <div className="max-w-3xl space-y-6">

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-300 text-sm font-medium mb-3">Hızlı Ekle — Bilinen Partnerler</p>
          <div className="flex flex-wrap gap-2">
            {WELL_KNOWN.map(p => (
              <button key={p.name} onClick={() => openNew({ name: p.name, logoUrl: p.logoUrl, websiteUrl: p.websiteUrl })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 hover:text-white text-xs transition-colors">
                <Plus className="h-3 w-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{partners.length} ortak tanımlı</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openNew()}>
            <Plus className="h-4 w-4 mr-2" /> Ortak Ekle
          </Button>
        </div>

        {isLoading ? (
          <div className="text-slate-400 text-center py-8">Yükleniyor...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Henüz teknoloji ortağı eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {partners.map(partner => {
              const isrVendor = isrVendorByName(partner.name);
              const distributors = isrVendor?.distributors ?? [];
              return (
                <div key={partner.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Partner satırı */}
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="bg-white rounded-lg p-2 h-12 w-24 flex items-center justify-center shrink-0">
                        <img src={partner.logoUrl} alt={partner.name}
                          className="max-h-8 max-w-[80px] object-contain"
                          onError={(e) => { (e.currentTarget.style.display = "none"); }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                        {(partner.salesRepName || partner.salesRepEmail) && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                            {partner.salesRepName && (
                              <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" />{partner.salesRepName}</span>
                            )}
                            {partner.salesRepEmail && (
                              <a href={`mailto:${partner.salesRepEmail}`} className="flex items-center gap-1 text-blue-400 hover:underline">
                                <Mail className="h-3 w-3" />{partner.salesRepEmail}
                              </a>
                            )}
                          </div>
                        )}
                        {partner.additionalContacts?.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {partner.additionalContacts.map((c, i) => (
                              <div key={i} className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-slate-500">
                                {c.role && <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-900/30 border-blue-700 text-blue-400">{c.role}</Badge>}
                                {c.name && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" />{c.name}</span>}
                                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-400 hover:underline"><Mail className="h-3 w-3" />{c.email}</a>}
                                {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400"
                        onClick={() => toggleMutation.mutate({ id: partner.id, isActive: !partner.isActive })}>
                        {partner.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        onClick={() => openEdit(partner)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                        onClick={() => { if (confirm("Silmek istediğinize emin misiniz?")) deleteMutation.mutate(partner.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Distribütörler bölümü */}
                  <div className="border-t border-slate-700 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Distribütörler
                        <Badge variant="outline" className="text-[10px] px-1.5 border-slate-600 text-slate-400">{distributors.length}</Badge>
                      </span>
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 bg-transparent"
                        onClick={() => openDist(partner.name)}>
                        <Plus className="h-3 w-3 mr-1" /> Distribütör Ekle
                      </Button>
                    </div>

                    {distributors.length === 0 ? (
                      <p className="text-xs text-slate-600 italic py-1">
                        Henüz distribütör yok — RFQ otomasyonu için gerekli.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {distributors.map(d => (
                          <div key={d.id} className="bg-slate-700/40 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-200">{d.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {d.contactName && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <UserCircle className="h-3 w-3" />{d.contactName}
                                  </span>
                                )}
                                {d.contactEmail && (
                                  <a href={`mailto:${d.contactEmail}`} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{d.contactEmail}
                                  </a>
                                )}
                                {d.phone && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Phone className="h-3 w-3" />{d.phone}
                                  </span>
                                )}
                              </div>
                              {(d.additionalContacts ?? []).filter(c => c.email).map((c, i) => (
                                <div key={i} className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5">
                                  {c.role && <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-900/30 border-blue-700 text-blue-400">{c.role}</Badge>}
                                  {c.name && <span className="text-xs text-slate-500 flex items-center gap-1"><UserCircle className="h-3 w-3" />{c.name}</span>}
                                  <a href={`mailto:${c.email}`} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</a>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
                                onClick={() => openDist(partner.name, d)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                                onClick={() => deleteDistMutation.mutate(d.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Partner Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialog.open} onOpenChange={o => setDialog({ open: o })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Teknoloji Ortağı Düzenle" : "Yeni Teknoloji Ortağı"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ortak Adı <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Fortinet" className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Website URL</Label>
                <Input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://fortinet.com" className="text-sm mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Logo URL (SVG/PNG) <span className="text-red-500">*</span></Label>
              <Input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.svg" className="text-sm mt-1" />
              {form.logoUrl && (
                <div className="mt-2 bg-white rounded-lg p-2 inline-flex items-center gap-2">
                  <img src={form.logoUrl} alt="önizleme" className="h-7 max-w-[100px] object-contain"
                    onError={e => (e.currentTarget.style.display = "none")} />
                  <span className="text-slate-400 text-xs">önizleme</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" /> Satış Temsilcisi
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Ad Soyad</Label>
                  <Input value={form.salesRepName} onChange={e => setForm(f => ({ ...f, salesRepName: e.target.value }))}
                    placeholder="Ahmet Yılmaz" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">E-posta</Label>
                  <Input type="email" value={form.salesRepEmail} onChange={e => setForm(f => ({ ...f, salesRepEmail: e.target.value }))}
                    placeholder="ahmet@vendor.com" className="text-sm mt-1" />
                </div>
              </div>
            </div>

            {form.additionalContacts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700">Ek Kontaklar</p>
                {form.additionalContacts.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50 relative">
                    <Button variant="ghost" size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removeContact(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500">Ad Soyad</Label>
                        <Input value={c.name} onChange={e => updateContact(i, "name", e.target.value)}
                          placeholder="Mehmet Demir" className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Görev / Rol</Label>
                        <Input value={c.role} onChange={e => updateContact(i, "role", e.target.value)}
                          placeholder="Teknik, Satış..." className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">E-posta</Label>
                        <Input type="email" value={c.email} onChange={e => updateContact(i, "email", e.target.value)}
                          placeholder="mehmet@vendor.com" className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Telefon</Label>
                        <Input value={c.phone} onChange={e => updateContact(i, "phone", e.target.value)}
                          placeholder="0212 000 00 00" className="text-sm mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addContact}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Ek Kontak Ekle
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Iptal</Button>
            <Button onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name || !form.logoUrl}>
              {dialog.editing ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Distribütör Dialog ─────────────────────────────────────────────── */}
      <Dialog open={distDialog.open} onOpenChange={o => setDistDialog({ open: o })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {distDialog.editing ? "Distribütör Düzenle" : "Distribütör Ekle"}
              {distDialog.partnerName && (
                <span className="text-sm font-normal text-slate-500 ml-2">— {distDialog.partnerName}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Firma Adı <span className="text-red-500">*</span></Label>
              <Input value={dForm.name} onChange={e => setDForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ABC Teknoloji Ltd." className="text-sm mt-1" />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" /> Ana Kontak
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-500">Ad Soyad</Label>
                  <Input value={dForm.contactName} onChange={e => setDForm(f => ({ ...f, contactName: e.target.value }))}
                    placeholder="Ali Kaya" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">E-posta <span className="text-red-500">*</span></Label>
                  <Input type="email" value={dForm.contactEmail} onChange={e => setDForm(f => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="ali@abc.com" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Telefon</Label>
                  <Input value={dForm.phone} onChange={e => setDForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0212 000 00 00" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Notlar</Label>
                  <Input value={dForm.notes} onChange={e => setDForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="opsiyonel not" className="text-sm mt-1" />
                </div>
              </div>
            </div>

            {dForm.additionalContacts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700">Ek Kontaklar</p>
                {dForm.additionalContacts.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50 relative">
                    <Button variant="ghost" size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removeDistContact(i)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500">Ad Soyad</Label>
                        <Input value={c.name} onChange={e => updateDistContact(i, "name", e.target.value)}
                          placeholder="Mehmet Demir" className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Görev / Rol</Label>
                        <Input value={c.role} onChange={e => updateDistContact(i, "role", e.target.value)}
                          placeholder="Teknik, Satış..." className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">E-posta</Label>
                        <Input type="email" value={c.email} onChange={e => updateDistContact(i, "email", e.target.value)}
                          placeholder="mehmet@dist.com" className="text-sm mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Telefon</Label>
                        <Input value={c.phone} onChange={e => updateDistContact(i, "phone", e.target.value)}
                          placeholder="0212 000 00 00" className="text-sm mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addDistContact}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Ek Kontak Ekle
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDistDialog({ open: false })}>Iptal</Button>
            <Button onClick={() => saveDistMutation.mutate()}
              disabled={saveDistMutation.isPending || !dForm.name || !dForm.contactEmail}>
              {distDialog.editing ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
