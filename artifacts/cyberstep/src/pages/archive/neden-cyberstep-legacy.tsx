import { useState } from "react";
import { Shield, ArrowRight, Users, Lightbulb, Target, Award, Coffee, Globe, Eye, Bot, CheckCircle, FileText, Lock, Paperclip } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

function CareerForm() {
  const { lang } = useLanguage();
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      setStatus("success");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Server error");
      setStatus("error");
    }
  };

  if (status === "success") return (
    <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center">
      <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
      <p className="font-semibold text-emerald-700 dark:text-emerald-400">
        {lang === "en" ? "Application received." : "Başvurunuz alındı."}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {lang === "en" ? "We'll get in touch with you as soon as possible." : "En kısa sürede sizinle iletişime geçeceğiz."}
      </p>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 bg-card border rounded-2xl p-6">
      <h3 className="font-semibold text-lg">
        {lang === "en" ? "Join Our Team" : "Ekibimize Katılın"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {lang === "en"
          ? "Do you want to join our mission to make cybersecurity accessible?"
          : "Siber güvenliği erişilebilir kılma misyonumuza ortak olmak ister misiniz?"}
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {lang === "en" ? "Full Name *" : "Ad Soyad *"}
          </label>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder={lang === "en" ? "John Smith" : "Ahmet Yılmaz"} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {lang === "en" ? "Phone *" : "Telefon *"}
          </label>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+90 555 000 0000" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {lang === "en" ? "Email *" : "E-posta *"}
        </label>
        <input required type="email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={lang === "en" ? "you@company.com" : "ad@sirketiniz.com"} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {lang === "en" ? "CV (PDF, DOCX — max 5 MB)" : "CV (PDF, DOCX — max 5 MB)"}
        </label>
        <label className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-background cursor-pointer hover:bg-muted/50 transition-colors">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{cvFile ? cvFile.name : (lang === "en" ? "Choose file..." : "Dosya seç...")}</span>
          <input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {lang === "en" ? "Short Introduction (optional)" : "Kısa Tanıtım (isteğe bağlı)"}
        </label>
        <textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder={lang === "en" ? "Tell us about your experience and interests..." : "Deneyimlerinizden, ilgi alanlarınızdan bahsedin..."} />
      </div>
      {status === "error" && <p className="text-sm text-red-500">{errMsg}</p>}
      <button type="submit" disabled={status === "loading"} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
        {status === "loading"
          ? (lang === "en" ? "Sending..." : "Gönderiliyor...")
          : (lang === "en" ? "Submit Application" : "Başvuruyu Gönder")}
      </button>
    </form>
  );
}

