import { Link } from "wouter";
import { Shield, CheckCircle, ArrowRight, Building2, Layers, Zap, Globe, Lock, Users, BarChart3, HeadphonesIcon, CalendarCheck } from "lucide-react";
import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Kurumsal() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Enterprise Cybersecurity Platform | CyberStep.io" : "Kurumsal Siber Güvenlik Platformu | CyberStep.io",
    description: lang === "en" ? "Continuous exposure management for mid-size and large enterprises. Firewall integration, white-label, SLA guarantee, enterprise onboarding." : "Orta ve büyük ölçekli şirketler için sürekli maruz kalma yönetimi. Firewall entegrasyonu, white-label, SLA garantisi, kurumsal onboarding.",
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
    { icon: Globe, title: lang === "en" ? "Turkey-Specific Intelligence" : "Türkiye'ye Özgü İstihbarat", desc: lang === "en" ? "USOM correlation, KVKK integration, Turkey sector benchmarks. What global tools can't do." : "USOM korelasyonu, KVKK entegrasyonu, Türkiye sektör benchmarkları. Global araçların yapamadığı şey." },
    { icon: Layers, title: lang === "en" ? "Integration Ecosystem" : "Entegrasyon Ekosistemi", desc: lang === "en" ? "Native integration with Fortinet, Check Point, Palo Alto, QRadar, CrowdStrike. Plugs into your existing infrastructure." : "Fortinet, Check Point, Palo Alto, QRadar, CrowdStrike ile native entegrasyon. Mevcut altyapınıza eklenir." },
    { icon: Lock, title: lang === "en" ? "Closed-Loop Verification" : "Kapalı Döngü Doğrulama", desc: lang === "en" ? "We don't just detect. We relay findings to your security system, and re-scan to verify once resolved." : "Sadece tespit etmiyoruz. Bulguyu güvenlik sisteminize iletiyoruz, düzeltilince yeniden tarayıp doğruluyoruz." },
    { icon: BarChart3, title: lang === "en" ? "Board-Level Reporting" : "Yönetim Kurulu Raporlaması", desc: lang === "en" ? "Alongside the technical report, a financial risk summary presentable to CFO and board of directors. In TRY." : "Teknik raporun yanı sıra CFO ve yönetim kuruluna sunulabilecek finansal risk özeti. TL bazında." },
    { icon: Zap, title: lang === "en" ? "Continuous Exposure Management" : "Sürekli Maruz Kalma Yönetimi", desc: lang === "en" ? "Weekly delta report, automatic re-scanning, instant alerts. Not a one-time assessment — a live platform." : "Haftalık delta raporu, otomatik yeniden tarama, anlık alarm. Tek seferlik değerlendirme değil, canlı platform." },
    { icon: HeadphonesIcon, title: lang === "en" ? "Dedicated Support" : "Dedike Destek", desc: lang === "en" ? "Dedicated account manager for enterprise clients, priority support line and SLA guarantee." : "Kurumsal müşterilere özel hesap yöneticisi, öncelikli destek hattı ve SLA garantisi." },
  ];

  const FEATURES = lang === "en" ? [
    "Unlimited domain and subdomain scanning",
    "Firewall integration (Fortinet, Palo Alto, Check Point)",
    "White-label portal — under your own brand",
    "API access and SIEM integration",
    "Board report (automated, monthly)",
    "AI security services package included",
    "KVKK DPA contract management",
    "Weekly threat intelligence digest",
    "Dedicated account manager",
    "SLA guarantee — 4-hour critical incident response",
    "EU AI Act compliance score and reporting",
    "Multi-user panel — team access",
  ] : [
    "Sınırsız domain ve subdomain taraması",
    "Firewall entegrasyonu (Fortinet, Palo Alto, Check Point)",
    "White-label portal — kendi markanızla",
    "API erişimi ve SIEM entegrasyonu",
    "Yönetim kurulu raporu (otomatik, aylık)",
    "AI güvenlik servisleri paketi dahil",
    "KVKK DPA sözleşme yönetimi",
    "Haftalık tehdit istihbaratı özeti",
    "Dedike hesap yöneticisi",
    "SLA garantisi — 4 saat kritik olay yanıtı",
    "EU AI Act uyum skoru ve raporlaması",
    "Çok kullanıcılı panel — ekip erişimi",
  ];

  const TIMELINE = lang === "en" ? [
    { day: "Day 1", title: "Onboarding & Discovery", desc: "Current infrastructure mapping, integration setup, first full scan." },
    { day: "Week 1", title: "First Risk Reports", desc: "External attack surface report, AI security score, KVKK compliance status." },
    { day: "Week 2", title: "Integration Completion", desc: "Firewall rules synchronized, SIEM alert stream active, team training." },
    { day: "Month 1+", title: "Continuous Monitoring", desc: "Weekly delta report, monthly board summary, quarterly policy update." },
  ] : [
    { day: "Gün 1", title: "Onboarding ve Keşif", desc: "Mevcut altyapı haritalaması, entegrasyon kurulumu, ilk tam tarama." },
    { day: "Hafta 1", title: "İlk Risk Raporları", desc: "Dış saldırı yüzeyi raporu, AI güvenlik skoru, KVKK uyum durumu." },
    { day: "Hafta 2", title: "Entegrasyon Tamamlama", desc: "Firewall kuralları senkronize, SIEM alarm akışı aktif, takım eğitimi." },
    { day: "Ay 1+", title: "Sürekli İzleme", desc: "Haftalık delta raporu, aylık yönetim kurulu özeti, çeyreklik politika güncellemesi." },
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
              {lang === "en" ? <>Continuous Exposure Management.<br /><span className="text-emerald-400">In Turkish. Built for Turkey.</span></> : <>Sürekli Maruz Kalma Yönetimi.<br /><span className="text-emerald-400">Türkçe. Türkiye'ye Özel.</span></>}
            </h1>
            <p className="text-slate-300 text-lg mb-4 leading-relaxed">
              {lang === "en" ? "External attack surface, AI tool security, KVKK compliance, firewall integration and automated reporting — in one platform. Designed for mid-size and large enterprises." : "Dış saldırı yüzeyi, AI araç güvenliği, KVKK uyumu, firewall entegrasyonu ve otomatik raporlama — tek platformda. Orta ve büyük ölçekli şirketler için tasarlandı."}
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
              ["AI tool security", false, false, true],
              ["EU AI Act compliance", false, false, true],
              ["Closed-loop verification", false, false, true],
              ["Turkey sector benchmarks", false, false, true],
              ["Risk estimation in TRY", false, false, true],
            ] : [
              ["Türkçe arayüz", false, false, true],
              ["KVKK entegrasyonu", false, false, true],
              ["USOM korelasyonu", false, false, true],
              ["AI araç güvenliği", false, false, true],
              ["EU AI Act uyumu", false, false, true],
              ["Kapalı döngü doğrulama", false, false, true],
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
              {lang === "en" ? "We arrange a personalized demo meeting. We review your current infrastructure and show how CyberStep integrates." : "Size özel bir demo toplantısı ayarlıyoruz. Mevcut altyapınızı inceleyip CyberStep'in nasıl entegre olacağını gösteriyoruz."}
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
