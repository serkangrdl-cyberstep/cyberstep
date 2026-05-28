import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Send, CheckCircle, XCircle, Plus, Trash2,
  Mail, Package, FileText, Clock, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:                  { label: "Yeni",                   color: "bg-blue-100 text-blue-700" },
  rfq_sent:             { label: "RFQ Gönderildi",         color: "bg-yellow-100 text-yellow-700" },
  quoted:               { label: "Teklif Hazır",           color: "bg-purple-100 text-purple-700" },
  revision_requested:   { label: "Revizyon Talebi",        color: "bg-orange-100 text-orange-700 font-semibold" },
  approved:             { label: "Onaylandı",              color: "bg-emerald-100 text-emerald-700" },
  sent:                 { label: "Müşteriye Gönderildi",   color: "bg-green-100 text-green-700" },
  won:                  { label: "Kazanildi",              color: "bg-green-200 text-green-800" },
  lost:                 { label: "Kaybedildi",             color: "bg-red-100 text-red-700" },
  cancelled:            { label: "Iptal",                  color: "bg-slate-100 text-slate-600" },
};

const QUOTE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: "Taslak",           color: "bg-slate-100 text-slate-600" },
  pending_approval: { label: "Onay Bekliyor",    color: "bg-orange-100 text-orange-700" },
  approved:         { label: "Onaylandı",         color: "bg-emerald-100 text-emerald-700" },
  sent:             { label: "Gönderildi",        color: "bg-green-100 text-green-700" },
  rejected:         { label: "Reddedildi",        color: "bg-red-100 text-red-700" },
};

interface QuoteLine {
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  currency?: string;
}

