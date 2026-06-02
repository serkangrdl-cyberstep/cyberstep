import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Webhook, Building2, Plus, Pencil, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountingSettings {
  id: number;
  provider: string;
  webhook_url: string | null;
  auto_sync_on_create: boolean;
  auto_sync_on_paid: boolean;
  auto_sync_on_cancel: boolean;
  last_sync_at: string | null;
  error_count: number;
}

interface BankAccount {
  id: number;
  currency: string;
  bank_name: string;
  iban: string;
  account_name: string;
  is_default: boolean;
}

const PROVIDERS = [
  { value: "none", label: "Entegrasyon yok" },
  { value: "logo", label: "Logo Yazılım" },
  { value: "mikro", label: "Mikro" },
  { value: "netsis", label: "Netsis" },
  { value: "uyumsoft", label: "Uyumsoft" },
  { value: "custom", label: "Özel Webhook" },
];

const CURRENCIES = [
  { value: "TRY", label: "TRY — Türk Lirası" },
  { value: "USD", label: "USD — Amerikan Doları" },
  { value: "EUR", label: "EUR — Euro" },
];

const CURRENCY_COLORS: Record<string, string> = {
  TRY: "bg-red-500/10 text-red-400 border-red-500/20",
  USD: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EUR: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface BankFormState {
  currency: string;
  bank_name: string;
  iban: string;
  account_name: string;
  is_default: boolean;
}

const EMPTY_BANK: BankFormState = { currency: "TRY", bank_name: "", iban: "", account_name: "", is_default: false };

function BankAccountDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: BankFormState;
  onSave: (data: BankFormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BankFormState>(initial);
  const set = (k: keyof BankFormState, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.bank_name ? "Hesabı Düzenle" : "Yeni Banka Hesabı"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-slate-300">Para Birimi</Label>
            <Select value={form.currency} onValueChange={v => set("currency", v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Banka Adı</Label>
            <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="Ziraat Bankası" />
          </div>
          <div>
            <Label className="text-slate-300">IBAN</Label>
            <Input className="bg-slate-800 border-slate-700 text-white mt-1 font-mono" value={form.iban} onChange={e => set("iban", e.target.value)} placeholder="TR00 0000 0000 0000 0000 0000 00" />
          </div>
          <div>
            <Label className="text-slate-300">Hesap Adı</Label>
            <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={form.account_name} onChange={e => set("account_name", e.target.value)} placeholder="CyberStep Ltd." />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300 text-sm">Varsayılan hesap</span>
            <Switch checked={form.is_default} onCheckedChange={v => set("is_default", v)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-slate-700" onClick={onClose}>Vazgec</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onSave(form)} disabled={saving || !form.bank_name || !form.iban || !form.account_name}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminMuhasebe() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useQuery<AccountingSettings>({
    queryKey: ["/api/crm/accounting"],
    queryFn: () => fetch("/api/crm/accounting", { credentials: "include" }).then(r => r.json()),
  });

  const { data: bankAccounts = [], isLoading: banksLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: () => fetch("/api/bank-accounts", { credentials: "include" }).then(r => r.json()),
  });

  const [acctForm, setAcctForm] = useState<Partial<AccountingSettings & { webhookSecret: string }>>({});
  const merged = { ...settings, ...acctForm };

  const [showBankDialog, setShowBankDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  const saveSetting = useMutation({
    mutationFn: () => fetch("/api/crm/accounting", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: merged.provider,
        webhookUrl: merged.webhook_url,
        webhookSecret: (acctForm as Record<string, unknown>)["webhookSecret"],
        autoSyncOnCreate: merged.auto_sync_on_create,
        autoSyncOnPaid: merged.auto_sync_on_paid,
        autoSyncOnCancel: merged.auto_sync_on_cancel,
      }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/accounting"] }); setAcctForm({}); toast({ title: "Ayarlar kaydedildi" }); },
  });

  const testWebhook = useMutation({
    mutationFn: () => fetch("/api/crm/accounting/test", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: merged.webhook_url, webhookSecret: (acctForm as Record<string, unknown>)["webhookSecret"] }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.ok) toast({ title: `Webhook test basarili (HTTP ${d.status})` });
      else toast({ title: `Webhook test basarisiz: ${d.error ?? d.status}`, variant: "destructive" });
    },
  });

  const createBank = useMutation({
    mutationFn: (data: BankFormState) => fetch("/api/bank-accounts", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Hata"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] }); setShowBankDialog(false); toast({ title: "Banka hesabi eklendi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const updateBank = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BankFormState }) => fetch(`/api/bank-accounts/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error("Hata"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] }); setEditingBank(null); toast({ title: "Hesap guncellendi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const deleteBank = useMutation({
    mutationFn: (id: number) => fetch(`/api/bank-accounts/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] }); toast({ title: "Hesap silindi" }); },
  });

  if (settingsLoading) return <AdminLayout title="Muhasebe Entegrasyonu"><div className="text-slate-400 text-center py-20">Yukleniyor...</div></AdminLayout>;

  return (
    <AdminLayout title="Muhasebe Entegrasyonu" description="Fatura webhook senkronizasyonu ve banka hesap ayarlari">
      <div className="space-y-6">

        {/* Accounting Software */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Muhasebe Yazilimi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Entegrasyon</Label>
              <Select value={merged.provider ?? "none"} onValueChange={v => setAcctForm(p => ({ ...p, provider: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {merged.provider && merged.provider !== "none" && (
              <>
                <div>
                  <Label className="text-slate-300">Webhook URL</Label>
                  <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={merged.webhook_url ?? ""} onChange={e => setAcctForm(p => ({ ...p, webhook_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-slate-300">Webhook Secret (opsiyonel)</Label>
                  <Input type="password" className="bg-slate-800 border-slate-700 text-white mt-1" onChange={e => setAcctForm(p => ({ ...p, webhookSecret: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="space-y-3">
                  {[
                    { key: "auto_sync_on_create" as const, label: "Fatura olusturulunca goncer" },
                    { key: "auto_sync_on_paid" as const, label: "Odeme alininca goncer" },
                    { key: "auto_sync_on_cancel" as const, label: "Iptal edilince goncer" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">{label}</span>
                      <Switch checked={merged[key] ?? true} onCheckedChange={v => setAcctForm(p => ({ ...p, [key]: v }))} />
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="border-slate-700" onClick={() => testWebhook.mutate()} disabled={testWebhook.isPending}>
                  Test Et
                </Button>
              </>
            )}
            {settings?.last_sync_at && (
              <p className="text-slate-500 text-xs">Son senkronizasyon: {new Date(settings.last_sync_at).toLocaleString("tr-TR")}</p>
            )}
            {(settings?.error_count ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <XCircle className="h-3 w-3" /> {settings?.error_count} basarisiz senkronizasyon
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => saveSetting.mutate()} disabled={saveSetting.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> {saveSetting.isPending ? "Kaydediliyor..." : "Entegrasyon Kaydet"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bank Accounts */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Banka Hesaplari
            </CardTitle>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => setShowBankDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Hesap Ekle
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-xs mb-4">Bu bilgiler PDF faturalarda odeme bolumunde gosterilir. Birden fazla para birimi icin farkli hesap ekleyebilirsiniz.</p>
            {banksLoading ? (
              <p className="text-slate-500 text-sm">Yukleniyor...</p>
            ) : bankAccounts.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                <Building2 className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Henuz banka hesabi eklenmemis</p>
                <Button size="sm" variant="outline" className="border-slate-700 mt-3" onClick={() => setShowBankDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Ilk Hesabi Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bankAccounts.map(acct => (
                  <div key={acct.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700">
                    <Badge variant="outline" className={`text-xs shrink-0 ${CURRENCY_COLORS[acct.currency] ?? "bg-slate-700 text-slate-300 border-slate-600"}`}>
                      {acct.currency}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{acct.bank_name}</span>
                        {acct.is_default && (
                          <span className="flex items-center gap-1 text-amber-400 text-xs">
                            <Star className="h-3 w-3" /> Varsayilan
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{acct.account_name}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5 break-all">{acct.iban}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingBank(acct)}
                        className="text-slate-500 hover:text-slate-300 transition-colors"
                        title="Duzenle"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Bu hesabi silmek istediginize emin misiniz?")) deleteBank.mutate(acct.id); }}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* New Bank Dialog */}
      <BankAccountDialog
        open={showBankDialog}
        onClose={() => setShowBankDialog(false)}
        initial={EMPTY_BANK}
        onSave={(data) => createBank.mutate(data)}
        saving={createBank.isPending}
      />

      {/* Edit Bank Dialog */}
      {editingBank && (
        <BankAccountDialog
          open={!!editingBank}
          onClose={() => setEditingBank(null)}
          initial={{
            currency: editingBank.currency,
            bank_name: editingBank.bank_name,
            iban: editingBank.iban,
            account_name: editingBank.account_name,
            is_default: editingBank.is_default,
          }}
          onSave={(data) => updateBank.mutate({ id: editingBank.id, data })}
          saving={updateBank.isPending}
        />
      )}
    </AdminLayout>
  );
}
