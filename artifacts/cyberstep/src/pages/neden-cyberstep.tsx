import { Shield, ArrowRight, Users, Lightbulb, Target, Award, Coffee, Code, Globe } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";

const TEAM = [
  {
    name: "Ahmet Yılmaz",
    role: "Kurucu & CEO",
    bio: "15 yıl kurumsal siber güvenlik ve risk danışmanlığı. Bankacılık ve fintech sektörlerinde 200'den fazla KOBİ değerlendirmesi.",
    icon: Shield,
  },
  {
    name: "Zeynep Kara",
    role: "Kurucu & CTO",
    bio: "Saldırı yüzeyi yönetimi ve tehdit istihbaratı alanında uzman. Açık kaynak güvenlik araçlarına katkı sağlayan aktif araştırmacı.",
    icon: Code,
  },
  {
    name: "Mehmet Demir",
    role: "Ürün & Büyüme",
    bio: "B2B SaaS ürün yönetimi ve Türkiye KOBİ ekosistemi konusunda deneyimli. Kullanıcı merkezli tasarım odaklı.",
    icon: Target,
  },
];

const NAME_STORY = [
  {
    icon: Globe,
    word: "Cyber",
    meaning: "Siber Güvenlik",
    desc: "Dijital tehditlere karşı Türkiye'deki şirketleri korumak. Siber kelimesi hem teknik kapsamı hem de odaklandığımız alanı net biçimde ifade ediyor.",
  },
  {
    icon: ArrowRight,
    word: "Step",
    meaning: "Adım",
    desc: "Güvenlik karmaşık görünebilir. Biz onu adım adım ilerlenebilir bir sürece dönüştürüyoruz. Her şirket kendi hızında, doğru sırayla ilerleyebilmeli.",
  },
];

const MILESTONES = [
  {
    period: "2023 Sonbahar",
    title: "Fikir",
    desc: "Küçük bir muhasebe firmasının önlenebilir bir veri ihlali nedeniyle 120.000 TL ceza aldığını gördük. Araçlar vardı — ama hiçbiri Türkçe değildi, hiçbiri KOBİ ölçeğinde değildi.",
  },
  {
    period: "2024 Ocak",
    title: "İlk Prototip",
    desc: "Domain tarama motoru ve ilk 20 soruluk risk değerlendirmesi. 40 KOBİ ile beta testi. Geri bildirim netti: Daha sade, daha Türkçe, daha aksiyona yönelik.",
  },
  {
    period: "2024 Haziran",
    title: "Yayında",
    desc: "CyberStep.io canlıya geçti. İlk 3 ayda 500'den fazla şirket ücretsiz değerlendirme tamamladı.",
  },
  {
    period: "2025",
    title: "AI Güvenlik Servisleri",
    desc: "Yapay zeka araç izleme, phishing simülasyonu ve EU AI Act uyum skoru hizmetleri eklendi. Platform siber güvenliğin ötesine, AI yönetişimine doğru genişledi.",
  },
  {
    period: "2026",
    title: "Sürekli Maruz Kalma Yönetimi",
    desc: "Firewall entegrasyonu, kapalı döngü doğrulama ve yönetim kurulu raporlaması. Tek seferlik denetimden sürekli güvenlik yönetimine geçiş.",
  },
];

const VALUES = [
  {
    icon: Lightbulb,
    title: "Sadelik",
    desc: "Teknik rapor değil, karar desteği. Bir CEO'nun anlayabileceği dilde, somut rakamlarla.",
  },
  {
    icon: Globe,
    title: "Yerellik",
    desc: "KVKK, USOM, Türkiye sektör dinamikleri. Global araçların görmezden geldiği bağlam.",
  },
  {
    icon: Award,
    title: "Kapalı Döngü",
    desc: "Bul, gönder, düzelt, doğrula. Rapor vermekle kalmıyoruz — sonuçlanana kadar takip ediyoruz.",
  },
];

