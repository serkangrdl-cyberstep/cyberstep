import { useState } from "react";
import { Shield, ArrowRight, Users, Lightbulb, Target, Award, Coffee, Globe, Eye, Bot, CheckCircle, FileText, Lock, Paperclip } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";


function CareerForm() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", message: "" });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => setCvFile(e.target.files?.[0] ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      let cvFileName: string | undefined;
      let cvFileData: string | undefined;
      if (cvFile) {
        cvFileName = cvFile.name;
        const buf = await cvFile.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        cvFileData = `data:${cvFile.type};base64,${b64}`;
      }
      const res = await fetch("/api/public/job-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cvFileName, cvFileData }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Hata"); }
      setStatus("success");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Sunucu hatası");
      setStatus("error");
    }
  };

  if (status === "success") return (
    <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center">
      <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
      <p className="font-semibold text-emerald-700 dark:text-emerald-400">Başvurunuz alındı.</p>
      <p className="text-sm text-muted-foreground mt-1">En kısa sürede sizinle iletişime geçeceğiz.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 bg-card border rounded-2xl p-6">
      <h3 className="font-semibold text-lg">Ekibimize Katılın</h3>
      <p className="text-sm text-muted-foreground">Siber güvenliği erişilebilir kılma misyonumuza ortak olmak ister misiniz?</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Ad Soyad *</label>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Ahmet Yılmaz" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Telefon *</label>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+90 555 000 0000" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">E-posta *</label>
        <input required type="email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ad@sirketiniz.com" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">CV (PDF, DOCX — max 5 MB)</label>
        <label className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-background cursor-pointer hover:bg-muted/50 transition-colors">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{cvFile ? cvFile.name : "Dosya seç..."}</span>
          <input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Kısa Tanıtım (isteğe bağlı)</label>
        <textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Deneyimlerinizden, ilgi alanlarınızdan bahsedin..." />
      </div>
      {status === "error" && <p className="text-sm text-red-500">{errMsg}</p>}
      <button type="submit" disabled={status === "loading"} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
        {status === "loading" ? "Gönderiliyor..." : "Başvuruyu Gönder"}
      </button>
    </form>
  );
}

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
            Bir ismin arkasında her zaman bir neden vardır. Bizim ismimizde iki kelime, bir sorun ve Türkiye'deki yüz binlerce şirket var.
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
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Siber güvenlik bir gecede tamamlanmaz. Merdiveni tek seferde çıkmak mümkün değildir — her basamak bir üsttekinin zeminini hazırlar. Bir basamağı atlayamazsın. Kısamazsın. Ama doğru basamakları, doğru sırayla atarsan zirveye ulaşırsın.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Türkiye'deki şirketlerin büyük çoğunluğu bu merdivende nerede durduğunu bilmiyor. Hangi basamakta olduklarını görecek araçları yok. Yol haritaları yok. Mevcut araçlar İngilizce, erişilmez fiyatlı ve teknik ekip gerektiriyor.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              CyberStep bu boşluk için doğdu — ve büyüdükçe o boşluğun ne kadar derin olduğunu gördük.
            </p>
          </div>
          <div className="mt-10 space-y-5">
            <div className="bg-card border rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3">İsmimizde iki anlam iç içe:</h3>
              <p className="text-muted-foreground leading-relaxed">
                İngilizce'de <span className="font-semibold text-foreground">step</span> hem <span className="text-emerald-600 font-semibold">adım</span> hem de <span className="text-emerald-600 font-semibold">ayak izi</span> demek. Bu tesadüf değil — bilinçli bir tercih. Siber güvenliğin en kritik kavramlarından biri dijital ayak izi: şirketinizin dışarıdan görünen saldırı yüzeyi. Bir saldırgan sizi hedef almadan önce ayak izinizi takip eder — hangi sistemler açık, hangi veriler sızmış, hangi kapılar kilitlenmemiş. CyberStep hem güvenlik adımlarınızı planlar hem dijital izinizi yönetir. Adım adım, iz bırakarak.
              </p>
            </div>
            <div className="bg-card border rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3">Neden .io?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Bu bir danışmanlık firması değil, bir platform. <span className="font-semibold text-foreground">.io</span> bilinçli bir sinyal: yapay zeka ve bulut altyapısı üzerine kurulu, sürekli büyüyen bir teknoloji ekosistemi. Dış saldırı yüzeyi taraması, sürekli maruz kalma yönetimi, yapay zeka güvenlik analizi, EU AI Act uyumu, KVKK entegrasyonu, firewall otomasyonu — bunlar ayrı araçlar değil, birbiriyle konuşan tek bir platform. Türkiye'de ilk kez, Türkçe.
              </p>
            </div>
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
              CyberStep bu boşluk için kuruldu. Türkçe, Türkiye ölçeğinde, aksiyona odaklı. Tek seferlik denetim değil, sürekli yönetim.
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

      {/* Nasıl Çalışır? */}
      <section id="nasil-calisir" className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium mb-4">
              <Target className="h-4 w-4" />
              Platform Yetenekleri
            </div>
            <h2 className="text-3xl font-bold">Nasıl Çalışır?</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              CyberStep tek bir araç değil, birbirine bağlı altı katmanlı bir güvenlik platformudur. Her katman bir üsttekinin zeminini hazırlar.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Globe,
                num: "01",
                title: "Dış Saldırı Yüzeyi Taraması",
                desc: "Domain güvenlik analizi, açık port tespiti, SSL durumu, HIBP sızıntı kontrolü, USOM korelasyonu ve dark web izleme. Teknik bilgi gerekmez.",
                href: "/domain-tarama",
                tag: "Ücretsiz başlangıç",
              },
              {
                icon: Shield,
                num: "02",
                title: "Yapay Zeka Risk Değerlendirmesi",
                desc: "20 soruluk Mini (ücretsiz) veya 60 soruluk Tam Değerlendirme. Gemini AI ile kişiselleştirilmiş risk raporu, sektör karşılaştırması ve öncelikli aksiyon planı.",
                href: "/assessment/start",
                tag: "Ücretsiz Mini",
              },
              {
                icon: Bot,
                num: "03",
                title: "AI Güvenlik Servisleri",
                desc: "Phishing simülasyonu, AI Red Team istihbaratı, deepfake tehdit analizi, AI araç izleme ve KVKK uyumlu AI politika otogüncelleme.",
                href: "/ai-guvenlik-degerlendirmesi",
                tag: "AI destekli",
              },
              {
                icon: CheckCircle,
                num: "04",
                title: "Uyum & Regülasyon Analizi",
                desc: "KVKK uyum denetimi, BDDK/DORA madde bazlı analiz, EU AI Act uyum skoru ve sektöre özgü regülasyon takvimi. Ceza riskinizi öğrenin.",
                href: "/dora-bddk-uyum",
                tag: "KVKK · DORA · EU AI Act",
              },
              {
                icon: Eye,
                num: "05",
                title: "Sürekli Maruz Kalma Yönetimi",
                desc: "Haftalık delta raporları, zero-day uyarıları, firewall entegrasyonu ve kapalı döngü doğrulama. Tek seferlik denetimden sürekli güvenliğe geçiş.",
                href: "/domain-tarama",
                tag: "CEM Platformu",
              },
              {
                icon: FileText,
                num: "06",
                title: "Yönetim Raporlaması",
                desc: "Yönetim kurulu güvenlik raporu, müşteri sağlık skoru dashboard'u, sektörel kıyaslama ve CFO'nun anlayabileceği finansal risk analizi.",
                href: "/hesabim/yonetim-raporu",
                tag: "C-Suite için",
              },
            ].map(({ icon: Icon, num, title, desc, href, tag }) => (
              <div key={num} className="bg-card border rounded-2xl p-6 relative hover:border-emerald-500/30 transition-colors group">
                <div className="text-5xl font-black text-emerald-600/10 absolute top-4 right-5 select-none leading-none">{num}</div>
                <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="inline-block text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full mb-3">{tag}</span>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{desc}</p>
                <Link href={href} className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium hover:underline">
                  İncele <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/assessment/start" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors">
              Ücretsiz Değerlendirme Başlat <ArrowRight className="h-4 w-4" />
            </Link>
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
              CyberStep, siber güvenliği gerçekten erişilebilir kılmak için bir araya gelen, odaklı bir ekip tarafından yönetiliyor.
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-muted-foreground leading-relaxed text-lg">
              Ekibimiz; kurumsal güvenlik altyapıları, yazılım geliştirme ve ürün tasarımı alanlarında onlarca yıllık birleşik deneyimi olan insanlardan oluşuyor. Büyük kurumsal güvenlik projelerinde çalıştık, sahada ne işe yaradığını gördük — ve aynı kaliteyi erişilebilir bir formatta sunmanın mümkün olduğuna inandık.
            </p>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8">
              <p className="text-lg font-medium text-foreground leading-relaxed">
                Bizi farklı kılan şey teknik bilgimiz değil, o bilgiyi sıradan bir patronun anlayabileceği dile çevirme kararlılığımız.
              </p>
            </div>
            <CareerForm />
          </div>
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
