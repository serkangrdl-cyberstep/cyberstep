import { Link } from "wouter";
import { Shield, CheckCircle, ArrowRight, Building2, Layers, Zap, Globe, Lock, Users, BarChart3, HeadphonesIcon, CalendarCheck } from "lucide-react";
import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Kurumsal() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Enterprise Supplier Risk Management | CyberStep.io" : "Kurumsal Tedarikçi Risk Yönetimi | CyberStep.io",
    description: lang === "en" ? "Continuous supplier cyber risk monitoring for enterprise procurement and risk teams: portfolio scoring, drop alerts, PDF reports and API." : "Kurumsal satın alma ve risk ekipleri için sürekli tedarikçi siber risk izleme: portföy skoru, düşüş uyarıları, PDF raporu ve API.",
    canonicalPath: "/kurumsal",
  });

  const [form, setForm] = useState({ name: "", company: "", title: "", email: "", phone: "", employees: "", notes: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/public/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "kurumsal" }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  const DIFFERENTIATORS = [
    { icon: Globe, title: lang === "en" ? "Turkey-Specific Intelligence" : "Türkiye'ye Özgü İstihbarat", desc: lang === "en" ? "USOM correlation, KVKK context and Turkey sector benchmarks. What global tools can't do." : "USOM korelasyonu, KVKK bağlamı ve Türkiye sektör kıyaslaması. Global araçların yapamadığı şey." },
    { icon: Layers, title: lang === "en" ? "Supplier Portfolio" : "Tedarikçi Portföyü", desc: lang === "en" ? "Add suppliers one by one or by CSV, tag their criticality and see the critical ones at risk first." : "Tedarikçileri tek tek ya da CSV ile ekleyin, kritiklik seviyesini işaretleyin, riskteki kritik tedarikçileri öne çıkarın." },
    { icon: Zap, title: lang === "en" ? "Continuous Monitoring & Alerts" : "Sürekli İzleme ve Uyarı", desc: lang === "en" ? "Suppliers are re-scanned automatically. A score drop triggers an e-mail alert. Not a one-time assessment." : "Tedarikçiler otomatik yeniden taranır. Skor düşüşünde e-posta uyarısı gelir. Tek seferlik değerlendirme değil." },
    { icon: Lock, title: lang === "en" ? "No Supplier Cooperation Needed" : "Tedarikçiden İzin Gerekmez", desc: lang === "en" ? "Scores come from external, passive scanning of public data. You see the risk without sending a questionnaire." : "Skor, kamuya açık verinin dış ve pasif taranmasından gelir. Anket göndermeden riski görürsünüz." },
    { icon: BarChart3, title: lang === "en" ? "Audit-Ready Reporting" : "Denetime Hazır Raporlama", desc: lang === "en" ? "A portfolio PDF report for KVKK, BDDK and internal audit files." : "KVKK, BDDK ve iç denetim dosyaları için portföy PDF raporu." },
    { icon: HeadphonesIcon, title: lang === "en" ? "Risk Score API" : "Risk Skoru API", desc: lang === "en" ? "Feed supplier scores directly into your procurement and risk systems." : "Tedarikçi skorlarını satın alma ve risk sistemlerinize doğrudan aktarın." },
  ];

  const FEATURES = lang === "en" ? [
    "500+ suppliers in one portfolio",
    "Everything in Professional",
    "Risk Score API access",
    "Critical finding and risk escalation alerts",
    "Supplier self-assessment questionnaire",
    "Portfolio PDF report (KVKK / Law 7545)",
    "Sector benchmark and percentile",
    "Custom contract and SLA",
  ] : [
    "500+ tedarikçilik portföy",
    "Profesyonel paketteki her şey",
    "Risk Skoru API erişimi",
    "Kritik bulgu ve risk artışı uyarıları",
    "Tedarikçi öz-değerlendirme anketi",
    "Portföy PDF raporu (KVKK / 7545)",
    "Sektör kıyaslaması ve yüzdelik dilim",
    "Özel sözleşme ve SLA",
  ];

  const TIMELINE = lang === "en" ? [
    { day: "Day 1", title: "Portfolio Setup", desc: "Upload your supplier list by CSV and mark critical suppliers." },
    { day: "Day 1", title: "First Scores", desc: "Every supplier is scanned; you get a ranked risk list." },
    { day: "Week 1", title: "Alerts & Reports", desc: "E-mail alerts are active; first portfolio PDF report for your files." },
    { day: "Month 1+", title: "Continuous Monitoring", desc: "Automatic re-scans, API integration." },
  ] : [
    { day: "Gün 1", title: "Portföy Kurulumu", desc: "Tedarikçi listesini CSV ile yükleyin, kritik tedarikçileri işaretleyin." },
    { day: "Gün 1", title: "İlk Skorlar", desc: "Her tedarikçi taranır; risk sırasına göre liste hazır olur." },
    { day: "Hafta 1", title: "Uyarılar ve Rapor", desc: "E-posta uyarıları aktif; dosyalarınız için ilk portföy PDF raporu." },
    { day: "Ay 1+", title: "Sürekli İzleme", desc: "Otomatik yeniden tarama, API entegrasyonu." },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
              <Building2 className="h-4 w-4" />
              {lang === "en" ? "Enterprise" : "Kurumsal"}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              {lang === "en" ? <>Continuous Supplier Risk Monitoring.<br /><span className="text-emerald-400">In Turkish. Built for Turkey.</span></> : <>Sürekli Tedarikçi Risk İzleme.<br /><span className="text-emerald-400">Türkçe. Türkiye'ye Özel.</span></>}
            </h1>
            <p className="text-slate-300 text-lg mb-4 leading-relaxed">
              {lang === "en" ? "See the cyber risk of your suppliers without asking them: portfolio scoring, drop alerts, audit reports and API. Designed for enterprise procurement and risk teams." : "Tedarikçilerinizin siber riskini onlara sormadan görün: portföy skoru, düşüş uyarıları, denetim raporu ve API. Kurumsal satın alma ve risk ekipleri için tasarlandı."}
            </p>
            <p className="text-slate-400 text-sm mb-8">
              {lang === "en" ? "An alternative to SecurityScorecard or BitSight's English enterprise pricing. With Turkey-specific intelligence." : "SecurityScorecard veya BitSight'ın İngilizce kurumsal fiyatlandırmasına alternatif. Türkiye'ye özgü istihbarat ile."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="#demo-form"
                className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-base"
              >
                {lang === "en" ? "Request a Demo" : "Demo Talep Et"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <Link
                href="/fiyatlar"
                className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors text-base"
              >
                {lang === "en" ? "Pricing Comparison" : "Fiyat Karşılaştırması"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">{lang === "en" ? "Global Tools vs CyberStep" : "Global Araçlar vs CyberStep"}</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {lang === "en" ? "Global tools speak English to large enterprise customers. CyberStep speaks Turkish to companies of every size in Turkey." : "Global araçlar büyük kurumsal müşteriye İngilizce konuşur. CyberStep Türkiye'nin her ölçekteki şirketine Türkçe konuşur."}
            </p>
          </div>

          {/* Comparison table */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-16">
            <div className="grid grid-cols-4 bg-slate-50 dark:bg-slate-800/50 border-b text-sm font-semibold">
              <div className="px-4 py-3 text-slate-500 border-r">{lang === "en" ? "Feature" : "Özellik"}</div>
              <div className="px-4 py-3 text-slate-400 border-r text-center">SecurityScorecard</div>
              <div className="px-4 py-3 text-slate-400 border-r text-center">BitSight</div>
              <div className="px-4 py-3 text-emerald-600 text-center">CyberStep</div>
            </div>
            {(lang === "en" ? [
              ["Turkish interface", false, false, true],
              ["KVKK integration", false, false, true],
              ["USOM correlation", false, false, true],
              ["Turkey sector benchmarks", false, false, true],
              ["Risk estimation in TRY", false, false, true],
            ] : [
              ["Türkçe arayüz", false, false, true],
              ["KVKK entegrasyonu", false, false, true],
              ["USOM korelasyonu", false, false, true],
              ["Türkiye sektör benchmark", false, false, true],
              ["TL bazında risk tahmini", false, false, true],
            ]).map(([feature, ss, bs, cs], i) => (
              <div key={i} className="grid grid-cols-4 border-b last:border-0 text-sm">
                <div className="px-4 py-3 text-foreground border-r font-medium">{feature as string}</div>
                <div className="px-4 py-3 text-center border-r">{ss ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</div>
                <div className="px-4 py-3 text-center border-r">{bs ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</div>
                <div className="px-4 py-3 text-center">{cs ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-slate-300">—</span>}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-6 space-y-3">
                <div className="h-11 w-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">{lang === "en" ? "What's Included in the Enterprise Package" : "Kurumsal Paketin İçeriği"}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 bg-card border rounded-xl px-5 py-4">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Onboarding Timeline */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">{lang === "en" ? "Onboarding Process" : "Onboarding Süreci"}</h2>
            <p className="text-muted-foreground mt-3">{lang === "en" ? "We start delivering value from day one." : "İlk günden itibaren değer üretmeye başlıyoruz."}</p>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border md:left-1/2" />
            <div className="space-y-10">
              {TIMELINE.map((item, i) => (
                <div key={i} className={`flex gap-6 items-start ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                  <div className="hidden md:block w-1/2" />
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold z-10 relative">
                      {i + 1}
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-5 flex-1">
                    <p className="text-xs text-emerald-600 font-semibold mb-1">{item.day}</p>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo-form" className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <CalendarCheck className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-3">{lang === "en" ? "Request a Demo" : "Demo Talep Edin"}</h2>
            <p className="text-slate-400">
              {lang === "en" ? "We arrange a personalized demo meeting. We review your supplier list and show how CyberStep scores it." : "Size özel bir demo toplantısı ayarlıyoruz. Mevcut altyapınızı inceleyip CyberStep'in nasıl entegre olacağını gösteriyoruz."}
            </p>
          </div>

          {sent ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{lang === "en" ? "Your request has been received." : "Talebiniz alındı."}</h3>
              <p className="text-slate-400">{lang === "en" ? "We will reach you within 1 business day." : "En geç 1 iş günü içinde size ulaşacağız."}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Full Name *" : "Ad Soyad *"}</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder={lang === "en" ? "John Smith" : "Mehmet Yılmaz"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Title" : "Ünvan"}</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="IT Director / CISO" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Company *" : "Şirket *"}</label>
                <input required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder={lang === "en" ? "Company Name Inc." : "Şirket Adı A.Ş."} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Corporate Email *" : "Kurumsal E-posta *"}</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder={lang === "en" ? "john@company.com" : "mehmet@sirket.com.tr"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Phone" : "Telefon"}</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="+90 5XX XXX XX XX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Employee Count" : "Çalışan Sayısı"}</label>
                <select value={form.employees} onChange={e => setForm(f => ({ ...f, employees: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">{lang === "en" ? "Select" : "Seçin"}</option>
                  <option value="50-250">50–250</option>
                  <option value="250-1000">250–1.000</option>
                  <option value="1000+">1.000+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{lang === "en" ? "Notes / Questions" : "Notlar / Sorularınız"}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                  placeholder={lang === "en" ? "Current security infrastructure, priority needs..." : "Mevcut güvenlik altyapısı, öncelikli ihtiyaçlar..."} />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-4 rounded-lg transition-colors text-base">
                {sending ? (lang === "en" ? "Sending..." : "Gönderiliyor...") : (lang === "en" ? "Request Demo" : "Demo Talep Et")}
              </button>
              <p className="text-xs text-center text-slate-500">{lang === "en" ? "Your data is only used to contact you. Never shared with third parties." : "Verileriniz yalnızca sizinle iletişim kurmak için kullanılır. Üçüncü taraflarla paylaşılmaz."}</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
