import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Radar, Eye, Send, FileText, Building2,
  Globe, User, Phone, Mail, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Loader2, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

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
  assignedTo: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  lastActivityAt: string;
}

interface Stats { new: number; scanned: number; teaser_sent: number; interested: number; won: number; lost: number; }

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:          { label: "Yeni",          color: "bg-blue-100 text-blue-700",    icon: Clock },
  scanning:     { label: "Taranıyor",     color: "bg-yellow-100 text-yellow-700", icon: Loader2 },
  scanned:      { label: "Tarandı",       color: "bg-purple-100 text-purple-700", icon: Radar },
  teaser_sent:  { label: "Gönderildi",    color: "bg-indigo-100 text-indigo-700", icon: Send },
  viewed:       { label: "Görüntülendi",  color: "bg-cyan-100 text-cyan-700",    icon: Eye },
  interested:   { label: "İlgilendi",     color: "bg-orange-100 text-orange-700", icon: TrendingUp },
  won:          { label: "Kazanıldı",     color: "bg-green-100 text-green-700",  icon: CheckCircle },
  lost:         { label: "Kaybedildi",    color: "bg-red-100 text-red-700",      icon: XCircle },
};

const SECTORS = ["Sağlık", "Finans", "Perakende", "Bilişim", "İmalat", "Lojistik", "Eğitim", "İnşaat", "Enerji", "Diğer"];

export default function EnterprisePropectsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Prospect>>({});
  const [scanningIds, setScanningIds] = useState<Set<number>>(new Set());

  const { data: prospects = [], isLoading } = useQuery<Prospect[]>({
    queryKey: ["enterprise-prospects"],
    queryFn: () => fetch("/api/enterprise/prospects", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["enterprise-prospects-stats"],
    queryFn: () => fetch("/api/enterprise/prospects/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
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

  const scanMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/enterprise/prospects/${id}/scan`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: (_, id) => {
      setScanningIds(prev => new Set(prev).add(id));
      qc.invalidateQueries({ queryKey: ["enterprise-prospects"] });
    },
  });

  const filtered = prospects.filter(p =>
    !search ||
    p.companyName.toLowerCase().includes(search.toLowerCase()) ||
    p.domain.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: "Yeni",        key: "new",         color: "text-blue-600" },
    { label: "Tarandı",     key: "scanned",      color: "text-purple-600" },
    { label: "Gönderildi",  key: "teaser_sent",  color: "text-indigo-600" },
    { label: "İlgilendi",   key: "interested",   color: "text-orange-600" },
    { label: "Kazanıldı",   key: "won",          color: "text-green-600" },
  ];

  return (
    <AdminLayout title="Enterprise Adaylar" description="Potansiyel kurumsal müşteriler">

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {statCards.map(s => (
          <Card key={s.key} className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{(stats as Record<string, number> | undefined)?.[s.key] ?? 0}</div>
              <div className="text-slate-400 text-xs mt-1">{s.label}</div>
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
            placeholder="Şirket veya domain ara..." className="pl-9 bg-slate-800 border-slate-600 text-white"
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
                <th className="px-4 py-3 text-left">Domain</th>
                <th className="px-4 py-3 text-left">Sektör</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-left">Son Aktivite</th>
                <th className="px-4 py-3 text-left">Atanan</th>
                <th className="px-4 py-3 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Yükleniyor...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Henüz aday yok</td></tr>
              )}
              {filtered.map(p => {
                const st = STATUS_MAP[p.status] ?? STATUS_MAP["new"]!;
                const StatusIcon = st.icon;
                const isScanning = p.status === "scanning" || scanningIds.has(p.id);
                return (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{p.companyName}</div>
                      {p.contactName && <div className="text-slate-400 text-xs">{p.contactName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400">{p.domain}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.sector ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                        <StatusIcon className={`h-3 w-3 ${isScanning ? "animate-spin" : ""}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {format(new Date(p.lastActivityAt), "d MMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{p.assignedTo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {p.status === "new" && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs border-slate-600 gap-1"
                            disabled={isScanning || scanMutation.isPending}
                            onClick={() => scanMutation.mutate(p.id)}
                          >
                            <Radar className="h-3 w-3" />
                            Tara
                          </Button>
                        )}
                        {p.status === "scanned" && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs border-purple-600 text-purple-300 gap-1"
                            onClick={() => navigate(`/panel/enterprise/prospects/${p.id}`)}
                          >
                            <Eye className="h-3 w-3" />
                            Teaser Gör
                          </Button>
                        )}
                        {(p.status === "scanned" || p.status === "teaser_sent") && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs border-indigo-600 text-indigo-300 gap-1"
                            onClick={() => navigate(`/panel/enterprise/prospects/${p.id}`)}
                          >
                            <Send className="h-3 w-3" />
                            Gönder
                          </Button>
                        )}
                        {(p.status === "interested" || p.status === "won") && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1"
                            onClick={() => navigate(`/panel/enterprise/contracts/new?prospectId=${p.id}`)}
                          >
                            <FileText className="h-3 w-3" />
                            Sözleşme
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 text-xs text-slate-400"
                          onClick={() => navigate(`/panel/enterprise/prospects/${p.id}`)}
                        >
                          Detay
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              <Label className="text-slate-300 text-xs">Domain *</Label>
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
            <div className="col-span-2">
              <Label className="text-slate-300 text-xs">Atanan Temsilci</Label>
              <Input value={form.assignedTo ?? ""} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" placeholder="Temsilci adı veya e-posta" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.companyName || !form.domain || addMutation.isPending}
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
