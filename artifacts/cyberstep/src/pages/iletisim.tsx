import { useQuery } from "@tanstack/react-query";
import { Mail, Send, Phone, MapPin, Linkedin, Twitter, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Iletisim() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en" ? "Contact | CyberStep.io" : "İletişim | CyberStep.io",
    description: lang === "en"
      ? "Contact CyberStep.io for cybersecurity assessment, enterprise solutions and support."
      : "CyberStep.io ile iletişime geçin. Siber güvenlik değerlendirmesi, kurumsal çözümler ve destek için bize ulaşın.",
    keywords: "cyberstep contact, cybersecurity support, cyberstep.io",
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
        throw new Error(data.error ?? "Server error");
      }
      toast({
        title: lang === "en" ? "Message sent" : "Mesajınız iletildi",
        description: lang === "en" ? "We'll get back to you as soon as possible." : "En kısa sürede size geri döneceğiz.",
      });
      setForm({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      toast({
        title: lang === "en" ? "Send failed" : "Gönderim başarısız",
        description: err instanceof Error ? err.message : (lang === "en" ? "Please try again." : "Lütfen tekrar deneyin."),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const email   = settings?.["contact.email"]   ?? "info@cyberstep.io";
  const phone   = settings?.["contact.phone"]   ?? "";
  const address = settings?.["contact.address"] ?? "";
  const linkedin = settings?.["contact.linkedin"] ?? "";
  const twitter  = settings?.["contact.twitter"]  ?? "";
  const website  = settings?.["contact.website"]  ?? "";

  const contactItems = [
    { icon: Mail,     label: lang === "en" ? "Email" : "E-posta", value: email,    href: `mailto:${email}`,   show: !!email },
    { icon: Phone,    label: lang === "en" ? "Phone" : "Telefon", value: phone,    href: `tel:${phone}`,      show: !!phone },
    { icon: MapPin,   label: lang === "en" ? "Address" : "Adres", value: address,  href: null,                show: !!address },
    { icon: Globe,    label: "Web",                               value: website,   href: website,             show: !!website },
    { icon: Linkedin, label: "LinkedIn",                          value: "LinkedIn", href: linkedin,           show: !!linkedin },
    { icon: Twitter,  label: "X (Twitter)",                       value: "X",       href: twitter,            show: !!twitter },
  ].filter(i => i.show);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl font-bold mb-4">
            {lang === "en" ? "Contact" : "İletişim"}
          </h1>
          <p className="text-slate-400 text-lg">
            {lang === "en" ? "Reach out for your questions" : "Sorularınız için bize ulaşın"}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold mb-6">
              {lang === "en" ? "Contact Information" : "İletişim Bilgileri"}
            </h2>
            <div className="space-y-4 mb-8">
              {contactItems.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">{label}</div>
                    {href ? (
                      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                        className="font-medium hover:text-primary transition-colors">{value}</a>
                    ) : (
                      <span className="font-medium">{value}</span>
                    )}
                  </div>
                </div>
              ))}
              {contactItems.length === 0 && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">{lang === "en" ? "Email" : "E-posta"}</div>
                    <a href="mailto:info@cyberstep.io" className="font-medium hover:text-primary transition-colors">info@cyberstep.io</a>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl">
              <h3 className="font-semibold mb-2">
                {lang === "en" ? "Quick Assessment" : "Hızlı Değerlendirme"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === "en"
                  ? "Start with a free Mini Assessment and see your results in 5 minutes."
                  : "Ücretsiz Mini Değerlendirme ile hemen başlayın, 5 dakikada sonuçlarınızı görün."}
              </p>
              <a href="/assessment/start" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                {lang === "en" ? "Start Now" : "Hemen Başla"}
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">
              {lang === "en" ? "Reach Out to Us" : "Bize Ulaşın"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{lang === "en" ? "Full Name" : "Ad Soyad"}</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={lang === "en" ? "John Smith" : "Ahmet Yılmaz"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{lang === "en" ? "Email" : "E-posta"}</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  {lang === "en" ? "Company Name" : "Firma Adı"}{" "}
                  <span className="text-muted-foreground text-xs">
                    {lang === "en" ? "(optional)" : "(isteğe bağlı)"}
                  </span>
                </Label>
                <Input
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder={lang === "en" ? "Your company name" : "Şirketinizin adı"}
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === "en" ? "Your Message" : "Mesajınız"}</Label>
                <Textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder={lang === "en" ? "How can we help you?" : "Nasıl yardımcı olabiliriz?"}
                  className="min-h-[140px]"
                  required
                />
              </div>
              <Button type="submit" disabled={sending} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {sending
                  ? (lang === "en" ? "Sending..." : "Gönderiliyor...")
                  : (lang === "en" ? "Send Message" : "Mesaj Gönder")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
