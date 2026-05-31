import { Shield, Target, Eye, Lock, ArrowRight, CheckCircle, TrendingUp, Globe, Zap } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Hakkimizda() {
  usePageMeta({
    title: "Hakkımızda — Türkiye'de Siber Güvenlik Neden Eksik? | CyberStep.io",
    description: "CyberStep, Türkiye'deki şirketlerin saldırganın gözüyle kendine bakmasını sağlayan platformdur. Teknik bilgi gerektirmeden. Türkçe. Aksiyona hazır.",
    canonicalPath: "/hakkimizda",
    lang: "tr",
  });

  const PRINCIPLES = [
    {
      icon: Target,
      title: "Patron Dili",
      desc: "Teknik rapor değil, finansal karar desteği. 'Port 3389 açık' değil, 'Bu açık kapatılmazsa tahminen 180.000–620.000 TL risk taşıyorsunuz.' CEO için yaratılan raporlar, CFO'nun anlayabileceği dil.",
    },
    {
      icon: Globe,
      title: "Türkiye'ye Özgü",
      desc: "USOM korelasyonu, KVKK entegrasyonu, Türkiye sektör benchmarkları. Türkiye'deki ihale süreçlerini, denetim yapısını, sektöre özgü riski bilen bir platform. Global araçların yapmadığı şey.",
    },
    {
      icon: Zap,
      title: "Bul — Gönder — Doğrula",
      desc: "Sadece rapor vermiyoruz. Bulguyu güvenlik sisteminize iletiyoruz, düzeltilince yeniden tarayıp doğruluyoruz. Kapalı döngü. Haftalık delta. Skor sürekli güncel.",
    },
  ];

  const TIMELINE = [
    { year: "2024", title: "Dış Saldırı Yüzeyi Analizi", desc: "Domain taraması, HIBP, USOM korelasyonu, dark web izleme." },
    { year: "2025", title: "AI Güvenlik Servisleri", desc: "AI araç risk değerlendirmesi, phishing simülasyonu, KVKK politika otogüncelleme." },
    { year: "2026", title: "Sürekli Maruz Kalma Yönetimi", desc: "CEM platformu — firewall entegrasyonu, kapalı döngü doğrulama, yönetim kurulu raporlaması." },
    { year: "2026", title: "EU AI Act Uyum Servisi", desc: "Türkiye'deki şirketlerin AB pazarına ihracat yapabilmesi için EU AI Act uyum skoru ve sertifikasyonu." },
  ];

  const STATS = [
    { value: "3.5M+", label: "Türkiye'deki şirket sayısı" },
    { value: "%95", label: "Güvenlik ekibi olmayan şirket oranı" },
    { value: "47M TL", label: "2024 yılı KVKK ceza toplamı" },
    { value: "30dk", label: "Kapatılabilecek açıkların ortalama kapanma süresi" },
  ];

  const VALUES = [
    {
      icon: Target,
      title: "Misyon",
      desc: "Her ölçekteki Türk şirketine, saldırganın gözüyle kendine bakma ve riski anlaşılır biçimde görme imkânı. Teknik bilgi gerektirmeden. Türkçe. Aksiyona hazır.",
    },
    {
      icon: Eye,
      title: "Vizyon",
      desc: "Türkiye'nin her şirketinin siber riskini gerçek zamanlı görebildiği, sektörel benchmarklarla karşılaştırabildiği ve otomatik olarak yönetilebildiği bir ekosistem.",
    },
    {
      icon: Lock,
      title: "Yöntem",
      desc: "Dış saldırı yüzeyi + AI güvenlik + uyum ve sertifikasyon. Üç katman birlikte çalışır. Tespit et, gönder, düzelt, belgele. Sonra yeniden başla.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Hakkımızda
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Türkiye'de Siber Güvenlik<br />
            <span className="text-emerald-400">Neden Bu Kadar Eksik?</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Ve biz bu boşluğu nasıl doldurmaya başladık.
          </p>
        </div>
      </section>

      {/* Problem tanımı */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed text-muted-foreground mb-6">
              2024 yılında Türkiye'de 94 firmaya toplam <strong className="text-foreground">47 milyon TL</strong> KVKK cezası kesildi. Bu cezaların büyük çoğunluğu teknik uzman gerektirmeyen, 30 dakikada kapatılabilecek açıklardan kaynaklandı.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground mb-6">
              Problem şu: Türkiye'deki şirketlerin <strong className="text-foreground">yüzde doksan beşinin</strong> güvenlik ekibi yok. Mevcut araçlar İngilizce, kurumsal ölçeğe göre fiyatlandırılmış ve teknik bilgi gerektiriyor. Büyük kurumlar için yapılmış araçlar, orta ölçekli şirketlerin sorununu çözmüyor.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              CyberStep bu boşluk için kuruldu.
            </p>
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

      {/* Platform Evrimi */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Platform Evrimi</h2>
            <p className="text-muted-foreground mt-3">
              Tek bir araç değil, büyüyen bir ekosistem.
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
                  <p className="text-sm text-muted-foreground italic">Devam ediyor. Roadmap'e girin.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 İlke */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">CyberStep'i Farklı Kılan 3 İlke</h2>
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
            <h2 className="text-3xl font-bold">Global Araçlar Ne Yapamıyor?</h2>
          </div>
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-800/50 border-b">
              <div className="px-6 py-3 text-sm font-semibold text-slate-500 border-r">Global Araçlar</div>
              <div className="px-6 py-3 text-sm font-semibold text-emerald-600">CyberStep</div>
            </div>
            {[
              ["İngilizce, teknik raporlar", "Türkçe, patron dili — TL bazında risk tahmini"],
              ["Kurumsal fiyatlandırma ($$$)", "Her ölçekteki şirkete erişilebilir fiyatlandırma"],
              ["KVKK'yı bilmez", "KVKK uyum skoru, DPA sözleşme şablonu dahil"],
              ["USOM korelasyonu yok", "Türkiye'ye özgü tehdit istihbaratı"],
              ["AI araç güvenliği kapsam dışı", "AI araç izleme, phishing sim, EU AI Act uyumu"],
              ["Tespit et, rapor ver — bitti", "Bul, gönder, düzelt, doğrula — kapalı döngü"],
            ].map(([old, neo], i) => (
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
            Saldırgan sizi 5 dakikada tarar.<br />Siz kaç dakikada?
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Ücretsiz domain taraması veya 20 soruluk Mini Değerlendirme ile başlayın. Teknik bilgi gerekmez.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/assessment/start"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
            >
              Ücretsiz Değerlendirme Başlat
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/domain-tarama"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors"
            >
              Domain'inizi Tarayın
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
