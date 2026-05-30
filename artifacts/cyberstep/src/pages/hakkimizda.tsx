import { Shield, Target, Users, ArrowRight, TrendingUp, Lock, Eye } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Hakkimizda() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.json()),
    staleTime: 60000,
  });

  const heroTitle = settings?.["about.title"] || "İş sürekliliğinizi koruyun.";
  const heroContent = settings?.["about.content"] || "";

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Hakkımızda
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {heroTitle}
          </h1>
          {heroContent ? (
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
              {heroContent}
            </p>
          ) : (
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              CyberStep.io; KOBİ'lerin fidye saldırısı, veri sızıntısı ve KVKK uyumsuzluk risklerini
              10 dakikada ölçmesini, önceliklendirmesini ve adım adım kapatmasını sağlayan
              yapay zeka destekli bir platformdur.
            </p>
          )}
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <h2 className="text-3xl font-bold text-foreground">İsmin Arkındaki Fikir</h2>
              <p className="text-muted-foreground leading-relaxed">
                Siber güvenlik sıkılaştırmaları kat merdivenini çıkar gibi yapılır — her basamakta
                bir üst seviyeye ulaşırsın. Bir basamağı atlayamazsın, kısamazsın. Ama doğru
                basamakları, doğru sırayla atarsan zirveye ulaşırsın.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Tüm güvenlik önlemlerini bir gecede almanın imkânı yoktur — büyük kurumlar için bile.
                KOBİ'ler için ise yol haritasız bu merdiveni çıkmak neredeyse imkânsızdır.
                CyberStep tam bu boşluğu kapatmak için doğdu.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                İngilizce'de "step" hem <em>adım</em> hem de <em>ayak izi</em> anlamına gelir.
                Bu istemeden ortaya çıkmış bir anlam derinliği değil, bilinçli bir tercih:
                siber güvenlikteki en kritik kavramlardan biri de "dijital ayak izi" —
                yani şirketinizin saldırı yüzeyi. CyberStep, hem güvenlik adımlarınızı
                hem de dijital izinizi yönetir.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">.io</strong> uzantısı ise bilinçli bir sinyal:
                bu bir yerel IT şirketi değil, yapay zeka ve bulut altyapısı üzerine kurulu
                modern bir teknoloji platformu. KOBİ'lere enterprise kalitesinde araçları
                erişilebilir hale getiren bir ürün.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { step: "1. Basamak", title: "Nerede durduğunu bil", desc: "20 soruda risk profilinizi tespit edin. Yapay zeka analiz eder, kişiselleştirilmiş rapor oluşturur." },
                { step: "2. Basamak", title: "Önceliğini belirle", desc: "Hangi açığı önce kapatmanız gerekiyor? Sektörünüze ve ölçeğinize göre sıralı aksiyon planı." },
                { step: "3. Basamak", title: "İlerle ve ölç", desc: "Her adımda güvenlik olgunluğunuz artar ve belgelenir. Müşterilerinize, ortaklarınıza gösterebileceğiniz somut bir kayıt." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 p-5 bg-card border rounded-xl">
                  <div className="shrink-0">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                      {item.step}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Persona */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Kimin için inşa ettik?</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              CyberStep'i tasarlarken aklımızda hep aynı kişi vardı.
            </p>
          </div>
          <div className="bg-card border rounded-2xl p-8 md:p-10 max-w-2xl mx-auto relative">
            <div className="absolute -top-4 left-8">
              <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Hedef Kitlemiz</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-600 dark:text-slate-300">
                E
              </div>
              <div>
                <p className="font-bold text-lg">Emre Bey</p>
                <p className="text-sm text-muted-foreground">45 kişilik üretim firmasının sahibi</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>Muhasebe yazılımı, ERP ve bir e-ticaret sitesi kullanıyor. Çalışanlarından biri sahte e-postaya tıkladı — sisteme fidye yazılımı girdi. Üç gün üretim durdu.</p>
              <p>Bir siber güvenlik firmasını aradı — 3 aylık proje teklifi, büyük bütçe. <em>"Biz o kadar büyük değiliz"</em> deyip kapattı. Ama büyük olmak gerekmiyordu — doğru adımı atmak yeterliydi.</p>
              <p>Müşteri verisini koruyamadığı için KVKK kapsamında soruşturma başladı. Müşteri ilişkisi bitti.</p>
              <p className="text-foreground font-medium pt-2 border-t">
                Emre Bey'in sorunu siber güvenliği bilmemek değildi. Nereden başlayacağını bilmemekti.
              </p>
            </div>
            <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                CyberStep, Emre Bey'e şunu söylüyor:
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                "Önce şu üç açığı kapat. Fidye saldırısının en sık girdiği yol burası. Geri kalanı için zamanın var."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission / Values */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Ne için varız?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Misyon",
                desc: "KOBİ'lerin iş sürekliliğini tehdit eden açıkları — fidye saldırısı, veri sızıntısı, KVKK uyumsuzluğu — teknik jargon olmadan görmelerini ve öncelikli adımları anında almalarını sağlamak.",
              },
              {
                icon: Eye,
                title: "Vizyon",
                desc: "Türkiye'deki her KOBİ'nin siber güvenliği büyük bütçeler beklemeden, nereden başlayacağını bilerek uygulayabildiği bir ekosistem. Güvenlik bir lüks değil, ulaşılabilir bir standart.",
              },
              {
                icon: Lock,
                title: "Yöntem",
                desc: "Yapay zeka destekli Siber Sağlık Karnesi ile uzman incelemesini birleştiren hibrit model. Anında skor, ardından 'önce şunu kapat' formatında öncelik sıralı aksiyon planı.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-6 space-y-4">
                <div className="h-11 w-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition vs Competitors */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Geleneksel danışmanlıktan farkımız</h2>
          </div>
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-800/50 border-b">
              <div className="px-6 py-3 text-sm font-semibold text-slate-500 border-r">Geleneksel Yaklaşım</div>
              <div className="px-6 py-3 text-sm font-semibold text-emerald-600">CyberStep.io</div>
            </div>
            {[
              ["Kapsamlı denetim, büyük proje bütçesi", "10 dakikada Siber Sağlık Karnesi, anında skor"],
              ['"Her şeyi düzelt" listesi', '"Önce şu üç açığı kapat" öncelik planı'],
              ["Teknik jargon dolu raporlar", "Jargonsuz, iş etkisiyle açıklanan sade Türkçe analiz"],
              ["Fidye/KVKK riski kör nokta kalır", "Fidye, veri sızıntısı ve KVKK uyumu ayrı ayrı değerlendirme"],
              ["Tek seferlik danışmanlık", "Sürekli olgunluk takibi ve ölçülebilir ilerleme kaydı"],
            ].map(([old, neo], i) => (
              <div key={i} className="grid grid-cols-2 border-b last:border-0">
                <div className="px-6 py-4 text-sm text-muted-foreground border-r flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  {old}
                </div>
                <div className="px-6 py-4 text-sm text-foreground font-medium flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {neo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tagline + CTA */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-6">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">Sloganımız</p>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight">
            Siber güvenlik,<br />adım adım.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Fidye saldırısı, veri sızıntısı, KVKK cezası — üç tehdidin hangisine en açık olduğunuzu
            10 dakikada öğrenin. İlk karne ücretsiz.
          </p>
          <div className="pt-4">
            <Link
              href="/assessment/start"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-base"
            >
              Ücretsiz Siber Sağlık Karnesi Al
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-background border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "3.5M+", label: "Türkiye'deki KOBİ" },
              { value: "%60", label: "Fidye saldırılarında KOBİ payı" },
              { value: "10dk", label: "Siber Sağlık Karnesi süresi" },
              { value: "₺1.8M", label: "Ortalama fidye maliyeti (KOBİ)" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-4xl font-bold text-emerald-600 mb-1">{value}</div>
                <div className="text-sm text-muted-foreground leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About content from admin (if any) */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Target, title: "Odağımız", desc: "İş sürekliliğini tehdit eden üç ana risk: fidye saldırısı, müşteri/çalışan verisi sızıntısı ve KVKK uyumsuzluğu. Bu üçünü öncelik sırasıyla kapatmak, KOBİ'ler için en etkili başlangıç noktasıdır." },
              { icon: Users, title: "Kitlemiz", desc: "1'den 250'ye kadar çalışanı olan, muhasebe yazılımı kullanan perakende satış noktasından imalat tesisine kadar tüm sektörlerden Türkiye'deki KOBİ'ler." },
              { icon: TrendingUp, title: "Yöntemimiz", desc: "Yapay zeka ile üretilen Siber Sağlık Karnesi, uzman ekibimizce doğrulanır. Teknik bilgi gerektirmeyen sorular, iş etkisiyle açıklanan bulgular, uygulanabilir öncelik planı." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border rounded-xl p-6">
                <Icon className="h-8 w-8 text-emerald-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