export default function NedenCyberStep() {
  usePageMeta({
    title: "Neden CyberStep? — İsmin Hikayesi ve Ekibimiz | CyberStep.io",
    description: "CyberStep.io adının nereden geldiği, kim tarafından kurulduğu ve Türkiye KOBİ'leri için neden var olduğu. Ekibimizle tanışın.",
    canonicalPath: "/neden-cyberstep",
    lang: "tr",
  });

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Coffee className="h-4 w-4" />
            Hikayemiz
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Neden <span className="text-emerald-400">CyberStep?</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Bir ismin arkasında her zaman bir neden vardır. Bizimkinde iki kelime, bir sorun ve Türkiye'deki yüzbinlerce şirket var.
          </p>
        </div>
      </section>

      {/* İsmin Anlamı */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">İki Kelime, Bir Amaç</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              "CyberStep" ismini seçmeden önce onlarca alternatif değerlendirdik. Bu iki kelimeye yerleşmemizin nedeni basit: ikisi birlikte tam olarak ne yapmak istediğimizi anlatıyor.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {NAME_STORY.map(({ icon: Icon, word, meaning, desc }) => (
              <div key={word} className="bg-card border rounded-2xl p-8 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <Icon className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-foreground tracking-tight">{word}</div>
                    <div className="text-sm font-semibold text-emerald-600">{meaning}</div>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center">
            <p className="text-lg font-medium text-foreground leading-relaxed max-w-2xl mx-auto">
              CyberStep = Siber tehditlere karşı, <span className="text-emerald-600 font-semibold">adım adım</span>, teknik bilgi gerektirmeden, <span className="text-emerald-600 font-semibold">Türkçe</span> ilerleyebilmek.
            </p>
          </div>
        </div>
      </section>

      {/* Neden Var Olduk */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Neden Var Olduk?</h2>
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Türkiye'deki şirketlerin <strong className="text-foreground">yüzde doksan beşinin</strong> güvenlik ekibi yok. Var olan araçlar İngilizce, kurumsal fiyatlandırmalı ve teknik bilgi gerektiriyor. Bu araçlar büyük kurumlar için yapılmış — oysa siber saldırıların hedefinin büyük çoğunluğu KOBİ'ler.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              2024 yılında Türkiye'de 94 firmaya toplam <strong className="text-foreground">47 milyon TL</strong> KVKK cezası kesildi. Bu cezaların büyük çoğunluğu 30 dakikada kapatılabilecek açıklardan kaynaklandı. Araçlar yoktu değil — erişilebilir değildi.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              CyberStep bu boşluk için kuruldu. Türkçe, KOBİ ölçeğinde, aksiyona odaklı. Tek seferlik denetim değil, sürekli yönetim.
            </p>
          </div>
        </div>
      </section>

      {/* Değerlerimiz */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Çalışma Biçimimiz</h2>
          </div>
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

      {/* Zaman Çizelgesi */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Nasıl Buraya Geldik?</h2>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-8">
              {MILESTONES.map((item, i) => (
                <div key={i} className="flex gap-6 items-start pl-12 relative">
                  <div className="absolute left-0 h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 bg-card border rounded-xl p-5">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">{item.period}</span>
                    <h3 className="font-semibold mt-3 mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ekibimiz */}
      <section className="py-20 bg-background" id="ekibimiz">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium mb-4">
              <Users className="h-4 w-4" />
              Ekibimiz
            </div>
            <h2 className="text-3xl font-bold">Arkasındaki İnsanlar</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              CyberStep, siber güvenliği gerçekten erişilebilir kılmak için bir araya gelen küçük ama odaklı bir ekip tarafından yönetiliyor.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TEAM.map(({ name, role, bio, icon: Icon }) => (
              <div key={name} className="bg-card border rounded-2xl p-6 space-y-4 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{name}</div>
                  <div className="text-sm text-emerald-600 font-medium">{role}</div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-10">
            Ekibimize katılmak ister misiniz?{" "}
            <Link href="/iletisim" className="text-emerald-600 hover:underline font-medium">
              Bize yazın
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
          <Shield className="h-10 w-10 text-emerald-400 mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold">
            Sizi de bu adıma davet ediyoruz.
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            20 soruluk ücretsiz değerlendirme veya domain taraması ile başlayın. Teknik bilgi gerekmez.
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
              href="/hakkimizda"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors"
            >
              Hakkımızda
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
