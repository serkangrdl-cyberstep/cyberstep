import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Shield, Globe, Phone, Mail, MapPin, FileText, Cookie, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";

export default function AdminSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  useRequireAdmin();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin-panel/settings", { credentials: "include" }).then(r => r.json()),
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
      toast({ title: "Kaydedildi", description: "Site ayarlari guncellendi." });
    },
    onError: () => toast({ title: "Hata", description: "Kaydetme basarisiz.", variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Yukleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          <span className="font-bold text-white text-sm">CyberStep Admin</span>
        </div>
        <Button variant="ghost" className="justify-start text-slate-300 hover:text-white mb-2" onClick={() => navigate("/panel")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Genel Bakis
        </Button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <h1 className="text-xl font-bold text-white">Site Ayarlari</h1>
          <p className="text-slate-400 text-sm">Hakkimizda, Iletisim, KVKK ve yasal sayfalari duzenleyin</p>
        </header>

        <div className="p-8 max-w-4xl">
          <Tabs defaultValue="about">
            <TabsList className="bg-slate-800 border-slate-700 mb-6 flex-wrap h-auto gap-1 p-1">
              {[
                { value: "about", label: "Hakkimizda" },
                { value: "contact", label: "Iletisim" },
                { value: "kvkk", label: "KVKK" },
                { value: "terms", label: "Kullanim Kosullari" },
                { value: "privacy", label: "Gizlilik" },
                { value: "cookie", label: "Cerez" },
                { value: "footer", label: "Footer" },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value}
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Hakkimizda */}
            <TabsContent value="about">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" /> Hakkimizda Icerigi</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Baslik</Label>
                    <Input value={form["about.title"] ?? ""} onChange={e => set("about.title", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Icerik</Label>
                    <Textarea value={form["about.content"] ?? ""} onChange={e => set("about.content", e.target.value)} className="bg-slate-700 border-slate-600 text-white min-h-[200px]" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Iletisim */}
            <TabsContent value="contact">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Phone className="h-5 w-5 text-emerald-400" /> Iletisim Bilgileri</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "contact.email", label: "E-posta", icon: Mail },
                    { key: "contact.phone", label: "Telefon", icon: Phone },
                    { key: "contact.address", label: "Adres", icon: MapPin },
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</Label>
                      <Input value={form[key] ?? ""} onChange={e => set(key, e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* KVKK */}
            <TabsContent value="kvkk">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><FileText className="h-5 w-5 text-emerald-400" /> KVKK Aydinlatma Metni</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-slate-300">KVKK Metni</Label>
                    <Textarea value={form["kvkk.content"] ?? ""} onChange={e => set("kvkk.content", e.target.value)} className="bg-slate-700 border-slate-600 text-white min-h-[300px]" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Kullanim Kosullari */}
            <TabsContent value="terms">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Scale className="h-5 w-5 text-emerald-400" /> Kullanim Kosullari</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                    Kullanim Kosullari metni kod icinde bolumler halinde tanimlidir. Asagida son guncelleme tarihini degistirebilirsiniz.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Son Guncelleme Tarihi</Label>
                    <Input type="date" value={form["terms.lastUpdated"] ?? "2025-01-01"} onChange={e => set("terms.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Gizlilik Politikasi */}
            <TabsContent value="privacy">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-400" /> Gizlilik Politikasi</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                    Gizlilik Politikasi metni KVKK/GDPR uyumlu sekilde kod icinde tanimlidir. Asagida son guncelleme tarihini degistirebilirsiniz.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Son Guncelleme Tarihi</Label>
                    <Input type="date" value={form["privacy.lastUpdated"] ?? "2025-01-01"} onChange={e => set("privacy.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cerez Politikasi */}
            <TabsContent value="cookie">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Cookie className="h-5 w-5 text-emerald-400" /> Cerez Politikasi</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-400 text-xs">
                    Cerez kategorileri (Zorunlu / Analitik / Pazarlama) ve tablo icerik kod icinde tanimlidir. Son guncelleme tarihini guncelleyebilirsiniz.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Son Guncelleme Tarihi</Label>
                    <Input type="date" value={form["cookie.lastUpdated"] ?? "2025-01-01"} onChange={e => set("cookie.lastUpdated", e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Footer */}
            <TabsContent value="footer">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-400" /> Footer Bilgileri</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: "footer.company", label: "Sirket Adi" },
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
              {saveMutation.isPending ? "Kaydediliyor..." : "Degisiklikleri Kaydet"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
