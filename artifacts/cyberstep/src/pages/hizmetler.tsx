import { Link } from "wouter";
import { Shield, Search, AlertTriangle, FileText, ChevronRight, Check } from "lucide-react";
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

const SERVICES = [
  {
    id: "reputation",
    icon: Shield,
    badge: "YENİ",
    title: "Reputation & Kara Liste İzleme",
    description:
      "Domain ve IP adreslerinizi Spamhaus, Google Safe Browsing ve SURBL kara listelerinde sürekli izliyoruz. SSL sertifika geçerliliği, SPF/DMARC/DKIM mail güvenlik yapılandırması otomatik kontrol edilir. Bir sorun tespit edildiğinde anında bildirim alırsınız.",
    features: [
      "Günlük otomatik kara liste taraması",
      "SSL sertifika son kullanma uyarısı",
      "SPF, DMARC, DKIM yapılandırma kontrolü",
      "Mail sunucu reputation skoru (0-100)",
    ],
    color: "border-emerald-500/30 bg-emerald-500/5",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    href: "/domain-tarama",
  },
  {
    id: "marka-koruma",
    icon: Search,
    badge: "YENİ",
    title: "Marka Koruma & Typosquatting Tespiti",
    description:
      "Şirket adınızı taklit eden sahte domainleri otomatik tespit ediyoruz. Karakter hatası, TLD değişimi, prefix/suffix eklenmiş 71+ varyasyon her hafta taranır. Aktif phishing girişimlerinde anında uyarı ve kanıt raporu üretilir.",
    features: [
      "71+ domain varyasyonu haftalık tarama",
      "TLD swap, typo, homoglyph tespiti",
      "Şüpheli site içerik analizi",
      "ICANN şikayet için otomatik kanıt PDF'i",
    ],
    color: "border-blue-500/30 bg-blue-500/5",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    href: "/marka-koruma",
  },
  {
    id: "veri-sizintisi",
    icon: AlertTriangle,
    badge: "YENİ",
    title: "Veri Sızıntısı İzleme",
    description:
      "Kurumunuza ait e-posta ve hesap bilgilerinin dark web ve sızdırılmış veritabanlarında görünüp görünmediğini izliyoruz. HaveIBeenPwned ve DeHashed entegrasyonuyla haftalık tarama yapılır. Tüm veriler KVKK uyumlu şekilde işlenir.",
    features: [
      "HaveIBeenPwned & DeHashed entegrasyonu",
      "Haftalık otomatik tarama",
      "Kritik sızıntılarda anlık bildirim",
      "KVKK uyumlu veri işleme",
    ],
    color: "border-red-500/30 bg-red-500/5",
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    href: "/veri-sizintisi",
  },
  {
    id: "ciso-raporu",
    icon: FileText,
    badge: "YENİ",
    title: "Aylık CISO Executive Raporu",
    description:
      "Her ay otomatik üretilen 4 sayfalık yönetici raporu: risk skoru trendi, kritik bulgular, aksiyon önerileri. Teknik detay değil iş dili. Yönetim kuruluna direkt sunulabilir format. Yapay zeka destekli Türkçe özet.",
    features: [
      "Aylık otomatik PDF üretimi",
      "0-100 risk skoru ve trend grafiği",
      "AI destekli Türkçe yönetici özeti",
      "Fortinet WAF entegrasyon önerileri",
    ],
    color: "border-[#00C8FF]/30 bg-[#00C8FF]/5",
    iconColor: "text-[#00C8FF]",
    iconBg: "bg-[#00C8FF]/10",
    href: "/assessment/start",
  },
];

export default function Hizmetler() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Hizmetler | CyberStep",
    description:
      "CyberStep'in sunduğu siber güvenlik hizmetleri: Kara liste izleme, marka koruma, veri sızıntısı tespiti ve aylık CISO executive raporu.",
    noIndex: false,
  });

  return (
    <div className="min-h-screen bg-[#060D1A] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD }}
      />

      {/* Hero */}
      <section className="py-16 border-b border-slate-800 bg-gradient-to-b from-slate-900 to-[#060D1A]">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00C8FF]/10 border border-[#00C8FF]/20 text-[#00C8FF] text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            <span>Platform Hizmetleri</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
            {lang === "en" ? "Cybersecurity Services" : "Siber Güvenlik Hizmetleri"}
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Kara liste izleme, marka koruma, veri sızıntısı tespiti ve aylık CISO raporu —
            KOBİ'ler için Türkçe, tek platformda.
          </p>
        </div>
      </section>

      {/* Service Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  id={service.id}
                  className={`rounded-2xl border p-7 flex flex-col gap-5 ${service.color} scroll-mt-20`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`h-12 w-12 rounded-xl ${service.iconBg} flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${service.iconColor}`} />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00C8FF]/20 text-[#00C8FF] border border-[#00C8FF]/30">
                      {service.badge}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold mb-3">{service.title}</h2>
                    <p className="text-slate-300 text-sm leading-relaxed">{service.description}</p>
                  </div>

                  <ul className="space-y-2">
                    {service.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className={`h-4 w-4 ${service.iconColor} shrink-0 mt-0.5`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <Link
                      href={service.href}
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${service.iconColor} hover:opacity-80 transition-opacity`}
                    >
                      Detaylı İncele
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-slate-800">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ücretsiz Başlayın</h2>
          <p className="text-slate-300 mb-8">
            20 dakikada şirketinizin güvenlik riskini öğrenin.
            Tüm hizmetler mini assessment ile başlar.
          </p>
          <Link
            href="/assessment/start"
            className="inline-flex items-center justify-center gap-2 bg-[#00C8FF] text-[#060D1A] font-semibold px-8 py-4 rounded-lg hover:bg-[#00C8FF]/90 transition-colors"
          >
            Ücretsiz Değerlendirme Başlat
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