export default function NedenCyberStep() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en"
      ? "Why CyberStep? — The Story Behind the Name | CyberStep.io"
      : "Neden CyberStep? — İsmin Hikayesi ve Ekibimiz | CyberStep.io",
    description: lang === "en"
      ? "Where the name CyberStep.io comes from, who founded it, and why it exists for Turkish SMEs. Meet our team."
      : "CyberStep.io adının nereden geldiği, kim tarafından kurulduğu ve Türkiye KOBİ'leri için neden var olduğu. Ekibimizle tanışın.",
    canonicalPath: "/neden-cyberstep",
  });

  const MILESTONES = [
    {
      period: lang === "en" ? "Autumn 2023" : "2023 Sonbahar",
      title: lang === "en" ? "The Idea" : "Fikir",
      desc: lang === "en"
        ? "We saw a small accounting firm get fined 120,000 TL for a preventable data breach. Tools existed — but none were in Turkish, none were SME-scale."
        : "Küçük bir muhasebe firmasının önlenebilir bir veri ihlali nedeniyle 120.000 TL ceza aldığını gördük. Araçlar vardı — ama hiçbiri Türkçe değildi, hiçbiri KOBİ ölçeğinde değildi.",
    },
    {
      period: lang === "en" ? "January 2024" : "2024 Ocak",
      title: lang === "en" ? "First Prototype" : "İlk Prototip",
      desc: lang === "en"
        ? "Domain scanning engine and the first 20-question risk assessment. Beta-tested with 40 SMEs. The feedback was clear: simpler, more Turkish, more action-oriented."
        : "Domain tarama motoru ve ilk 20 soruluk risk değerlendirmesi. 40 KOBİ ile beta testi. Geri bildirim netti: Daha sade, daha Türkçe, daha aksiyona yönelik.",
    },
    {
      period: lang === "en" ? "June 2024" : "2024 Haziran",
      title: lang === "en" ? "Live" : "Yayında",
      desc: lang === "en"
        ? "CyberStep.io went live. In the first 3 months, over 500 companies completed a free assessment."
        : "CyberStep.io canlıya geçti. İlk 3 ayda 500'den fazla şirket ücretsiz değerlendirme tamamladı.",
    },
    {
      period: "2025",
      title: lang === "en" ? "AI Security Services" : "AI Güvenlik Servisleri",
      desc: lang === "en"
        ? "AI tool monitoring, phishing simulation and EU AI Act compliance score services added. The platform expanded beyond cybersecurity into AI governance."
        : "Yapay zeka araç izleme, phishing simülasyonu ve EU AI Act uyum skoru hizmetleri eklendi. Platform siber güvenliğin ötesine, AI yönetişimine doğru genişledi.",
    },
    {
      period: "2026",
      title: lang === "en" ? "Continuous Exposure Management" : "Sürekli Maruz Kalma Yönetimi",
      desc: lang === "en"
        ? "Firewall integration, closed-loop verification and board reporting. Transition from one-time audit to continuous security management."
        : "Firewall entegrasyonu, kapalı döngü doğrulama ve yönetim kurulu raporlaması. Tek seferlik denetimden sürekli güvenlik yönetimine geçiş.",
    },
  ];

  const VALUES = [
    {
      icon: Lightbulb,
      title: lang === "en" ? "Simplicity" : "Sadelik",
      desc: lang === "en"
        ? "Not a technical report — decision support. In language a CEO can understand, with concrete numbers."
        : "Teknik rapor değil, karar desteği. Bir CEO'nun anlayabileceği dilde, somut rakamlarla.",
    },
    {
      icon: Globe,
      title: lang === "en" ? "Local Focus" : "Yerellik",
      desc: lang === "en"
        ? "KVKK, USOM, Turkey sector dynamics. The context global tools ignore."
        : "KVKK, USOM, Türkiye sektör dinamikleri. Global araçların görmezden geldiği bağlam.",
    },
    {
      icon: Award,
      title: lang === "en" ? "Closed Loop" : "Kapalı Döngü",
      desc: lang === "en"
        ? "Find, send, fix, verify. We don't just report — we follow through until it's resolved."
        : "Bul, gönder, düzelt, doğrula. Rapor vermekle kalmıyoruz — sonuçlanana kadar takip ediyoruz.",
    },
  ];

  const HOW_IT_WORKS = [
    {
      icon: Globe,
      num: "01",
      title: lang === "en" ? "External Attack Surface Scan" : "Dış Saldırı Yüzeyi Taraması",
      desc: lang === "en"
        ? "Domain security analysis, open port detection, SSL status, HIBP leak check, USOM correlation and dark web monitoring. No technical knowledge needed."
        : "Domain güvenlik analizi, açık port tespiti, SSL durumu, HIBP sızıntı kontrolü, USOM korelasyonu ve dark web izleme. Teknik bilgi gerekmez.",
      href: "/domain-tarama",
      tag: lang === "en" ? "Free start" : "Ücretsiz başlangıç",
    },
    {
      icon: Shield,
      num: "02",
      title: lang === "en" ? "AI Risk Assessment" : "Yapay Zeka Risk Değerlendirmesi",
      desc: lang === "en"
        ? "20-question Mini (free) or 60-question Full Assessment. Personalized risk report with Gemini AI, sector comparison and prioritized action plan."
        : "20 soruluk Mini (ücretsiz) veya 60 soruluk Tam Değerlendirme. Gemini AI ile kişiselleştirilmiş risk raporu, sektör karşılaştırması ve öncelikli aksiyon planı.",
      href: "/assessment/start",
      tag: lang === "en" ? "Free Mini" : "Ücretsiz Mini",
    },
    {
      icon: Bot,
      num: "03",
      title: lang === "en" ? "AI Security Services" : "AI Güvenlik Servisleri",
      desc: lang === "en"
        ? "Phishing simulation, AI Red Team intelligence, deepfake threat analysis, AI tool monitoring and KVKK-compliant AI policy auto-update."
        : "Phishing simülasyonu, AI Red Team istihbaratı, deepfake tehdit analizi, AI araç izleme ve KVKK uyumlu AI politika otogüncelleme.",
      href: "/ai-guvenlik-degerlendirmesi",
      tag: lang === "en" ? "AI-powered" : "AI destekli",
    },
    {
      icon: CheckCircle,
      num: "04",
      title: lang === "en" ? "Compliance & Regulation Analysis" : "Uyum & Regülasyon Analizi",
      desc: lang === "en"
        ? "KVKK compliance audit, BDDK/DORA article-by-article analysis, EU AI Act compliance score and sector-specific regulation calendar. Know your penalty risk."
        : "KVKK uyum denetimi, BDDK/DORA madde bazlı analiz, EU AI Act uyum skoru ve sektöre özgü regülasyon takvimi. Ceza riskinizi öğrenin.",
      href: "/dora-bddk-uyum",
      tag: "KVKK · DORA · EU AI Act",
    },
    {
      icon: Eye,
      num: "05",
      title: lang === "en" ? "Continuous Exposure Management" : "Sürekli Maruz Kalma Yönetimi",
      desc: lang === "en"
        ? "Weekly delta reports, zero-day alerts, firewall integration and closed-loop verification. Transition from one-time audit to continuous security."
        : "Haftalık delta raporları, zero-day uyarıları, firewall entegrasyonu ve kapalı döngü doğrulama. Tek seferlik denetimden sürekli güvenliğe geçiş.",
      href: "/domain-tarama",
      tag: lang === "en" ? "CEM Platform" : "CEM Platformu",
    },
    {
      icon: FileText,
      num: "06",
      title: lang === "en" ? "Management Reporting" : "Yönetim Raporlaması",
      desc: lang === "en"
        ? "Board security report, customer health score dashboard, sector benchmarking and financial risk analysis in language a CFO can understand."
        : "Yönetim kurulu güvenlik raporu, müşteri sağlık skoru dashboard'u, sektörel kıyaslama ve CFO'nun anlayabileceği finansal risk analizi.",
      href: "/hesabim/yonetim-raporu",
      tag: lang === "en" ? "For C-Suite" : "C-Suite için",
    },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <Coffee className="h-4 w-4" />
            {lang === "en" ? "Our Story" : "Hikayemiz"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {lang === "en" ? <>Why <span className="text-emerald-400">CyberStep?</span></> : <>Neden <span className="text-emerald-400">CyberStep?</span></>}
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            {lang === "en"
              ? "There is always a reason behind a name. In ours: two words, one problem, and hundreds of thousands of companies across Turkey."
              : "Bir ismin arkasında her zaman bir neden vardır. Bizim ismimizde iki kelime, bir sorun ve Türkiye'deki yüz binlerce şirket var."}
          </p>
        </div>
      </section>

      {/* Name Meaning */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "Two Words, One Purpose" : "İki Kelime, Bir Amaç"}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              {lang === "en"
                ? "We considered dozens of alternatives before choosing the name \"CyberStep\". The reason we settled on these two words is simple: together they describe exactly what we want to do."
                : "\"CyberStep\" ismini seçmeden önce onlarca alternatif değerlendirdik. Bu iki kelimeye yerleşmemizin nedeni basit: ikisi birlikte tam olarak ne yapmak istediğimizi anlatıyor."}
            </p>
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
            {lang === "en" ? (
              <>
                <p className="text-muted-foreground leading-relaxed">
                  Cybersecurity is not completed overnight. You can't climb the ladder in one go — each step prepares the ground for the next. You can't skip a step. You can't shortcut it. But if you take the right steps, in the right order, you reach the top.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  The vast majority of companies in Turkey don't know where they stand on this ladder. They have no tools to see which step they're on. No roadmap. Existing tools are in English, inaccessibly priced, and require a technical team.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  CyberStep was born to fill this gap — and as we grew, we saw how deep that gap really was.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground leading-relaxed">
                  Siber güvenlik bir gecede tamamlanmaz. Merdiveni tek seferde çıkmak mümkün değildir — her basamak bir üsttekinin zeminini hazırlar. Bir basamağı atlayamazsın. Kısamazsın. Ama doğru basamakları, doğru sırayla atarsan zirveye ulaşırsın.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Türkiye'deki şirketlerin büyük çoğunluğu bu merdivende nerede durduğunu bilmiyor. Hangi basamakta olduklarını görecek araçları yok. Yol haritaları yok. Mevcut araçlar İngilizce, erişilmez fiyatlı ve teknik ekip gerektiriyor.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  CyberStep bu boşluk için doğdu — ve büyüdükçe o boşluğun ne kadar derin olduğunu gördük.
                </p>
              </>
            )}
          </div>
          <div className="mt-10 space-y-5">
            <div className="bg-card border rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3">
                {lang === "en" ? "Two meanings intertwined in our name:" : "İsmimizde iki anlam iç içe:"}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {lang === "en"
                  ? "In English, \"step\" means both a move forward and a footprint. This is not a coincidence — it's a deliberate choice. One of the most critical concepts in cybersecurity is digital footprint: the external attack surface visible from outside your company. Before targeting you, an attacker traces your footprint — which systems are exposed, which data has leaked, which doors are unlocked. CyberStep both plans your security steps and manages your digital trace. Step by step, leaving a mark."
                  : "İngilizce'de step hem adım hem de ayak izi demek. Bu tesadüf değil — bilinçli bir tercih. Siber güvenliğin en kritik kavramlarından biri dijital ayak izi: şirketinizin dışarıdan görünen saldırı yüzeyi. Bir saldırgan sizi hedef almadan önce ayak izinizi takip eder — hangi sistemler açık, hangi veriler sızmış, hangi kapılar kilitlenmemiş. CyberStep hem güvenlik adımlarınızı planlar hem dijital izinizi yönetir. Adım adım, iz bırakarak."}
              </p>
            </div>
            <div className="bg-card border rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3">
                {lang === "en" ? "Why .io?" : "Neden .io?"}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {lang === "en"
                  ? "This is not a consulting firm — it's a platform. .io is a deliberate signal: a technology ecosystem built on AI and cloud infrastructure, continuously growing. External attack surface scanning, continuous exposure management, AI security analysis, EU AI Act compliance, KVKK integration, firewall automation — these are not separate tools; they're a single interconnected platform. First of its kind in Turkey, in Turkish."
                  : "Bu bir danışmanlık firması değil, bir platform. .io bilinçli bir sinyal: yapay zeka ve bulut altyapısı üzerine kurulu, sürekli büyüyen bir teknoloji ekosistemi. Dış saldırı yüzeyi taraması, sürekli maruz kalma yönetimi, yapay zeka güvenlik analizi, EU AI Act uyumu, KVKK entegrasyonu, firewall otomasyonu — bunlar ayrı araçlar değil, birbiriyle konuşan tek bir platform. Türkiye'de ilk kez, Türkçe."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why We Exist */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "Why Do We Exist?" : "Neden Var Olduk?"}
            </h2>
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
            {lang === "en" ? (
              <>
                <p className="text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">95 percent</strong> of companies in Turkey have no security team. Existing tools are in English, enterprise-priced and require technical knowledge. These tools were built for large corporations — yet the majority of cyberattack targets are SMEs.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  In 2024, 94 firms in Turkey were fined a total of <strong className="text-foreground">47 million TL</strong> in KVKK penalties. The majority of these fines stemmed from gaps that could be closed in 30 minutes. It wasn't that tools didn't exist — they weren't accessible.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  CyberStep was founded to fill this gap. Turkish, Turkey-scale, action-focused. Not a one-time audit — continuous management.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground leading-relaxed">
                  Türkiye'deki şirketlerin <strong className="text-foreground">yüzde doksan beşinin</strong> güvenlik ekibi yok. Var olan araçlar İngilizce, kurumsal fiyatlandırmalı ve teknik bilgi gerektiriyor. Bu araçlar büyük kurumlar için yapılmış — oysa siber saldırıların hedefinin büyük çoğunluğu KOBİ'ler.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  2024 yılında Türkiye'de 94 firmaya toplam <strong className="text-foreground">47 milyon TL</strong> KVKK cezası kesildi. Bu cezaların büyük çoğunluğu 30 dakikada kapatılabilecek açıklardan kaynaklandı. Araçlar yoktu değil — erişilebilir değildi.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  CyberStep bu boşluk için kuruldu. Türkçe, Türkiye ölçeğinde, aksiyona odaklı. Tek seferlik denetim değil, sürekli yönetim.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Our Way of Working */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "How We Work" : "Çalışma Biçimimiz"}
            </h2>
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

      {/* Timeline */}
      <section className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "How Did We Get Here?" : "Nasıl Buraya Geldik?"}
            </h2>
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

      {/* How It Works */}
      <section id="nasil-calisir" className="py-20 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium mb-4">
              <Target className="h-4 w-4" />
              {lang === "en" ? "Platform Capabilities" : "Platform Yetenekleri"}
            </div>
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "How It Works" : "Nasıl Çalışır?"}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {lang === "en"
                ? "CyberStep is not a single tool — it's a six-layer security platform. Each layer prepares the foundation for the next."
                : "CyberStep tek bir araç değil, birbirine bağlı altı katmanlı bir güvenlik platformudur. Her katman bir üsttekinin zeminini hazırlar."}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map(({ icon: Icon, num, title, desc, href, tag }) => (
              <div key={num} className="bg-card border rounded-2xl p-6 relative hover:border-emerald-500/30 transition-colors group">
                <div className="text-5xl font-black text-emerald-600/10 absolute top-4 right-5 select-none leading-none">{num}</div>
                <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="inline-block text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full mb-3">{tag}</span>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{desc}</p>
                <Link href={href} className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium hover:underline">
                  {lang === "en" ? "Explore" : "İncele"} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/assessment/start" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors">
              {lang === "en" ? "Start Free Assessment" : "Ücretsiz Değerlendirme Başlat"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-background" id="ekibimiz">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium mb-4">
              <Users className="h-4 w-4" />
              {lang === "en" ? "Our Team" : "Ekibimiz"}
            </div>
            <h2 className="text-3xl font-bold">
              {lang === "en" ? "The People Behind It" : "Arkasındaki İnsanlar"}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              {lang === "en"
                ? "CyberStep is run by a focused team that came together to make cybersecurity truly accessible."
                : "CyberStep, siber güvenliği gerçekten erişilebilir kılmak için bir araya gelen, odaklı bir ekip tarafından yönetiliyor."}
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-muted-foreground leading-relaxed text-lg">
              {lang === "en"
                ? "Our team comprises people with decades of combined experience in enterprise security infrastructure, software development and product design. We've worked on large corporate security projects, seen what works in the field — and believed it was possible to deliver that same quality in an accessible format."
                : "Ekibimiz; kurumsal güvenlik altyapıları, yazılım geliştirme ve ürün tasarımı alanlarında onlarca yıllık birleşik deneyimi olan insanlardan oluşuyor. Büyük kurumsal güvenlik projelerinde çalıştık, sahada ne işe yaradığını gördük — ve aynı kaliteyi erişilebilir bir formatta sunmanın mümkün olduğuna inandık."}
            </p>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8">
              <p className="text-lg font-medium text-foreground leading-relaxed">
                {lang === "en"
                  ? "What sets us apart is not our technical knowledge — it's our determination to translate that knowledge into language an ordinary business owner can understand."
                  : "Bizi farklı kılan şey teknik bilgimiz değil, o bilgiyi sıradan bir patronun anlayabileceği dile çevirme kararlılığımız."}
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
            {lang === "en"
              ? "We invite you to take this step too."
              : "Sizi de bu adıma davet ediyoruz."}
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            {lang === "en"
              ? "Start with a 20-question free assessment or a domain scan. No technical knowledge needed."
              : "20 soruluk ücretsiz değerlendirme veya domain taraması ile başlayın. Teknik bilgi gerekmez."}
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
              href="/hakkimizda"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 font-medium px-8 py-4 rounded-lg transition-colors"
            >
              {lang === "en" ? "About Us" : "Hakkımızda"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
