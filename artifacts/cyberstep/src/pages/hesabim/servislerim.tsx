import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Shield, CheckCircle, Clock, XCircle, Package, ExternalLink,
  ArrowRight, AlertCircle, ShoppingCart, Loader2, ChevronDown, ChevronUp,
  Settings, Server, Globe, X, Check, Lock, CreditCard, RefreshCw, Ban,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";
import { useCart } from "@/contexts/cart-context";

interface OnboardingStep {
  key: string;
  label: string;
  side: "customer" | "admin";
  status: "pending" | "done" | "skipped";
}

interface ServiceSubscription {
  id: number;
  serviceSlug: string;
  serviceLabel: string;
  status: string;
  billingCycle: string;
  amountPaid: string | null;
  startedAt: string;
  expiresAt: string | null;
  contactName: string;
  companyName: string;
  email: string;
  iyzicoCardUserKey?: string | null;
  iyzicoCardToken?: string | null;
  paymentRef?: string | null;
}

interface CatalogItem {
  slug: string;
  label: string;
  shortDescription: string;
  icon: string;
  category: string;
  monthlyPriceTl: string;
  priceTl: string | null;
  serviceType: string | null;
  isActive: boolean;
  isSelfService: boolean | null;
}

interface MyServiceItem {
  subscription: ServiceSubscription;
  catalog: CatalogItem | null;
  config: Record<string, unknown>;
  onboardingSteps: OnboardingStep[];
  onboardingProgress: number;
}

