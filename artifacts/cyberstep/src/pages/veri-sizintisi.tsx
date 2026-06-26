import { Link } from "wouter";
import { Shield, AlertTriangle, CheckCircle2, Database, Bell, Lock, ChevronRight } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "CyberStep",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "TRY",
    "description": "Ücretsiz mini assessment",
  },
});

export default function VeriSizintisi() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Veri Sızıntısı İzleme | CyberStep",
    description:
      "Kurumunuzun verileri dark web'de mi? HaveIBeenPwned entegrasyonuyla haftalık otomatik tarama. KVKK uyumlu. CyberStep ile koruma altına alın.",
    noIndex: false,
  });

  return (
    <div className="min-h-screen bg-[#060D1A] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD }}
      />

      {/* Hero */}
      <section className="py-20 border-b border-slate-800 bg-gradient-to-b from-slate-900 to-[#060D1A]">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00C8FF]/10 border border-[#00C8FF]/20 text-[#00C8FF] text-sm font-medium mb-6">
            <AlertTriangle className="h-4 w-4" />
            <span>Veri Sızıntısı İzleme</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Verileriniz Dark Web'de mi?
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-4">
            Çoğu şirket, veri sızıntısını ortalama{" "}
            <span className="font-semibold text-white">277 gün sonra</span> fark
            ediyor. Siz anında öğrenin.
          </p>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mb-10">
            Kara liste izleme, marka koruma ve veri sızıntısı tespiti tek
            platformda — Türkiye'nin en kapsamlı EASM çözümü.
          </p>
          <Link
            href="/assessment/start"
            className="inline-flex items-center justify-center gap-2 bg-[#00C8FF] text-[#060D1A] font-semibold px-8 py-4 rounded-lg hover:bg-[#00C8FF]/90 transition-colors text-base"
          >
            Ücretsiz Tarama Başlat
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Risk İstatistikleri */}
      <section className="py-16 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                color: "text-red-400",
                bg: "bg-red-500/10 border-red-500/20",
                stat: "%65",
                label: "Türkiye'deki şirketlerin siber saldırıya uğrama oranı",
                source: "Fortinet / DORinsight 2025",
              },
              {
                icon: AlertTriangle,
                color: "text-[#F5A623]",
                bg: "bg-[#F5A623]/10 border-[#F5A623]/20",
                stat: "277 gün",
                label: "Ortalama veri ihlali tespit süresi",
                source: "IBM Cost of Data Breach 2024",
              },
              {
                icon: Database,
                color: "text-[#00C8FF]",
                bg: "bg-[#00C8FF]/10 border-[#00C8FF]/20",
                stat: "$4.88M",
                label: "Veri ihlalinin ortalama küresel maliyeti",
                source: "IBM CODB 2024",
              },
            ].map(({ icon: Icon, color, bg, stat, label, source }) => (
              <div
                key={stat}
                className={`rounded-xl border p-6 ${bg}`}
              >
                <Icon className={`h-6 w-6 ${color} mb-4`} />
                <p className={`text-3xl font-bold ${color} mb-2`}>{stat}</p>
                <p className="text-white font-medium text-sm mb-2">{label}</p>
                <p className="text-slate-500 text-xs">{source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="py-16 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-[#00C8FF] text-sm font-semibold uppercase tracking-widest mb-3">
              Nasıl Çalışır?
            </p>
            <h2 className="text-3xl font-bold">3 Adımda Tam Koruma</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: "1",
                icon: Shield,
                title: "Domain'inizi Ekleyin",
                desc: "Şirket domain'inizi sisteme kayıt edin. Kurulum 2 dakika sürer.",
              },
              {
                num: "2",
                icon: Database,
                title: "Otomatik Tarama",
                desc: "HaveIBeenPwned ve DeHashed haftalık otomatik tarama yapar. Siz bir şey yapmanıza gerek yok.",
              },
              {
                num: "3",
                icon: Bell,
                title: "Anında Bildirim",
                desc: "Kritik bir bulgu tespit edildiğinde e-posta ile anında uyarı alırsınız.",
              },
            ].map(({ num, icon: Icon, title, desc }) => (
              <div key={num} className="text-center">
                <div className="relative inline-flex mb-5">
                  <div className="h-16 w-16 rounded-full bg-[#0E1A2E] border border-slate-700 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-[#00C8FF]" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[#00C8FF] flex items-center justify-center text-[#060D1A] text-xs font-bold">
                    {num}
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Database,
                title: "HaveIBeenPwned & DeHashed Entegrasyonu",
                desc: "Dünya'nın en kapsamlı iki breach veritabanı ile entegrasyon. Milyarlarca kayıt taranır.",
              },
              {
                icon: Bell,
                title: "Haftalık Otomatik Tarama",
                desc: "Her Çarşamba otomatik çalışır. Yeni sızıntı tespit edildiğinde hemen haberdar olursunuz.",
              },
              {
                icon: AlertTriangle,
                title: "Kritik Sızıntılarda Anlık Bildirim",
                desc: "Şifre içeren kritik breach'lerde beklemeden e-posta bildirimi alırsınız.",
              },
              {
                icon: Lock,
                title: "KVKK Uyumlu Veri İşleme",
                desc: "Şifre veya hash bilgisi saklanmaz. Tüm veriler KVKK kapsamında işlenir.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 p-5 bg-[#0E1A2E] border border-slate-800 rounded-xl"
              >
                <div className="h-10 w-10 rounded-lg bg-[#00C8FF]/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-[#00C8FF]" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KVKK Güvencesi */}
      <section className="py-16 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="rounded-xl border-2 border-[#F5A623]/40 bg-[#F5A623]/5 p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#F5A623]/20 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-[#F5A623]" />
              </div>
              <div>
                <p className="font-semibold text-[#F5A623] mb-2">KVKK Güvencesi</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Tüm veriler Türkiye'de işlenir. Kişisel veriler KVKK kapsamında
                  korunur. Şifre veya hash bilgisi asla saklanmaz. Etkilenen
                  e-posta adresleri yalnızca istatistiksel sayım olarak
                  tutulur — listelenmez.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Hemen Başlayın</h2>
          <p className="text-slate-300 mb-8">
            20 dakikada şirketinizin siber güvenlik riskini öğrenin.
            Veri sızıntısı dahil 5 alan ücretsiz değerlendirme.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/assessment/start"
              className="inline-flex items-center justify-center gap-2 bg-[#00C8FF] text-[#060D1A] font-semibold px-8 py-4 rounded-lg hover:bg-[#00C8FF]/90 transition-colors"
            >
              Ücretsiz Değerlendirme Başlat
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              href="/sizinti-izleyici"
              className="inline-flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 px-8 py-4 rounded-lg transition-colors"
            >
              <CheckCircle2 className="h-5 w-5 text-[#00C8FF]" />
              Ücretsiz Sızıntı Sorgula
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
