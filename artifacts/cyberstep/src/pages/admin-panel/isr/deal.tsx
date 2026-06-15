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
  Mail, Package, FileText, Clock, AlertTriangle, ClipboardPaste, Bot, Loader2,
  Phone, CalendarCheck, StickyNote, Zap, MessageSquare, CheckCircle2, Bell, BellRing, X,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface CopilotContent {
  musteri_ozeti: string;
  satis_acisi: string;
  aciliyet_faktoru: string;
  onerilen_paket: { isim: string; fiyat: string; neden: string[] };
  gorusmede_sor: Array<{ soru: string; amac: string }>;
  itirazlar: Array<{ itiraz: string; cevap: string }>;
  linkedin_mesaji: string;
  followup_mail_d3: { konu: string; icerik: string };
  followup_mail_d7: { konu: string; icerik: string };
  bir_sonraki_adim: string;
  upsell_zamani: string;
}

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

  // Paste response state
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteFrom, setPasteFrom] = useState("");
  const [pasteResult, setPasteResult] = useState<{ lineCount: number; currency: string } | null>(null);

  // Email send dialog state
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTemplateId, setEmailTemplateId] = useState<string>("");
  const [emailVars, setEmailVars] = useState<Record<string, string>>({});

  // Activity form state
  const [activityType, setActivityType] = useState<string>("note");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDesc, setActivityDesc] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [copilotResult, setCopilotResult] = useState<{ copilot: CopilotContent; cached: boolean } | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [copilotTab, setCopilotTab] = useState<"ozet" | "gorusme" | "mailler" | "itirazlar">("ozet");

  // Reminder state
  const [remindDate, setRemindDate] = useState("");
  const [remindNote, setRemindNote] = useState("");
  const [showReminderForm, setShowReminderForm] = useState(false);

  // Next Best Action state
  const [nbaActions, setNbaActions] = useState<Array<{
    title: string; description: string; urgency: string; category: string;
  }> | null>(null);
  const [nbaLoading, setNbaLoading] = useState(false);

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
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const { data: vendorsData } = useQuery<Array<{
    id: number; name: string; displayName: string;
    distributors: Array<{ id: number; name: string; contactEmail: string; contactName: string | null }>;
  }>>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
  });

  const { data: activitiesData, refetch: refetchActivities } = useQuery<{
    activities: Array<{
      id: number; type: string; title: string; description: string | null;
      outcome: string | null; isCompleted: boolean; createdByEmail: string | null;
      createdAt: string; completedAt: string | null;
    }>;
  }>({
    queryKey: ["isr-activities", dealId],
    queryFn: () => fetch(`/api/admin-panel/isr/deals/${dealId}/activities`, { credentials: "include" }).then(r => r.json()),
    enabled: !isNaN(dealId),
  });

  const { data: remindersData, refetch: refetchReminders } = useQuery<{
    reminders: Array<{
      id: number; remindAt: string; note: string | null; isDismissed: boolean;
    }>;
  }>({
    queryKey: ["isr-reminders", dealId],
    queryFn: () => fetch(`/api/admin-panel/isr/deals/${dealId}/reminders`, { credentials: "include" }).then(r => r.json()),
    enabled: !isNaN(dealId),
  });

  const createReminderMutation = useMutation({
    mutationFn: () => fetch(`/api/admin-panel/isr/deals/${dealId}/reminders`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: remindDate, note: remindNote || undefined }),
    }).then(r => r.json()),
    onSuccess: () => {
      setRemindDate(""); setRemindNote(""); setShowReminderForm(false);
      refetchReminders();
    },
  });

  const dismissReminderMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/isr/reminders/${id}/dismiss`, {
      method: "PATCH", credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => refetchReminders(),
  });

  const createActivityMutation = useMutation({
    mutationFn: () => fetch(`/api/admin-panel/isr/deals/${dealId}/activities`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: activityType, title: activityTitle, description: activityDesc || undefined }),
    }).then(r => r.json()),
    onSuccess: () => {
      setActivityTitle(""); setActivityDesc(""); setShowActivityForm(false);
      refetchActivities();
    },
  });

  const completeActivityMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/isr/activities/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: true }),
    }).then(r => r.json()),
    onSuccess: () => refetchActivities(),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin-panel/isr/activities/${id}`, {
      method: "DELETE", credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => refetchActivities(),
  });

  const fetchNba = async () => {
    setNbaLoading(true);
    try {
      const r = await fetch(`/api/admin-panel/isr/deals/${dealId}/next-action`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      setNbaActions(d.actions ?? []);
    } catch {
      setNbaActions([]);
    } finally {
      setNbaLoading(false);
    }
  };

  const handleCopilotStart = async () => {
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const r = await fetch(`/api/admin-panel/isr/deals/${dealId}/copilot`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) { setCopilotError("Copilot üretilemedi, tekrar deneyin."); return; }
      const d = await r.json() as { copilot: CopilotContent; cached: boolean };
      setCopilotResult(d);
      setCopilotTab("ozet");
    } catch {
      setCopilotError("Bağlantı hatası.");
    } finally {
      setCopilotLoading(false);
    }
  };

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

  const pasteResponseMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin-panel/isr/deals/${dealId}/paste-response`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailText: pasteText, fromEmail: pasteFrom || undefined }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: (data) => {
      setPasteResult({ lineCount: data.lineCount, currency: data.parsed?.currency ?? "TRY" });
      setPasteText("");
      setPasteFrom("");
      refetch();
      qc.invalidateQueries({ queryKey: ["isr-stats"] });
    },
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
            <Button size="sm" variant="outline" onClick={() => {
              setEmailVars({
                companyName: String(deal["customerCompany"] ?? ""),
                contactName: String(deal["customerContact"] ?? ""),
                dealId: String(dealId),
              });
              setEmailTemplateId("");
              setEmailDialog(true);
            }}>
              <Mail className="h-4 w-4 mr-1.5" />
              E-posta Gönder
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

            {/* Paste distributor reply */}
            <Card className={showPaste ? "border-2 border-blue-200" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardPaste className="h-4 w-4 text-blue-500" />
                    Distributor Cevabini Yapistir
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setShowPaste(v => !v); setPasteResult(null); }}
                    className="text-xs h-7"
                  >
                    {showPaste ? "Kapat" : "Ac"}
                  </Button>
                </div>
              </CardHeader>
              {showPaste && (
                <CardContent className="space-y-3">
                  {pasteResult ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <CheckCircle className="h-10 w-10 text-emerald-500" />
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">Basariyla islendi</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {pasteResult.lineCount > 0
                            ? `${pasteResult.lineCount} fiyat kalemi AI tarafindan cikarildi ve marj uygulanarak hazir hale getirildi.`
                            : "Mail kaydedildi fakat fiyat kalemi bulunamadi. Teklifi manuel olusturabilirsiniz."}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {pasteResult.lineCount > 0 && (
                          <Button size="sm" onClick={prefillFromResponse} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Teklifi Duzenle ve Onayla
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setPasteResult(null); }}>
                          Baska Bir Cevap Yapistir
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">
                          Distributor'un mail cevabini buraya kopyala-yapistir
                        </Label>
                        <Textarea
                          placeholder={"Merhaba,\n\nFiyat teklifimizi asagida bulabilirsiniz:\n\nFG-100F x50 — 12.500 TL/adet\n...\n\nSaygilarimizla"}
                          value={pasteText}
                          onChange={e => setPasteText(e.target.value)}
                          rows={7}
                          className="text-xs font-mono resize-none"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">
                          Gonderen e-posta (opsiyonel)
                        </Label>
                        <Input
                          value={pasteFrom}
                          onChange={e => setPasteFrom(e.target.value)}
                          placeholder="distributor@firma.com"
                          className="text-sm h-8"
                        />
                      </div>
                      {pasteResponseMutation.isError && (
                        <p className="text-xs text-red-600">
                          {String((pasteResponseMutation.error as Error)?.message ?? "Bir hata olustu")}
                        </p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => { setShowPaste(false); setPasteText(""); setPasteFrom(""); }}
                        >
                          Vazgec
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => pasteResponseMutation.mutate()}
                          disabled={!pasteText.trim() || pasteResponseMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {pasteResponseMutation.isPending
                            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />AI Parse Ediyor...</>
                            : <><Bot className="h-3.5 w-3.5 mr-1.5" />AI ile Parse Et ve Kaydet</>}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
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

            {/* AI Next Best Action */}
            <Card className="border-violet-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-500" /> AI Asistan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {nbaActions === null && (
                  <Button
                    size="sm" className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={fetchNba} disabled={nbaLoading}
                  >
                    {nbaLoading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analiz ediliyor...</>
                      : <><Zap className="h-3.5 w-3.5 mr-1.5" />Sonraki Adım Önerisi Al</>}
                  </Button>
                )}
                {nbaActions !== null && (
                  <>
                    {nbaActions.map((a, i) => {
                      const urgencyStyle: Record<string, string> = {
                        urgent: "border-l-4 border-red-400 bg-red-50",
                        high:   "border-l-4 border-orange-400 bg-orange-50",
                        normal: "border-l-4 border-blue-400 bg-blue-50",
                        low:    "border-l-4 border-slate-300 bg-slate-50",
                      };
                      const catIcon: Record<string, React.ReactNode> = {
                        follow_up:  <MessageSquare className="h-3 w-3" />,
                        send_offer: <Send className="h-3 w-3" />,
                        contact:    <Phone className="h-3 w-3" />,
                        internal:   <FileText className="h-3 w-3" />,
                        close:      <CheckCircle2 className="h-3 w-3" />,
                      };
                      return (
                        <div key={i} className={`rounded-lg p-3 space-y-1 ${urgencyStyle[a.urgency] ?? "border border-slate-200"}`}>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            {catIcon[a.category]}
                            {a.title}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{a.description}</p>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => { setNbaActions(null); fetchNba(); }}
                      disabled={nbaLoading}
                      className="w-full text-xs text-violet-600 hover:text-violet-800 flex items-center justify-center gap-1 py-1"
                    >
                      {nbaLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Yenile
                    </button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Status update */}
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

            {/* Activities */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-500" /> Aktiviteler
                    {(activitiesData?.activities.length ?? 0) > 0 && (
                      <span className="text-xs font-normal text-slate-400">({activitiesData?.activities.length})</span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                    onClick={() => setShowActivityForm(v => !v)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add activity form */}
                {showActivityForm && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { type: "note",    label: "Not",      icon: StickyNote },
                        { type: "call",    label: "Arama",    icon: Phone },
                        { type: "meeting", label: "Toplantı", icon: CalendarCheck },
                        { type: "email",   label: "E-posta",  icon: Mail },
                      ].map(({ type, label, icon: Icon }) => (
                        <button
                          key={type}
                          onClick={() => setActivityType(type)}
                          className={`flex flex-col items-center gap-1 py-2 rounded text-xs font-medium transition-colors ${
                            activityType === type ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <Input
                      placeholder="Başlık *"
                      value={activityTitle}
                      onChange={e => setActivityTitle(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Textarea
                      placeholder="Notlar (isteğe bağlı)"
                      value={activityDesc}
                      onChange={e => setActivityDesc(e.target.value)}
                      rows={2}
                      className="text-xs resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowActivityForm(false)}>İptal</Button>
                      <Button
                        size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => createActivityMutation.mutate()}
                        disabled={!activityTitle.trim() || createActivityMutation.isPending}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                )}

                {/* Activity timeline */}
                {(activitiesData?.activities ?? []).length === 0 && !showActivityForm && (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz aktivite yok</p>
                )}
                {(activitiesData?.activities ?? []).map((a) => {
                  const typeIcon: Record<string, React.ReactNode> = {
                    note:    <StickyNote className="h-3.5 w-3.5 text-slate-400" />,
                    call:    <Phone className="h-3.5 w-3.5 text-blue-400" />,
                    meeting: <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" />,
                    email:   <Mail className="h-3.5 w-3.5 text-orange-400" />,
                  };
                  return (
                    <div key={a.id} className={`flex gap-2.5 group ${a.isCompleted ? "opacity-60" : ""}`}>
                      <div className="mt-0.5 shrink-0">{typeIcon[a.type] ?? <StickyNote className="h-3.5 w-3.5 text-slate-400" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium text-slate-800 ${a.isCompleted ? "line-through" : ""}`}>{a.title}</div>
                        {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                        <div className="text-xs text-slate-400 mt-0.5">
                          {format(new Date(a.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                        {!a.isCompleted && (
                          <button
                            onClick={() => completeActivityMutation.mutate(a.id)}
                            className="text-emerald-500 hover:text-emerald-700"
                            title="Tamamlandı"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteActivityMutation.mutate(a.id)}
                          className="text-red-400 hover:text-red-600"
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Reminders */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4 text-violet-500" />
                    Hatırlatmalar
                    {(remindersData?.reminders.length ?? 0) > 0 && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                        {remindersData!.reminders.length}
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-xs text-violet-600 hover:bg-violet-50"
                    onClick={() => setShowReminderForm(v => !v)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showReminderForm && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Tarih ve Saat</label>
                      <input
                        type="datetime-local"
                        value={remindDate}
                        onChange={e => setRemindDate(e.target.value)}
                        className="w-full text-xs h-8 px-2 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    </div>
                    <Input
                      placeholder="Not (isteğe bağlı)"
                      value={remindNote}
                      onChange={e => setRemindNote(e.target.value)}
                      className="text-xs h-8"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReminderForm(false)}>İptal</Button>
                      <Button
                        size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                        onClick={() => createReminderMutation.mutate()}
                        disabled={!remindDate || createReminderMutation.isPending}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                )}

                {(remindersData?.reminders ?? []).length === 0 && !showReminderForm && (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz hatırlatma yok</p>
                )}

                {(remindersData?.reminders ?? []).map((r) => {
                  const due = new Date(r.remindAt) <= new Date();
                  return (
                    <div key={r.id} className={`flex gap-2.5 group rounded-lg p-2 ${due ? "bg-violet-50 border border-violet-200" : "bg-slate-50"}`}>
                      <div className="mt-0.5 shrink-0">
                        {due
                          ? <BellRing className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                          : <Bell className="h-3.5 w-3.5 text-slate-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${due ? "text-violet-800" : "text-slate-700"}`}>
                          {format(new Date(r.remindAt), "d MMM yyyy HH:mm", { locale: tr })}
                          {due && <span className="ml-1.5 text-violet-600 font-semibold">· Vadesini doldu</span>}
                        </div>
                        {r.note && <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>}
                      </div>
                      <button
                        onClick={() => dismissReminderMutation.mutate(r.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 text-slate-400 hover:text-slate-600"
                        title="Kapat"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Özet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between"><span>RFQ Gönderilen</span><span className="font-medium">{data?.rfqs.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Gelen Yanıt</span><span className="font-medium">{data?.responses.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Hazır Teklif</span><span className="font-medium">{data?.quotes.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Aktivite</span><span className="font-medium">{activitiesData?.activities.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Oluşturma</span><span className="font-medium">{deal["createdAt"] ? format(new Date(String(deal["createdAt"])), "d MMM yyyy", { locale: tr }) : "—"}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ISR Copilot */}
      <IsrCopilotSection
        copilot={copilotResult?.copilot ?? null}
        cached={copilotResult?.cached ?? false}
        loading={copilotLoading}
        error={copilotError}
        activeTab={copilotTab}
        onTabChange={setCopilotTab}
        onStart={handleCopilotStart}
      />

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
                <Button variant="outline" onClick={() => setRfqDialog(false)}>İptal</Button>
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

      {/* E-posta Gönder Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>E-posta Gönder</DialogTitle>
          </DialogHeader>
          <EmailSendForm
            dealId={dealId}
            initialVars={emailVars}
            initialTemplateId={emailTemplateId}
            onTemplateChange={setEmailTemplateId}
            onVarsChange={setEmailVars}
            toEmail={String(deal["customerEmail"] ?? "")}
            toName={String(deal["customerContact"] ?? "")}
            onClose={() => setEmailDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ─── ISR Copilot Section ──────────────────────────────────────────────────────
const C = {
  bg: "#060D1A", card: "#0A1828", border: "#1A3050",
  blue: "#00C8FF", text: "#E8EDF5", muted: "#8896A8",
  green: "#2ECC71", yellow: "#F5A623", red: "#E03A3A", purple: "#9B59B6",
};

function CopilotMailBlock({ title, subtitle, color, subject, content }: {
  title: string; subtitle: string; color: string;
  subject: string | null; content: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const text = subject ? `Konu: ${subject}\n\n${content}` : content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${color}33`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: `${color}11`, borderBottom: `1px solid ${color}22`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subtitle}</div>
        </div>
        <button onClick={copy} style={{ background: `${color}22`, border: `1px solid ${color}44`, color: color, borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      <div style={{ padding: 16 }}>
        {subject && <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Konu: <span style={{ color: C.text, fontWeight: 600 }}>{subject}</span></div>}
        <pre style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{content}</pre>
      </div>
    </div>
  );
}

function IsrCopilotSection({ copilot, cached, loading, error, activeTab, onTabChange, onStart }: {
  copilot: CopilotContent | null;
  cached: boolean;
  loading: boolean;
  error: string | null;
  activeTab: "ozet" | "gorusme" | "mailler" | "itirazlar";
  onTabChange: (t: "ozet" | "gorusme" | "mailler" | "itirazlar") => void;
  onStart: () => void;
}) {
  if (!copilot && !loading) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.blue}18`, border: `1px solid ${C.blue}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bot style={{ width: 20, height: 20, color: C.blue }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>ISR Copilot</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Bu deal için AI destekli satış rehberi — görüşme soruları, mail taslakları, itiraz cevapları
            </div>
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
        <button onClick={onStart} style={{ background: C.blue, color: C.bg, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Zap style={{ width: 16, height: 16 }} /> Copilot Başlat
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.blue}44`, borderRadius: 14, padding: 32, textAlign: "center" }}>
        <Loader2 style={{ width: 32, height: 32, color: C.blue, animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ color: C.blue, fontWeight: 700, fontSize: 15 }}>Müşteri analiz ediliyor...</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Satış rehberi hazırlanıyor</div>
      </div>
    );
  }

  if (!copilot) return null;

  const tabs = [
    { key: "ozet" as const, label: "Özet" },
    { key: "gorusme" as const, label: "Görüşme" },
    { key: "mailler" as const, label: "Mailler" },
    { key: "itirazlar" as const, label: "İtirazlar" },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.blue}55`, borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.bg, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bot style={{ width: 18, height: 18, color: C.blue }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>ISR Copilot</span>
          {cached && <span style={{ fontSize: 10, color: C.muted, background: C.border, padding: "2px 8px", borderRadius: 10 }}>önbellekten</span>}
        </div>
        <div style={{ background: `${C.blue}18`, border: `1px solid ${C.blue}44`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: C.blue }}>
          {copilot.onerilen_paket.isim} — {copilot.onerilen_paket.fiyat}
        </div>
      </div>

      {/* Aciliyet */}
      <div style={{ background: `${C.yellow}0D`, borderBottom: `1px solid ${C.yellow}33`, padding: "10px 20px", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Zap style={{ width: 14, height: 14, color: C.yellow, marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: C.yellow, fontWeight: 600, lineHeight: 1.5 }}>{copilot.aciliyet_faktoru}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)} style={{ padding: "11px 18px", fontSize: 13, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", color: activeTab === tab.key ? C.blue : C.muted, borderBottom: activeTab === tab.key ? `2px solid ${C.blue}` : "2px solid transparent" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>

        {/* ÖZET */}
        {activeTab === "ozet" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Müşteri Özeti</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>{copilot.musteri_ozeti}</div>
            </div>
            <div style={{ background: `${C.blue}0A`, border: `1px solid ${C.blue}2A`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: C.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Satış Açısı</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>{copilot.satis_acisi}</div>
            </div>
            <div style={{ background: `${C.green}0A`, border: `1px solid ${C.green}2A`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: C.green, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Önerilen Paket</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 8 }}>{copilot.onerilen_paket.isim} — {copilot.onerilen_paket.fiyat}</div>
              {(Array.isArray(copilot.onerilen_paket.neden) ? copilot.onerilen_paket.neden : []).map((n, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: C.text }}>{n}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.yellow, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: C.bg, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Bir Sonraki Adım</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.bg }}>{copilot.bir_sonraki_adim}</div>
            </div>
          </div>
        )}

        {/* GÖRÜŞME */}
        {activeTab === "gorusme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Görüşmede bu soruları sor — her biri bir ihtiyacı ortaya çıkarır</div>
            {copilot.gorusmede_sor.map((item, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.blue, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 5 }}>{item.soru}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Amaç: {item.amac}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: `${C.purple}0D`, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: 14, marginTop: 6 }}>
              <div style={{ fontSize: 10, color: C.purple, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Upsell Zamanı</div>
              <div style={{ fontSize: 13, color: C.text }}>{copilot.upsell_zamani}</div>
            </div>
          </div>
        )}

        {/* MAİLLER */}
        {activeTab === "mailler" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CopilotMailBlock title="LinkedIn Mesajı" subtitle="Teaser açılmadıysa D+3'te gönder" color="#0077B5" subject={null} content={copilot.linkedin_mesaji} />
            <CopilotMailBlock title="D+3 Takip Maili" subtitle="Teaser gönderildi, 3 gün geçti, açılmadı" color={C.yellow} subject={copilot.followup_mail_d3.konu} content={copilot.followup_mail_d3.icerik} />
            <CopilotMailBlock title="D+7 Takip Maili" subtitle="Açıldı ama dönüş yok — daha acil ton" color={C.red} subject={copilot.followup_mail_d7.konu} content={copilot.followup_mail_d7.icerik} />
          </div>
        )}

        {/* İTİRAZLAR */}
        {activeTab === "itirazlar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Görüşmede karşılaşacağın itirazlar ve hazır cevaplar</div>
            {copilot.itirazlar.map((item, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: `${C.red}0D`, borderBottom: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.red }}>"{item.itiraz}"</span>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: C.green, fontSize: 14, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{item.cevap}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onStart} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 16px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <MessageSquare style={{ width: 12, height: 12 }} /> Yeniden Üret
        </button>
      </div>
    </div>
  );
}

// ─── Inline EmailSendForm component ──────────────────────────────────────────
function EmailSendForm({
  dealId,
  initialVars,
  initialTemplateId,
  onTemplateChange,
  onVarsChange,
  toEmail,
  toName,
  onClose,
}: {
  dealId: number;
  initialVars: Record<string, string>;
  initialTemplateId: string;
  onTemplateChange: (v: string) => void;
  onVarsChange: (v: Record<string, string>) => void;
  toEmail: string;
  toName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [vars, setVars] = useState(initialVars);

  const { data: templates = [] } = useQuery<Array<{ id: number; name: string; variables: string[] }>>({
    queryKey: ["email-templates"],
    queryFn: () => fetch("/api/admin-panel/email-templates", { credentials: "include" }).then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/emails/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: templateId ? parseInt(templateId) : undefined,
          toEmail,
          toName: toName || undefined,
          vars,
          relatedType: "deal",
          relatedId: dealId,
        }),
      }).then(r => r.json()),
    onSuccess: (data: { ok?: boolean; error?: string }) => {
      qc.invalidateQueries({ queryKey: ["email-history"] });
      onClose();
      if (data.ok) toast({ title: "E-posta gönderildi" });
      else toast({ title: "Gönderilemedi", description: data.error, variant: "destructive" });
    },
  });

  const selected = templates.find(t => t.id === parseInt(templateId));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Şablon</Label>
        <Select value={templateId} onValueChange={v => { setTemplateId(v); onTemplateChange(v); setVars(initialVars); }}>
          <SelectTrigger><SelectValue placeholder="Şablon seç..." /></SelectTrigger>
          <SelectContent>
            {templates.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-0.5">
        <div>Alıcı: <span className="font-medium text-slate-700">{toEmail}</span></div>
        {toName && <div>Ad: <span className="font-medium text-slate-700">{toName}</span></div>}
      </div>

      {selected && selected.variables.length > 0 && (
        <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
          <p className="text-xs font-medium text-slate-600">Değişkenler</p>
          <div className="grid grid-cols-2 gap-2">
            {selected.variables.map(v => (
              <div key={v} className="space-y-1">
                <Label className="text-xs font-mono text-blue-600">{`{{${v}}}`}</Label>
                <Input
                  className="h-7 text-xs"
                  value={vars[v] ?? ""}
                  onChange={e => { const nv = { ...vars, [v]: e.target.value }; setVars(nv); onVarsChange(nv); }}
                  placeholder={v}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !templateId}>
          {sendMutation.isPending ? "Gönderiliyor..." : "Gönder"}
        </Button>
      </DialogFooter>
    </div>
  );
}