interface CatalogService {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  serviceType: string | null;
  priceTl: string | null;
  priceTlAnnual: string | null;
  monthlyPriceTl: string;
  category: string;
  icon: string;
  isSelfService: boolean | null;
  isActive: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: "Aktif", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  pending: { label: "Beklemede", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  expired: { label: "Suresi Doldu", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
  cancelled: { label: "Iptal", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  suspended: { label: "Askida", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  assessment: "Degerlendirme",
  ai_service: "AI Servis",
  monitoring: "Izleme",
  soc: "SOC",
  consulting: "Danismanlik",
  bundle: "Paket",
};

// ──────────────────────────────────────────────────────────────────────────────
// Service config forms
// ──────────────────────────────────────────────────────────────────────────────

function FortinetConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">FortiManager URL ve API credentials giriniz. Gelismis ayarlar icin sayfanin altindaki linki kullanin.</p>
      <div>
        <Label className="text-slate-300 text-xs">FortiManager URL</Label>
        <Input value={config["url"] ?? ""} onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://fortimanager.sirket.com" className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">API Kullanici Adi</Label>
        <Input value={config["username"] ?? ""} onChange={e => onChange({ ...config, username: e.target.value })}
          placeholder="api-user" className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">API Sifre / Token</Label>
        <Input type="password" value={config["password"] ?? ""} onChange={e => onChange({ ...config, password: e.target.value })}
          placeholder="••••••••" className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
      </div>
      <Button size="sm" variant="ghost" className="text-xs text-sky-400 hover:text-sky-300 gap-1 px-0"
        onClick={() => window.location.href = "/hesabim/fortinet-entegrasyonu"}>
        <ExternalLink className="w-3 h-3" /> Gelismis Fortinet ayarlari
      </Button>
    </div>
  );
}

function DomainListField({ label, domains, onAdd, onRemove, icon }: {
  label: string; domains: string[]; onAdd: (d: string) => void; onRemove: (d: string) => void;
  icon?: React.ReactNode;
}) {
  const [val, setVal] = useState("");
  function add() {
    const d = val.trim().toLowerCase();
    if (!d || domains.includes(d)) return;
    onAdd(d);
    setVal("");
  }
  return (
    <div>
      <Label className="text-slate-300 text-xs">{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input value={val} onChange={e => setVal(e.target.value)} placeholder="ornek.com"
          className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
          onKeyDown={e => e.key === "Enter" && add()} />
        <Button size="sm" variant="outline" className="border-slate-700 shrink-0" onClick={add}>Ekle</Button>
      </div>
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {domains.map(d => (
            <span key={d} className="flex items-center gap-1 bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded">
              {icon ?? <Globe className="w-3 h-3 text-sky-400" />} {d}
              <button onClick={() => onRemove(d)} className="ml-0.5 text-slate-400 hover:text-red-400"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DnsMonitorConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const domains: string[] = config["domains"] ? JSON.parse(config["domains"]) : [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Izlenecek domain adlarini ekleyin. DNS kayit degisiklikleri aninda bildirilir.</p>
      <DomainListField label="Izlenecek Domainler" domains={domains}
        onAdd={d => onChange({ ...config, domains: JSON.stringify([...domains, d]) })}
        onRemove={d => onChange({ ...config, domains: JSON.stringify(domains.filter(x => x !== d)) })} />
      <div>
        <Label className="text-slate-300 text-xs">Bildirim E-postasi</Label>
        <Input value={config["notificationEmail"] ?? ""} onChange={e => onChange({ ...config, notificationEmail: e.target.value })}
          placeholder="guvenlik@sirket.com" type="email" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
    </div>
  );
}

function CtLogConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const domains: string[] = config["domains"] ? JSON.parse(config["domains"]) : [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Yetkisiz SSL sertifikasi cikartilmasina karsi izlenecek domain whitelist tanimlayin.</p>
      <DomainListField label="Domain Whitelist" domains={domains}
        icon={<Shield className="w-3 h-3 text-emerald-400" />}
        onAdd={d => onChange({ ...config, domains: JSON.stringify([...domains, d]) })}
        onRemove={d => onChange({ ...config, domains: JSON.stringify(domains.filter(x => x !== d)) })} />
      <div>
        <Label className="text-slate-300 text-xs">Uyari E-postasi</Label>
        <Input value={config["alertEmail"] ?? ""} onChange={e => onChange({ ...config, alertEmail: e.target.value })}
          placeholder="guvenlik@sirket.com" type="email" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
    </div>
  );
}

function Ms365ConfigForm() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Microsoft 365 hesabinizi OAuth ile baglayin. Azure AD giris logu ve Defender tehdit uyarilari izlenir.</p>
      <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4 text-center space-y-3">
        <p className="text-sm text-slate-300">Microsoft 365 baglantisi kurmak icin asagidaki butonu kullanin.</p>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          onClick={() => { window.location.href = "/api/ms365/auth"; }}>
          Microsoft 365 ile Baglan
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="text-xs text-sky-400 hover:text-sky-300 gap-1 w-full justify-start px-0"
        onClick={() => window.location.href = "/hesabim/entegrasyonlarim"}>
        <ExternalLink className="w-3 h-3" /> Entegrasyon detaylarina git
      </Button>
    </div>
  );
}

function KvkkConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">KVKK kapsaminda bildirim sorumlusunun iletisim bilgilerini girin.</p>
      <div>
        <Label className="text-slate-300 text-xs">Sorumlu Ad Soyad</Label>
        <Input value={config["contactName"] ?? ""} onChange={e => onChange({ ...config, contactName: e.target.value })}
          placeholder="Ayse Kaya" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Sorumlu E-posta</Label>
        <Input value={config["contactEmail"] ?? ""} onChange={e => onChange({ ...config, contactEmail: e.target.value })}
          placeholder="kvkk@sirket.com" type="email" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Sorumlu Telefon</Label>
        <Input value={config["contactPhone"] ?? ""} onChange={e => onChange({ ...config, contactPhone: e.target.value })}
          placeholder="+90 555 000 00 00" type="tel" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
    </div>
  );
}

function ServiceNowConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">ServiceNow instance URL giriniz. SOC vakalari otomatik ticket'a donusturulur.</p>
      <div>
        <Label className="text-slate-300 text-xs">Instance URL</Label>
        <Input value={config["instanceUrl"] ?? ""} onChange={e => onChange({ ...config, instanceUrl: e.target.value })}
          placeholder="https://sirket.service-now.com" className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
      </div>
      <Button size="sm" variant="ghost" className="text-xs text-sky-400 hover:text-sky-300 gap-1 w-full justify-start px-0"
        onClick={() => window.location.href = "/hesabim/entegrasyonlarim"}>
        <ExternalLink className="w-3 h-3" /> Gelismis ServiceNow ayarlari
      </Button>
    </div>
  );
}

function SocConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">SOC ekibinin kritik vakalarda ulasabilecegi eskalasyon tercihlerinizi ayarlayin.</p>
      <div>
        <Label className="text-slate-300 text-xs">Eskalasyon Telefonu</Label>
        <Input value={config["escalationPhone"] ?? ""} onChange={e => onChange({ ...config, escalationPhone: e.target.value })}
          placeholder="+90 555 000 00 00" type="tel" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Mesai Saati Tercihi</Label>
        <div className="flex gap-2 mt-1">
          {[{ value: "09-18", label: "09:00-18:00" }, { value: "08-20", label: "08:00-20:00" }, { value: "7x24", label: "7/24" }].map(opt => (
            <button key={opt.value} onClick={() => onChange({ ...config, officeHours: opt.value })}
              className={`flex-1 py-2 rounded text-xs font-medium border transition-colors ${
                config["officeHours"] === opt.value ? "bg-sky-600 border-sky-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Eskalasyon E-postasi</Label>
        <Input value={config["escalationEmail"] ?? ""} onChange={e => onChange({ ...config, escalationEmail: e.target.value })}
          placeholder="ciso@sirket.com" type="email" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
    </div>
  );
}

function ObservabilityConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const sources: string[] = config["logSources"] ? JSON.parse(config["logSources"]) : [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Log kaynaklarini ve API endpoint bilgilerinizi tanimlayin.</p>
      <DomainListField label="Log Kaynaklari" domains={sources} icon={<Server className="w-3 h-3 text-indigo-400" />}
        onAdd={s => onChange({ ...config, logSources: JSON.stringify([...sources, s]) })}
        onRemove={s => onChange({ ...config, logSources: JSON.stringify(sources.filter(x => x !== s)) })} />
      <div>
        <Label className="text-slate-300 text-xs">API Endpoint (opsiyonel)</Label>
        <Input value={config["apiEndpoint"] ?? ""} onChange={e => onChange({ ...config, apiEndpoint: e.target.value })}
          placeholder="https://api.sirket.com/logs" className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
      </div>
    </div>
  );
}

function DefaultConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Bu servis icin iletisim bilgilerinizi girin.</p>
      <div>
        <Label className="text-slate-300 text-xs">Iletisim E-postasi</Label>
        <Input value={config["contactEmail"] ?? ""} onChange={e => onChange({ ...config, contactEmail: e.target.value })}
          placeholder="guvenlik@sirket.com" type="email" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
      <div>
        <Label className="text-slate-300 text-xs">Notlar (opsiyonel)</Label>
        <Input value={config["notes"] ?? ""} onChange={e => onChange({ ...config, notes: e.target.value })}
          placeholder="Ek bilgi..." className="mt-1 bg-slate-800 border-slate-700 text-white text-sm" />
      </div>
    </div>
  );
}

function getConfigForm(slug: string, config: Record<string, string>, onChange: (v: Record<string, string>) => void) {
  if (slug.includes("fortinet") || slug.includes("fabric")) return <FortinetConfigForm config={config} onChange={onChange} />;
  if (slug.includes("dns")) return <DnsMonitorConfigForm config={config} onChange={onChange} />;
  if (slug.includes("ct-log") || slug.includes("ct_log") || slug.includes("sertifika")) return <CtLogConfigForm config={config} onChange={onChange} />;
  if (slug.includes("ms365") || slug.includes("microsoft") || slug.includes("azure")) return <Ms365ConfigForm />;
  if (slug.includes("kvkk")) return <KvkkConfigForm config={config} onChange={onChange} />;
  if (slug.includes("servicenow") || slug.includes("service-now")) return <ServiceNowConfigForm config={config} onChange={onChange} />;
  if (slug.includes("soc")) return <SocConfigForm config={config} onChange={onChange} />;
  if (slug.includes("observ") || slug.includes("log")) return <ObservabilityConfigForm config={config} onChange={onChange} />;
  return <DefaultConfigForm config={config} onChange={onChange} />;
}

// ──────────────────────────────────────────────────────────────────────────────
// Service Config Modal
// ──────────────────────────────────────────────────────────────────────────────

function ServiceConfigModal({ item, onClose }: { item: MyServiceItem; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const slug = item.subscription.serviceSlug;
  const [localConfig, setLocalConfig] = useState<Record<string, string>>(
    (item.config as Record<string, string>) ?? {}
  );
  const [showChecklist, setShowChecklist] = useState(true);
  const isMsConfig = slug.includes("ms365") || slug.includes("microsoft") || slug.includes("azure");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customer/service-config/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ config: localConfig }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Kaydedildi", description: "Yapilandirma bilgileri guncellendi." });
      qc.invalidateQueries({ queryKey: ["my-services"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold text-lg">{item.subscription.serviceLabel}</h2>
            <p className="text-slate-400 text-sm mt-0.5">Servis yapilandirmasi</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {getConfigForm(slug, localConfig, setLocalConfig)}

          {!isMsConfig && (
            <Button className="w-full bg-sky-600 hover:bg-sky-500 text-white" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Kaydediliyor...</> : "Kaydet"}
            </Button>
          )}

          {/* Onboarding checklist */}
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <button className="w-full flex items-center justify-between p-3 text-left text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              onClick={() => setShowChecklist(v => !v)}>
              <span className="font-medium flex items-center gap-2">
                Onboarding Adimlari
                <span className="text-[10px] bg-slate-800 text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                  {item.onboardingSteps.filter(s => s.status === "done").length}/{item.onboardingSteps.length}
                </span>
              </span>
              {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showChecklist && (
              <div className="border-t border-slate-800 p-3 space-y-2.5">
                {item.onboardingSteps.map(step => (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {step.status === "done" ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600 bg-slate-800/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${step.status === "done" ? "text-emerald-400 line-through" : "text-slate-300"}`}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {step.side === "admin" ? "CyberStep ekibi tarafindan yapilir" : "Sizin yapmaniz gerekiyor"}
                      </p>
                    </div>
                    {step.side === "admin" && step.status === "pending" && (
                      <Badge className="text-[10px] bg-slate-800 text-slate-500 border-slate-700 shrink-0">Beklemede</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────

interface RenewalCard {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

export default function ServislerimPage() {
  const { data: customer, isLoading: authLoading } = useRequireCustomer();
  const { addItem: cartAdd, removeItem: cartRemove, isInCart: cartIsInCart, itemCount: cartItemCount } = useCart();
  const [, navigate] = useLocation();
  const [selectedItem, setSelectedItem] = useState<MyServiceItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cancel state (#90)
  const [cancelSubId, setCancelSubId] = useState<number | null>(null);

  // Renewal state (#91)
  const [renewSub, setRenewSub] = useState<MyServiceItem["subscription"] | null>(null);
  const [renewMode, setRenewMode] = useState<"stored" | "new">("stored");
  const [renewCard, setRenewCard] = useState<RenewalCard>({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
  const [pendingRenewId, setPendingRenewId] = useState<number | null>(() => {
    const param = new URLSearchParams(window.location.search).get("renew");
    return param ? parseInt(param, 10) : null;
  });

  const cancelMutation = useMutation({
    mutationFn: async (subId: number) => {
      const res = await fetch(`/api/customer/service-subscriptions/${subId}/cancel`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Iptal basarisiz"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Abonelik iptal edildi", description: "Iptal onay e-postasi gonderildi." });
      setCancelSubId(null);
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
    },
    onError: (err: Error) => {
      toast({ title: "Iptal basarisiz", description: err.message, variant: "destructive" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async ({ subId, body }: { subId: number; body: Record<string, string> }) => {
      const res = await fetch(`/api/customer/service-subscriptions/${subId}/renew`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Yenileme basarisiz"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Abonelik yenilendi", description: "Odeme basarili, aboneliginiz uzatildi." });
      setRenewSub(null);
      setRenewCard({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
    },
    onError: (err: Error) => {
      toast({ title: "Odeme basarisiz", description: err.message, variant: "destructive" });
    },
  });

  function handleRenewSubmit() {
    if (!renewSub) return;
    const body: Record<string, string> = {};
    if (renewMode === "new") {
      if (!renewCard.cardHolderName || !renewCard.cardNumber || !renewCard.expireMonth || !renewCard.expireYear || !renewCard.cvc) {
        toast({ title: "Eksik bilgi", description: "Tum kart alanlarini doldurun.", variant: "destructive" });
        return;
      }
      Object.assign(body, renewCard);
    }
    renewMutation.mutate({ subId: renewSub.id, body });
  }

  const { data: myServices = [], isLoading: servicesLoading } = useQuery<MyServiceItem[]>({
    queryKey: ["my-services"],
    queryFn: async () => {
      const res = await fetch("/api/customer/my-services", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customer,
  });

  // Auto-open renewal dialog when navigated from /yenile?token=...
  useEffect(() => {
    if (!pendingRenewId || servicesLoading || myServices.length === 0) return;
    const item = myServices.find(m => m.subscription.id === pendingRenewId);
    if (item) {
      setRenewSub(item.subscription);
      setRenewMode(item.subscription.iyzicoCardUserKey && item.subscription.iyzicoCardToken ? "stored" : "new");
      setPendingRenewId(null);
    }
  }, [pendingRenewId, myServices, servicesLoading]);

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<CatalogService[]>({
    queryKey: ["service-catalog-public"],
    queryFn: async () => {
      const res = await fetch("/api/public/service-catalog");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const ownedSlugs = new Set(myServices.map(m => m.subscription.serviceSlug));
  const activeSubs = myServices.filter(m => m.subscription.status === "active");
  const inactiveSubs = myServices.filter(m => m.subscription.status !== "active");

  const availableServices = catalog
    .filter(s => s.isActive && !ownedSlugs.has(s.slug) && Number(s.priceTl ?? s.monthlyPriceTl) > 0)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {selectedItem && <ServiceConfigModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* Cancel Confirmation (#90) */}
      <AlertDialog open={cancelSubId !== null} onOpenChange={open => { if (!open) setCancelSubId(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Aboneligi iptal et?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Bu islemi geri alamazsiniz. Mevcut donem sonuna kadar erisim devam eder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">Vazgec</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => cancelSubId && cancelMutation.mutate(cancelSubId)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Iptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renewal Modal (#91) */}
      <Dialog open={renewSub !== null} onOpenChange={open => { if (!open) setRenewSub(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-sky-400" /> Abonelik Yenile
            </DialogTitle>
          </DialogHeader>

          {renewSub && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm">
                <p className="font-medium text-white">{renewSub.serviceLabel}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {renewSub.billingCycle === "annual" ? "Yillik" : "Aylik"} &bull; {renewSub.amountPaid ? `${Number(renewSub.amountPaid).toLocaleString("tr-TR")} TL` : ""}
                </p>
              </div>

              {/* Mode tabs */}
              {renewSub.iyzicoCardUserKey && renewSub.iyzicoCardToken ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setRenewMode("stored")}
                    className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${renewMode === "stored" ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                  >
                    <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />Kayitli Kart
                  </button>
                  <button
                    onClick={() => setRenewMode("new")}
                    className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${renewMode === "new" ? "bg-sky-600/20 border-sky-500/50 text-sky-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                  >
                    Yeni Kart
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Kart bilgilerini girin:</p>
              )}

              {(renewMode === "new" || !renewSub.iyzicoCardUserKey) && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-xs">Kart Sahibi Adi</Label>
                    <Input value={renewCard.cardHolderName} onChange={e => setRenewCard(c => ({ ...c, cardHolderName: e.target.value }))}
                      placeholder="AHMET YILMAZ" className="mt-1 bg-slate-800 border-slate-700 text-white text-sm uppercase" />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Kart Numarasi</Label>
                    <Input value={renewCard.cardNumber} onChange={e => setRenewCard(c => ({ ...c, cardNumber: e.target.value }))}
                      placeholder="1234 5678 9012 3456" maxLength={19} className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label className="text-slate-300 text-xs">Son Kullanma (AA/YY)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={renewCard.expireMonth} onChange={e => setRenewCard(c => ({ ...c, expireMonth: e.target.value }))}
                          placeholder="MM" maxLength={2} className="bg-slate-800 border-slate-700 text-white font-mono text-sm w-16 text-center" />
                        <Input value={renewCard.expireYear} onChange={e => setRenewCard(c => ({ ...c, expireYear: e.target.value }))}
                          placeholder="YY" maxLength={2} className="bg-slate-800 border-slate-700 text-white font-mono text-sm w-16 text-center" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs">CVV</Label>
                      <Input value={renewCard.cvc} onChange={e => setRenewCard(c => ({ ...c, cvc: e.target.value }))}
                        placeholder="123" maxLength={4} className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-sm w-20 text-center" />
                    </div>
                  </div>
                </div>
              )}

              {renewMode === "stored" && renewSub.iyzicoCardUserKey && (
                <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 rounded px-3 py-2">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <span>Odeme daha once kullanilan kart ile gerceklestirilecek.</span>
                </div>
              )}

              {renewMutation.isError && (
                <p className="text-xs text-red-400">{(renewMutation.error as Error).message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setRenewSub(null)}>Vazgec</Button>
            <Button onClick={handleRenewSubmit} disabled={renewMutation.isPending} className="bg-sky-600 hover:bg-sky-500 gap-2">
              {renewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Yenile ve Ode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-sky-400" /> Servislerim
          </h1>
          <p className="text-slate-400 mt-1">Aktif servislerinizi ve onboarding ilerlemesini yonetin.</p>
        </div>

        {/* Aktif Servisler */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" /> Aktif Servislerim
          </h2>

          {servicesLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Yukleniyor...</div>
          ) : activeSubs.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Henuz aktif bir servisiniz yok.</p>
                <Button variant="outline" className="mt-4 border-sky-500/30 text-sky-400 hover:bg-sky-500/10" onClick={() => navigate("/fiyatlandirma")}>
                  Servislere Goz At
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeSubs.map(item => {
                const sub = item.subscription;
                const statusInfo = STATUS_MAP[sub.status] ?? STATUS_MAP["active"];
                const StatusIcon = statusInfo.icon;
                const expiresDate = sub.expiresAt ? new Date(sub.expiresAt) : null;
                const pendingCustomerSteps = item.onboardingSteps.filter(s => s.side === "customer" && s.status === "pending");

                return (
                  <Card key={sub.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{sub.serviceLabel}</span>
                            <Badge className={`text-[10px] border gap-1 ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                              {sub.billingCycle === "annual" ? "Yillik" : "Aylik"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>Baslangic: {new Date(sub.startedAt).toLocaleDateString("tr-TR")}</span>
                            {expiresDate && <span>Bitis: {expiresDate.toLocaleDateString("tr-TR")}</span>}
                            {sub.amountPaid && (
                              <span className="font-medium text-slate-300">{Number(sub.amountPaid).toLocaleString("tr-TR")} TL</span>
                            )}
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-slate-500">Onboarding ilerlemesi</span>
                              <span className={`text-[11px] font-medium ${item.onboardingProgress === 100 ? "text-emerald-400" : "text-slate-400"}`}>
                                {item.onboardingProgress}%
                              </span>
                            </div>
                            <Progress value={item.onboardingProgress} className="h-1.5 bg-slate-800" />
                            {pendingCustomerSteps.length > 0 && (
                              <p className="text-[10px] text-yellow-400 mt-1">
                                {pendingCustomerSteps.length} yapilandirma adimi bekliyor
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="border-sky-600/40 text-sky-400 hover:bg-sky-500/10 gap-1.5 text-xs"
                            onClick={() => setSelectedItem(item)}>
                            <Settings className="w-3.5 h-3.5" /> Yapilandir
                          </Button>
                          {sub.serviceSlug.includes("soc") && (
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-sky-400 gap-1 text-xs h-7"
                              onClick={() => navigate("/hesabim/soc")}>
                              <ExternalLink className="w-3 h-3" /> SOC Panosu
                            </Button>
                          )}
                          {sub.serviceSlug.includes("noc") && (
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-sky-400 gap-1 text-xs h-7"
                              onClick={() => navigate("/hesabim/noc")}>
                              <ExternalLink className="w-3 h-3" /> NOC Panosu
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 gap-1 text-xs h-7"
                            onClick={() => setCancelSubId(sub.id)}>
                            <Ban className="w-3 h-3" /> Iptal Et
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Kullanilabilir Servisler */}
        {!catalogLoading && availableServices.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" /> Kullanilabilir Servisler
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableServices.map(svc => {
                const price = svc.priceTl ? Number(svc.priceTl) : Number(svc.monthlyPriceTl);
                const catLabel = CATEGORY_LABELS[svc.category] ?? svc.category;
                const inCart = cartIsInCart(svc.slug);
                return (
                  <Card key={svc.id} className={`bg-slate-900 border-slate-800 hover:border-sky-800/50 transition-all cursor-pointer ${inCart ? "border-sky-700/50" : ""}`}
                    onClick={() => navigate(`/satin-al/${svc.slug}`)}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">{catLabel}</Badge>
                        {inCart ? <ShoppingCart className="w-3.5 h-3.5 text-sky-400" /> : <Lock className="w-3.5 h-3.5 text-slate-600" />}
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-1 leading-snug">{svc.label}</h3>
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{svc.shortDescription}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sky-400 text-sm">{price.toLocaleString("tr-TR")} TL</span>
                          <span className="text-xs text-slate-500 ml-1">
                            {svc.serviceType === "one_time" ? "tek sefer" : svc.serviceType === "annual" ? "/yil" : "/ay"}
                          </span>
                        </div>
                        {inCart ? (
                          <Button size="sm" variant="outline" className="text-xs border-sky-500/40 text-sky-400 gap-1"
                            onClick={e => { e.stopPropagation(); cartRemove(svc.slug); }}>
                            <X className="w-3 h-3" /> Cikar
                          </Button>
                        ) : (
                          <Button size="sm" className="text-xs bg-sky-600 hover:bg-sky-500 gap-1"
                            onClick={e => {
                              e.stopPropagation();
                              cartAdd({ id: svc.id, slug: svc.slug, label: svc.label, monthlyPriceTl: Number(svc.monthlyPriceTl), serviceType: svc.serviceType ?? null });
                            }}>
                            <ShoppingCart className="w-3 h-3" /> Sepete Ekle
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="mt-3 text-center">
              <Button variant="ghost" className="text-slate-400 hover:text-sky-400 text-sm" onClick={() => navigate("/fiyatlandirma")}>
                Tum servisleri gor <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </section>
        )}

        {/* Gecmis Servisler */}
        {inactiveSubs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-500 mb-4">Gecmis Servisler</h2>
            <div className="space-y-2">
              {inactiveSubs.map(item => {
                const sub = item.subscription;
                const statusInfo = STATUS_MAP[sub.status] ?? STATUS_MAP["expired"];
                const StatusIcon = statusInfo.icon;
                return (
                  <Card key={sub.id} className="bg-slate-900/50 border-slate-800/50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{sub.serviceLabel}</span>
                          <Badge className={`text-[10px] border gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                          </Badge>
                        </div>
                        {sub.status === "expired" && (
                          <Button size="sm" variant="outline" className="text-xs border-sky-600/40 text-sky-400 hover:bg-sky-500/10 gap-1.5"
                            onClick={() => {
                              setRenewSub(sub);
                              setRenewMode(sub.iyzicoCardUserKey && sub.iyzicoCardToken ? "stored" : "new");
                              setRenewCard({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
                            }}>
                            <RefreshCw className="w-3 h-3" /> Yenile
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sticky sepet çubuğu — sepette ürün varsa görünür */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-sky-900/95 backdrop-blur border-t border-sky-700/50 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-sky-200">
              <ShoppingCart className="h-4 w-4 text-sky-400" />
              <span><span className="font-bold text-white">{cartItemCount} servis</span> sepetinizde</span>
            </div>
            <button
              onClick={() => navigate("/hesabim/sepet")}
              className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              Sepete Git <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
