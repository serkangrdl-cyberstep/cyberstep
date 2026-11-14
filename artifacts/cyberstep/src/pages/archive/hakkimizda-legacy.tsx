import { Shield, Target, Eye, Lock, ArrowRight, CheckCircle, TrendingUp, Globe, Zap } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Hakkimizda() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en"
      ? "About Us — Why Is Cybersecurity So Lacking in Turkey? | CyberStep.io"
      : "Hakkımızda — Türkiye'de Siber Güvenlik Neden Eksik? | CyberStep.io",
    description: lang === "en"
      ? "CyberStep is the platform that lets Turkish companies see themselves through an attacker's eyes. No technical knowledge required. In Turkish. Action-ready."
      : "CyberStep, Türkiye'deki şirketlerin saldırganın gözüyle kendine bakmasını sağlayan platformdur. Teknik bilgi gerektirmeden. Türkçe. Aksiyona hazır.",
    canonicalPath: "/hakkimizda",
  });

  const PRINCIPLES = [
    {
      icon: Target,
      title: lang === "en" ? "Executive Language" : "Patron Dili",
      desc: lang === "en"
        ? "Not a technical report — financial decision support. Not 'Port 3389 is open' but 'If this gap is not closed, you carry an estimated 180,000–620,000 TL risk.' Reports created for CEOs, in language a CFO can understand."
        : "Teknik rapor değil, finansal karar desteği. 'Port 3389 açık' değil, 'Bu açık kapatılmazsa tahminen 180.000–620,000 TL risk taşıyorsunuz.' CEO için yaratılan raporlar, CFO'nun anlayabileceği dil.",
    },
    {
      icon: Globe,
      title: lang === "en" ? "Turkey-Specific" : "Türkiye'ye Özgü",
      desc: lang === "en"
        ? "USOM correlation, KVKK integration, Turkey sector benchmarks. A platform that understands Turkey's tender processes, audit structure, and sector-specific risk. What global tools don't do."
        : "USOM korelasyonu, KVKK entegrasyonu, Türkiye sektör benchmarkları. Türkiye'deki ihale süreçlerini, denetim yapısını, sektöre özgü riski bilen bir platform. Global araçların yapmadığı şey.",
    },
    {
      icon: Zap,
      title: lang === "en" ? "Find — Send — Verify" : "Bul — Gönder — Doğrula",
      desc: lang === "en"
        ? "We don't just report. We send findings to your security system, and after they're fixed, we re-scan to verify. Closed loop. Weekly delta. Score always up to date."
        : "Sadece rapor vermiyoruz. Bulguyu güvenlik sisteminize iletiyoruz, düzeltilince yeniden tarayıp doğruluyoruz. Kapalı döngü. Haftalık delta. Skor sürekli güncel.",
    },
  ];

  const TIMELINE = [
    {
      year: "2024",
      title: lang === "en" ? "External Attack Surface Analysis" : "Dış Saldırı Yüzeyi Analizi",
      desc: lang === "en" ? "Domain scanning, HIBP, USOM correlation, dark web monitoring." : "Domain taraması, HIBP, USOM korelasyonu, dark web izleme.",
    },
    {
      year: "2025",
      title: lang === "en" ? "AI Security Services" : "AI Güvenlik Servisleri",
      desc: lang === "en" ? "AI tool risk assessment, phishing simulation, KVKK policy auto-update." : "AI araç risk değerlendirmesi, phishing simülasyonu, KVKK politika otogüncelleme.",
    },
    {
      year: "2026",
      title: lang === "en" ? "Continuous Exposure Management" : "Sürekli Maruz Kalma Yönetimi",
      desc: lang === "en" ? "CEM platform — firewall integration, closed-loop verification, board reporting." : "CEM platformu — firewall entegrasyonu, kapalı döngü doğrulama, yönetim kurulu raporlaması.",
    },
    {
      year: "2026",
      title: lang === "en" ? "EU AI Act Compliance Service" : "EU AI Act Uyum Servisi",
      desc: lang === "en" ? "EU AI Act compliance score and certification for Turkish companies exporting to the EU market." : "Türkiye'deki şirketlerin AB pazarına ihracat yapabilmesi için EU AI Act uyum skoru ve sertifikasyonu.",
    },
  ];

  const STATS = [
    { value: "3.5M+", label: lang === "en" ? "Companies in Turkey" : "Türkiye'deki şirket sayısı" },
    { value: "95%", label: lang === "en" ? "Companies without a security team" : "Güvenlik ekibi olmayan şirket oranı" },
    { value: "47M TL", label: lang === "en" ? "Total KVKK fines in 2024" : "2024 yılı KVKK ceza toplamı" },
    { value: "30 min", label: lang === "en" ? "Avg. time to close fixable gaps" : "Kapatılabilecek açıkların ortalama kapanma süresi" },
  ];

  const VALUES = [
    {
      icon: Target,
      title: lang === "en" ? "Mission" : "Misyon",
      desc: lang === "en"
        ? "To give every Turkish company of any size the ability to see themselves through an attacker's eyes and understand risk clearly. No technical knowledge needed. In Turkish. Action-ready."
        : "Her ölçekteki Türk şirketine, saldırganın gözüyle kendine bakma ve riski anlaşılır biçimde görme imkânı. Teknik bilgi gerektirmeden. Türkçe. Aksiyona hazır.",
    },
    {
      icon: Eye,
      title: lang === "en" ? "Vision" : "Vizyon",
      desc: lang === "en"
        ? "An ecosystem where every company in Turkey can see its cyber risk in real time, benchmark against sector averages, and manage it automatically."
        : "Türkiye'nin her şirketinin siber riskini gerçek zamanlı görebildiği, sektörel benchmarklarla karşılaştırabildiği ve otomatik olarak yönetilebildiği bir ekosistem.",
    },
    {
      icon: Lock,
      title: lang === "en" ? "Method" : "Yöntem",
      desc: lang === "en"
        ? "External attack surface + AI security + compliance and certification. Three layers work together. Detect, send, fix, document. Then start again."
        : "Dış saldırı yüzeyi + AI güvenlik + uyum ve sertifikasyon. Üç katman birlikte çalışır. Tespit et, gönder, düzelt, belgele. Sonra yeniden başla.",
    },
  ];

  const COMPARISON = lang === "en" ? [
    ["English, technical reports", "Turkish, executive language — TL-based risk estimate"],
    ["Enterprise pricing ($$$)", "Accessible pricing for companies of all sizes"],
    ["Doesn't know KVKK", "KVKK compliance score, DPA contract template included"],
    ["No USOM correlation", "Turkey-specific threat intelligence"],
    ["AI tool security out of scope", "AI tool monitoring, phishing sim, EU AI Act compliance"],
    ["Detect and report — done", "Find, send, fix, verify — closed loop"],
    ["No EU AI Act support for EU exporters", "EU AI Act compliance score and action plan"],
    ["No Turkish support", "Turkish interface, Turkish report, Turkish support"],
  ] : [
    ["İngilizce, teknik raporlar", "Türkçe, patron dili — TL bazında risk tahmini"],
    ["Kurumsal fiyatlandırma ($$$)", "Her ölçekteki şirkete erişilebilir fiyatlandırma"],
    ["KVKK'yı bilmez", "KVKK uyum skoru, DPA sözleşme şablonu dahil"],
    ["USOM korelasyonu yok", "Türkiye'ye özgü tehdit istihbaratı"],
    ["AI araç güvenliği kapsam dışı", "AI araç izleme, phishing sim, EU AI Act uyumu"],
    ["Tespit et, rapor ver — bitti", "Bul, gönder, düzelt, doğrula — kapalı döngü"],
    ["AB'ye ihraç edenler için EU AI Act desteği yok", "EU AI Act uyum skoru ve aksiyon planı"],
    ["Türkçe destek yok", "Türkçe arayüz, Türkçe rapor, Türkçe destek"],
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            {lang === "en" ? "About Us" : "Hakkımızda"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {lang === "en"
              ? <>Why Is Cybersecurity So<br /><span className="text-emerald-400">Lacking in Turkey?</span></>
              : <>Türkiye'de Siber Güvenlik<br /><span className="text-emerald-400">Neden Bu Kadar Eksik?</span></>}
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            {lang === "en"
              ? "And how we started filling this gap."
              : "Ve biz bu boşluğu nasıl doldurmaya başladık."}
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {lang === "en" ? (
              <>
                <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                  In 2024, 94 companies in Turkey were fined a total of <strong className="text-foreground">47 million TL</strong> in KVKK penalties. The vast majority of these fines stemmed from gaps that required no technical expertise and could be closed in 30 minutes.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                  Here's the problem: <strong className="text-foreground">95 percent</strong> of companies in Turkey have no security team. Existing tools are in English, priced for enterprise scale, and require technical knowledge. Tools built for large corporations don't solve the real problems most companies face.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  CyberStep was founded to fill this gap. Turkish, Turkey-scale, action-focused. Not a one-time audit — continuous management.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                  2024 yılında Türkiye'de 94 firmaya toplam <strong className="text-foreground">47 milyon TL</strong> KVKK cezası kesildi. Bu cezaların büyük çoğunluğu teknik uzman gerektirmeyen, 30 dakikada kapatılabilecek açıklardan kaynaklandı.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                  Problem şu: Türkiye'deki şirketlerin <strong className="text-foreground">yüzde doksan beşinin</strong> güvenlik ekibi yok. Mevcut araçlar İngilizce, kurumsal ölçeğe göre fiyatlandırılmış ve teknik bilgi gerektiriyor. Büyük kurumlar için yapılmış araçlar, çoğu şirketin gerçek sorununu çözmüyor.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  CyberStep bu boşluk için kuruldu. Türkçe, Türkiye ölçeğinde, aksiyona odaklı. Tek seferlik denetim değil, sürekli yönetim.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl md:text-4xl font-bold text-emerald-600 mb-2">{value}</div>
                <div className="text-sm text-muted-foreground leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission / Vision / Method */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-6 space-y-4">
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

      {/* Platform Evolution */}
      <section id="platform-evrimi" className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "Platform Evolution" : "Platform Evrimi"}
            </h2>
            <p className="text-muted-foreground mt-3">
              {lang === "en" ? "Not a single tool — a growing ecosystem." : "Tek bir araç değil, büyüyen bir ekosistem."}
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <div key={i} className="flex gap-6 items-start pl-10 relative">
                  <div className="absolute left-0 h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 bg-card border rounded-xl p-5">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">{item.year}</span>
                    <h3 className="font-semibold mt-3 mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-6 items-start pl-10 relative">
                <div className="absolute left-0 h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                  ...
                </div>
                <div className="flex-1 bg-card border border-dashed rounded-xl p-5">
                  <p className="text-sm text-muted-foreground italic">
                    {lang === "en" ? "Continuing. Join the roadmap." : "Devam ediyor. Roadmap'e girin."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Principles */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "3 Principles That Make CyberStep Different" : "CyberStep'i Farklı Kılan 3 İlke"}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PRINCIPLES.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="bg-card border rounded-xl p-6 space-y-4 relative">
                <div className="absolute -top-3 -left-3 h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="h-11 w-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mt-2">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global vs CyberStep */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "What Global Tools Cannot Do" : "Global Araçlar Ne Yapamıyor?"}
            </h2>
          </div>
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-800/50 border-b">
              <div className="px-6 py-3 text-sm font-semibold text-slate-500 border-r">
                {lang === "en" ? "Global Tools" : "Global Araçlar"}
              </div>
              <div className="px-6 py-3 text-sm font-semibold text-emerald-600">CyberStep</div>
            </div>
            {COMPARISON.map(([old, neo], i) => (
              <div key={i} className="grid grid-cols-2 border-b last:border-0">
                <div className="px-6 py-4 text-sm text-muted-foreground border-r flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  {old}
                </div>
                <div className="px-6 py-4 text-sm text-foreground font-medium flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  {neo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
          <TrendingUp className="h-10 w-10 text-emerald-400 mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold">
            {lang === "en"
              ? <>An attacker scans you in 5 minutes.<br />How long does it take you?</>
              : <>Saldırgan sizi 5 dakikada tarar.<br />Siz kaç dakikada?</>}
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            {lang === "en"
              ? "Start with a free domain scan or the 20-question Mini Assessment. No technical knowledge needed."
              : "Ücretsiz domain taraması veya 20 soruluk Mini Değerlendirme ile başlayın. Teknik bilgi gerekmez."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/assessment/start"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
            >
              {lang === "en" ? "Start Free Assessment" : "Ücretsiz Değerlendirme Başlat"}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/domain-tarama"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors"
            >
              {lang === "en" ? "Scan Your Domain" : "Domain'inizi Tarayın"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
