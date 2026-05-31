import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, FileText, CheckCircle, Clock, AlertCircle,
  Zap, Download, Building2, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Contract {
  id: number;
  contractNumber: string;
  companyName: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  totalAmountTl: string | null;
  status: string;
  createdAt: string;
  billingContactEmail: string | null;
}

interface ServiceLine {
  serviceSlug: string;
  serviceName: string;
  unitPriceTl: string;
  quantity: number;
  lineTotalTl: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:     { label: "Taslak",     color: "bg-slate-100 text-slate-700" },
  sent:      { label: "Gönderildi", color: "bg-blue-100 text-blue-700" },
  signed:    { label: "İmzalandı",  color: "bg-yellow-100 text-yellow-700" },
  active:    { label: "Aktif",      color: "bg-green-100 text-green-700" },
  expired:   { label: "Süresi Doldu", color: "bg-red-100 text-red-700" },
  cancelled: { label: "İptal",      color: "bg-slate-100 text-slate-600" },
};

const SERVICE_CATALOG = [
  { slug: "mini-assessment",    name: "Mini Güvenlik Değerlendirmesi",   price: "990" },
  { slug: "full-assessment",    name: "Tam Güvenlik Değerlendirmesi",    price: "5990" },
  { slug: "domain-scan",        name: "Sürekli Domain Taraması",         price: "1990" },
  { slug: "ai-tool-monitoring", name: "AI Araç İzleme (yıllık)",         price: "5880" },
  { slug: "ai-policy",          name: "AI Güvenlik Politikası",          price: "990" },
  { slug: "virtual-ciso",       name: "Sanal CISO (aylık)",              price: "8000" },
  { slug: "pentest-lite",       name: "Pentest Lite",                    price: "4990" },
  { slug: "board-report",       name: "Yönetim Kurulu Raporu (yıllık)", price: "3990" },
  { slug: "phishing-sim",       name: "Phishing Simülasyonu",            price: "1990" },
  { slug: "tprm",               name: "Tedarikçi Risk Yönetimi",         price: "2990" },
];

function fmt(tl: string | null): string {
  if (!tl) return "—";
  return Number(tl).toLocaleString("tr-TR") + " TL";
}

