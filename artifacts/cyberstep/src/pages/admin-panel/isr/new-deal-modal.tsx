import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Sparkles, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ParsedDeal {
  customerCompany?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  vendorName?: string;
  productKeywords?: string;
  quantity?: string;
  priority: string;
  aiSummary: string;
  aiPriorityReason: string;
  isCompetitiveDeal: boolean;
}

interface Vendor { id: number; displayName: string; name: string; }
interface Customer { id: number; companyName: string; contactName?: string; email?: string; phone?: string; }

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: "Düşük",   color: "bg-slate-100 text-slate-600" },
  normal: { label: "Normal",  color: "bg-blue-100 text-blue-700" },
  high:   { label: "Yüksek",  color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Acil",    color: "bg-red-100 text-red-700 font-semibold" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewDealModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [requestText, setRequestText] = useState("");
  const [parsed, setParsed] = useState<ParsedDeal | null>(null);
  const [form, setForm] = useState<Partial<ParsedDeal & { vendorId?: number; customerId?: number }>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["isr-vendors"],
    queryFn: () => fetch("/api/admin-panel/isr/vendors", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["isr-customers"],
    queryFn: () => fetch("/api/admin-panel/isr/customers", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin-panel/isr/deals/parse", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestText }),
      });
      if (!r.ok) throw new Error("Parse hatası");
      return r.json() as Promise<ParsedDeal>;
    },
    onSuccess: (data) => {
      setParsed(data);
      const matchedVendor = vendors.find(v =>
        data.vendorName && (
          v.displayName.toLowerCase().includes(data.vendorName.toLowerCase()) ||
          data.vendorName.toLowerCase().includes(v.name.toLowerCase())
        )
      );
      const matchedCustomer = customers.find(c =>
        data.customerCompany &&
        c.companyName.toLowerCase().includes(data.customerCompany.toLowerCase())
      );
      setForm({
        ...data,
        vendorId: matchedVendor?.id,
        customerId: matchedCustomer?.id,
        customerCompany: matchedCustomer?.companyName ?? data.customerCompany,
        contactName: matchedCustomer?.contactName ?? data.contactName,
        contactEmail: matchedCustomer?.email ?? data.contactEmail,
        contactPhone: matchedCustomer?.phone ?? data.contactPhone,
      });
      setStep("review");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin-panel/isr/deals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, requestText, intakeChannel: "manual" }),
      });
      if (!r.ok) throw new Error("Deal oluşturulamadı");
      return r.json();
    },
    onSuccess: () => {
      onCreated();
      handleClose();
    },
  });

  function handleClose() {
    setStep("input");
    setRequestText("");
    setParsed(null);
    setForm({});
    setShowAdvanced(false);
    onClose();
  }

  function upd(key: string, val: string | number | undefined) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const priority = (form.priority ?? "normal") as string;
  const prio = PRIORITY_MAP[priority] ?? PRIORITY_MAP["normal"];

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-600" />
            Yeni Deal Aç
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Müşteri talebi veya toplantı notunu yaz
              </Label>
              <Textarea
                placeholder={`Örn: "ABC Teknoloji Ahmet Bey aradı, 50 adet FortiGate 100F istiyor. Q3 bütçesi var ama rakiple de konuşuyor. Fiyat hassas."`}
                value={requestText}
                onChange={e => setRequestText(e.target.value)}
                rows={5}
                className="resize-none text-sm"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1.5">
                AI metni analiz edip müşteri, ürün, öncelik bilgilerini otomatik çıkaracak.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Vazgec</Button>
              <Button
                onClick={() => parseMutation.mutate()}
                disabled={!requestText.trim() || parseMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {parseMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analiz ediliyor...</>
                  : <><Sparkles className="h-4 w-4 mr-2" /> AI ile Analiz Et</>}
              </Button>
            </div>
            {parseMutation.isError && (
              <p className="text-sm text-red-600">Analiz hatası, lütfen tekrar deneyin.</p>
            )}
          </div>
        )}

        {step === "review" && parsed && (
          <div className="space-y-5">
            {/* AI Summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-emerald-800 font-medium">{parsed.aiSummary}</p>
                  {parsed.isCompetitiveDeal && (
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Rekabetci deal — fiyat stratejisi önemli
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Customer Company */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Müşteri Firma</Label>
                <div className="space-y-1">
                  <Input
                    value={form.customerCompany ?? ""}
                    onChange={e => upd("customerCompany", e.target.value)}
                    placeholder="Firma adı"
                    className="text-sm h-8"
                  />
                  {customers.length > 0 && (
                    <Select
                      value={String(form.customerId ?? "")}
                      onValueChange={v => {
                        const c = customers.find(x => x.id === Number(v));
                        if (c) {
                          setForm(f => ({
                            ...f,
                            customerId: c.id,
                            customerCompany: c.companyName,
                            contactName: c.contactName ?? f.contactName,
                            contactEmail: c.email ?? f.contactEmail,
                            contactPhone: c.phone ?? f.contactPhone,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs text-slate-500">
                        <SelectValue placeholder="Kayıtli müşterilerden sec..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                            {c.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Vendor */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Vendor</Label>
                <Select
                  value={String(form.vendorId ?? "")}
                  onValueChange={v => {
                    const vendor = vendors.find(x => x.id === Number(v));
                    setForm(f => ({ ...f, vendorId: Number(v), vendorName: vendor?.displayName }));
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Vendor sec..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product */}
              <div className="col-span-2">
                <Label className="text-xs text-slate-500 mb-1 block">Ürün / Talep</Label>
                <Input
                  value={form.productKeywords ?? ""}
                  onChange={e => upd("productKeywords", e.target.value)}
                  placeholder="örn: FortiGate 100F x50, 1 yıl destek"
                  className="text-sm h-8"
                />
              </div>

              {/* Priority */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Öncelik</Label>
                <Select value={priority} onValueChange={v => upd("priority", v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {parsed.aiPriorityReason && (
                  <p className="text-xs text-slate-400 mt-1">{parsed.aiPriorityReason}</p>
                )}
              </div>

              {/* Priority badge */}
              <div className="flex items-end pb-1">
                <Badge className={`${prio.color} border-0 text-xs`}>{prio.label}</Badge>
                {parsed.isCompetitiveDeal && (
                  <Badge className="ml-2 bg-orange-100 text-orange-700 border-0 text-xs">Rakip var</Badge>
                )}
              </div>
            </div>

            {/* Advanced — contact details */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                İletişim detayları {showAdvanced ? "gizle" : "göster"}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">İletişim Kişisi</Label>
                    <Input value={form.contactName ?? ""} onChange={e => upd("contactName", e.target.value)} className="text-sm h-8" placeholder="Ad Soyad" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">E-posta</Label>
                    <Input value={form.contactEmail ?? ""} onChange={e => upd("contactEmail", e.target.value)} className="text-sm h-8" placeholder="ornek@firma.com" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Telefon</Label>
                    <Input value={form.contactPhone ?? ""} onChange={e => upd("contactPhone", e.target.value)} className="text-sm h-8" placeholder="+90 5xx..." />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-between pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep("input")}>
                Geri
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Vazgec</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !form.customerCompany}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {createMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Kaydediliyor...</>
                    : "Deal Oluştur"}
                </Button>
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-600">Deal oluşturulamadı. Lütfen tekrar deneyin.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
