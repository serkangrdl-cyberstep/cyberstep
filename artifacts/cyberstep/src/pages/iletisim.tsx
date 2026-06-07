import { useQuery } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Iletisim() {
  usePageMeta({
    title: "İletişim | CyberStep.io",
    description: "CyberStep.io ile iletişime geçin. Siber güvenlik değerlendirmesi, kurumsal çözümler ve destek için bize ulaşın.",
    keywords: "cyberstep iletişim, siber güvenlik destek, cyberstep.io",
    canonicalPath: "/iletisim",
  });
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
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Sunucu hatası");
      }
      toast({ title: "Mesajınız iletildi", description: "En kısa sürede size geri döneceğiz." });
      setForm({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      toast({ title: "Gönderim başarısız", description: err instanceof Error ? err.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const email = settings?.["contact.email"] ?? "info@cyberstep.io";

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
            <div className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">E-posta</div>
                <a href={`mailto:${email}`} className="font-medium hover:text-primary transition-colors">{email}</a>
              </div>
            </div>

            <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl">
              <h3 className="font-semibold mb-2">Hızlı Değerlendirme</h3>
              <p className="text-sm text-muted-foreground mb-4">Ücretsiz Mini Değerlendirme ile hemen başlayın, 5 dakikada sonuçlarınızı görün.</p>
              <a href="/assessment/start" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Hemen Başla
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">Bize Ulaşın</h2>
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
                <Label>Firma Adı <span className="text-muted-foreground text-xs">(isteğe bağlı)</span></Label>
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