export default function EnterpriseContractsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["enterprise-contracts"],
    queryFn: () => fetch("/api/enterprise/contracts", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/enterprise/contracts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["enterprise-contracts"] });
      setShowNew(false);
      if (data.id) navigate(`/panel/enterprise/contracts/${data.id}`);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/enterprise/contracts/${id}/activate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activatedBy: "admin" }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise-contracts"] }),
  });

  function addService(slug: string) {
    const cat = SERVICE_CATALOG.find(s => s.slug === slug);
    if (!cat) return;
    const exists = services.findIndex(s => s.serviceSlug === slug);
    if (exists >= 0) return;
    setServices(prev => [...prev, {
      serviceSlug: cat.slug, serviceName: cat.name,
      unitPriceTl: cat.price, quantity: 1, lineTotalTl: cat.price,
    }]);
  }

  function removeService(slug: string) {
    setServices(prev => prev.filter(s => s.serviceSlug !== slug));
  }

  const subtotal = services.reduce((sum, s) => sum + Number(s.lineTotalTl), 0);
  const discountPct = parseInt(form["discountPct"] ?? "0") || 0;
  const discountAmount = subtotal * discountPct / 100;
  const vatAmount = (subtotal - discountAmount) * 0.2;
  const total = subtotal - discountAmount + vatAmount;

  function handleCreate() {
    if (!form["companyName"] || !form["startDate"]) return;
    createMutation.mutate({
      ...form,
      discountPct,
      totalAmountTl: total.toFixed(2),
      services,
    });
  }

  const activeCount = contracts.filter(c => c.status === "active").length;
  const totalMrr = contracts
    .filter(c => c.status === "active")
    .reduce((sum, c) => sum + Number(c.totalAmountTl ?? 0), 0);

  return (
    <AdminLayout title="Enterprise Sözleşmeler" description="Kurumsal müşteri sözleşme yönetimi">

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-white">{contracts.length}</div>
            <div className="text-slate-400 text-xs mt-1">Toplam Sözleşme</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-slate-400 text-xs mt-1">Aktif</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-400">{totalMrr.toLocaleString("tr-TR")} TL</div>
            <div className="text-slate-400 text-xs mt-1">Toplam Sözleşme Değeri</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-semibold">Tüm Sözleşmeler</h2>
        <Button onClick={() => setShowNew(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="h-4 w-4" /> Yeni Sözleşme
        </Button>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Sözleşme No</th>
                <th className="px-4 py-3 text-left">Şirket</th>
                <th className="px-4 py-3 text-left">Tür</th>
                <th className="px-4 py-3 text-left">Başlangıç</th>
                <th className="px-4 py-3 text-left">Tutar</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Yükleniyor...</td></tr>
              )}
              {!isLoading && contracts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Henüz sözleşme yok</td></tr>
              )}
              {contracts.map(c => {
                const st = STATUS_MAP[c.status] ?? STATUS_MAP["draft"]!;
                return (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-750">
                    <td className="px-4 py-3 font-mono text-emerald-400 text-xs">{c.contractNumber}</td>
                    <td className="px-4 py-3 text-white font-medium">{c.companyName}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{c.contractType}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {format(new Date(c.startDate), "d MMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{fmt(c.totalAmountTl)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {c.status === "signed" && (
                          <Button
                            size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1"
                            onClick={() => activateMutation.mutate(c.id)}
                            disabled={activateMutation.isPending}
                          >
                            <Zap className="h-3 w-3" /> Aktive Et
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost" className="h-7 text-xs text-slate-400"
                          onClick={() => navigate(`/panel/enterprise/contracts/${c.id}`)}
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

      {/* New Contract Modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Sözleşme Oluştur</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Müşteri Bilgisi */}
            <div>
              <h3 className="text-slate-300 font-medium text-sm mb-3">1. Müşteri Bilgisi</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Şirket Adı *</Label>
                  <Input value={form["companyName"] ?? ""} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Vergi No</Label>
                  <Input value={form["companyTaxId"] ?? ""} onChange={e => setForm(f => ({ ...f, companyTaxId: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Fatura E-posta</Label>
                  <Input value={form["billingContactEmail"] ?? ""} onChange={e => setForm(f => ({ ...f, billingContactEmail: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" type="email" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Yetkili Kişi</Label>
                  <Input value={form["billingContactName"] ?? ""} onChange={e => setForm(f => ({ ...f, billingContactName: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" />
                </div>
              </div>
            </div>

            {/* Sözleşme Türü */}
            <div>
              <h3 className="text-slate-300 font-medium text-sm mb-3">2. Sözleşme Türü</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Tür</Label>
                  <Select onValueChange={v => setForm(f => ({ ...f, contractType: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Yıllık" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="annual">Yıllık</SelectItem>
                      <SelectItem value="monthly">Aylık</SelectItem>
                      <SelectItem value="multi_year">Çok Yıllık</SelectItem>
                      <SelectItem value="one_time">Tek Seferlik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Başlangıç Tarihi *</Label>
                  <Input value={form["startDate"] ?? ""} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" type="date" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Bitiş Tarihi</Label>
                  <Input value={form["endDate"] ?? ""} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white mt-1" type="date" />
                </div>
              </div>
            </div>

            {/* Servis Kalemleri */}
            <div>
              <h3 className="text-slate-300 font-medium text-sm mb-3">3. Servis Kalemleri</h3>
              <Select onValueChange={addService}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mb-3">
                  <SelectValue placeholder="+ Servis Ekle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SERVICE_CATALOG.map(s => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name} — {Number(s.price).toLocaleString("tr-TR")} TL
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {services.length > 0 && (
                <div className="space-y-1">
                  {services.map(s => (
                    <div key={s.serviceSlug} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                      <span className="text-white text-sm">{s.serviceName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300 text-sm">{Number(s.lineTotalTl).toLocaleString("tr-TR")} TL</span>
                        <button onClick={() => removeService(s.serviceSlug)} className="text-slate-500 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-slate-400 text-sm">
                      <span>Ara Toplam</span><span>{subtotal.toLocaleString("tr-TR")} TL</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-sm">
                      <div className="flex items-center gap-2">
                        <span>İndirim %</span>
                        <Input value={form["discountPct"] ?? "0"} onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))}
                          className="w-16 h-6 bg-slate-700 border-slate-600 text-white text-xs px-2" />
                      </div>
                      <span className="text-red-400">-{discountAmount.toLocaleString("tr-TR")} TL</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-sm">
                      <span>KDV %20</span><span>{vatAmount.toLocaleString("tr-TR")} TL</span>
                    </div>
                    <div className="flex justify-between text-white font-bold">
                      <span>TOPLAM</span><span>{total.toLocaleString("tr-TR")} TL</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notlar */}
            <div>
              <Label className="text-slate-400 text-xs">İç Notlar</Label>
              <Textarea value={form["internalNotes"] ?? ""} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white mt-1" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>İptal</Button>
            <Button variant="outline" className="border-slate-600" onClick={() => setShowNew(false)}>
              Taslak Kaydet
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form["companyName"] || !form["startDate"] || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? "Oluşturuluyor..." : "Sözleşme Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
