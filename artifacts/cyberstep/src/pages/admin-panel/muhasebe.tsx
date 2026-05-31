import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, Webhook, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountingSettings {
  id: number;
  provider: string;
  webhook_url: string | null;
  auto_sync_on_create: boolean;
  auto_sync_on_paid: boolean;
  auto_sync_on_cancel: boolean;
  bank_name: string | null;
  bank_iban: string | null;
  bank_account_name: string | null;
  last_sync_at: string | null;
  error_count: number;
}

const PROVIDERS = [
  { value: "none", label: "Entegrasyon yok" },
  { value: "logo", label: "Logo Yazılım" },
  { value: "mikro", label: "Mikro" },
  { value: "netsis", label: "Netsis" },
  { value: "uyumsoft", label: "Uyumsoft" },
  { value: "custom", label: "Özel Webhook" },
];

export default function AdminMuhasebe() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AccountingSettings>({
    queryKey: ["/api/crm/accounting"],
    queryFn: () => fetch("/api/crm/accounting", { credentials: "include" }).then(r => r.json()),
  });

  const [form, setForm] = useState<Partial<AccountingSettings & { webhookSecret: string }>>({});
  const merged = { ...settings, ...form };

  const save = useMutation({
    mutationFn: () => fetch("/api/crm/accounting", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: merged.provider, webhookUrl: merged.webhook_url, webhookSecret: (form as Record<string, unknown>)["webhookSecret"], bankName: merged.bank_name, bankIban: merged.bank_iban, bankAccountName: merged.bank_account_name, autoSyncOnCreate: merged.auto_sync_on_create, autoSyncOnPaid: merged.auto_sync_on_paid, autoSyncOnCancel: merged.auto_sync_on_cancel }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crm/accounting"] }); setForm({}); toast({ title: "Ayarlar kaydedildi" }); },
  });

  const test = useMutation({
    mutationFn: () => fetch("/api/crm/accounting/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: merged.webhook_url, webhookSecret: (form as Record<string, unknown>)["webhookSecret"] }) }).then(r => r.json()),
    onSuccess: (d) => { if (d.ok) toast({ title: `Webhook test başarılı (HTTP ${d.status})` }); else toast({ title: `Webhook test başarısız: ${d.error ?? d.status}`, variant: "destructive" }); },
  });

  if (isLoading) return <AdminLayout title="Muhasebe Entegrasyonu"><div className="text-slate-400 text-center py-20">Yükleniyor...</div></AdminLayout>;

  return (
    <AdminLayout title="Muhasebe Entegrasyonu" description="Fatura webhook senkronizasyonu ve banka ayarları">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Provider */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Muhasebe Yazılımı</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Entegrasyon</Label>
              <Select value={merged.provider ?? "none"} onValueChange={v => setForm(p => ({ ...p, provider: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {merged.provider !== "none" && (
              <>
                <div>
                  <Label className="text-slate-300">Webhook URL</Label>
                  <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={merged.webhook_url ?? ""} onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-slate-300">Webhook Secret (opsiyonel)</Label>
                  <Input type="password" className="bg-slate-800 border-slate-700 text-white mt-1" onChange={e => setForm(p => ({ ...p, webhookSecret: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="space-y-3">
                  {[
                    { key: "auto_sync_on_create" as const, label: "Fatura oluşturulunca gönder" },
                    { key: "auto_sync_on_paid" as const, label: "Ödeme alınınca gönder" },
                    { key: "auto_sync_on_cancel" as const, label: "İptal edilince gönder" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">{label}</span>
                      <Switch checked={merged[key] ?? true} onCheckedChange={v => setForm(p => ({ ...p, [key]: v }))} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-slate-700" onClick={() => test.mutate()} disabled={test.isPending}>
                    Test Et
                  </Button>
                </div>
              </>
            )}
            {settings?.last_sync_at && (
              <p className="text-slate-500 text-xs">Son senkronizasyon: {new Date(settings.last_sync_at).toLocaleString("tr-TR")}</p>
            )}
            {(settings?.error_count ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <XCircle className="h-3 w-3" /> {settings?.error_count} başarısız senkronizasyon
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Banka Bilgileri</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-400 text-xs">Bu bilgiler PDF faturalarda ödeme bölümünde gösterilir.</p>
            <div>
              <Label className="text-slate-300">Banka Adı</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={merged.bank_name ?? ""} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="Ziraat Bankası" />
            </div>
            <div>
              <Label className="text-slate-300">IBAN</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1 font-mono" value={merged.bank_iban ?? ""} onChange={e => setForm(p => ({ ...p, bank_iban: e.target.value }))} placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </div>
            <div>
              <Label className="text-slate-300">Hesap Adı</Label>
              <Input className="bg-slate-800 border-slate-700 text-white mt-1" value={merged.bank_account_name ?? ""} onChange={e => setForm(p => ({ ...p, bank_account_name: e.target.value }))} placeholder="CyberStep Ltd." />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => save.mutate()} disabled={save.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> {save.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </AdminLayout>
  );
}
