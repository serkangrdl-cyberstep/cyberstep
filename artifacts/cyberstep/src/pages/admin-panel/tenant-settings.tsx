import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Building2, Cpu, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/tenant-context";

export default function TenantSettings() {
  const [, navigate] = useLocation();
  const { tenant, refresh } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(tenant?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor ?? "");
  const [aiProvider, setAiProvider] = useState(tenant?.aiProvider ?? "gemini-replit");
  const [aiModel, setAiModel] = useState(tenant?.aiModel ?? "");
  const [aiApiKey, setAiApiKey] = useState("");
  const [quoteTerms, setQuoteTerms] = useState(tenant?.quoteTerms ?? "");
  const [quoteFooter, setQuoteFooter] = useState(tenant?.quoteFooter ?? "");
  const [quoteValidDays, setQuoteValidDays] = useState(String(tenant?.quoteValidDays ?? 30));
  const [imapHost, setImapHost] = useState(tenant?.imapHost ?? "");
  const [imapUser, setImapUser] = useState(tenant?.imapUser ?? "");
  const [imapPass, setImapPass] = useState("");
  const [smtpHost, setSmtpHost] = useState(tenant?.smtpHost ?? "");
  const [smtpUser, setSmtpUser] = useState(tenant?.smtpUser ?? "");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPort, setSmtpPort] = useState(String(tenant?.smtpPort ?? 587));

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Workspace seçilmedi</div>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name, logoUrl, primaryColor, aiProvider, aiModel, quoteTerms,
        quoteFooter, quoteValidDays: parseInt(quoteValidDays),
        imapHost, imapUser, smtpHost, smtpUser, smtpPort: parseInt(smtpPort),
      };
      if (aiApiKey) body.aiApiKey = aiApiKey;
      if (imapPass) body.imapPass = imapPass;
      if (smtpPass) body.smtpPass = smtpPass;

      const r = await fetch(`/api/admin-panel/tenants/${tenant!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Hata", description: d.error, variant: "destructive" }); return; }
      await refresh();
      toast({ title: "Kaydedildi", description: "Workspace ayarlari guncellendi" });
    } finally { setSaving(false); }
  }

  const aiProviderModels: Record<string, string[]> = {
    "gemini-replit": [],
    "gemini": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    "anthropic": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate("/panel")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Workspace Ayarlari</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Firma Bilgileri */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                Firma Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-slate-300 text-sm">Firma Adi</Label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-300 text-sm">Logo URL</Label>
                  <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white" placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-sm">Ana Renk</Label>
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white" placeholder="#10b981" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className="text-slate-400 text-sm">Plan:</div>
                <div className="text-white text-sm font-medium capitalize">{tenant.plan}</div>
                <div className="text-slate-400 text-sm">|</div>
                <div className="text-slate-400 text-sm">Slug:</div>
                <div className="text-slate-400 text-sm font-mono">{tenant.slug}</div>
              </div>
            </CardContent>
          </Card>

          {/* AI Ayarlari */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                AI Ayarlari
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-slate-300 text-sm">AI Saglayici</Label>
                <Select value={aiProvider} onValueChange={setAiProvider}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="gemini-replit" className="text-white">Gemini (Replit — ucretsiz)</SelectItem>
                    <SelectItem value="gemini" className="text-white">Google Gemini (kendi API anahtarim)</SelectItem>
                    <SelectItem value="openai" className="text-white">OpenAI</SelectItem>
                    <SelectItem value="anthropic" className="text-white">Anthropic Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiProvider !== "gemini-replit" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Model</Label>
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Model seciniz" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {(aiProviderModels[aiProvider] ?? []).map(m => (
                          <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">API Anahtari</Label>
                    <Input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white font-mono"
                      placeholder={tenant.aiApiKey ? "••••••••  (degistirmek icin girin)" : "sk-..."} />
                  </div>
                </>
              )}
              {aiProvider === "gemini-replit" && (
                <p className="text-slate-500 text-xs">Replit'in saglayip yonettigi Gemini kredisi kullanilir. API anahtari gerekmez.</p>
              )}
            </CardContent>
          </Card>

          {/* Teklif Ayarlari */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Teklif Ayarlari
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-slate-300 text-sm">Gecerlilik Suresi (gun)</Label>
                <Input type="number" min={1} max={365} value={quoteValidDays} onChange={e => setQuoteValidDays(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white w-32" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300 text-sm">Varsayilan Kosullar</Label>
                <Textarea value={quoteTerms} onChange={e => setQuoteTerms(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white resize-none" rows={3}
                  placeholder="Odeme vadesi: 30 gun. KDV dahildir..." />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300 text-sm">Teklif Alt Bilgisi</Label>
                <Input value={quoteFooter} onChange={e => setQuoteFooter(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Sorulariniz icin: satis@sirket.com" />
              </div>
            </CardContent>
          </Card>

          {/* E-posta / IMAP/SMTP */}
          {tenant.isrEnabled && (
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-400" />
                  E-posta Ayarlari (ISR)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-slate-400 text-xs mb-2">Gelen kutu tarama (IMAP) ve giden posta (SMTP) ayarlari</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">IMAP Sunucu</Label>
                    <Input value={imapHost} onChange={e => setImapHost(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white" placeholder="imap.gmail.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">IMAP Kullanici</Label>
                    <Input value={imapUser} onChange={e => setImapUser(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white" placeholder="satis@sirket.com" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-sm">IMAP Sifre</Label>
                  <Input type="password" value={imapPass} onChange={e => setImapPass(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder={tenant.imapUser ? "••••••••  (degistirmek icin girin)" : ""} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-slate-300 text-sm">SMTP Sunucu</Label>
                    <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white" placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Port</Label>
                    <Input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white" placeholder="587" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">SMTP Kullanici</Label>
                    <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white" placeholder="satis@sirket.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">SMTP Sifre</Label>
                    <Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder={tenant.smtpUser ? "••••••••" : ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Kaydediliyor..." : "Ayarlari Kaydet"}
          </Button>
        </form>
      </div>
    </div>
  );
}
