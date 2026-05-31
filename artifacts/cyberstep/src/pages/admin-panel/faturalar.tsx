import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Send, CheckCircle, XCircle, Bell, Search, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  id: number;
  full_invoice_number: string;
  invoice_number: string;
  invoice_type: string;
  customer_name: string;
  customer_email: string;
  total_tl: string;
  subtotal_tl: string;
  vat_amount_tl: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  sent_at: string | null;
  line_items: Array<{ description: string; quantity: number; unitPrice: number; vatRate: number; lineTotal: number }>;
  notes: string | null;
}

interface Stats {
  this_month_count: number;
  this_month_total: string;
  this_month_collected: string;
  total_outstanding: string;
  overdue_total: string;
  overdue_count: number;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Beklemede", variant: "secondary" },
  paid:    { label: "Ödendi", variant: "default" },
  overdue: { label: "Vadesi Geçti", variant: "destructive" },
  cancelled: { label: "İptal", variant: "outline" },
};

function fmtMoney(n: string | number) {
  return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR");
}

export default function AdminFaturalar() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);

  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/invoices/stats"], queryFn: () => fetch("/api/invoices/stats", { credentials: "include" }).then(r => r.json()) });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", statusFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (search) p.set("search", search);
      return fetch(`/api/invoices?${p}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => fetch(`/api/invoices/${id}/mark-paid`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); qc.invalidateQueries({ queryKey: ["/api/invoices/stats"] }); toast({ title: "Ödendi olarak işaretlendi" }); },
  });
  const cancel = useMutation({
    mutationFn: (id: number) => fetch(`/api/invoices/${id}/cancel`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); toast({ title: "Fatura iptal edildi" }); },
  });
  const sendInv = useMutation({
    mutationFn: (id: number) => fetch(`/api/invoices/${id}/send`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => toast({ title: "Fatura e-posta ile gönderildi" }),
    onError: () => toast({ title: "E-posta gönderilemedi", variant: "destructive" }),
  });
  const sendReminder = useMutation({
    mutationFn: ({ id, n }: { id: number; n: number }) => fetch(`/api/invoices/${id}/send-reminder`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderNumber: n }) }).then(r => r.json()),
    onSuccess: () => toast({ title: "Hatırlatma gönderildi" }),
  });

  const downloadPdf = (id: number, num: string) => {
    const a = document.createElement("a");
    a.href = `/api/invoices/${id}/pdf`;
    a.download = `${num}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <AdminLayout title="Fatura Yönetimi" description="Fatura oluştur, gönder, takip et">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Bu Ay Fatura", value: `₺${fmtMoney(stats?.this_month_total ?? 0)}`, sub: `${stats?.this_month_count ?? 0} adet` },
          { label: "Bu Ay Tahsilat", value: `₺${fmtMoney(stats?.this_month_collected ?? 0)}`, sub: "ödendi" },
          { label: "Bekleyen", value: `₺${fmtMoney(stats?.total_outstanding ?? 0)}`, sub: "tahsil edilecek" },
          { label: "Vadesi Geçen", value: `₺${fmtMoney(stats?.overdue_total ?? 0)}`, sub: `${stats?.overdue_count ?? 0} fatura`, danger: true },
        ].map(s => (
          <Card key={s.label} className={`bg-slate-900 border-slate-800 ${s.danger ? "border-red-500/40" : ""}`}>
            <CardContent className="p-4">
              <p className="text-slate-400 text-xs">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.danger ? "text-red-400" : "text-white"}`}>{s.value}</p>
              <p className="text-slate-500 text-xs">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + create */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input className="pl-9 bg-slate-900 border-slate-700 text-white" placeholder="Müşteri adı veya fatura no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="pending">Beklemede</SelectItem>
            <SelectItem value="overdue">Vadesi Geçti</SelectItem>
            <SelectItem value="paid">Ödendi</SelectItem>
            <SelectItem value="cancelled">İptal</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Yeni Fatura
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Fatura No", "Müşteri", "Tutar", "Durum", "Vade", "İşlemler"].map(h => (
                    <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS["pending"]!;
                  return (
                    <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <button className="text-cyan-400 hover:underline font-mono text-xs" onClick={() => setSelectedInv(inv)}>
                          {inv.full_invoice_number ?? inv.invoice_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-white">{inv.customer_name}</td>
                      <td className="px-4 py-3 text-white font-medium">₺{fmtMoney(inv.total_tl)}</td>
                      <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className={`px-4 py-3 text-sm ${inv.status === "overdue" ? "text-red-400" : "text-slate-300"}`}>{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => downloadPdf(inv.id, inv.full_invoice_number ?? inv.invoice_number)} title="PDF indir">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => sendInv.mutate(inv.id)} title="E-posta gönder">
                            <Send className="h-3 w-3" />
                          </Button>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300" onClick={() => markPaid.mutate(inv.id)} title="Ödendi işaretle">
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300" onClick={() => sendReminder.mutate({ id: inv.id, n: 1 })} title="Hatırlatma gönder">
                                <Bell className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm("İptal edilsin mi?")) cancel.mutate(inv.id); }} title="İptal et">
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-12">Fatura bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedInv && (
        <Dialog open={!!selectedInv} onOpenChange={() => setSelectedInv(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedInv.full_invoice_number ?? selectedInv.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-400">Müşteri:</span> <span className="text-white">{selectedInv.customer_name}</span></div>
                <div><span className="text-slate-400">Durum:</span> <Badge variant={STATUS_LABELS[selectedInv.status]?.variant ?? "secondary"}>{STATUS_LABELS[selectedInv.status]?.label ?? selectedInv.status}</Badge></div>
                <div><span className="text-slate-400">Vade:</span> <span className="text-white">{fmtDate(selectedInv.due_date)}</span></div>
                <div><span className="text-slate-400">Gönderildi:</span> <span className="text-white">{selectedInv.sent_at ? fmtDate(selectedInv.sent_at) : "Gönderilmedi"}</span></div>
              </div>
              {Array.isArray(selectedInv.line_items) && selectedInv.line_items.length > 0 && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800"><tr>{["Açıklama","Adet","Birim","Tutar"].map(h => <th key={h} className="text-left px-3 py-2 text-slate-400">{h}</th>)}</tr></thead>
                    <tbody>{selectedInv.line_items.map((li, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="px-3 py-2">{li.description}</td>
                        <td className="px-3 py-2">{li.quantity}</td>
                        <td className="px-3 py-2">₺{fmtMoney(li.unitPrice)}</td>
                        <td className="px-3 py-2 font-medium">₺{fmtMoney(li.lineTotal)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-700 pt-3">
                <div className="text-slate-400 text-xs">KDV dahil toplam</div>
                <div className="text-lg font-bold text-cyan-400">₺{fmtMoney(selectedInv.total_tl)}</div>
              </div>
              {selectedInv.notes && <p className="text-slate-400 text-xs italic">{selectedInv.notes}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-slate-700" onClick={() => downloadPdf(selectedInv.id, selectedInv.full_invoice_number ?? selectedInv.invoice_number)}>
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" className="border-slate-700" onClick={() => sendInv.mutate(selectedInv.id)}>
                <Send className="h-4 w-4 mr-2" /> Gönder
              </Button>
              {selectedInv.status !== "paid" && selectedInv.status !== "cancelled" && (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { markPaid.mutate(selectedInv.id); setSelectedInv(null); }}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Ödendi
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CreateInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); qc.invalidateQueries({ queryKey: ["/api/invoices/stats"] }); setCreateOpen(false); }} />
    </AdminLayout>
  );
}

function CreateInvoiceDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerTaxId: "", dueDate: "", vatRate: "20", notes: "", invoiceType: "invoice" });
  const [items, setItems] = useState([{ description: "", quantity: 1, unitPrice: "", vatRate: 20 }]);

  const addItem = () => setItems(p => [...p, { description: "", quantity: 1, unitPrice: "", vatRate: 20 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const updateItem = (i: number, k: string, v: string | number) => setItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const lineItems = items.map(it => ({ description: it.description, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), vatRate: Number(it.vatRate), lineTotal: Number(it.quantity) * Number(it.unitPrice) }));
  const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);
  const vatAmount = (subtotal * Number(form.vatRate)) / 100;
  const total = subtotal + vatAmount;

  const create = useMutation({
    mutationFn: () => fetch("/api/invoices", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, lineItems, vatRate: Number(form.vatRate) }) }).then(r => r.json()),
    onSuccess: (d) => { if (d.id) { toast({ title: "Fatura oluşturuldu" }); onCreated(); } else toast({ title: d.error ?? "Hata", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Yeni Fatura</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Fatura Türü</Label>
              <Select value={form.invoiceType} onValueChange={v => setForm(p => ({ ...p, invoiceType: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="invoice">Fatura</SelectItem><SelectItem value="proforma">Proforma</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Vade Tarihi</Label>
              <Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-slate-300">Müşteri Adı *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} /></div>
            <div><Label className="text-slate-300">E-posta</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.customerEmail} onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value }))} /></div>
            <div><Label className="text-slate-300">Vergi No</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.customerTaxId} onChange={e => setForm(p => ({ ...p, customerTaxId: e.target.value }))} /></div>
            <div><Label className="text-slate-300">KDV Oranı (%)</Label><Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-slate-300">Kalemler</Label>
              <Button size="sm" variant="outline" className="border-slate-700 h-7 text-xs" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <Input className="col-span-5 bg-slate-800 border-slate-700 text-white text-xs h-8" placeholder="Açıklama" value={it.description} onChange={e => updateItem(i, "description", e.target.value)} />
                <Input className="col-span-2 bg-slate-800 border-slate-700 text-white text-xs h-8" type="number" placeholder="Adet" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} />
                <Input className="col-span-3 bg-slate-800 border-slate-700 text-white text-xs h-8" type="number" placeholder="Fiyat ₺" value={it.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} />
                <Button size="sm" variant="ghost" className="col-span-2 h-8 text-red-400 hover:text-red-300 text-xs" onClick={() => removeItem(i)}>Sil</Button>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Ara Toplam</span><span>₺{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">KDV (%{form.vatRate})</span><span>₺{vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 font-bold text-cyan-400"><span>Toplam</span><span>₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
          </div>

          <div><Label className="text-slate-300">Not</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-slate-700" onClick={onClose}>İptal</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => create.mutate()} disabled={!form.customerName || create.isPending}>
            {create.isPending ? "Oluşturuluyor..." : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
