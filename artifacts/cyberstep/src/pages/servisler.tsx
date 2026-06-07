import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { CheckCircle2, ChevronRight, ArrowRight, Shield, Network, Globe, FileText, Building2, ScrollText, Activity, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";

interface ServiceCatalogItem {
  id: number;
  slug: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  features: string[];
  howItWorks: { step: string; desc: string }[];
  faq: { q: string; a: string }[];
  monthlyPriceTl: string;
  setupFeeTl: string;
  category: string;
  icon: string;
  isActive: boolean;
}

const ICONS: Record<string, React.ElementType> = {
  Network, Globe, FileText, Building2, ScrollText, Activity, Server, Shield,
};

const CATEGORY_COLORS: Record<string, string> = {
  soc: "bg-red-500/20 text-red-300 border-red-500/30",
  monitoring: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  compliance: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  itsm: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function fmtTL(val: string | number) {
  return new Intl.NumberFormat("tr-TR").format(Number(val));
}

const STATIC_SERVICES: ServiceCatalogItem[] = [
  {
    id: 0, slug: "fortinet-fabric", label: "Fortinet Security Fabric", category: "soc", icon: "Network",
    shortDescription: "FortiGate, FortiAnalyzer ve FortiSIEM entegrasyonuyla ağınızdaki tehditleri gerçek zamanlı izleyin ve otomatik bloklama yapın.",
    longDescription: "Fortinet Security Fabric, şirket ağınızdaki tüm güvenlik cihazlarını tek bir merkezi platform üzerinden yönetmenizi sağlar. CyberStep SOC analistleri 7/24 olayları izler, kritik tehditleri önceliklendirir ve gerektiğinde otomatik bloklama gerçekleştirir.",
    features: ["Gerçek zamanlı olay korelasyonu","Otomatik tehdit bloklama (FortiManager API)","SOC analist triage ve eskalasyon","Aylık güvenlik raporu","FortiGate, FortiAnalyzer, FortiSIEM entegrasyonu","MITRE ATT&CK eşleme"],
    howItWorks: [{step:"Bağlantı Kurulumu",desc:"FortiManager API kimlik bilgilerini güvenli şekilde sisteme tanımlarsınız."},{step:"İzleme Başlar",desc:"SOC motoru olayları gerçek zamanlı olarak toplar ve korelasyon yapar."},{step:"Müdahale",desc:"Kritik tehditler için otomatik bloklama veya SOC analist triage devreye girer."}],
    faq: [{q:"Mevcut Fortinet lisansım var, ek ücret öder miyim?",a:"Hayır. Bu servis yalnızca CyberStep SOC entegrasyonu ve yönetim hizmetini kapsar. Fortinet lisanslarınız değişmez."},{q:"Kaç cihaza kadar destekleniyor?",a:"Başlangıç paketinde 5 FortiGate cihazına kadar destek verilir. Ek cihazlar için özel fiyatlandırma uygulanır."},{q:"Kurulum ne kadar sürer?",a:"Ortalama 2-3 iş günü içinde entegrasyon tamamlanır."}],
    monthlyPriceTl: "4990.00", setupFeeTl: "2500.00", isActive: true,
  },
  {
    id: 0, slug: "dns-izleme", label: "DNS İzleme", category: "monitoring", icon: "Globe",
    shortDescription: "Alan adlarınızdaki değişiklikleri 5 dakikada bir denetleyin; yetkisiz subdomain, NS veya MX değişikliklerinde anında uyarı alın.",
    longDescription: "DNS kayıt değişiklikleri genellikle siber saldırıların ilk belirtisidir. CyberStep DNS İzleme servisi, alan adlarınızı 5 dakikada bir tarar ve herhangi bir kayıt değişikliğinde anında bildirim gönderir.",
    features: ["5 dakikada bir otomatik tarama","Subdomain, NS, MX, A, AAAA kayıt takibi","E-posta ve webhook uyarısı","Değişiklik geçmişi ve raporlama","Çoklu domain desteği"],
    howItWorks: [{step:"Domain Ekleme",desc:"Takip etmek istediğiniz domain adlarını sisteme eklersiniz."},{step:"Sürekli İzleme",desc:"Her 5 dakikada bir tüm DNS kayıtları otomatik olarak sorgulanır."},{step:"Anlık Uyarı",desc:"Herhangi bir kayıt değişikliğinde anında e-posta veya webhook bildirimi alırsınız."}],
    faq: [{q:"Kaç domain takip edebilirim?",a:"Başlangıç paketinde 5 domaine kadar destek verilir. Ek domain paketleri mevcuttur."},{q:"Hangi DNS kayıt türleri izleniyor?",a:"A, AAAA, MX, NS, TXT, CNAME, SOA ve subdomain kayıtları izlenir."},{q:"Uyarılar ne kadar sürede gelir?",a:"Maksimum 5 dakika gecikme ile gerçek zamanlı uyarı alırsınız."}],
    monthlyPriceTl: "990.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "ct-log-izleme", label: "CT Log İzleme", category: "monitoring", icon: "ScrollText",
    shortDescription: "Alan adınız için dünyada verilen tüm SSL sertifikalarını izleyin; sahte sertifika tespitinde anında bildirim alın.",
    longDescription: "Certificate Transparency logları, tüm SSL/TLS sertifikalarının kamuya açık kaydedildiği sistemlerdir. Saldırganlar markanızı taklit etmek için sahte sertifikalar alabilir. CyberStep CT Log İzleme servisi bunu anında tespit eder.",
    features: ["crt.sh entegrasyonu","Sahte sertifika tespiti","Anlık uyarı sistemi","Wildcard sertifika izleme","Marka koruma desteği"],
    howItWorks: [{step:"Domain Tanımlama",desc:"İzlemek istediğiniz domain adlarını ve alt domainleri sisteme eklersiniz."},{step:"CT Log Tarama",desc:"Dünya genelindeki tüm sertifika otoritelerinin logları sürekli taranır."},{step:"Tespit ve Uyarı",desc:"Alan adınıza ait yeni sertifika verildiğinde anında bildirim alırsınız."}],
    faq: [{q:"CT logları nedir?",a:"Evet. CT log standartlarına uyan tüm sertifika otoritelerinin kayıtları izlenir."},{q:"Neden önemli?",a:"Saldırganlar markanızı taklit ederek sahte sertifika alabilir; bu servis bunu anında tespit eder."},{q:"Hangi sertifika türleri izleniyor?",a:"DV, OV ve EV dahil tüm SSL/TLS sertifikaları izlenir."}],
    monthlyPriceTl: "490.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "microsoft-365", label: "Microsoft 365 Entegrasyonu", category: "monitoring", icon: "Building2",
    shortDescription: "Azure AD riskli giriş olaylarını, şüpheli kullanıcı aktivitelerini ve lisans değişikliklerini otomatik olarak izleyin.",
    longDescription: "Microsoft 365 ve Azure AD, şirketlerin en kritik iş altyapısını barındırır. CyberStep M365 entegrasyonu, OAuth2 ile güvenli bağlantı kurarak kullanıcı aktivitelerini, riskli girişleri ve lisans değişikliklerini otomatik izler.",
    features: ["Azure AD OAuth2 güvenli bağlantı","Riskli giriş olayı korelasyonu","Kullanıcı risk skoru izleme","MFA bypass tespiti","Lisans ve rol değişikliği takibi"],
    howItWorks: [{step:"OAuth Bağlantısı",desc:"Microsoft hesabınızla güvenli OAuth2 bağlantısı kurarsınız. Şifre paylaşımı gerekmez."},{step:"Olay Toplama",desc:"Azure AD güvenlik olayları gerçek zamanlı olarak toplanır ve analiz edilir."},{step:"Uyarı ve Raporlama",desc:"Riskli girişler ve şüpheli aktiviteler için anında uyarı ve aylık rapor alırsınız."}],
    faq: [{q:"Microsoft şifremi paylaşmam gerekiyor mu?",a:"Hayır. Yalnızca read-only güvenlik izinleriyle OAuth2 bağlantısı kurulur."},{q:"Hangi M365 planlarını destekliyor?",a:"Business, E3 ve E5 planları desteklenir. Azure AD P2 lisansı önerilir."},{q:"Veri depolanıyor mu?",a:"Yalnızca olay meta verisi ve anomali özeti tutulur; e-posta içerikleri asla saklanmaz."}],
    monthlyPriceTl: "1490.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "kvkk-bildirim", label: "KVKK Bildirim Sistemi", category: "compliance", icon: "FileText",
    shortDescription: "Veri ihlali olaylarını KVKK'nın gerektirdiği 72 saat içinde Kurul'a bildirmek için hazır süreç ve dokümantasyon.",
    longDescription: "KVKK Madde 12 kapsamında veri sorumluları, kişisel veri ihlalini öğrendikten itibaren 72 saat içinde KVK Kurulu'na bildirmekle yükümlüdür. CyberStep KVKK Bildirim Sistemi bu süreci otomatize eder.",
    features: ["72 saatlik bildirim sürecini otomatize edin","Hazır bildirim şablonları","Olay kaydı ve delil zinciri","İlgili kişi bildirim desteği","KVKK uyum raporlaması"],
    howItWorks: [{step:"İhlal Tespiti",desc:"Veri ihlali tespit edildiğinde sistem otomatik olarak olay kaydı açar."},{step:"Belge Hazırlama",desc:"72 saat süreç takvimi başlar; bildirim belgesi otomatik hazırlanır."},{step:"Kurul Bildirimi",desc:"Hazırlanan bildirim formu gözden geçirilir ve KVK Kurulu'na iletilir."}],
    faq: [{q:"Sistem bildirimi otomatik mi yapıyor?",a:"Hayır. Sistem taslağı hazırlar, ancak onay ve gönderim yetkili kişi tarafından yapılır."},{q:"İlgili kişilere bildirim?",a:"Evet, etkilenen kişilere gönderilecek bildirim metni de otomatik oluşturulur."},{q:"Denetimde belge sunabiliyor muyum?",a:"Evet. Tüm süreç kayıt altına alınır ve denetim için delil paketi hazırlanır."}],
    monthlyPriceTl: "1990.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "servicenow", label: "ServiceNow Entegrasyonu", category: "itsm", icon: "Activity",
    shortDescription: "SOC vakalarını ServiceNow incident'larıyla çift yönlü senkronize edin. HMAC-SHA256 imzalı webhook ile güvenli entegrasyon.",
    longDescription: "Kurumsal ITSM sistemlerinde ServiceNow en yaygın platformdur. CyberStep SOC ile ServiceNow arasında çift yönlü vaka senkronizasyonu, güvenlik olaylarının IT süreçleriyle entegre yönetilmesini sağlar.",
    features: ["Çift yönlü vaka senkronizasyonu","HMAC-SHA256 güvenli webhook","SLA ihlali uyarısı","Otomatik incident oluşturma","Durum güncelleme ve kapanış takibi"],
    howItWorks: [{step:"Webhook Yapılandırması",desc:"ServiceNow'da Outbound REST Message ve Business Rule tanımlanır."},{step:"Senkronizasyon Başlar",desc:"CyberStep SOC vakası açıldığında ServiceNow'da otomatik incident oluşturulur."},{step:"Çift Yönlü Güncelleme",desc:"Her iki sistemdeki durum değişiklikleri birbirine anında yansır."}],
    faq: [{q:"Hangi ServiceNow sürümlerini destekliyor?",a:"Tokyo veya sonraki sürümler için tam destek verilir."},{q:"Mevcut workflow'larım etkilenir mi?",a:"Hayır. Entegrasyon mevcut workflow'ların yanına eklenir, değişiklik gerektirmez."},{q:"Webhook güvenliği nasıl sağlanıyor?",a:"HMAC-SHA256 imzası ile her istek doğrulanır; yetkisiz erişim engellenir."}],
    monthlyPriceTl: "2490.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "soc-operasyon", label: "SOC Operasyon Merkezi", category: "soc", icon: "Shield",
    shortDescription: "7/24 güvenlik operasyonları; triage, playbook yönetimi, eskalasyon ve olay müdahale desteği.",
    longDescription: "CyberStep SOC Operasyon Merkezi, şirketinize 7/24 güvenlik analist desteği sağlar. Tehdit triage, playbook tabanlı müdahale ve eskalasyon süreçleri ile güvenlik olaylarınız profesyonel ekipte yönetilir.",
    features: ["7/24 triage ve eskalasyon","Hazır playbook kütüphanesi","Aylık SOC raporu","SLA garantili müdahale süreleri","MITRE ATT&CK tabanlı tehdit analizi"],
    howItWorks: [{step:"SOC Atama",desc:"Şirketinize SOC analistleri atanır ve mevcut güvenlik araçlarınızla entegrasyon kurulur."},{step:"Sürekli İzleme",desc:"Tüm güvenlik olayları 7/24 izlenir, önceliklendirilir ve playbook ile işlenir."},{step:"Raporlama",desc:"Aylık kapsamlı SOC raporu ve tehdit istihbaratı özeti sunulur."}],
    faq: [{q:"Kendi SOC ekibimle çakışır mı?",a:"SOC ekibinizle entegre çalışır. Ek kapasite veya tam dış kaynak modeli seçilebilir."},{q:"Hangi güvenlik araçlarını destekliyor?",a:"Fortinet, Microsoft Sentinel, Splunk, QRadar ve daha fazlasıyla entegrasyon mevcuttur."},{q:"SLA nedir?",a:"Kritik olaylar için 15 dakika, yüksek öncelikli olaylar için 1 saat müdahale süresi garanti edilir."}],
    monthlyPriceTl: "9990.00", setupFeeTl: "0.00", isActive: true,
  },
  {
    id: 0, slug: "observability", label: "Observability & SIEM", category: "monitoring", icon: "Server",
    shortDescription: "Log kaynaklarınızı merkezi bir noktada toplayın; anomali tespiti ve öngörülü uyarılarla güvenlik görünürlüğünüzü artırın.",
    longDescription: "Merkezi log yönetimi ve SIEM, modern güvenlik operasyonlarının temelini oluşturur. CyberStep Observability servisi farklı kaynaklardan gelen logları normalleştirir, korelasyon yapar ve anomalileri tespit eder.",
    features: ["Çoklu log kaynağı bağlantısı","AI destekli anomali tespiti","Gerçek zamanlı dashboard","Özelleştirilebilir uyarı kuralları","Uzun süreli log arşivleme"],
    howItWorks: [{step:"Log Kaynağı Bağlantısı",desc:"Firewall, sunucu, uygulama ve bulut servislerinden loglar merkezi sisteme yönlendirilir."},{step:"Normalizasyon ve Korelasyon",desc:"Farklı formatlardaki loglar normalize edilir ve korelasyon kuralları uygulanır."},{step:"Uyarı ve Analiz",desc:"Anomaliler tespit edildiğinde anında uyarı gönderilir ve detaylı analiz sunulur."}],
    faq: [{q:"Kaç log kaynağı bağlanabilir?",a:"Başlangıç paketinde 10 log kaynağına kadar destek verilir."},{q:"Hangi log formatları destekleniyor?",a:"Syslog, JSON, CEF, LEEF ve özel format desteği mevcuttur."},{q:"Loglar ne kadar süre saklanır?",a:"Standart pakette 90 gün, genişletilmiş pakette 1 yıl arşivleme yapılır."}],
    monthlyPriceTl: "2990.00", setupFeeTl: "0.00", isActive: true,
  },
];

function NotFound() {
  const { lang } = useLanguage();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">
          {lang === "en" ? "Service Not Found" : "Servis Bulunamadı"}
        </h1>
        <p className="text-muted-foreground mb-4">
          {lang === "en" ? "The service you are looking for does not exist." : "Aradığınız servis mevcut değil."}
        </p>
        <Link href="/fiyatlar" className="text-primary hover:underline">
          {lang === "en" ? "All Services" : "Tüm Servisler"}
        </Link>
      </div>
    </div>
  );
}

export default function ServislerPage() {
  const [, params] = useRoute("/servisler/:slug");
  const slug = params?.slug ?? "";
  const { lang } = useLanguage();

  const CATEGORY_LABELS: Record<string, string> = {
    soc: lang === "en" ? "SOC & Security Operations" : "SOC & Güvenlik Operasyonları",
    monitoring: lang === "en" ? "Continuous Monitoring" : "Sürekli İzleme",
    compliance: lang === "en" ? "Compliance" : "Uyumluluk",
    itsm: lang === "en" ? "IT Service Management" : "IT Servis Yönetimi",
  };

  const { data: allServices = [], isLoading } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["public-service-catalog"],
    queryFn: () => fetch("/api/public/service-catalog").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const service = allServices.find(s => s.slug === slug) ?? (isLoading ? undefined : STATIC_SERVICES.find(s => s.slug === slug));

  usePageMeta({
    title: service ? `${service.label} | CyberStep.io` : (lang === "en" ? "Service | CyberStep.io" : "Servis | CyberStep.io"),
    description: service?.shortDescription ?? (lang === "en" ? "CyberStep.io enterprise security services" : "CyberStep.io kurumsal güvenlik servisleri"),
    canonicalPath: `/servisler/${slug}`,
  });

  if (isLoading && !service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">
          {lang === "en" ? "Loading..." : "Yükleniyor..."}
        </div>
      </div>
    );
  }

  if (!service) return <NotFound />;

  const Icon = ICONS[service.icon] ?? Shield;
  const catColor = CATEGORY_COLORS[service.category] ?? "bg-primary/20 text-primary border-primary/30";
  const features: string[] = Array.isArray(service.features) ? service.features : [];
  const howItWorks: { step: string; desc: string }[] = Array.isArray(service.howItWorks) ? service.howItWorks : [];
  const faq: { q: string; a: string }[] = Array.isArray(service.faq) ? service.faq : [];
  const hasSetup = Number(service.setupFeeTl) > 0;

  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="py-20 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <Badge className={`border text-xs font-semibold px-3 py-1 ${catColor}`}>
                {CATEGORY_LABELS[service.category] ?? service.category}
              </Badge>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">{service.label}</h1>
            <p className="text-lg text-white/80 mb-8 leading-relaxed max-w-2xl">{service.shortDescription}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/satin-al/${service.slug}`}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                {lang === "en" ? "Get Started" : "Hemen Başla"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/iletisim?servis=${service.slug}`}
                className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary/10 transition-colors"
              >
                {lang === "en" ? "Request Demo" : "Demo İste"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Price + features */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Features list */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6">
                {lang === "en" ? "What's included?" : "Neler dahil?"}
              </h2>
              {features.length > 0 ? (
                <ul className="space-y-3">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  {lang === "en" ? "Feature list coming soon." : "Özellik listesi yakında eklenecek."}
                </p>
              )}

              {service.longDescription && (
                <div className="mt-8 prose prose-sm max-w-none text-muted-foreground">
                  <p>{service.longDescription}</p>
                </div>
              )}
            </div>

            {/* Price card */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {lang === "en" ? "Monthly Price" : "Aylık Fiyat"}
                </p>
                <p className="text-4xl font-bold text-primary mb-1">{fmtTL(service.monthlyPriceTl)} TL</p>
                <p className="text-sm text-muted-foreground mb-1">
                  {lang === "en" ? "monthly + VAT" : "aylık + KDV"}
                </p>
                {hasSetup && (
                  <p className="text-xs text-muted-foreground mb-4">
                    + {fmtTL(service.setupFeeTl)} TL {lang === "en" ? "setup fee (one-time)" : "kurulum ücreti (tek seferlik)"}
                  </p>
                )}
                <div className="space-y-2 mt-4">
                  <Link
                    href={`/satin-al/${service.slug}`}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                  >
                    {lang === "en" ? "Buy Now" : "Satın Al"} <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/iletisim?servis=${service.slug}`}
                    className="w-full flex items-center justify-center gap-2 border border-border py-3 rounded-xl font-medium hover:bg-muted/50 transition-colors text-sm"
                  >
                    {lang === "en" ? "Request Demo" : "Demo İste"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      {howItWorks.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl font-bold text-center mb-10">
              {lang === "en" ? "How does it work?" : "Nasıl çalışır?"}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {howItWorks.map((step, i) => (
                <div key={i} className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold text-lg">{i + 1}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.step}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl font-bold text-center mb-8">
              {lang === "en" ? "Frequently Asked Questions" : "Sık Sorulan Sorular"}
            </h2>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <details key={i} className="group border rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium list-none hover:bg-muted/40 transition-colors">
                    {item.q}
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            {lang === "en"
              ? `Ready to get started with ${service.label}?`
              : `${service.label} için hazır mısınız?`}
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            {lang === "en"
              ? "Request a free demo or buy now and start your service."
              : "Ücretsiz demo talebinde bulunun veya hemen satın alarak hizmetinizi başlatın."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/satin-al/${service.slug}`} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              {lang === "en" ? "Get Started" : "Hemen Başla"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/fiyatlar" className="inline-flex items-center gap-2 border border-primary/30 text-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary/10 transition-colors">
              {lang === "en" ? "All Services" : "Tüm Servisler"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
