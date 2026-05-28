import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, Plus, Edit, Trash2, Users, Globe, Mail, ChevronDown, ChevronUp,
  Phone, UserCircle, X,
} from "lucide-react";
import { useState } from "react";

interface Contact {
  name: string;
  email: string;
  phone: string;
  role: string;
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

interface Vendor {
  id: number;
  name: string;
  displayName: string;
  salesRepName: string | null;
  salesRepEmail: string | null;
  dealRegUrl: string | null;
  notes: string | null;
  isActive: boolean;
  distributors: Distributor[];
}

const EMPTY_VENDOR = { name: "", displayName: "", salesRepName: "", salesRepEmail: "", dealRegUrl: "", notes: "" };
const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "", role: "" };
const EMPTY_DIST = { name: "", contactName: "", contactEmail: "", phone: "", notes: "", additionalContacts: [] as Contact[] };

export default function AdminIsrVendors() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [vendorDialog, setVendorDialog] = useState<{ open: boolean; editing?: Vendor }>({ open: false });
  const [distDialog, setDistDialog] = useState<{ open: boolean; vendorId?: number; editing?: Distributor }>({ open: false });
  const [vForm, setVForm] = useState(EMPTY_VENDOR);
  const [dForm, setDForm] = useState(EMPTY_DIST);

  const { data: vendors = [], refetch } = useQuery<Vendor[]>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
  });

  const saveVendor = useMutation({
    mutationFn: () => {
      if (vendorDialog.editing) {
        return fetch(`/api/admin-panel/isr/vendors/${vendorDialog.editing.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(vForm),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/isr/vendors", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(vForm),
      }).then(r => r.json());
    },
    onSuccess: () => { setVendorDialog({ open: false }); refetch(); qc.invalidateQueries({ queryKey: ["isr-stats"] }); },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/isr/vendors/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const saveDist = useMutation({
    mutationFn: () => {
      const body = { ...dForm, additionalContacts: dForm.additionalContacts };
      if (distDialog.editing) {
        return fetch(`/api/admin-panel/isr/distributors/${distDialog.editing.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/isr/distributors", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, vendorId: distDialog.vendorId }),
      }).then(r => r.json());
    },
    onSuccess: () => { setDistDialog({ open: false }); refetch(); },
  });

  const deleteDist = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/isr/distributors/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const openVendor = (v?: Vendor) => {
    setVForm(v
      ? { name: v.name, displayName: v.displayName, salesRepName: v.salesRepName ?? "", salesRepEmail: v.salesRepEmail ?? "", dealRegUrl: v.dealRegUrl ?? "", notes: v.notes ?? "" }
      : EMPTY_VENDOR);
    setVendorDialog({ open: true, editing: v });
  };

  const openDist = (vendorId: number, d?: Distributor) => {
    setDForm(d
      ? { name: d.name, contactName: d.contactName ?? "", contactEmail: d.contactEmail, phone: d.phone ?? "", notes: d.notes ?? "", additionalContacts: d.additionalContacts ?? [] }
      : EMPTY_DIST);
    setDistDialog({ open: true, vendorId, editing: d });
  };

  const addContact = () => setDForm(f => ({ ...f, additionalContacts: [...f.additionalContacts, { ...EMPTY_CONTACT }] }));
  const removeContact = (i: number) => setDForm(f => ({ ...f, additionalContacts: f.additionalContacts.filter((_, idx) => idx !== i) }));
  const updateContact = (i: number, field: keyof Contact, value: string) =>
    setDForm(f => ({ ...f, additionalContacts: f.additionalContacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }));

  const allContacts = (d: Distributor): (Contact & { isPrimary?: boolean })[] => [
    { name: d.contactName ?? "", email: d.contactEmail, phone: d.phone ?? "", role: "", isPrimary: true },
    ...(d.additionalContacts ?? []),
  ];

  return (
    <AdminLayout title="Teknoloji Ortakları" description="Vendor firmalar, satış temsilcileri ve yetkili distribütörler">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => openVendor()}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Vendor Ekle
          </Button>
        </div>

        {vendors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-slate-500">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Henüz vendor eklenmedi. Fortinet, Cisco gibi teknoloji ortaklarını buraya ekleyin.</p>
            </CardContent>
          </Card>
        ) : (
          vendors.map((vendor) => (
            <Card key={vendor.id} className={!vendor.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{vendor.displayName}</CardTitle>
                      <span className="text-xs text-slate-400">({vendor.name})</span>
                      {!vendor.isActive && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Pasif</Badge>}
                    </div>

                    {/* Satış Temsilcisi */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      {vendor.salesRepName || vendor.salesRepEmail ? (
                        <span className="flex items-center gap-1">
                          <UserCircle className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="font-medium text-slate-600">{vendor.salesRepName || "—"}</span>
                          {vendor.salesRepEmail && (
                            <a href={`mailto:${vendor.salesRepEmail}`} className="text-blue-500 hover:underline ml-1">{vendor.salesRepEmail}</a>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 italic">
                          <Mail className="h-3 w-3" /> Satış temsilcisi eklenmedi
                        </span>
                      )}
                      {vendor.dealRegUrl && (
                        <a href={vendor.dealRegUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                          <Globe className="h-3 w-3" /> Deal Reg
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openVendor(vendor)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteVendor.mutate(vendor.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(e => ({ ...e, [vendor.id]: !e[vendor.id] }))}>
                      {expanded[vendor.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Distribütörler */}
              {expanded[vendor.id] && (
                <CardContent className="pt-0 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3 mt-3">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-slate-400" />
                      Distribütörler
                      <Badge variant="outline" className="text-xs">{vendor.distributors.length}</Badge>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => openDist(vendor.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Distribütör Ekle
                    </Button>
                  </div>

                  {vendor.distributors.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center border border-dashed rounded-lg">
                      Distribütör eklenmedi — RFQ gönderilebilmesi için en az bir distribütör gerekli.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {vendor.distributors.map((d) => {
                        const contacts = allContacts(d);
                        return (
                          <div key={d.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-medium text-sm text-slate-900">{d.name}</div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDist(vendor.id, d)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteDist.mutate(d.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              {contacts.filter(c => c.email).map((c, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                                  {c.isPrimary && <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">Ana Kontak</Badge>}
                                  {!c.isPrimary && c.role && <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 bg-blue-50 border-blue-200 text-blue-700">{c.role}</Badge>}
                                  {c.name && (
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="h-3 w-3 text-slate-400" />{c.name}
                                    </span>
                                  )}
                                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                                    <Mail className="h-3 w-3" />{c.email}
                                  </a>
                                  {c.phone && (
                                    <span className="flex items-center gap-1 text-slate-400">
                                      <Phone className="h-3 w-3" />{c.phone}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {d.notes && <p className="text-xs text-slate-400 mt-1.5 italic">{d.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ── Vendor Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={vendorDialog.open} onOpenChange={o => setVendorDialog({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{vendorDialog.editing ? "Vendor Düzenle" : "Yeni Vendor Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kod Adı <span className="text-red-500">*</span></Label>
                <Input placeholder="fortinet" value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Görünen Ad <span className="text-red-500">*</span></Label>
                <Input placeholder="Fortinet" value={vForm.displayName} onChange={e => setVForm(f => ({ ...f, displayName: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-600 pt-1">Satış Temsilcisi (Vendor)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ad Soyad</Label>
                <Input placeholder="Ahmet Yılmaz" value={vForm.salesRepName} onChange={e => setVForm(f => ({ ...f, salesRepName: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">E-posta</Label>
                <Input type="email" placeholder="ahmet@vendor.com" value={vForm.salesRepEmail} onChange={e => setVForm(f => ({ ...f, salesRepEmail: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Deal Registration URL</Label>
              <Input value={vForm.dealRegUrl} onChange={e => setVForm(f => ({ ...f, dealRegUrl: e.target.value }))} className="text-sm mt-1" placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Notlar</Label>
              <Textarea value={vForm.notes} onChange={e => setVForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDialog({ open: false })}>Iptal</Button>
            <Button onClick={() => saveVendor.mutate()} disabled={saveVendor.isPending || !vForm.name || !vForm.displayName}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Distributor Dialog ────────────────────────────────────────────── */}
      <Dialog open={distDialog.open} onOpenChange={o => setDistDialog({ open: o })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{distDialog.editing ? "Distribütör Düzenle" : "Distribütör Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Firma Adı <span className="text-red-500">*</span></Label>
              <Input placeholder="ABC Teknoloji A.Ş." value={dForm.name} onChange={e => setDForm(f => ({ ...f, name: e.target.value }))} className="text-sm mt-1" />
            </div>

            {/* Ana Kontak */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" /> Ana Kontak <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-500">Ad Soyad</Label>
                  <Input placeholder="Ayşe Kaya" value={dForm.contactName} onChange={e => setDForm(f => ({ ...f, contactName: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">E-posta <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="ayse@distributer.com" value={dForm.contactEmail} onChange={e => setDForm(f => ({ ...f, contactEmail: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500">Telefon</Label>
                  <Input placeholder="0212 000 00 00" value={dForm.phone} onChange={e => setDForm(f => ({ ...f, phone: e.target.value }))} className="text-sm mt-1" />
                </div>
              </div>
            </div>

            {/* Ek Kontaklar */}
            {dForm.additionalContacts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700">Ek Kontaklar</p>
                {dForm.additionalContacts.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50 relative">
                    <Button
                      variant="ghost" size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removeContact(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500">Ad Soyad</Label>
                        <Input value={c.name} onChange={e => updateContact(i, "name", e.target.value)} className="text-sm mt-1" placeholder="Mehmet Demir" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Görev / Rol</Label>
                        <Input value={c.role} onChange={e => updateContact(i, "role", e.target.value)} className="text-sm mt-1" placeholder="Teknik, Satış..." />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">E-posta</Label>
                        <Input type="email" value={c.email} onChange={e => updateContact(i, "email", e.target.value)} className="text-sm mt-1" placeholder="mehmet@dist.com" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Telefon</Label>
                        <Input value={c.phone} onChange={e => updateContact(i, "phone", e.target.value)} className="text-sm mt-1" placeholder="0212 000 00 00" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addContact}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Ek Kontak Ekle
            </Button>

            <div>
              <Label className="text-xs">Notlar</Label>
              <Textarea value={dForm.notes} onChange={e => setDForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistDialog({ open: false })}>Iptal</Button>
            <Button onClick={() => saveDist.mutate()} disabled={saveDist.isPending || !dForm.name || !dForm.contactEmail}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
