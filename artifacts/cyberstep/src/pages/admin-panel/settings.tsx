import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Globe, Phone, Mail, MapPin, FileText, Cookie, Scale, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";

export default function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

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
      toast({ title: "Kaydedildi", description: "Site ayarları güncellendi." });
    },
    onError: () => toast({ title: "Hata", description: "Kaydetme başarısız.", variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return null;

  return (
    <AdminLayout title="Site Ayarları" description="Hakkımızda, İletişim, KVKK ve yasal sayfaları düzenleyin">
      <div className="max-w-4xl">
        <Tabs defaultValue="about">
          <TabsList className="bg-slate-800 border-slate-700 mb-6 flex-wrap h-auto gap-1 p-1">
            {[
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
