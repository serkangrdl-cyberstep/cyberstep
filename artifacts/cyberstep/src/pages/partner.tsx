import { Link } from "wouter";
import { Shield, CheckCircle, ArrowRight, HandshakeIcon, Percent, Award, Globe, BarChart3, Users, Briefcase, ChevronRight } from "lucide-react";
import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Partner() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Partner Program | CyberStep.io" : "Partner Programı | CyberStep.io",
    description: lang === "en" ? "White-label cybersecurity platform for KVKK consultants, IT firms and insurance brokers. Referral commission, partner certificate and dedicated support." : "KVKK danışmanları, IT firmalar ve sigorta aracıları için white-label siber güvenlik platformu. Referral komisyonu, partner sertifikası ve dedike destek.",
    canonicalPath: "/partner",
  });

  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", type: "", notes: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "partner" }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  const PARTNER_TYPES = [
    {
      icon: Briefcase,
      title: "KVKK / Siber Güvenlik Danışmanı",
      desc: "Müşterilerinize white-label platform sunun. Siz danışmanlığı yapın, CyberStep teknolojiyi sağlasın.",
      badge: "En Popüler",
    },
    {
      icon: Globe,
      title: "IT Çözüm Firması",
      desc: "Hizmet portföyünüze siber güvenlik risk analizi ekleyin. API entegrasyonu ile kendi ürününüze katıştırın.",
      badge: null,
    },
    {
      icon: Shield,
      title: "Sigorta Aracısı",
      desc: "Siber sigorta tekliflerinizi CyberStep risk skoru ile destekleyin. Müşteri riski nesnel olarak belgeleyin.",
      badge: null,
    },
    {
      icon: Users,
      title: "Muhasebe / Mali Müşavir",
      desc: "Müşterilerinizin KVKK uyum durumunu ve siber risk maliyetini somutlaştırın. Yüksek katma değerli hizmet.",
      badge: null,
    },
  ];

  const BENEFITS = [
    { icon: Percent, title: "Referral Komisyonu", desc: "Yönlendirdiğiniz her müşteriden yıllık abonelik değerinin %20'si. Süresiz, her yenileme dahil." },
    { icon: Globe, title: "White-Label Portal", desc: "Kendi markanız, logonuz ve renginizle özelleştirilmiş müşteri portalı. CyberStep altyapısı arkada çalışır." },
    { icon: Award, title: "Partner Sertifikası", desc: "CyberStep Yetkili Partner sertifikası. Müşterilere güven sinyali, rekabet avantajı." },
    { icon: BarChart3, title: "Partner Panosu", desc: "Yönlendirdiğiniz müşterilerin risk skorlarını, komisyon durumunuzu ve raporlarını tek ekrandan takip edin." },
    { icon: Users, title: "Dedike Partner Yöneticisi", desc: "Sorularınız için doğrudan ulaşabileceğiniz bir hesap yöneticisi. Onboarding eğitimi dahil." },
    { icon: CheckCircle, title: "Satış Materyalleri", desc: "Hazır sunum, teklif şablonu ve müşteri başarı hikayeleri. Sıfırdan başlamak yok." },
  ];

  const HOW_IT_WORKS = [
    { step: "01", title: "Başvur", desc: "Aşağıdaki formu doldurun. 2 iş günü içinde sizi arayıp detayları konuşuyoruz." },
    { step: "02", title: "Onboard Ol", desc: "Partner sertifikasyon eğitimi (2 saat), white-label kurulumu, satış materyalleri teslimi." },
    { step: "03", title: "Müşteri Kazan", desc: "Referral linkinizle müşteri yönlendirin veya white-label portalınızla doğrudan sunun." },
    { step: "04", title: "Komisyon Al", desc: "Her aktif abonelikten aylık komisyon otomatik hesaplanır. Şeffaf dashboard ile takip edin." },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
              <HandshakeIcon className="h-4 w-4" />
              Partner Programı
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Siber Güvenliği<br />
              <span className="text-emerald-400">İş Modeline Dönüştürün.</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              KVKK danışmanları, IT çözüm firmaları, sigorta aracıları ve mali müşavirler için white-label siber güvenlik platformu. Siz müşteriyle ilişkiyi yönetin, CyberStep teknolojiyi sağlasın.
            </p>
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">%20</p>
                <p className="text-slate-400 text-sm">Referral Komisyonu</p>
              </div>
              <div className="w-px bg-slate-700 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">White-Label</p>
                <p className="text-slate-400 text-sm">Kendi Markanızla</p>
              </div>
              <div className="w-px bg-slate-700 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">Süresiz</p>
                <p className="text-slate-400 text-sm">Her Yenilemede Komisyon</p>
              </div>
            </div>
            <a
              href="#partner-form"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-base"
            >
              Partner Başvurusu Yap
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Kimler Partner Olabilir?</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Müşterileriniz zaten siber güvenlik sorunuyla karşı karşıya. Çözüm sunmak için artık CyberStep altyapınız var.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PARTNER_TYPES.map(({ icon: Icon, title, desc, badge }) => (
              <div key={title} className="bg-card border rounded-xl p-6 relative">
                {badge && (
                  <span className="absolute top-4 right-4 bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{badge}</span>
                )}
                <div className="h-12 w-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Partner Avantajları</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-5 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Nasıl Çalışır?</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="partner-form" className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-10">
            <HandshakeIcon className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-3">Partner Başvurusu</h2>
            <p className="text-slate-400">2 iş günü içinde sizi arıyoruz.</p>
          </div>

          {sent ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Başvurunuz alındı.</h3>
              <p className="text-slate-400">En geç 2 iş günü içinde size ulaşacağız.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad Soyad *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Ayşe Kaya" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Şirket / İşletme *</label>
                  <input required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Kaya Danışmanlık Ltd." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Partner Türü *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">Seçin</option>
                  <option value="kvkk-danisman">KVKK / Siber Güvenlik Danışmanı</option>
                  <option value="it-firma">IT Çözüm Firması</option>
                  <option value="sigorta">Sigorta Aracısı</option>
                  <option value="mali-musavir">Mali Müşavir / Muhasebeci</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta *</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="ayse@firma.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="+90 5XX XXX XX XX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Beklentileriniz / Sorularınız</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                  placeholder="Kaç müşteriniz var, ne tür hizmetler sunuyorsunuz..." />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-4 rounded-lg transition-colors text-base">
                {sending ? "Gönderiliyor..." : "Başvuruyu Gönder"}
              </button>
              <p className="text-xs text-center text-slate-500">Verileriniz yalnızca sizinle iletişim kurmak için kullanılır.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
