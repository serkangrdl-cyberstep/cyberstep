import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Iletisim() {
  const { toast } = useToast();
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    toast({ title: "Mesajınız iletildi", description: "En kısa sürede size geri döneceğiz." });
    setForm({ name: "", email: "", company: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl font-bold mb-4">İletişim</h1>
          <p className="text-slate-400 text-lg">Sorularınız için bize ulaşın</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold mb-6">İletişim Bilgileri</h2>
            <div className="space-y-6">
              {[
                { icon: Mail, label: "E-posta", value: settings?.["contact.email"] ?? "info@cyberstep.io" },
                { icon: Phone, label: "Telefon", value: settings?.["contact.phone"] ?? "+90 212 000 00 00" },
                { icon: MapPin, label: "Adres", value: settings?.["contact.address"] ?? "İstanbul, Türkiye" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">{label}</div>
                    <div className="font-medium">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-xl">
              <h3 className="font-semibold mb-2">Hızlı Değerlendirme</h3>
              <p className="text-sm text-muted-foreground mb-4">Ücretsiz Mini Değerlendirme ile hemen başlayın, 5 dakikada sonuçlarınızı görün.</p>
              <a href="/assessment/start" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Hemen Başla
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">Mesaj Gönderin</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmet Yılmaz" required />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ahmet@sirket.com" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Firma Adı</Label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Şirketinizin adı" />
              </div>
              <div className="space-y-2">
                <Label>Mesajınız</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Nasıl yardımcı olabiliriz?" className="min-h-[140px]" required />
              </div>
              <Button type="submit" disabled={sending} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Gönderiliyor..." : "Mesaj Gönder"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
