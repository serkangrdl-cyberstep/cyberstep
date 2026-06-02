import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, X, Send, Pause, Play, CheckCircle2, FileText, CheckSquare, Tag, MessageSquare, Activity, ShoppingBag, Ban, Settings2 } from "lucide-react";

interface ServiceSubscription {
  id: number;
  serviceSlug: string;
  serviceLabel: string;
  status: string;
  billingCycle: string;
  contactName: string;
  companyName: string;
  email: string;
  amountPaid: string | null;
  currency: string;
  paymentRef: string | null;
  startedAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  iyzicoCardUserKey: string | null;
  iyzicoCardToken: string | null;
  createdAt: string;
}

interface Customer360 {
  id: number; full_name: string; company_name: string; email: string;
  phone: string | null; city: string | null; sector: string | null; plan: string | null;
  cust_status: string; billing_name: string | null; billing_tax_id: string | null;
  billing_tax_office: string | null; billing_address: string | null; billing_email: string | null;
  billing_phone: string | null; payment_terms: number; assigned_to: string | null; first_payment_at: string | null;
  health?: { health_score: number; risk_level: string; calculated_at: string } | null;
  tags: Array<{ id: number; name: string; color: string }>;
  tasks: Array<{ id: number; title: string; priority: string; status: string; due_date: string | null; created_at: string }>;
  invoices: Array<{ id: number; full_invoice_number: string; total_tl: string; status: string; due_date: string | null }>;
  nps: Array<{ id: number; score: number | null; category: string | null; sent_at: string; responded_at: string | null }>;
}

interface Tag { id: number; name: string; color: string; }

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Aktif", variant: "default" }, paused: { label: "Duraklatıldı", variant: "secondary" },
  cancelled: { label: "İptal", variant: "destructive" }, trial: { label: "Deneme", variant: "outline" },
};
const INV_STATUS: Record<string, string> = { paid: "Ödendi", pending: "Beklemede", overdue: "Vadesi Geçti", cancelled: "İptal" };

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }
function fmtMoney(n: string | number) { return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2 }); }

