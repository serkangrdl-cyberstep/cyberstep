import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Plus, Edit, Trash2, Users, Globe, Mail, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface Distributor {
  id: number;
  vendorId: number;
  name: string;
  contactName: string | null;
  contactEmail: string;
  phone: string | null;
  notes: string | null;
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
const EMPTY_DIST = { name: "", contactName: "", contactEmail: "", phone: "", notes: "" };

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
      if (distDialog.editing) {
        return fetch(`/api/admin-panel/isr/distributors/${distDialog.editing.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(dForm),
        }).then(r => r.json());
      }
      return fetch("/api/admin-panel/isr/distributors", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dForm, vendorId: distDialog.vendorId }),
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
    setVForm(v ? { name: v.name, displayName: v.displayName, salesRepName: v.salesRepName ?? "", salesRepEmail: v.salesRepEmail ?? "", dealRegUrl: v.dealRegUrl ?? "", notes: v.notes ?? "" } : EMPTY_VENDOR);
    setVendorDialog({ open: true, editing: v });
  };

  const openDist = (vendorId: number, d?: Distributor) => {
    setDForm(d ? { name: d.name, contactName: d.contactName ?? "", contactEmail: d.contactEmail, phone: d.phone ?? "", notes: d.notes ?? "" } : EMPTY_DIST);
    setDistDialog({ open: true, vendorId, editing: d });
  };

  return (
    <AdminLayout title="Satıcı & Distribütör Yönetimi" description="Vendor firmalar ve yetkili distribütörler">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => openVendor()}>
            <Plus className="h-4 w-4 mr-2" /> Yeni Satıcı Ekle
          </Button>
        </div>

        {vendors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-slate-500">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Henüz satıcı eklenmedi. Fortinet, Cisco gibi vendor firmalarını buraya ekleyin.</p>
            </CardContent>
          </Card>
        ) : (
          vendors.map((vendor) => (
            <Card key={vendor.id} className={!vendor.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{vendor.displayName}</CardTitle>
                    {!vendor.isActive && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Pasif</Badge>}
                    <span className="text-xs text-slate-400 font-normal">({vendor.name})</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                <div className="flex gap-4 text-xs text-slate-500 mt-1 pb-3">
                  {vendor.salesRepEmail && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {vendor.salesRepName ?? ""} — {vendor.salesRepEmail}</span>
                  )}
                  {vendor.dealRegUrl && (
                    <a href={vendor.dealRegUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                      <Globe className="h-3 w-3" /> Deal Registration
                    </a>
                  )}
                </div>
              </CardHeader>

              {expanded[vendor.id] && (
                <CardContent className="pt-0 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3 mt-3">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-slate-400" /> Distribütörler ({vendor.distributors.length})
                    </span>
                    <Button variant="outline" size="sm" onClick={() => openDist(vendor.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Distribütör Ekle
                    </Button>
                  </div>
                  {vendor.distributors.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">Bu satıcıya ait distribütör yok.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {vendor.distributors.map((d) => (
                        <div key={d.id} className="flex items-center justify-between py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{d.name}</div>
                            <div className="text-xs text-slate-500">
                              {d.contactName && `${d.contactName} · `}{d.contactEmail}
                              {d.phone && ` · ${d.phone}`}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openDist(vendor.id, d)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteDist.mutate(d.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Vendor Dialog */}
      <Dialog open={vendorDialog.open} onOpenChange={o => setVendorDialog({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{vendorDialog.editing ? "Satıcı Düzenle" : "Yeni Satıcı Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kod Adı (ör: fortinet)</Label>
                <Input value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Görünen Ad (ör: Fortinet)</Label>
                <Input value={vForm.displayName} onChange={e => setVForm(f => ({ ...f, displayName: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Satış Temsilcisi Adı</Label>
                <Input value={vForm.salesRepName} onChange={e => setVForm(f => ({ ...f, salesRepName: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Satış Temsilcisi E-posta</Label>
                <Input type="email" value={vForm.salesRepEmail} onChange={e => setVForm(f => ({ ...f, salesRepEmail: e.target.value }))} className="text-sm mt-1" />
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

      {/* Distributor Dialog */}
      <Dialog open={distDialog.open} onOpenChange={o => setDistDialog({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{distDialog.editing ? "Distribütör Düzenle" : "Distribütör Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Firma Adı</Label>
              <Input value={dForm.name} onChange={e => setDForm(f => ({ ...f, name: e.target.value }))} className="text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Yetkili Kişi</Label>
                <Input value={dForm.contactName} onChange={e => setDForm(f => ({ ...f, contactName: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">E-posta</Label>
                <Input type="email" value={dForm.contactEmail} onChange={e => setDForm(f => ({ ...f, contactEmail: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input value={dForm.phone} onChange={e => setDForm(f => ({ ...f, phone: e.target.value }))} className="text-sm mt-1" />
            </div>
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
