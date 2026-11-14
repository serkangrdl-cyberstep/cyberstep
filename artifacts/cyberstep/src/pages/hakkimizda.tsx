/**
 * Hakkımızda — TPRM odaklı yapı (Kasım 2026).
 * Eski sürümler: pages/archive/hakkimizda-legacy.tsx ve pages/archive/neden-cyberstep-legacy.tsx
 * (/neden-cyberstep artık buraya yönlenir; isim hikayesi ve ekip bu sayfada).
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Footprints, Eye, Scale, Gauge, MapPin, ShieldCheck, ArrowRight, Users, Radar, FileSearch } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function Hakkimizda() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const tx = (tr: string, eng: string) => (en ? eng : tr);

  usePageMeta({
    title: tx("Hakkımızda | CyberStep.io", "About Us | CyberStep.io"),
    description: tx(
      "CyberStep, Türk şirketlerinin tedarikçilerinin siber riskini dışarıdan, ölçülebilir ve şeffaf biçimde görmesini sağlar. Türkiye odaklı veritabanı, açık metodoloji, sürekli izleme.",
      "CyberStep lets Turkish companies see their suppliers' cyber risk from the outside, measurably and transparently. A Türkiye-focused database, open methodology and continuous monitoring.",
    ),
    canonicalPath: "/hakkimizda",
    lang,
  });

  const { data: bench } = useQuery<{ available: boolean; sampleSize?: number }>({
    queryKey: ["home-benchmark"],
    queryFn: () => fetch("/api/domain-scan/benchmark?score=50").then((r) => r.json()),
    staleTime: 600_000,
  });
  const domainCount = bench?.available && bench.sampleSize
    ? bench.sampleSize.toLocaleString(en ? "en-US" : "tr-TR")
    : null;

  const stats = [
    { value: domainCount ?? tx("Yüz binlerce", "Hundreds of thousands"), label: tx("sürekli taranan Türk alan adı", "Turkish domains continuously scanned") },
    { value: "6", label: tx("ağırlıklı risk kategorisi", "weighted risk categories") },
    { value: tx("Her gün", "Daily"), label: tx("yeni alan adı keşfi", "new domain discovery") },
    { value: "0", label: tx("tedarikçiden istenen kurulum veya onay", "installs or approvals needed from suppliers") },
  ];

  const principles = [
    {
      icon: Eye,
      title: tx("Dışarıdan, sormadan", "Outside-in, no questionnaires"),
      desc: tx(
        "Saldırgan da tedarikçinize anket göndermez. Biz de yalnızca herkese açık, dışarıdan doğrulanabilen sinyallere bakarız: DNS ve e-posta kayıtları, sertifikalar, internete açık servisler, zafiyetler, itibar listeleri.",
        "Attackers don't send questionnaires either. We only use public, externally verifiable signals: DNS and e-mail records, certificates, internet-facing services, vulnerabilities and reputation lists.",
      ),
    },
    {
      icon: Scale,
      title: tx("Şeffaf metodoloji", "Transparent methodology"),
      desc: tx(
        "Skorun nasıl hesaplandığı açıkça yayımlanır. Ölçülemeyen hiçbir şey “temiz” sayılmaz; aktif sömürülen bir zafiyet ortalamanın arkasına saklanamaz.",
        "How the score is calculated is published openly. Nothing unmeasured is counted as clean, and an actively exploited vulnerability can't hide behind an average.",
      ),
    },
    {
      icon: MapPin,
      title: tx("Türkiye'ye özgü", "Built for Türkiye"),
      desc: tx(
        "Türk alan adlarından oluşan veritabanı, USOM kayıtları, Türkçe raporlar, KVKK ve BDDK bağlamı ve Türkiye sektörlerine göre kıyaslama. Global araçların atladığı yerel ayrıntılar.",
        "A database of Turkish domains, USOM records, Turkish-language reports, KVKK and BDDK context and Turkish sector benchmarks — the local detail global tools miss.",
      ),
    },
  ];

  const steps = [
    { icon: Radar, title: tx("Sürekli keşif", "Continuous discovery"), desc: tx("Sertifika şeffaflık kayıtları, sanayi odaları, ihracatçı birlikleri ve kamu listelerinden her gün yeni Türk alan adları keşfedilir.", "New Turkish domains are discovered daily from certificate transparency logs, chambers of industry, exporter associations and public lists.") },
    { icon: FileSearch, title: tx("Tarama ve zenginleştirme", "Scanning & enrichment"), desc: tx("Her alan adı e-posta güvenliği, TLS, açık portlar, zafiyetler, sızıntılar ve itibar açısından taranır; sektör bilgisiyle zenginleştirilir.", "Each domain is scanned for e-mail security, TLS, open ports, vulnerabilities, breaches and reputation, and enriched with sector data.") },
    { icon: Gauge, title: tx("Skor ve kıyaslama", "Score & benchmark"), desc: tx("Risk Skoru v2 hesaplanır, sektördeki diğer şirketlerle kıyaslanır ve değişiklikler izlenir.", "Risk Score v2 is calculated, benchmarked against the sector and tracked over time.") },
    { icon: ShieldCheck, title: tx("Aksiyon", "Action"), desc: tx("Müşterilerimiz uyarı, rapor ve tedarikçi anketiyle riski yönetir; tedarikçiler bulguları düzeltip skorlarını kanıtlar.", "Customers manage risk with alerts, reports and supplier questionnaires; suppliers fix findings and prove their score.") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl text-center relative z-10 space-y-5">
          <p className="text-sm font-medium text-primary">{tx("Hakkımızda", "About us")}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            {tx("Türk şirketlerinin tedarik zincirini görünür kılıyoruz.", "We make Turkish companies' supply chains visible.")}
          </h1>
          <p className="text-lg text-white/80">
            {tx(
              "Bir şirketin güvenliği, en zayıf tedarikçisi kadar güçlüdür. CyberStep, şirketlerin yüzlerce tedarikçisinin siber riskini tek tek anket göndermeden, dışarıdan ve sürekli olarak ölçmesini sağlar.",
              "A company is only as secure as its weakest supplier. CyberStep lets companies measure the cyber risk of hundreds of suppliers continuously, from the outside, without sending questionnaires one by one.",
            )}
          </p>
        </div>
      </section>

      {/* Rakamlar */}
      <section className="py-10 border-b bg-card">
        <div className="container mx-auto px-4 max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* İsim: adım ve ayak izi */}
      <section className="py-16 bg-background" id="isim">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Footprints className="h-5 w-5 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">{tx("İsmimiz: adım ve ayak izi", "Our name: a step and a footprint")}</h2>
          </div>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              {tx(
                "İngilizcede “step” hem adım hem de ayak izi demek. Siber güvenlik bir gecede tamamlanmaz; doğru adımlar doğru sırayla atılır. Ama önce nerede durduğunuzu görmeniz gerekir.",
                "In English, “step” means both a move forward and a footprint. Cybersecurity isn't finished overnight; the right steps are taken in the right order. But first you need to see where you stand.",
              )}
            </p>
            <p>
              {tx(
                "Her şirketin internette bıraktığı bir dijital ayak izi var: alan adları, e-posta kayıtları, açık servisler, sertifikalar. Saldırganların ilk baktığı yer burası. CyberStep bu ayak izini ölçer; önce kendi şirketiniz için, sonra iş yaptığınız her tedarikçi için.",
                "Every company leaves a digital footprint online: domains, e-mail records, open services, certificates. It's the first place attackers look. CyberStep measures that footprint — first for your own company, then for every supplier you work with.",
              )}
            </p>
          </div>
        </div>
      </section>

      {/* İlkeler */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{tx("Nasıl düşünüyoruz", "How we think")}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {principles.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-6">
                <Icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section className="py-16 bg-background" id="nasil-calisir">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{tx("Platform nasıl çalışır?", "How the platform works")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="rounded-xl border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-6">
            <Link href="/metodoloji" className="text-sm font-medium text-primary hover:underline">{tx("Skor metodolojisi →", "Scoring methodology →")}</Link>
          </p>
        </div>
      </section>

      {/* Ekip */}
      <section className="py-16 bg-muted/30 border-y" id="ekibimiz">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">{tx("Ekibimiz", "Our team")}</h2>
          </div>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              {tx(
                "CyberStep; kurumsal güvenlik altyapıları, Türkiye'deki kurumsal satış ve kanal süreçleri ile yazılım geliştirme alanlarında uzun yıllara dayanan deneyimi bir araya getiren küçük ve odaklı bir ekip tarafından geliştiriliyor.",
                "CyberStep is built by a small, focused team that combines long experience in enterprise security infrastructure, enterprise sales and channel processes in Türkiye, and software development.",
              )}
            </p>
            <p>
              {tx(
                "Platformun büyük bölümü otomasyonla çalışır: keşif, tarama, skorlama ve izleme insan müdahalesi beklemeden sürer. Bu sayede binlerce tedarikçiyi sürekli izlemek, erişilebilir bir maliyetle mümkün olur.",
                "Most of the platform runs on automation: discovery, scanning, scoring and monitoring continue without waiting for human intervention. That's what makes continuously monitoring thousands of suppliers affordable.",
              )}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-4">
          <h2 className="text-3xl font-bold text-white">{tx("Birlikte çalışalım", "Let's work together")}</h2>
          <p className="text-white/70">
            {tx(
              "Bankalar, sigorta şirketleri, holdingler ve kurumsal satın alma ekipleriyle çalışıyoruz. İş ortaklığı ve entegrasyon için de bize ulaşın.",
              "We work with banks, insurers, holdings and procurement teams. Reach out for partnerships and integrations too.",
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/iletisim?konu=Demo talebi" className="inline-flex items-center justify-center rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6">
              {tx("Demo talep et", "Request a demo")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/is-ortakligi" className="inline-flex items-center justify-center rounded-md font-medium border border-white/20 text-white hover:bg-white/10 h-12 px-6">
              {tx("İş ortaklığı", "Partner program")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