export default function AdminIsrDeal() {
  const { id } = useParams<{ id: string }>();
  const dealId = parseInt(id);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [kdvRate, setKdvRate] = useState(20);

  // RFQ dialog state
  const [rfqDialog, setRfqDialog] = useState(false);
  const [rfqVendorId, setRfqVendorId] = useState<string>("");
  const [rfqDistributorIds, setRfqDistributorIds] = useState<number[]>([]);

  const { data, isLoading, refetch } = useQuery<{
    deal: Record<string, unknown>;
    rfqs: Record<string, unknown>[];
    responses: Record<string, unknown>[];
    lines: Record<string, unknown>[];
    quotes: Record<string, unknown>[];
    quoteLines: Record<string, unknown>[];
  }>({
    queryKey: ["isr-deal", dealId],
    queryFn: () => fetch(`/api/admin-panel/isr/deals/${dealId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !isNaN(dealId),
  });

  const { data: vendorsData } = useQuery<Array<{
    id: number; name: string; displayName: string;
    distributors: Array<{ id: number; name: string; contactEmail: string; contactName: string | null }>;
  }>>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
  });

  const sendRfqMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin-panel/isr/deals/${dealId}/send-rfq`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: rfqVendorId ? parseInt(rfqVendorId) : undefined,
          distributorIds: rfqDistributorIds.length > 0 ? rfqDistributorIds : undefined,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      setRfqDialog(false);
      setRfqDistributorIds([]);
      refetch();
      qc.invalidateQueries({ queryKey: ["isr-stats"] });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin-panel/isr/deals/${dealId}/quotes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: quoteLines, notes: quoteNotes, kdvRate }),
      }).then(r => r.json()),
    onSuccess: () => { setShowQuoteBuilder(false); refetch(); },
  });

  const approveMutation = useMutation({
    mutationFn: (quoteId: number) =>
      fetch(`/api/admin-panel/isr/quotes/${quoteId}/approve`, {
        method: "POST", credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["isr-stats", "isr-deals"] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (quoteId: number) =>
      fetch(`/api/admin-panel/isr/quotes/${quoteId}/reject`, {
        method: "POST", credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/admin-panel/isr/deals/${dealId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  if (isLoading) return (
    <AdminLayout title="Deal Detayı">
      <div className="text-center py-16 text-slate-500">Yükleniyor...</div>
    </AdminLayout>
  );

  const deal = data?.deal;
  if (!deal) return (
    <AdminLayout title="Deal Detayı">
      <div className="text-center py-16 text-slate-500">Deal bulunamadı.</div>
    </AdminLayout>
  );

  const status = STATUS_LABELS[String(deal["status"])] ?? { label: String(deal["status"]), color: "bg-slate-100 text-slate-600" };
  const subtotal = quoteLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const kdv = subtotal * (kdvRate / 100);
  const total = subtotal + kdv;

  // Pre-fill from RFQ response lines
  const prefillFromResponse = () => {
    const lines = data?.lines ?? [];
    if (lines.length > 0) {
      setQuoteLines(lines.map((l) => ({
        sku: String(l["sku"] ?? ""),
        description: String(l["description"]),
        quantity: Number(l["quantity"]),
        unitPrice: Number(l["unitPrice"] ?? 0),
        unitCost: Number(l["unitCost"] ?? 0),
        currency: String(l["currency"] ?? "TRY"),
      })));
      setShowQuoteBuilder(true);
    } else {
      setShowQuoteBuilder(true);
    }
  };

  return (
    <AdminLayout title="Deal Detayı" description={`#${dealId} — ${String(deal["customerCompany"] ?? deal["customerEmail"])}`}>
      <div className="space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/panel/isr")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
          <Badge className={`${status.color} border-0`}>{status.label}</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => {
              setRfqVendorId(deal["vendorId"] ? String(deal["vendorId"]) : "");
              setRfqDistributorIds([]);
              setRfqDialog(true);
            }}>
              <Send className="h-4 w-4 mr-1.5" />
              RFQ Gönder
            </Button>
            <Button size="sm" variant="outline" onClick={prefillFromResponse}>
              <Plus className="h-4 w-4 mr-1.5" />
              Teklif Hazırla
            </Button>
          </div>
        </div>

        {/* Revision request alert */}
        {String(deal["status"]) === "revision_requested" && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-orange-800">Revizyon Talebi Alindi</div>
              <div className="text-sm text-orange-700">
                Musteri bu teklif icin indirim veya icin degisikligi talep etti. Asagidaki notlari inceleyin ve yeni bir teklif hazirlayin.
              </div>
              {deal["notes"] ? (
                <pre className="mt-2 text-xs text-orange-900 bg-orange-100 rounded p-2 whitespace-pre-wrap font-mono">
                  {String(deal["notes"])}
                </pre>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={prefillFromResponse} className="bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Revize Teklif Hazirla
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate("quoted")} className="border-orange-300 text-orange-700 hover:bg-orange-100">
                  Teklif Hazir Olarak Isaretle
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Deal info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" /> Müşteri Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-500">Ad:</span> <span className="text-slate-900">{String(deal["customerName"] ?? "—")}</span></div>
                  <div><span className="text-slate-500">E-posta:</span> <span className="text-slate-900">{String(deal["customerEmail"])}</span></div>
                  <div><span className="text-slate-500">Firma:</span> <span className="text-slate-900">{String(deal["customerCompany"] ?? "—")}</span></div>
                  <div><span className="text-slate-500">Satıcı:</span> <span className="text-slate-900">{String(deal["vendorName"] ?? "—")}</span></div>
                </div>
                {!!deal["productKeywords"] && (
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                    <span className="font-medium">Ürün Anahtar Kelimeleri:</span> {String(deal["productKeywords"])}
                  </div>
                )}
                {!!deal["aiSummary"] && (
                  <div className="mt-2 p-3 bg-blue-50 rounded text-xs text-blue-700">
                    <span className="font-semibold">AI Özeti:</span> {String(deal["aiSummary"])}
                  </div>
                )}
                {!!deal["originalBody"] && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Orijinal e-postayı göster</summary>
                    <pre className="mt-2 p-3 bg-slate-50 rounded whitespace-pre-wrap text-slate-600 max-h-40 overflow-auto">{String(deal["originalBody"])}</pre>
                  </details>
                )}
              </CardContent>
            </Card>

            {/* RFQs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-yellow-500" /> Gönderilen RFQ'lar ({data?.rfqs.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.rfqs ?? []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">Henüz RFQ gönderilmedi.</div>
                ) : (
                  <div className="divide-y">
                    {(data?.rfqs ?? []).map((rfq) => (
                      <div key={String(rfq["id"])} className="px-6 py-3 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{String(rfq["sentToName"] ?? rfq["sentToEmail"])}</div>
                          <div className="text-xs text-slate-400">{String(rfq["sentToEmail"])} · {rfq["sentAt"] ? format(new Date(String(rfq["sentAt"])), "d MMM HH:mm", { locale: tr }) : ""}</div>
                        </div>
                        <Badge className={rfq["status"] === "responded" ? "bg-green-100 text-green-700 border-0" : "bg-yellow-100 text-yellow-700 border-0"}>
                          {rfq["status"] === "responded" ? "Cevap Geldi" : "Bekliyor"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RFQ Responses + lines */}
            {(data?.responses ?? []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-500" /> Gelen Teklifler
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(data?.responses ?? []).map((resp) => {
                    const respLines = (data?.lines ?? []).filter(l => l["rfqResponseId"] === resp["id"]);
                    return (
                      <div key={String(resp["id"])} className="mb-4 last:mb-0">
                        <div className="text-xs text-slate-500 mb-2">
                          {String(resp["fromEmail"])} · {resp["receivedAt"] ? format(new Date(String(resp["receivedAt"])), "d MMM HH:mm", { locale: tr }) : ""}
                          {!!resp["validUntil"] && ` · Geçerlilik: ${String(resp["validUntil"])}`}
                        </div>
                        {respLines.length > 0 ? (
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">SKU</th>
                                <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Ürün</th>
                                <th className="text-center text-xs font-medium text-slate-500 px-3 py-2">Adet</th>
                                <th className="text-right text-xs font-medium text-slate-500 px-3 py-2">Maliyet</th>
                                <th className="text-right text-xs font-medium text-slate-500 px-3 py-2">Satış</th>
                              </tr>
                            </thead>
                            <tbody>
                              {respLines.map((l) => (
                                <tr key={String(l["id"])} className="border-t border-slate-100">
                                  <td className="px-3 py-2 text-xs text-slate-500">{String(l["sku"] ?? "—")}</td>
                                  <td className="px-3 py-2 text-xs">{String(l["description"])}</td>
                                  <td className="px-3 py-2 text-xs text-center">{String(l["quantity"])}</td>
                                  <td className="px-3 py-2 text-xs text-right">{Number(l["unitCost"]).toLocaleString("tr-TR")} {String(l["currency"])}</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium">{Number(l["unitPrice"]).toLocaleString("tr-TR")} {String(l["currency"])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-xs text-slate-400">Fiyat kalemi parse edilemedi.</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Quote Builder */}
            {showQuoteBuilder && (
              <Card className="border-2 border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" /> Teklif Hazırla
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quoteLines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="grid grid-cols-5 gap-2 flex-1">
                        <Input placeholder="SKU" value={line.sku ?? ""} onChange={e => {
                          const updated = [...quoteLines]; updated[i] = { ...line, sku: e.target.value }; setQuoteLines(updated);
                        }} className="text-xs col-span-1" />
                        <Input placeholder="Ürün açıklaması" value={line.description} onChange={e => {
                          const updated = [...quoteLines]; updated[i] = { ...line, description: e.target.value }; setQuoteLines(updated);
                        }} className="text-xs col-span-2" />
                        <Input type="number" placeholder="Adet" value={line.quantity} onChange={e => {
                          const updated = [...quoteLines]; updated[i] = { ...line, quantity: parseInt(e.target.value) || 1 }; setQuoteLines(updated);
                        }} className="text-xs" />
                        <Input type="number" placeholder="Birim Fiyat" value={line.unitPrice} onChange={e => {
                          const updated = [...quoteLines]; updated[i] = { ...line, unitPrice: parseFloat(e.target.value) || 0 }; setQuoteLines(updated);
                        }} className="text-xs" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setQuoteLines(quoteLines.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setQuoteLines([...quoteLines, { description: "", quantity: 1, unitPrice: 0 }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Satır Ekle
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">KDV Oranı (%)</Label>
                      <Input type="number" value={kdvRate} onChange={e => setKdvRate(parseInt(e.target.value) || 0)} className="text-sm mt-1" />
                    </div>
                    <div className="text-right pt-5">
                      <div className="text-xs text-slate-500">Ara Toplam: {subtotal.toLocaleString("tr-TR")} TRY</div>
                      <div className="text-xs text-slate-500">KDV: {kdv.toLocaleString("tr-TR")} TRY</div>
                      <div className="text-base font-bold text-slate-900">TOPLAM: {total.toLocaleString("tr-TR")} TRY</div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Notlar</Label>
                    <Textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} rows={2} className="text-sm mt-1" />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowQuoteBuilder(false)}>Iptal</Button>
                    <Button size="sm" onClick={() => createQuoteMutation.mutate()} disabled={createQuoteMutation.isPending}>
                      Teklif Oluştur ve Onaya Gönder
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quotes */}
            {(data?.quotes ?? []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" /> Teklifler
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(data?.quotes ?? []).map((quote) => {
                    const qs = QUOTE_STATUS_LABELS[String(quote["status"])] ?? { label: String(quote["status"]), color: "bg-slate-100 text-slate-600" };
                    const qLines = (data?.quoteLines ?? []).filter(l => l["quoteId"] === quote["id"]);
                    return (
                      <div key={String(quote["id"])} className="border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{String(quote["quoteNumber"])}</span>
                            <Badge className={`ml-2 ${qs.color} border-0 text-xs`}>{qs.label}</Badge>
                          </div>
                          <div className="font-bold text-slate-900">{Number(quote["total"]).toLocaleString("tr-TR")} {String(quote["currency"])}</div>
                        </div>
                        {qLines.length > 0 && (
                          <table className="w-full text-xs border-collapse">
                            <tbody>
                              {qLines.map((l) => (
                                <tr key={String(l["id"])} className="border-t border-slate-100">
                                  <td className="py-1.5 text-slate-500">{String(l["sku"] ?? "—")}</td>
                                  <td className="py-1.5">{String(l["description"])}</td>
                                  <td className="py-1.5 text-center">x{String(l["quantity"])}</td>
                                  <td className="py-1.5 text-right font-medium">{Number(l["lineTotal"]).toLocaleString("tr-TR")} {String(l["currency"])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {quote["status"] === "pending_approval" && (
                          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate(Number(quote["id"]))} disabled={rejectMutation.isPending}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reddet
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => approveMutation.mutate(Number(quote["id"]))} disabled={approveMutation.isPending}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Onayla ve Müşteriye Gönder
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" /> Durum Güncelle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {["new", "rfq_sent", "quoted", "won", "lost", "cancelled"].map((s) => {
                  const sl = STATUS_LABELS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatusMutation.mutate(s)}
                      disabled={deal["status"] === s}
                      className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                        deal["status"] === s
                          ? `${sl?.color} opacity-100`
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {sl?.label ?? s}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Özet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between"><span>RFQ Gönderilen</span><span className="font-medium">{data?.rfqs.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Gelen Yanıt</span><span className="font-medium">{data?.responses.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Hazır Teklif</span><span className="font-medium">{data?.quotes.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Oluşturma</span><span className="font-medium">{deal["createdAt"] ? format(new Date(String(deal["createdAt"])), "d MMM yyyy", { locale: tr }) : "—"}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* RFQ Gönder Dialog */}
      {(() => {
        const selectedVendor = vendorsData?.find(v => String(v.id) === rfqVendorId);
        const distributors = selectedVendor?.distributors ?? [];
        const allSelected = distributors.length > 0 && distributors.every(d => rfqDistributorIds.includes(d.id));
        return (
          <Dialog open={rfqDialog} onOpenChange={o => setRfqDialog(o)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" /> RFQ Gönder
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Vendor selector */}
                <div>
                  <Label className="text-xs font-medium text-slate-700">Satıcı (Vendor)</Label>
                  <Select value={rfqVendorId} onValueChange={v => { setRfqVendorId(v); setRfqDistributorIds([]); }}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue placeholder="Vendor seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendorsData ?? []).filter(v => v.distributors.length > 0).map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Distributor list */}
                {selectedVendor && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium text-slate-700">
                        Distribütörler ({distributors.length})
                      </Label>
                      <button
                        className="text-xs text-blue-500 hover:underline"
                        onClick={() => allSelected
                          ? setRfqDistributorIds([])
                          : setRfqDistributorIds(distributors.map(d => d.id))
                        }
                      >
                        {allSelected ? "Hiçbirini seçme" : "Tümünü seç"}
                      </button>
                    </div>
                    {distributors.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        Bu vendor altında distribütör yok. Önce distribütör ekleyin.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto border border-slate-200 rounded-md p-3">
                        {distributors.map(d => (
                          <div key={d.id} className="flex items-center gap-2.5">
                            <Checkbox
                              id={`dist-${d.id}`}
                              checked={rfqDistributorIds.includes(d.id)}
                              onCheckedChange={checked => {
                                setRfqDistributorIds(prev =>
                                  checked ? [...prev, d.id] : prev.filter(x => x !== d.id)
                                );
                              }}
                            />
                            <label htmlFor={`dist-${d.id}`} className="flex-1 cursor-pointer">
                              <div className="text-sm font-medium text-slate-900">{d.name}</div>
                              <div className="text-xs text-slate-400">
                                {d.contactName ? `${d.contactName} · ` : ""}{d.contactEmail}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    {rfqDistributorIds.length === 0 && distributors.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Seçim yapmazsanız tüm distribütörlere gönderilir.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setRfqDialog(false)}>Iptal</Button>
                <Button
                  onClick={() => sendRfqMutation.mutate()}
                  disabled={sendRfqMutation.isPending || !rfqVendorId}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sendRfqMutation.isPending ? "Gönderiliyor..." : `RFQ Gönder${rfqDistributorIds.length > 0 ? ` (${rfqDistributorIds.length})` : ""}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AdminLayout>
  );
}
