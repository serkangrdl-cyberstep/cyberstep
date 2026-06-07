import { Shield, Download, Chrome, Star, Zap, Eye, Lock, Globe, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";

const FEATURES = [
  {
    icon: Eye,
    title: "Anlık Güvenlik Skoru",
    desc: "Her web sitesine girdiğinizde tarayıcı ikonunda o domain'in CyberStep skoru belirir. 0–100 arası, anlık.",
  },
  {
    icon: Zap,
    title: "Renk Kodlu Uyarı Rozeti",
    desc: "Yeşil: Güvenli. Sarı: Dikkatli ol. Kırmızı: Yüksek risk. Gri: Henüz taranmamış.",
  },
  {
    icon: Lock,
    title: "SPF · DMARC · SSL Durumu",
    desc: "Popup'ta e-posta güvenliği, SSL geçerliliği ve kara liste durumunu tek bakışta görün.",
  },
  {
    icon: Globe,
    title: "Tedarikçi Risk Tespiti",
    desc: "Tedarikçi sitesinde kırmızı rozet mi gördünüz? Yöneticinize bildirin, raporunu isteyin.",
  },
];

const STEPS = [
  { n: "1", title: "ZIP Dosyasını İndirin", desc: "Aşağıdaki butona tıklayın, cyberstep-extension.zip dosyasını kaydedin." },
  { n: "2", title: "ZIP'i Açın", desc: "İndirilen dosyayı bir klasöre çıkarın (ör. Masaüstü/CyberStep-Extension/)." },
  { n: "3", title: "Chrome'u Açın", desc: "Adres çubuğuna chrome://extensions yazın ve Enter'a basın." },
  { n: "4", title: "Geliştirici Modunu Etkinleştirin", desc: "Sağ üstteki 'Geliştirici modu' anahtarını açın." },
  { n: "5", title: "Yükleyin", desc: "'Paketlenmemiş uzantı yükle' butonuna tıklayın, çıkardığınız klasörü seçin." },
];

export default function ExtensionDownload() {
  const { lang } = useLanguage();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">CyberStep.io</span>
          </Link>
          <Link href="/domain-tarama">
            <Button variant="outline" size="sm">Domain Tara</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-4xl space-y-20">

        {/* Hero */}
        <section className="text-center space-y-6">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1">
            <Chrome className="h-3.5 w-3.5 mr-1.5" />
            {lang === "en" ? "Chrome & Edge Extension — Free" : "Chrome & Edge Eklentisi — Ücretsiz"}
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight">
            {lang === "en" ? <>See the security score of<br />every website instantly</> : <>Her web sitesinin güvenlik<br />skorunu anında görün</>}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            CyberStep eklentisi tarayıcınızda arka planda çalışır. Bir siteye girdiğinizde o domain'in
            güvenlik skorunu rozet olarak gösterir. Kırmızı rozet = yüksek siber risk.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
            >
              <a href="/cyberstep-extension.zip" download="cyberstep-extension.zip">
                <Download className="h-5 w-5 mr-2" />
                Eklentiyi İndir (ZIP)
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/domain-tarama">
                Domain Tara <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ücretsiz · Veri toplamaz · Açık kaynak yapısında · Chrome & Edge uyumlu
          </p>
        </section>

        {/* Mockup */}
        <section className="flex justify-center">
          <div className="relative">
            <div className="w-72 rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card">
                <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                  <Shield className="h-3 w-3 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary">CyberStep</span>
                <span className="ml-auto text-xs text-muted-foreground">tedarikci.com</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full border-2 border-red-500 flex flex-col items-center justify-center bg-red-500/5">
                    <span className="text-2xl font-black text-red-500">32</span>
                    <span className="text-[9px] text-muted-foreground">/ 100</span>
                  </div>
                  <div>
                    <span className="inline-block text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded mb-1">F</span>
                    <p className="text-sm font-bold text-foreground">Kritik Risk</p>
                    <p className="text-[11px] text-muted-foreground">Son tarama: 29 May 2026</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: "SPF", ok: false }, { l: "DMARC", ok: false },
                    { l: "SSL/TLS", ok: true }, { l: "Kara Liste", ok: false },
                  ].map(i => (
                    <div key={i.l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${i.ok ? "bg-green-500" : "bg-red-500"}`} />
                      {i.l}: {i.ok ? "Geçti" : "Başarısız"}
                    </div>
                  ))}
                </div>
                <button className="w-full text-center text-xs font-semibold py-2 rounded-md bg-primary text-primary-foreground">
                  Tam Raporu Görüntüle →
                </button>
              </div>
              <div className="px-4 py-2 border-t border-border/50 text-center text-[10px] text-muted-foreground">
                Güvenli internet için <span className="text-primary">CyberStep.io</span>
              </div>
            </div>
            {/* Floating badge indicator */}
            <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-black rounded px-1.5 py-0.5 shadow-lg">
              32
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center">Ne görürsünüz?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="border border-border/50 rounded-xl p-5 bg-card/50 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Viral scenario */}
        <section className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Viral senaryo</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Bir KOBİ çalışanı</strong> tedarikçisinin sitesine giriyor. Tarayıcıda kırmızı rozet belirir: <strong className="text-red-500">32</strong>.
            </p>
            <p>
              Patronuna bildiriyor: <em>"Bu tedarikçinin güvenlik skoru çok düşük."</em>
            </p>
            <p>
              Patron merak ediyor: <em>"Peki bizim skorumuz ne?"</em> → Kendi sitesini CyberStep'te taratıyor.
              Düşük skor görünce rapor satın alıyor.
            </p>
            <p className="text-foreground font-medium">
              Sıfır reklam maliyetiyle organik büyüme.
            </p>
          </div>
        </section>

        {/* Installation steps */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Nasıl Yüklenir?</h2>
          <div className="space-y-3">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-4 p-4 border border-border/40 rounded-xl bg-card/30">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                  {s.n}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground mb-0.5">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center pt-2">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-10"
            >
              <a href="/cyberstep-extension.zip" download="cyberstep-extension.zip">
                <Download className="h-5 w-5 mr-2" />
                Eklentiyi İndir
              </a>
            </Button>
          </div>
        </section>

        {/* Privacy note */}
        <section className="border border-border/40 rounded-xl p-6 bg-card/20 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Gizlilik Taahhüdü</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Eklenti yalnızca ziyaret ettiğiniz sitenin <strong>domain adını</strong> CyberStep API'sine gönderir.
            Kişisel bilgi, şifre, çerez veya sayfa içeriği toplamaz. Domain güvenlik skoru kamuya açık bir veridir.
            Gönderilen veri şifrelenmiş HTTPS bağlantısı üzerinden iletilir.
          </p>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">CyberStep.io</Link>
        {" · "}
        <Link href="/kvkk-metni" className="hover:text-foreground transition-colors">Gizlilik Politikası</Link>
        {" · "}
        <Link href="/iletisim" className="hover:text-foreground transition-colors">İletişim</Link>
      </footer>
    </div>
  );
}
