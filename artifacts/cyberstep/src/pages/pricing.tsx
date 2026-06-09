import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, ChevronRight, Shield, Users, Clock, Award, UserCheck,
  Eye, FileText, Zap, Network, Mail, Layers, Cpu, Plus, Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRICING_PLANS } from "@/lib/constants";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";

interface DbPlan { id: number; slug: string; name: string; price: string; currency: string; isActive: boolean; }

type CompRow =
  | { header: true; label: string }
  | { header?: false; label: string; mini: string | boolean; full: string | boolean };

export default function Pricing() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en" ? "Services & Pricing | CyberStep.io" : "Hizmetler & Fiyatlar | CyberStep.io",
    description: lang === "en"
      ? "Cybersecurity services and pricing for SMEs. Start with a free Mini Assessment, explore SOC, EASM, TPRM and more."
      : "KOBİ'ler icin siber guvenlik hizmetleri ve fiyatları. Ucretsiz Mini Degerlendirme ile baslayin, SOC, EASM, TPRM ve daha fazlasını kesfin.",
    keywords: "cybersecurity services, cybersecurity pricing, SOC service price, EASM price, TPRM price",
    canonicalPath: "/fiyatlar",
  });

  const [openAddon, setOpenAddon] = useState<string | null>(null);

  useEffect(() => {
    const id = "ld-json-service";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "CyberStep Siber Güvenlik Değerlendirmesi",
      "provider": { "@type": "Organization", "name": "CyberStep.io", "url": "https://cyberstep.io" },
      "offers": [
        { "@type": "Offer", "name": "Mini Değerlendirme", "price": "0", "priceCurrency": "TRY", "description": "20 soruluk ücretsiz siber güvenlik risk değerlendirmesi", "url": "https://cyberstep.io/degerlendirme" },
        { "@type": "Offer", "name": "Tam Değerlendirme", "price": "5990", "priceCurrency": "TRY", "description": "60 soruluk kapsamlı güvenlik değerlendirmesi, sektör karşılaştırması ve uzman danışmanlık", "url": "https://cyberstep.io/fiyatlar" },
      ],
      "areaServed": "TR",
      "availableLanguage": "Turkish",
    });
    return () => { el?.remove(); };
  }, []);

  const TRUST_ITEMS = [
    { icon: Shield,    text: lang === "en" ? "256-bit SSL encrypted secure payment"         : "256-bit SSL şifreli güvenli ödeme" },
    { icon: Users,     text: lang === "en" ? "Preferred by 500+ companies"                  : "500+ şirket tarafından tercih edildi" },
    { icon: Clock,     text: lang === "en" ? "Expert validation included in Full Assessment" : "Tam Değerlendirme'de uzman doğrulaması dahil" },
    { icon: Award,     text: lang === "en" ? "KVKK-compliant data processing"               : "KVKK uyumlu veri işleme" },
  ];

  const COMPARISON_ROWS: CompRow[] = [
    { header: true, label: lang === "en" ? "Assessment" : "Değerlendirme" },
    { label: lang === "en" ? "Number of questions"                          : "Soru sayısı",                                  mini: "20",                                full: "60" },
    { label: lang === "en" ? "Security domains"                             : "Güvenlik alanı",                               mini: "5",                                 full: "10" },
    { label: lang === "en" ? "Instant risk score and red alarm"             : "Anlık risk skoru ve kırmızı alarm",            mini: true,                                full: true },
    { label: lang === "en" ? "AI report"                                    : "Yapay zeka raporu",                            mini: lang === "en" ? "Basic" : "Temel",   full: lang === "en" ? "Detailed" : "Detaylı" },
    { label: lang === "en" ? "Sector comparison"                            : "Sektörel karşılaştırma",                       mini: false,                               full: true },
    { label: lang === "en" ? "PDF report download"                          : "PDF rapor indirme",                            mini: false,                               full: true },
    { label: lang === "en" ? "Detailed prioritized action plan"             : "Detaylı öncelikli aksiyon planı",              mini: false,                               full: true },
    { label: lang === "en" ? "1-on-1 expert session (1 hour)"              : "Birebir uzman görüşmesi (1 saat)",             mini: false,                               full: true },
    { label: lang === "en" ? "30-day automated re-scan"                     : "30 günlük otomatik yeniden tarama",            mini: false,                               full: true },
    { header: true, label: lang === "en" ? "Domain Scanning" : "Alan Adı Tarama" },
    { label: "SPF / DMARC / DKIM / MX / SSL",                                                                                  mini: true,                                full: true },
    { label: lang === "en" ? "HIBP data breach check"                       : "HIBP veri sızıntısı kontrolü",                 mini: true,                                full: true },
    { label: lang === "en" ? "Blacklist and Shadow IT detection"            : "Kara liste ve Shadow IT tespiti",              mini: true,                                full: true },
    { label: lang === "en" ? "HTTP security header analysis"               : "HTTP güvenlik başlıkları analizi",             mini: false,                               full: true },
    { label: lang === "en" ? "URLhaus malicious URL check"                 : "URLhaus zararlı URL kontrolü",                 mini: false,                               full: true },
    { label: lang === "en" ? "USOM blacklist domain scan"                  : "USOM kara liste domain taraması",              mini: false,                               full: true },
    { label: lang === "en" ? "crt.sh Certificate Transparency (subdomain)" : "crt.sh Alt Alan Şeffaflığı (subdomain)",       mini: false,                               full: true },
    { label: lang === "en" ? "NIST NVD CVE vulnerability scan"             : "NIST NVD CVE güvenlik açığı taraması",        mini: false,                               full: true },
    { label: lang === "en" ? "VirusTotal domain reputation scan"           : "VirusTotal domain reputation taraması",       mini: false,                               full: true },
    { label: lang === "en" ? "AbuseIPDB IP abuse history"                  : "AbuseIPDB IP kötüye kullanım geçmişi",        mini: false,                               full: true },
    { label: lang === "en" ? "Shodan internet exposure scan"               : "Shodan internet maruziyet taraması",          mini: false,                               full: lang === "en" ? "Paid" : "Ücretli" },
    { header: true, label: lang === "en" ? "Compliance" : "Uyumluluk" },
    { label: lang === "en" ? "KVKK Article 12 Technical Measure Map"       : "KVKK Madde 12 Teknik Tedbir Haritası",        mini: false,                               full: true },
    { label: lang === "en" ? "NIST CSF 2.0 Compliance Level"               : "NIST CSF 2.0 Uyum Seviyesi",                  mini: false,                               full: true },
    { header: true, label: lang === "en" ? "Free Security Tools (All Plans)" : "Ücretsiz Güvenlik Araçları (Tüm Paketlerde)" },
    { label: lang === "en" ? "Dark Web Leak Monitor"                        : "Karanlık Web Sızıntı İzleyici",               mini: true,                                full: true },
    { label: lang === "en" ? "KVKK VERBİS Obligation Check"                : "KVKK VERBİS Yükümlülük Kontrolü",             mini: true,                                full: true },
    { label: lang === "en" ? "KVKK Administrative Penalty Simulator"       : "KVKK İdari Ceza Simülatörü",                  mini: true,                                full: true },
    { label: lang === "en" ? "Microsoft 365 Security Audit Checklist"      : "Microsoft 365 Güvenlik Denetim Listesi",      mini: true,                                full: true },
    { label: lang === "en" ? "Cyber Insurance Premium Calculator"          : "Siber Sigorta Prim Hesaplayıcı",              mini: true,                                full: true },
    { label: lang === "en" ? "KEP Need Assessment"                          : "KEP İhtiyaç Değerlendirmesi",                 mini: true,                                full: true },
    { label: lang === "en" ? "ERP Security Scan Checklist"                 : "ERP Güvenlik Tarama Listesi",                 mini: true,                                full: true },
    { label: lang === "en" ? "Sector Cybersecurity Benchmarking"           : "Sektörel Siber Güvenlik Kıyaslama",           mini: true,                                full: true },
    { label: lang === "en" ? "Phishing Email Awareness Test"               : "Phishing E-posta Farkındalık Testi",          mini: true,                                full: true },
    { label: lang === "en" ? "Domain Security Quick Scan"                  : "Alan Adı Güvenlik Hızlı Tarama",              mini: true,                                full: true },
  ];

  const { data: dbPlansRaw } = useQuery<DbPlan[]>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const dbPlans = Array.isArray(dbPlansRaw) ? dbPlansRaw : [];
  const fullDbPlan = dbPlans.find(p => p.slug === "full");
  const fullPriceLabel = fullDbPlan ? (new Intl.NumberFormat("tr-TR").format(parseFloat(String(fullDbPlan.price))) + (lang === "en" ? " TL + VAT" : " TL + KDV")) : PRICING_PLANS[1].priceLabel;

  const plans = PRICING_PLANS.map(p =>
    p.id === "full" && fullDbPlan
      ? { ...p, priceLabel: fullPriceLabel }
      : p
  );

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <section className="py-16 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <Badge className="bg-primary/20 text-primary border-primary/40 mb-4">
            {lang === "en" ? "Services & Pricing" : "Hizmetler & Fiyatlar"}
          </Badge>
          <h1 className="text-4xl font-bold text-white mb-4">
            {lang === "en" ? "Cybersecurity Services with Transparent Pricing" : "Şeffaf Fiyatlarla Siber Güvenlik Hizmetleri"}
          </h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            {lang === "en"
              ? "Mini assessment is free. Explore the service catalog below for SOC, EASM, TPRM and more."
              : "Mini değerlendirme ücretsiz. SOC, EASM, TPRM ve daha fazlası için aşağıdaki hizmet kataloğunu inceleyin."}
          </p>
        </div>
      </section>

      {/* 4 Tier — Karar Kolaylaştırıcı */}
      <section className="py-16 bg-background border-b">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {lang === "en" ? "Choose your protection level" : "Koruma seviyenizi seçin"}
            </p>
            <h2 className="text-3xl font-bold mb-3">
              {lang === "en" ? "4 Packages. Everything runs in the background." : "4 Paket. Her şey perde arkasında çalışır."}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              {lang === "en"
                ? "No agent to install, no IT hassle. Just enter your domain — we handle the rest."
                : "Sisteminize hiçbir şey kurulmaz, IT'niz rahatsız edilmez. Sadece domain adınızı girin — gerisini biz hallederiz."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Tier 1 — Kalkan */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {lang === "en" ? "Starter" : "Başlangıç"}
                </p>
                <h3 className="text-lg font-bold mb-1">CyberStep Kalkan</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "Know your security posture. Get alerted when something changes."
                    : "Güvenlik durumunuzu öğrenin. Bir şey değişince haberdar olun."}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">₺2.990 <span className="text-sm font-normal text-muted-foreground">/ {lang === "en" ? "mo" : "ay"}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "1–50 employees" : "1–50 çalışan"}</p>
              </div>
              <ul className="space-y-1.5 flex-1 text-xs">
                {(lang === "en"
                  ? ["Domain Security Scan", "DNS Monitoring", "Fake Domain Early Alert", "CVE Impact Alerts", "Mini Assessment + AI Report"]
                  : ["Domain Güvenlik Taraması", "DNS İzleme", "Sahte Domain Erken Uyarı", "CVE Etki Uyarıları", "Mini Değerlendirme + AI Rapor"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/iletisim" className="block w-full text-center border-2 border-primary text-primary py-2 rounded-xl text-sm font-semibold hover:bg-primary/10 transition-colors">
                {lang === "en" ? "Get a Quote" : "Teklif Al"}
              </Link>
            </div>

            {/* Tier 2 — Zırh (recommended) */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 flex flex-col gap-4 relative shadow-md">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                  {lang === "en" ? "Most Popular" : "En Çok Tercih Edilen"}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {lang === "en" ? "Protection" : "Koruma"}
                </p>
                <h3 className="text-lg font-bold mb-1">CyberStep Zırh</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "Full protection with Threat Intel, Board Reports, and KVKK tracking."
                    : "Tehdit İstihbaratı, Yönetim Kurulu Raporu ve KVKK takibiyle tam koruma."}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">₺5.990 <span className="text-sm font-normal text-muted-foreground">/ {lang === "en" ? "mo" : "ay"}</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "50–250 employees" : "50–250 çalışan"}</p>
              </div>
              <ul className="space-y-1.5 flex-1 text-xs">
                {(lang === "en"
                  ? ["Everything in Kalkan", "Threat Intelligence (Starter)", "Board Report (monthly)", "KVKK Notification System", "Dark Web Monitoring", "Attack Surface Analysis"]
                  : ["Kalkan'daki her şey", "Tehdit İstihbaratı (Starter)", "Yönetim Kurulu Raporu (aylık)", "KVKK Bildirim Sistemi", "Dark Web İzleme", "Saldırı Yüzeyi Analizi"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/iletisim" className="block w-full text-center bg-primary text-primary-foreground py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                {lang === "en" ? "Get a Quote" : "Teklif Al"}
              </Link>
            </div>

            {/* Tier 3 — vCISO */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {lang === "en" ? "Platform + Expert" : "Platform + Uzman"}
                </p>
                <h3 className="text-lg font-bold mb-1">CyberStep vCISO</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "Platform automates 80%. Trusted expert partner handles the rest."
                    : "Platform %80'ini otomatikleştirir. Uzman iş ortağı kalanı yönetir."}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  ₺4.990
                  <span className="text-sm font-normal text-muted-foreground"> {lang === "en" ? "/ mo — from" : "/ ay'dan"}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? "100–500 employees · 3 tiers" : "100–500 çalışan · 3 seviye"}
                </p>
              </div>
              <ul className="space-y-1.5 flex-1 text-xs">
                {(lang === "en"
                  ? ["Everything in Zırh", "Monthly/quarterly expert sessions", "Risk Register & security roadmap", "Board presentation support", "Compliance audit preparation"]
                  : ["Zırh'taki her şey", "Aylık/çeyreklik uzman görüşmeleri", "Risk Kaydı ve güvenlik yol haritası", "Yönetim kurulu sunum desteği", "Uyum denetimi hazırlığı"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/ciso-asistan-paketi" className="block w-full text-center border-2 border-primary text-primary py-2 rounded-xl text-sm font-semibold hover:bg-primary/10 transition-colors">
                {lang === "en" ? "See All Tiers" : "Tüm Seviyeleri Gör"}
              </Link>
            </div>

            {/* Tier 4 — Tam Yönetilen */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 dark:bg-slate-900/80 p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {lang === "en" ? "Fully Managed" : "Tam Yönetilen"}
                </p>
                <h3 className="text-lg font-bold text-white mb-1">
                  {lang === "en" ? "SOC/NOC Managed Service" : "SOC/NOC Yönetilen Servis"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === "en"
                    ? "24/7 SOC + NOC operations center. Threat triage, playbooks, escalation and network management — all in one."
                    : "7/24 SOC + NOC operasyon merkezi. Tehdit triage, playbook, eskalasyon ve ağ yönetimi — tek çatı altında."}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {lang === "en" ? "Custom" : "Teklif Bazlı"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{lang === "en" ? "500+ employees" : "500+ çalışan"}</p>
              </div>
              <ul className="space-y-1.5 flex-1 text-xs">
                {(lang === "en"
                  ? ["Everything in vCISO Lider", "24/7 SOC — triage + playbook + escalation", "NOC — uptime, anomaly detection, capacity", "Fortinet / ServiceNow integrations", "Dedicated security operations team"]
                  : ["vCISO Lider'deki her şey", "7/24 SOC — triage + playbook + eskalasyon", "NOC — uptime, anomali tespiti, kapasite", "Fortinet / ServiceNow entegrasyonları", "Adanmış güvenlik operasyonları ekibi"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/iletisim" className="block w-full text-center bg-white text-slate-900 py-2 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors">
                {lang === "en" ? "Contact Sales" : "Satış Ekibiyle Görüş"}
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {lang === "en"
              ? "All packages include a 14-day free trial. Prices are excl. VAT. Enterprise pricing on request."
              : "Tüm paketlerde 14 gün ücretsiz deneme. Fiyatlar KDV hariçtir. Kurumsal fiyatlandırma için teklif alın."}
          </p>
        </div>
      </section>

      {/* Add-on Menüsü */}
      <section className="py-14 bg-muted/30 border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {lang === "en" ? "Customize your package" : "Paketinizi özelleştirin"}
            </p>
            <h2 className="text-2xl font-bold mb-2">
              {lang === "en" ? "Add-on Services" : "Ek Servisler"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              {lang === "en"
                ? "Each add-on group can be added to any package. One-time or subscription — your choice."
                : "Her ek servis grubu herhangi bir pakete eklenebilir. Tek seferlik veya abonelik — sizin tercihiniz."}
            </p>
          </div>

          {(() => {
            const ADDON_GROUPS = [
              {
                key: "saldiri-yuzeyi",
                icon: Cpu,
                label: lang === "en" ? "Attack Surface Analysis" : "Saldırı Yüzeyi Analizi",
                desc: lang === "en"
                  ? "Passive OSINT-based analysis: Shodan, crt.sh, CVE/EPSS, MITRE ATT&CK. No active connection to your systems."
                  : "Pasif OSINT tabanlı analiz: Shodan, crt.sh, CVE/EPSS, MITRE ATT&CK. Sisteme aktif bağlantı yok.",
                items: lang === "en"
                  ? [["1 Domain (one-time)", "7.500 TL"], ["5 Domains (one-time)", "15.000 TL"], ["Annual (4x quarterly)", "24.000 TL / yr"]]
                  : [["1 Domain (tek seferlik)", "7.500 TL"], ["5 Domain (tek seferlik)", "15.000 TL"], ["Yıllık (4x çeyreklik)", "24.000 TL / yıl"]],
              },
              {
                key: "tprm",
                icon: Layers,
                label: lang === "en" ? "Supplier Risk Management (TPRM)" : "Tedarikçi Risk Yönetimi (TPRM)",
                desc: lang === "en"
                  ? "Scan supplier domains with EASM + HIBP + DMARC. A–F risk matrix, PDF report."
                  : "Tedarikçi domainlerini EASM + HIBP + DMARC ile tarayın. A–F risk matrisi, PDF rapor.",
                items: lang === "en"
                  ? [["5 Suppliers (one-time)", "2.500 TL"], ["10 Suppliers (one-time)", "4.000 TL"], ["20 Suppliers (one-time)", "6.500 TL"]]
                  : [["5 Tedarikçi (tek seferlik)", "2.500 TL"], ["10 Tedarikçi (tek seferlik)", "4.000 TL"], ["20 Tedarikçi (tek seferlik)", "6.500 TL"]],
              },
              {
                key: "eposta-uyumluluk",
                icon: Mail,
                label: lang === "en" ? "Email & Compliance" : "E-posta & Uyumluluk",
                desc: lang === "en"
                  ? "Email security audit (SPF/DMARC/DKIM + 15 blacklists), continuous monitoring, KVKK notification system."
                  : "E-posta güvenlik denetimi (SPF/DMARC/DKIM + 15 kara liste), sürekli izleme, KVKK bildirim sistemi.",
                items: lang === "en"
                  ? [["Email Security Audit (one-time)", "2.500 TL"], ["Email Monitoring", "990 TL / mo"], ["KVKK Notification System", "1.990 TL / mo"]]
                  : [["E-posta Güvenlik Denetimi (tek seferlik)", "2.500 TL"], ["E-posta İzleme", "990 TL / ay"], ["KVKK Bildirim Sistemi", "1.990 TL / ay"]],
              },
              {
                key: "ai-guvenlik",
                icon: Zap,
                label: lang === "en" ? "AI Security" : "AI Güvenlik",
                desc: lang === "en"
                  ? "AI tools risk assessment, KVKK-compliant policy auto-update, tool monitoring, phishing simulation."
                  : "Yapay zeka araçları risk değerlendirmesi, KVKK uyumlu politika otogüncelleme, araç izleme, oltalama simülasyonu.",
                items: lang === "en"
                  ? [["AI Security Assessment (one-time)", "2.900 TL"], ["AI Policy Auto-Update", "990 TL / yr"], ["AI Tool Monitoring", "490 TL / mo"], ["AI Phishing Simulation (one-time)", "1.990 TL"]]
                  : [["AI Güvenlik Değerlendirmesi (tek seferlik)", "2.900 TL"], ["AI Politika Otogüncelleme", "990 TL / yıl"], ["AI Araç İzleme", "490 TL / ay"], ["AI Oltalama Simülasyonu (tek seferlik)", "1.990 TL"]],
              },
              {
                key: "entegrasyonlar",
                icon: Network,
                label: lang === "en" ? "Integrations" : "Entegrasyonlar",
                desc: lang === "en"
                  ? "Fortinet Security Fabric, Microsoft 365 Azure AD, ServiceNow SOC sync."
                  : "Fortinet Security Fabric, Microsoft 365 Azure AD, ServiceNow SOC senkronizasyonu.",
                items: lang === "en"
                  ? [["Fortinet Security Fabric", "4.990 TL / mo (setup: 2.500 TL)"], ["Microsoft 365 Integration", "1.490 TL / mo"], ["ServiceNow Integration", "2.490 TL / mo (setup: 1.000 TL)"]]
                  : [["Fortinet Security Fabric", "4.990 TL / ay (kurulum: 2.500 TL)"], ["Microsoft 365 Entegrasyonu", "1.490 TL / ay"], ["ServiceNow Entegrasyonu", "2.490 TL / ay (kurulum: 1.000 TL)"]],
              },
            ];

            return (
              <div className="space-y-3">
                {ADDON_GROUPS.map(group => {
                  const Icon = group.icon;
                  const isOpen = openAddon === group.key;
                  return (
                    <div key={group.key} className="rounded-xl border bg-card overflow-hidden">
                      <button
                        onClick={() => setOpenAddon(isOpen ? null : group.key)}
                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{group.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{group.desc}</p>
                        </div>
                        <div className="shrink-0 text-muted-foreground">
                          {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t px-5 pb-5 pt-4 bg-muted/20">
                          <p className="text-xs text-muted-foreground mb-4">{group.desc}</p>
                          <div className="space-y-2">
                            {group.items.map(([name, price]) => (
                              <div key={name} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                                <span className="text-sm">{name}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-bold text-primary">{price}</span>
                                  <Link
                                    href="/iletisim"
                                    className="text-xs border border-primary/40 text-primary px-3 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                                  >
                                    {lang === "en" ? "Add" : "Ekle"}
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <p className="text-center text-xs text-muted-foreground mt-6">
            {lang === "en"
              ? "Add-ons can be combined with any package. Prices are excl. VAT."
              : "Ek servisler herhangi bir paket ile kombinlenebilir. Fiyatlar KDV hariçtir."}
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* KVKK cost comparison */}
          <div className="max-w-4xl mx-auto mb-8 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/50 p-5">
            <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {lang === "en" ? "Why is it worth it?" : "Neden değer?"}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center">
              <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border p-4 shadow-sm">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  {lang === "en" ? "KVKK minimum administrative fine" : "KVKK minimum idari ceza"}
                </p>
                <p className="text-3xl font-bold text-amber-600">94.000 TL</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "en" ? "increases with annual revaluation rate" : "yıllık yeniden değerleme oranıyla artıyor"}
                </p>
              </div>
              <div className="text-xl font-bold text-muted-foreground">↔</div>
              <div className="flex-1 rounded-lg bg-white dark:bg-slate-900 border p-4 shadow-sm">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                  {lang === "en" ? "Full Assessment" : "Tam Değerlendirme"}
                </p>
                <p className="text-3xl font-bold text-primary">{fullPriceLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "en" ? "one-time payment" : "tek seferlik ödeme"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 flex flex-col gap-6 shadow-sm ${
                  plan.highlight
                    ? "border-primary/50 bg-primary/5 shadow-primary/10 shadow-md"
                    : "bg-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-4xl font-bold text-primary">{plan.priceLabel}</span>
                    {"priceSuffix" in plan && plan.priceSuffix && (
                      <span className="text-sm text-muted-foreground mb-1">{plan.priceSuffix}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="font-bold text-primary">{plan.questionCount}</span>
                    <span className="text-muted-foreground">{lang === "en" ? "questions" : "soru"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="font-bold text-primary">{plan.domainCount}</span>
                    <span className="text-muted-foreground">{lang === "en" ? "domains" : "alan"}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`inline-flex items-center justify-center rounded-md text-sm font-semibold h-12 px-6 transition-colors ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-2 border-primary text-primary hover:bg-primary/10"
                  }`}
                >
                  {plan.cta}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            {lang === "en" ? "Detailed Comparison" : "Detaylı Karşılaştırma"}
          </h2>
          <div className="rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground w-1/2">
                    {lang === "en" ? "Feature" : "Özellik"}
                  </th>
                  <th className="text-center px-6 py-4 font-semibold">Mini</th>
                  <th className="text-center px-6 py-4 font-semibold text-primary">
                    {lang === "en" ? "Full" : "Tam"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) =>
                  row.header ? (
                    <tr key={row.label}>
                      <td colSpan={3} className="px-6 py-2.5 text-xs font-bold text-primary uppercase tracking-wider bg-primary/5 border-b">
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.label} className={`border-b last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      <td className="px-6 py-3.5 font-medium">{row.label}</td>
                      <td className="px-6 py-3.5 text-center">
                        {typeof row.mini === "boolean" ? (
                          row.mini
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            : <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className="font-semibold">{row.mini}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {typeof row.full === "boolean" ? (
                          row.full
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            : <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className="font-bold text-primary">{row.full}</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* AI Security Services */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <Badge className="bg-primary/20 text-primary border-primary/40 mb-3">
              {lang === "en" ? "New" : "Yeni"}
            </Badge>
            <h2 className="text-2xl font-bold mb-2">
              {lang === "en" ? "AI Security Services" : "AI Güvenlik Servisleri"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              {lang === "en"
                ? "The spread of AI tools is creating new compliance obligations. Keep your policy current, monitor your tools, anticipate attacks."
                : "Yapay zeka araçlarının yayılmasıyla birlikte yeni uyum yükümlülükleri doğuyor. Politikanızı güncel tutun, araçlarınızı izleyin, saldırıları önceden görün."}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {/* AI Policy */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">
                  {lang === "en" ? "AI Policy Auto-Update" : "AI Politika Otogüncelleme"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "KVKK-compliant AI usage policy — automatically updated each quarter, PDF + Word download."
                    : "KVKK uyumlu yapay zeka kullanım politikası — her çeyrek otomatik güncellenir, PDF + Word indirme."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(lang === "en"
                  ? ["Company-specific AI policy", "4 quarterly auto-updates", "Triggered on tool changes", "Approval and version tracking"]
                  : ["Şirkete özel AI politikası", "4 çeyreklik otomatik güncelleme", "Araç değişikliğinde tetikleme", "Onay ve versiyon takibi"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">990 TL <span className="text-sm font-normal text-muted-foreground">/ {lang === "en" ? "yr + VAT" : "yıl + KDV"}</span></p>
                <Link href="/ai-politika" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  {lang === "en" ? "Create My Policy" : "Politikamı Oluştur"} <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>

            {/* AI Tool Monitoring */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">
                  {lang === "en" ? "AI Tool Monitoring" : "AI Araç İzleme"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "Get instant email alerts when ChatGPT, Gemini, Copilot privacy policies change."
                    : "ChatGPT, Gemini, Copilot gizlilik politikası değişince anında e-posta bildirimi alın."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(lang === "en"
                  ? ["20+ AI tools weekly check", "Instant alert on critical changes", "KVKK compliance score update", "Customizable notification level"]
                  : ["20+ AI aracı haftalık kontrol", "Kritik değişikliklerde anında uyarı", "KVKK uyum puanı güncelleme", "Özelleştirilebilir bildirim seviyesi"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">490 TL <span className="text-sm font-normal text-muted-foreground">/ {lang === "en" ? "mo + VAT" : "ay + KDV"}</span></p>
                <Link href="/ai-arac-izleme" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  {lang === "en" ? "Start Monitoring" : "İzlemeyi Başlat"} <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>

            {/* AI Phishing */}
            <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
              <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-base mb-1">
                  {lang === "en" ? "AI Phishing Simulation" : "AI Oltalama Simülasyonu"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "See the AI-powered email attackers would craft against your company — before they do. One-time."
                    : "Saldırganların şirketinize yönelik hazırlayacağı AI destekli e-postayı önce siz görün. Tek seferlik."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(lang === "en"
                  ? ["Public data OSINT analysis", "3 realistic attack scenarios", "Protection method per scenario", "SPF / DMARC gap detection"]
                  : ["Kamuya açık veri OSINT analizi", "3 gerçekçi saldırı senaryosu", "Her senaryo için koruma yöntemi", "SPF / DMARC açık tespiti"]
                ).map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3 border-t">
                <p className="text-xl font-bold text-primary mb-3">1.990 TL <span className="text-sm font-normal text-muted-foreground">· {lang === "en" ? "one-time + VAT" : "tek seferlik + KDV"}</span></p>
                <Link href="/ai-phishing-simulasyonu" className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  {lang === "en" ? "Start Simulation" : "Simülasyonu Başlat"} <ChevronRight className="inline h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Bundle card */}
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/8 to-primary/3 p-7">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-lg font-bold">
                    {lang === "en" ? "AI Protection Bundle" : "AI Koruma Paketi"}
                  </h3>
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {lang === "en" ? "32% Savings" : "%32 Tasarruf"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {lang === "en"
                    ? "AI Security Assessment + AI Tool Monitoring (12 months) + AI Policy Auto-Update — get all three AI security services together."
                    : "AI Güvenlik Değerlendirmesi + AI Araç İzleme (12 ay) + AI Politika Otogüncelleme — üç AI güvenlik servisini birlikte alın."}
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="line-through text-muted-foreground">9.770 TL + KDV</span>
                  <span className="text-2xl font-bold text-primary">9.990 TL</span>
                  <span className="text-muted-foreground">/ {lang === "en" ? "yr + VAT" : "yıl + KDV"}</span>
                </div>
              </div>
              <Link href="/iletisim" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shrink-0">
                {lang === "en" ? "Get Bundle Quote" : "Paket Teklifi Al"} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>


      {/* Trust bar */}
      <section className="py-10 border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="h-4 w-4 text-primary shrink-0" />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
