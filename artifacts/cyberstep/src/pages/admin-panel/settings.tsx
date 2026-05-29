import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Globe, Phone, Mail, MapPin, FileText, Cookie, Scale, Shield, ToggleLeft, ToggleRight, CheckCircle, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

interface ExternalService {
  name: string; category: string; always: boolean; active: boolean; desc: string; alacart?: boolean;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin-panel/settings", { credentials: "include" }).then(r => r.json()),
  });

  const { data: extServices } = useQuery<ExternalService[]>({
    queryKey: ["admin-ext-services"],
    queryFn: async () => {
      const r = await fetch("/api/admin-panel/settings/services", { credentials: "include" });
      if (!r.ok) throw new Error("Yetkisiz");
      return r.json();
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch("/api/admin-panel/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      toast({ title: "Kaydedildi", description: "Site ayarları güncellendi." });
    },
    onError: () => toast({ title: "Hata", description: "Kaydetme başarısız.", variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return null;

  const SERVICE_TOGGLES = [
    { key: "service.domain_scan",    label: "Alan Adı Tarama",          desc: "SPF/DMARC/SSL/MX/DKIM tarama servisini etkinleştirir" },
    { key: "service.shadow_it",      label: "Gölge BT Tespiti",         desc: "Web sitesi üzerindeki üçüncü taraf servisleri tespit eder" },
    { key: "service.hibp",           label: "Veri Sızıntısı Kontrolü",  desc: "HIBP (Have I Been Pwned) ile e-posta sızıntısı tarar" },
    { key: "service.dnsbl",          label: "Kara Liste Kontrolü",      desc: "Alan adının spam/kara listelerinde olup olmadığını kontrol eder" },
    { key: "service.customer_portal",label: "Müşteri Portalı",          desc: "Müşterilerin /giris ve /raporlarim sayfalarına erişimini açar" },
    { key: "service.full_assessment",label: "Tam Değerlendirme (55 soru)",desc: "Ücretli 55 soruluk tam değerlendirme modülünü etkinleştirir" },
  ];

  const togVal = (key: string) => (form[key] ?? "1") === "1";
  const toggleService = (key: string) => set(key, togVal(key) ? "0" : "1");

  return (
    <AdminLayout title="Site Ayarları" description="Hakkımızda, İletişim, KVKK ve yasal sayfaları düzenleyin">
      <div className="max-w-4xl">
        <Tabs defaultValue="about">
          <TabsList className="bg-slate-800 border-slate-700 mb-6 flex-wrap h-auto gap-1 p-1">
            {[
              { value: "services", label: "Servisler" },
              { value: "about",   label: "Hakkımızda" },
              { value: "contact", label: "İletişim" },
              { value: "kvkk",    label: "KVKK" },
              { value: "terms",   label: "Kullanım Koşulları" },
              { value: "privacy", label: "Gizlilik" },
              { value: "cookie",  label: "Çerez" },
              { value: "footer",  label: "Footer" },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value}
                className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="services">
            <div className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-400" /> Servis Yönetimi
                  </CardTitle>
                  <p className="text-slate-400 text-sm mt-1">Platforma ait özellikleri ve servisleri etkinleştirin veya devre dışı bırakın.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SERVICE_TOGGLES.map(({ key, label, desc }) => {
                    const on = togVal(key);
                    return (
                      <div key={key} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{label}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                        </div>
                        <button
                          onClick={() => toggleService(key)}
                          className={`ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${on ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600"}`}
                        >
                          {on ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {on ? "Aktif" : "Pasif"}
                        </button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-emerald-400" /> Bağlı Dış Servisler
                  </CardTitle>
                  <p className="text-slate-400 text-sm mt-1">
                    Alan adı tarama motorunda kullanılan dış API ve veri kaynaklarının bağlantı durumu.
                    API anahtarı gerektiren servisler ortam değişkenlerinden okunur.
                  </p>
                </CardHeader>
                <CardContent>
                  {!extServices ? (
                    <div className="text-slate-500 text-sm py-4 text-center">Yükleniyor...</div>
                  ) : (
                    <div className="space-y-2">
                      {(["AI", "İtibar", "Tehdit", "E-posta", "Altyapı", "İletişim"] as const).map(cat => {
                        const items = extServices.filter(s => s.category === cat);
                        if (items.length === 0) return null;
                        return (
                          <div key={cat}>
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2 mt-4 first:mt-0">{cat}</p>
                            <div className="space-y-1.5">
                              {items.map(svc => (
                                <div key={svc.name} className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                                  {svc.active
                                    ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    : <XCircle className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-sm font-medium ${svc.active ? "text-white" : "text-slate-500"}`}>{svc.name}</span>
                                      {svc.always
                                        ? <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Anahtarsız</span>
                                        : svc.alacart
                                          ? <span className={`text-xs px-1.5 py-0.5 rounded ${svc.active ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-amber-500/5 text-amber-600 border border-amber-700/30"}`}>
                                              {svc.active ? "A-la-cart (Aktif)" : "A-la-cart"}
                                            </span>
                                          : <span className={`text-xs px-1.5 py-0.5 rounded ${svc.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                                              {svc.active ? "API Anahtarı Bağlı" : "API Anahtarı Yok"}
                                            </span>}
                                    </div>
                                    <p className="text-slate-500 text-xs mt-0.5">{svc.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="about">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" /> Hakkımızda İçeriği</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Başlık</Label>
                  <Input value={form["about.title"] ?? ""} onChange={e => set("about.title", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İçerik</Label>
                  <Textarea value={form["about.content"] ?? ""} onChange={e => set("about.content", e.target.value)} className="bg-slate-700 border-slate-600 text-white min-h-[200px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Phone className="h-5 w-5 text-emerald-400" /> İletişim Bilgileri</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "contact.email",   label: "E-posta", icon: Mail },
                  { key: "contact.phone",   label: "Telefon", icon: Phone },
                  { key: "contact.address", label: "Adres",   icon: MapPin },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</Label>
                    <Input value={form[key] ?? ""} onChange={e => set(key, e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kvkk">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><FileText className="h-5 w-5 text-emerald-400" /> KVKK Aydınlatma Metni</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-slate-300">KVKK Metni</Label>
                  <Textarea value={form["kvkk.content"] ?? ""} onChange={e => set("kvkk.content", e.target.value)} className="bg-slate-700 border-slate-600 text-white min-h-[300px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Scale className="h-5 w-5 text-emerald-400" /> Kullanım Koşulları</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                  Kullanım Koşulları metni kod içinde bölümler halinde tanımlıdır. Aşağıda son güncelleme tarihini değiştirebilirsiniz.
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Son Güncelleme Tarihi</Label>
                  <Input type="date" value={form["terms.lastUpdated"] ?? "2025-01-01"} onChange={e => set("terms.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-400" /> Gizlilik Politikası</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                  Gizlilik Politikası metni KVKK/GDPR uyumlu şekilde kod içinde tanımlıdır. Aşağıda son güncelleme tarihini değiştirebilirsiniz.
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Son Güncelleme Tarihi</Label>
                  <Input type="date" value={form["privacy.lastUpdated"] ?? "2025-01-01"} onChange={e => set("privacy.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cookie">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Cookie className="h-5 w-5 text-emerald-400" /> Çerez Politikası</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                  Çerez kategorileri ve tablo içerik kod içinde tanımlıdır. Son güncelleme tarihini güncelleyebilirsiniz.
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Son Güncelleme Tarihi</Label>
                  <Input type="date" value={form["cookie.lastUpdated"] ?? "2025-01-01"} onChange={e => set("cookie.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="footer">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" /> Footer Bilgileri</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "footer.company", label: "Şirket Adı" },
                  { key: "footer.tagline", label: "Slogan" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-slate-300">{label}</Label>
                    <Input value={form[key] ?? ""} onChange={e => set(key, e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