export default function Musteri360() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Partial<Customer360>>({});
  const [noteText, setNoteText] = useState("");
  const [newTagId, setNewTagId] = useState("");

  const { data: customer, isLoading } = useQuery<Customer360>({
    queryKey: ["/api/crm/customers", id],
    queryFn: () => fetch(`/api/crm/customers/${id}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: allTags = [] } = useQuery<Tag[]>({ queryKey: ["/api/crm/tags"], queryFn: () => fetch("/api/crm/tags", { credentials: "include" }).then(r => r.json()) });
  const { data: serviceSubscriptions = [] } = useQuery<ServiceSubscription[]>({
    queryKey: ["/api/payments/service-subscriptions", customer?.email],
    queryFn: () => fetch(`/api/payments/service-subscriptions?email=${encodeURIComponent(customer!.email)}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!customer?.email,
  });
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [renewSubId, setRenewSubId] = useState<number | null>(null);
  const [renewCard, setRenewCard] = useState({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });

  const save = useMutation({
    mutationFn: () => fetch(`/api/crm/customers/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edits) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }); setEditMode(false); setEdits({}); toast({ title: "Müşteri güncellendi" }); },
  });
  const addNote = useMutation({
    mutationFn: () => fetch(`/api/crm/customers/${id}/notes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: noteText }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }); setNoteText(""); toast({ title: "Not eklendi" }); },
  });
  const addTag = useMutation({
    mutationFn: (tagId: number) => fetch(`/api/crm/customers/${id}/tags`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }); setNewTagId(""); },
  });
  const removeTag = useMutation({
    mutationFn: (tagId: number) => fetch(`/api/crm/customers/${id}/tags/${tagId}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }),
  });
  const pause = useMutation({
    mutationFn: () => fetch(`/api/crm/customers/${id}/pause`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }); toast({ title: "Abonelik duraklatıldı" }); },
  });
  const resume = useMutation({
    mutationFn: () => fetch(`/api/crm/customers/${id}/resume`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/customers", id] }); toast({ title: "Abonelik yeniden aktif" }); },
  });
  const sendNps = useMutation({
    mutationFn: () => fetch("/api/crm/nps/send", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: Number(id) }) }).then(r => r.json()),
    onSuccess: () => toast({ title: "NPS anketi gönderildi" }),
  });
  const cancelSubscription = useMutation({
    mutationFn: (subId: number) => fetch(`/api/payments/service-subscriptions/${subId}/cancel`, { method: "POST", credentials: "include" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "İptal başarısız"); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/payments/service-subscriptions", customer?.email] }); setCancelConfirmId(null); toast({ title: "Abonelik iptal edildi", description: "İptal onay e-postası müşteriye gönderildi." }); },
    onError: (err: Error) => { toast({ title: "Hata", description: err.message, variant: "destructive" }); },
  });
  const renewSubscription = useMutation({
    mutationFn: ({ subId, body }: { subId: number; body: Record<string, string> }) =>
      fetch(`/api/payments/service-subscriptions/${subId}/renew`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Yenileme başarısız"); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payments/service-subscriptions", customer?.email] });
      setRenewSubId(null);
      setRenewCard({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
      toast({ title: "Abonelik yenilendi", description: "Yenileme makbuzu müşteriye e-posta ile gönderildi." });
    },
    onError: (err: Error) => { toast({ title: "Ödeme Hatası", description: err.message, variant: "destructive" }); },
  });

  if (isLoading) return <AdminLayout title="Müşteri 360"><div className="text-slate-400 text-center py-20">Yükleniyor...</div></AdminLayout>;
  if (!customer || (customer as unknown as Record<string, unknown>)["error"]) return <AdminLayout title="Müşteri 360"><div className="text-red-400 text-center py-20">Müşteri bulunamadı</div></AdminLayout>;

  const st = STATUS_LABELS[customer.cust_status] ?? STATUS_LABELS["active"]!;
  const merged = { ...customer, ...edits };

  const field = (key: keyof Customer360, label: string, type = "text") => (
    <div>
      <Label className="text-slate-400 text-xs">{label}</Label>
      {editMode ? (
        <Input type={type} className="bg-slate-800 border-slate-700 text-white mt-1 h-8 text-sm" value={String(edits[key] ?? customer[key] ?? "")} onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))} />
      ) : (
        <p className="text-white text-sm mt-1">{String(customer[key] ?? "-")}</p>
      )}
    </div>
  );

  return (
    <AdminLayout title={`${customer.company_name ?? customer.full_name}`} description="Müşteri 360° görünümü">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xl">
            {(customer.company_name ?? customer.full_name).charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-white font-bold">{customer.company_name ?? customer.full_name}</h2>
            <p className="text-slate-400 text-sm">{customer.email}</p>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
          {customer.plan && <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">{customer.plan}</Badge>}
          {customer.health && (
            <span className={`text-xs font-semibold ${customer.health.health_score >= 70 ? "text-emerald-400" : customer.health.health_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
              Sağlık: {customer.health.health_score}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 h-8" onClick={() => sendNps.mutate()}><Send className="h-3 w-3 mr-1" />NPS</Button>
          <Button size="sm" variant="outline" className="border-sky-500/40 text-sky-300 h-8" onClick={() => navigate(`/panel/musteriler/${id}/provizyon`)}><Settings2 className="h-3 w-3 mr-1" />Provizyon</Button>
          {customer.cust_status === "paused" ? (
            <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-300 h-8" onClick={() => resume.mutate()}><Play className="h-3 w-3 mr-1" />Devam Et</Button>
          ) : customer.cust_status === "active" ? (
            <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-300 h-8" onClick={() => pause.mutate()}><Pause className="h-3 w-3 mr-1" />Duraklat</Button>
          ) : null}
          {editMode ? (
            <>
              <Button size="sm" variant="outline" className="border-slate-700 h-8" onClick={() => { setEditMode(false); setEdits({}); }}>İptal</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-3 w-3 mr-1" />Kaydet</Button>
            </>
          ) : (
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-8" onClick={() => setEditMode(true)}>Düzenle</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="bg-slate-900 border border-slate-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="info" className="data-[state=active]:bg-slate-700">Bilgi</TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-slate-700">Fatura</TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-slate-700">Etiketler</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-slate-700">Görevler</TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-slate-700">Faturalar</TabsTrigger>
          <TabsTrigger value="nps" className="data-[state=active]:bg-slate-700">NPS</TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-slate-700">Notlar</TabsTrigger>
          <TabsTrigger value="servisler" className="data-[state=active]:bg-slate-700">
            <ShoppingBag className="h-3 w-3 mr-1" />
            Aktif Servisler
            {serviceSubscriptions.length > 0 && (
              <span className="ml-1.5 bg-cyan-500/20 text-cyan-400 text-xs px-1.5 py-0.5 rounded-full">{serviceSubscriptions.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              {field("full_name", "Yetkili Adı")}
              {field("company_name", "Şirket")}
              {field("email", "E-posta")}
              {field("phone", "Telefon")}
              {field("city", "Şehir")}
              {field("sector", "Sektör")}
              {field("plan", "Plan")}
              {field("assigned_to", "Sorumlu")}
              <div>
                <Label className="text-slate-400 text-xs">İlk Ödeme</Label>
                <p className="text-white text-sm mt-1">{fmtDate(customer.first_payment_at)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 grid grid-cols-2 gap-4">
              {field("billing_name", "Fatura Unvanı")}
              {field("billing_tax_id", "Vergi No")}
              {field("billing_tax_office", "Vergi Dairesi")}
              {field("billing_email", "Fatura E-postası")}
              {field("billing_phone", "Fatura Telefonu")}
              <div>
                <Label className="text-slate-400 text-xs">Ödeme Vadesi</Label>
                {editMode ? (
                  <Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1 h-8 text-sm" value={String(edits["payment_terms"] ?? customer.payment_terms ?? 30)} onChange={e => setEdits(p => ({ ...p, payment_terms: Number(e.target.value) }))} />
                ) : (
                  <p className="text-white text-sm mt-1">{customer.payment_terms ?? 30} gün</p>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-slate-400 text-xs">Fatura Adresi</Label>
                {editMode ? (
                  <Textarea className="bg-slate-800 border-slate-700 text-white mt-1 text-sm" rows={2} value={String(edits["billing_address"] ?? customer.billing_address ?? "")} onChange={e => setEdits(p => ({ ...p, billing_address: e.target.value }))} />
                ) : (
                  <p className="text-white text-sm mt-1 whitespace-pre-line">{customer.billing_address ?? "-"}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {customer.tags.map(tag => (
                  <span key={tag.id} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-slate-900" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                    <button onClick={() => removeTag.mutate(tag.id)} className="ml-1 hover:opacity-70"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {customer.tags.length === 0 && <p className="text-slate-500 text-sm">Etiket yok</p>}
              </div>
              <div className="flex gap-2">
                <Select value={newTagId} onValueChange={setNewTagId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-48"><SelectValue placeholder="Etiket seç" /></SelectTrigger>
                  <SelectContent>
                    {allTags.filter(t => !customer.tags.find(ct => ct.id === t.id)).map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => newTagId && addTag.mutate(Number(newTagId))} disabled={!newTagId}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {customer.tasks.length === 0 ? <p className="text-slate-500 text-sm p-5">Görev yok</p> : (
                <div className="divide-y divide-slate-800">
                  {customer.tasks.map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${t.status === "completed" ? "line-through text-slate-500" : "text-white"}`}>{t.title}</p>
                        {t.due_date && <p className="text-slate-500 text-xs mt-0.5">Vade: {fmtDate(t.due_date)}</p>}
                      </div>
                      <span className={`text-xs font-medium ${t.priority === "high" ? "text-red-400" : t.priority === "medium" ? "text-yellow-400" : "text-green-400"}`}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {customer.invoices.length === 0 ? <p className="text-slate-500 text-sm p-5">Fatura yok</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-800">{["No","Tutar","Durum","Vade"].map(h => <th key={h} className="text-left text-slate-400 text-xs px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {customer.invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 text-cyan-400 font-mono text-xs">{inv.full_invoice_number}</td>
                        <td className="px-4 py-3 text-white">₺{fmtMoney(inv.total_tl)}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{INV_STATUS[inv.status] ?? inv.status}</td>
                        <td className={`px-4 py-3 text-xs ${inv.status === "overdue" ? "text-red-400" : "text-slate-400"}`}>{fmtDate(inv.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NPS */}
        <TabsContent value="nps">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-3">
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => sendNps.mutate()} disabled={sendNps.isPending}><Send className="h-3 w-3 mr-2" />NPS Anketi Gönder</Button>
              {customer.nps.length === 0 ? <p className="text-slate-500 text-sm">Henüz anket gönderilmedi</p> : (
                <div className="space-y-2">
                  {customer.nps.map(n => (
                    <div key={n.id} className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg">
                      {n.score !== null ? <span className={`text-2xl font-bold ${n.score >= 9 ? "text-emerald-400" : n.score >= 7 ? "text-yellow-400" : "text-red-400"}`}>{n.score}</span> : <span className="text-slate-600 text-sm">-</span>}
                      <div className="flex-1"><p className="text-slate-400 text-xs">Gönderildi: {fmtDate(n.sent_at)}</p>{n.responded_at && <p className="text-slate-500 text-xs">Yanıtlandı: {fmtDate(n.responded_at)}</p>}</div>
                      {n.category && <span className={`text-xs font-medium ${n.category === "promoter" ? "text-emerald-400" : n.category === "passive" ? "text-yellow-400" : "text-red-400"}`}>{n.category}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aktif Servisler */}
        <TabsContent value="servisler">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-200 text-sm flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-cyan-400" />
                Satın Alınan Servisler
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {serviceSubscriptions.length === 0 ? (
                <p className="text-slate-500 text-sm p-5">Henüz satın alınmış servis yok</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {serviceSubscriptions.map(sub => {
                    const isActive = sub.status === "active";
                    const isExpired = sub.expiresAt ? new Date(sub.expiresAt) < new Date() : false;
                    const effectiveStatus = isExpired ? "expired" : sub.status;
                    const statusColors: Record<string, string> = {
                      active: "text-emerald-400", cancelled: "text-red-400", trial: "text-yellow-400", expired: "text-slate-500"
                    };
                    const statusLabels: Record<string, string> = {
                      active: "Aktif", cancelled: "İptal", trial: "Deneme", expired: "Süresi Doldu"
                    };
                    const isConfirming = cancelConfirmId === sub.id;
                    return (
                      <div key={sub.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{sub.serviceLabel}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={`text-xs font-semibold ${statusColors[effectiveStatus] ?? "text-slate-400"}`}>
                              {statusLabels[effectiveStatus] ?? effectiveStatus}
                            </span>
                            <span className="text-slate-500 text-xs">{sub.billingCycle === "annual" ? "Yıllık" : "Aylık"}</span>
                            <span className="text-slate-500 text-xs">Başlangıç: {fmtDate(sub.startedAt)}</span>
                            {sub.expiresAt && (
                              <span className={`text-xs ${isExpired ? "text-red-400" : "text-slate-500"}`}>
                                Bitiş: {fmtDate(sub.expiresAt)}
                              </span>
                            )}
                            {sub.cancelledAt && (
                              <span className="text-xs text-red-400">İptal: {fmtDate(sub.cancelledAt)}</span>
                            )}
                          </div>
                          {sub.paymentRef && (
                            <p className="text-slate-600 text-xs mt-0.5 font-mono">Ref: {sub.paymentRef}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          {sub.amountPaid && (
                            <p className="text-cyan-400 font-semibold text-sm">₺{Number(sub.amountPaid).toLocaleString("tr-TR")}</p>
                          )}
                          {isActive && !isExpired ? (
                            isConfirming ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-red-400">Emin misiniz?</span>
                                <Button size="sm" variant="destructive" className="h-6 text-xs px-2" disabled={cancelSubscription.isPending} onClick={() => cancelSubscription.mutate(sub.id)}>
                                  {cancelSubscription.isPending ? "..." : "Evet, İptal Et"}
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-slate-700 text-slate-300" onClick={() => setCancelConfirmId(null)}>Vazgeç</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => setCancelConfirmId(sub.id)}>
                                <Ban className="h-3 w-3 mr-1" />İptal Et
                              </Button>
                            )
                          ) : (sub.status === "cancelled" || isExpired) ? (
                            renewSubId === sub.id ? (
                              <div className="mt-2 p-3 bg-slate-800 rounded-lg border border-slate-700 text-left w-64">
                                <p className="text-xs text-slate-400 font-semibold mb-2">Yenileme Ödemesi</p>
                                {sub.iyzicoCardUserKey && sub.iyzicoCardToken ? (
                                  <div className="space-y-2">
                                    <p className="text-xs text-emerald-400">Kayıtlı kart ile hızlı yenileme yapılabilir.</p>
                                    <div className="flex gap-1.5">
                                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs flex-1" disabled={renewSubscription.isPending} onClick={() => renewSubscription.mutate({ subId: sub.id, body: {} })}>
                                        {renewSubscription.isPending ? "..." : "Kayıtlı Kartla Yenile"}
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-400" onClick={() => setRenewSubId(null)}>X</Button>
                                    </div>
                                    <p className="text-xs text-slate-500">veya yeni kart bilgisi girin:</p>
                                  </div>
                                ) : null}
                                <div className="space-y-1.5 mt-1">
                                  <Input placeholder="Kart üzerindeki isim" className="bg-slate-900 border-slate-600 h-7 text-xs text-white" value={renewCard.cardHolderName} onChange={e => setRenewCard(p => ({ ...p, cardHolderName: e.target.value }))} />
                                  <Input placeholder="Kart numarası" className="bg-slate-900 border-slate-600 h-7 text-xs text-white" value={renewCard.cardNumber} onChange={e => setRenewCard(p => ({ ...p, cardNumber: e.target.value }))} />
                                  <div className="flex gap-1">
                                    <Input placeholder="AA" className="bg-slate-900 border-slate-600 h-7 text-xs text-white w-14" value={renewCard.expireMonth} onChange={e => setRenewCard(p => ({ ...p, expireMonth: e.target.value }))} />
                                    <Input placeholder="YYYY" className="bg-slate-900 border-slate-600 h-7 text-xs text-white w-20" value={renewCard.expireYear} onChange={e => setRenewCard(p => ({ ...p, expireYear: e.target.value }))} />
                                    <Input placeholder="CVV" className="bg-slate-900 border-slate-600 h-7 text-xs text-white w-16" value={renewCard.cvc} onChange={e => setRenewCard(p => ({ ...p, cvc: e.target.value }))} />
                                  </div>
                                  <div className="flex gap-1.5">
                                    <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs flex-1"
                                      disabled={renewSubscription.isPending || !renewCard.cardNumber || !renewCard.cardHolderName || !renewCard.expireMonth || !renewCard.expireYear || !renewCard.cvc}
                                      onClick={() => renewSubscription.mutate({ subId: sub.id, body: renewCard })}>
                                      {renewSubscription.isPending ? "..." : "Yeni Kartla Yenile"}
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-400" onClick={() => setRenewSubId(null)}>X</Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10" onClick={() => { setRenewSubId(sub.id); setCancelConfirmId(null); }}>
                                Yenile
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-2">
                <Textarea className="bg-slate-800 border-slate-700 text-white flex-1" rows={2} placeholder="Not ekle..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                <Button className="bg-emerald-600 hover:bg-emerald-700 self-end" onClick={() => addNote.mutate()} disabled={!noteText || addNote.isPending}><Plus className="h-4 w-4" /></Button>
              </div>
              {(customer.tasks as unknown as Array<{ id: number; title: string; description?: string; task_type: string; created_at: string }>).filter(t => t.task_type === "note").map(note => (
                <div key={note.id} className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-white text-sm">{note.description}</p>
                  <p className="text-slate-500 text-xs mt-1">{fmtDate(note.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
