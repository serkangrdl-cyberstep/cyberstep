import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Plus, Building2, Mail, Phone, TrendingUp, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Customer {
  id: number;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  sector?: string;
  notes?: string;
  aiProfile?: string;
  dealsCount: number;
  avgDecisionDays?: number;
  createdAt: string;
}

const SECTORS = ["Finans", "Üretim", "Kamu", "Sağlık", "Perakende", "Teknoloji", "Telekomünikasyon", "Lojistik", "Enerji", "Diğer"];

function CustomerForm({
  initial,
  onSave,
  onClose,
  loading,
}: {
  initial?: Partial<Customer>;
  onSave: (data: Partial<Customer>) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Partial<Customer>>(initial ?? {});
  const upd = (k: keyof Customer, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-slate-500 mb-1 block">Firma Adi *</Label>
          <Input value={form.companyName ?? ""} onChange={e => upd("companyName", e.target.value)} placeholder="ABC Teknoloji A.S." className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Iletisim Kisi</Label>
          <Input value={form.contactName ?? ""} onChange={e => upd("contactName", e.target.value)} placeholder="Ahmet Yilmaz" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">E-posta</Label>
          <Input value={form.email ?? ""} onChange={e => upd("email", e.target.value)} placeholder="ahmet@firma.com" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Telefon</Label>
          <Input value={form.phone ?? ""} onChange={e => upd("phone", e.target.value)} placeholder="+90 5xx xxx xx xx" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Sektor</Label>
          <select
            value={form.sector ?? ""}
            onChange={e => upd("sector", e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Seciniz...</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-slate-500 mb-1 block">Notlar</Label>
          <Input value={form.notes ?? ""} onChange={e => upd("notes", e.target.value)} placeholder="Ozel notlar..." className="h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Vazgec</Button>
        <Button
          size="sm"
          onClick={() => onSave(form)}
          disabled={loading || !form.companyName?.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminIsrMusteriler() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["isr-customers", search],
    queryFn: () => {
      const url = search ? `/api/admin-panel/isr/customers?q=${encodeURIComponent(search)}` : "/api/admin-panel/isr/customers";
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Customer>) =>
      fetch("/api/admin-panel/isr/customers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["isr-customers"] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) =>
      fetch(`/api/admin-panel/isr/customers/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["isr-customers"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/isr/customers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isr-customers"] }),
  });

  return (
    <AdminLayout title="Musteri Rehberi">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Musteri Rehberi
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{customers.length} musteri</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Yeni Musteri
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Firma veya kisi ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Yukleniyor...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {search ? "Arama sonucu bulunamadi." : "Henuz musteri yok. Deal actiginda otomatik olusur veya buradan ekle."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {customers.map(c => (
              <Card key={c.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/panel/isr/musteri/${c.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-sm">{c.companyName}</h3>
                        {c.sector && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">{c.sector}</Badge>
                        )}
                        {c.dealsCount > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs px-1.5 py-0">
                            {c.dealsCount} deal
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        {c.contactName && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Users className="h-3 w-3 text-slate-400" /> {c.contactName}
                          </span>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" /> {c.phone}
                          </span>
                        )}
                        {c.avgDecisionDays && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-slate-400" /> Ort. {c.avgDecisionDays} gun karar suresi
                          </span>
                        )}
                      </div>
                      {c.aiProfile && (
                        <p className="text-xs text-slate-500 italic mt-1.5 border-l-2 border-emerald-200 pl-2">{c.aiProfile}</p>
                      )}
                      {c.notes && (
                        <p className="text-xs text-slate-500 mt-1">{c.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { if (confirm(`${c.companyName} silinsin mi?`)) deleteMutation.mutate(c.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-slate-300 self-center ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={v => !v && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Yeni Musteri</DialogTitle></DialogHeader>
          <CustomerForm
            onSave={data => createMutation.mutate(data)}
            onClose={() => setShowCreate(false)}
            loading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Musteri Duzenle</DialogTitle></DialogHeader>
          {editing && (
            <CustomerForm
              initial={editing}
              onSave={data => updateMutation.mutate({ id: editing.id, data })}
              onClose={() => setEditing(null)}
              loading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
