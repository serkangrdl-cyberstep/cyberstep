import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { STAGES, stageOf, SOURCE_LABELS } from "@/lib/pipeline-stages";

interface Prospect {
  id: number;
  companyName: string;
  domain: string;
  sector: string | null;
  employeeCount: string | null;
  city: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  supplierCount: number | null;
  assignedTo: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  lastActivityAt: string;
}

const SECTORS = ["Sağlık", "Finans", "Perakende", "Bilişim", "İmalat", "Lojistik", "Eğitim", "İnşaat", "Enerji", "Diğer"];

export default function EnterprisePropectsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Prospect>>({});

  const { data: prospects = [], isLoading } = useQuery<Prospect[]>({
    queryKey: ["enterprise-prospects"],
    queryFn: () => fetch("/api/enterprise/prospects", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<Prospect>) =>
      fetch("/api/enterprise/prospects", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enterprise-prospects"] }); setShowAdd(false); setForm({}); },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/enterprise/prospects/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise-prospects"] }),
  });

  const filtered = prospects.filter(p =>
    !search ||
    p.companyName.toLowerCase().includes(search.toLowerCase()) ||
    (p.domain ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const counts: Record<string, number> = {};
  for (const p of prospects) counts[stageOf(p.status)] = (counts[stageOf(p.status)] ?? 0) + 1;

  return (
    <AdminLayout title="Adaylar (TPRM)" description="Tedarikçi risk yönetimi satış adayları">

      {/* Aşama sayıları */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-6">
        {STAGES.map(st => (
          <Card key={st.id} className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-white">{counts[st.id] ?? 0}</div>
              <div className="text-slate-400 text-xs mt-1">{st.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Şirket veya alan adı ara..." className="pl-9 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="h-4 w-4" /> Yeni Aday Ekle
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Şirket</th>
                <th className="px-4 py-3 text-left">Alan adı</th>
                <th className="px-4 py-3 text-left">Kaynak</th>
                <th className="px-4 py-3 text-left">Tedarikçi</th>
                <th className="px-4 py-3 text-left">Aşama</th>
                <th className="px-4 py-3 text-left">Son Aktivite</th>
                <th className="px-4 py-3 text-left">Atanan</th>
                <th className="px-4 py-3 text-right">Sözleşme</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Yükleniyor...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Henüz aday yok</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.companyName}</div>
                    {p.contactName && <div className="text-slate-400 text-xs">{p.contactName}{p.contactTitle ? ` · ${p.contactTitle}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3 text-emerald-400">{p.domain || "—"}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{SOURCE_LABELS[p.source ?? "manual"] ?? p.source}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{p.supplierCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={stageOf(p.status)}
                      onChange={e => moveMutation.mutate({ id: p.id, status: e.target.value })}
                      className={`text-xs rounded px-2 py-1 border-0 font-medium ${STAGES.find(x => x.id === stageOf(p.status))?.chip ?? ""}`}
                      aria-label="Aşama"
                    >
                      {STAGES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(p.lastActivityAt), "d MMM yyyy", { locale: tr })}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{p.assignedTo ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {["proposal", "contract", "won"].includes(stageOf(p.status)) && (
                      <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1" onClick={() => navigate("/panel/enterprise/contracts")}>
                        <FileText className="h-3 w-3" /> Sözleşme
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Prospect Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Yeni Aday Ekle</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-slate-300 text-xs">Şirket Adı *</Label>
              <Input value={form.companyName ?? ""} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Acme Tekstil A.Ş." />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Alan adı</Label>
              <Input value={form.domain ?? ""} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="acme.com.tr" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Sektör</Label>
              <Select onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Şehir</Label>
              <Input value={form.city ?? ""} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="İstanbul" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">İletişim Adı</Label>
              <Input value={form.contactName ?? ""} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Ahmet Yılmaz" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Unvan</Label>
              <Input value={form.contactTitle ?? ""} onChange={e => setForm(f => ({ ...f, contactTitle: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="IT Müdürü" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">E-posta</Label>
              <Input value={form.contactEmail ?? ""} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="ahmet@acme.com.tr" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Telefon</Label>
              <Input value={form.contactPhone ?? ""} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="+90 212 555 0000" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Tahmini tedarikçi sayısı</Label>
              <Input type="number" value={form.supplierCount ?? ""} onChange={e => setForm(f => ({ ...f, supplierCount: e.target.value ? Number(e.target.value) : null }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="25" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Atanan Temsilci</Label>
              <Input value={form.assignedTo ?? ""} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Temsilci adı veya e-posta" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.companyName || addMutation.isPending}
              onClick={() => addMutation.mutate(form)}
            >
              {addMutation.isPending ? "Kaydediliyor..." : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
