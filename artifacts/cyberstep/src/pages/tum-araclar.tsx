import { Link } from "wouter";
import { ArrowRight, Globe, ShieldAlert, FileText, BarChart2, Search, AlertCircle, Target, Bot, Cpu, BookOpen, Scale, Building2, Zap, Activity, Shield, Mail, Layers, TrendingUp, Lock, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

export default function TumAraclar() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en" ? "Cybersecurity Toolkit | CyberStep.io" : "Siber Güvenlik Araç Seti | CyberStep.io",
    description: lang === "en"
      ? "All cybersecurity tools to protect your company — from AI-powered assessments to compliance guides and leak monitoring."
      : "AI destekli değerlendirmeden uyum rehberlerine, sızıntı izlemeye kadar şirketinizi koruyacak tüm siber güvenlik araçları.",
    keywords: "cybersecurity tools, domain scan, ssl check, kvkk compliance, phishing test",
    canonicalPath: "/tum-araclar",
  });

  const TOOL_CATEGORIES = [
    {
      title: lang === "en" ? "AI Security" : "AI Güvenlik",
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      tools: [
        { href: "/ai-guvenlik-degerlendirmesi", label: lang === "en" ? "AI Risk Assessment" : "AI Risk Değerlendirmesi", icon: Shield, desc: lang === "en" ? "Measure the security and compliance risk of your AI systems." : "AI sistemlerinizin güvenlik ve uyum riskini ölçün.", badge: null },
        { href: "/ai-phishing-simulasyonu", label: lang === "en" ? "AI Phishing Simulation" : "AI Phishing Simülasyonu", icon: Mail, desc: lang === "en" ? "Test awareness with realistic AI-powered attack scenarios." : "Gerçekçi AI destekli saldırı senaryolarıyla farkındalığı test edin.", badge: lang === "en" ? "New" : "Yeni" },
        { href: "/ai-arac-izleme", label: lang === "en" ? "AI Tool Monitoring" : "AI Araç İzleme", icon: Activity, desc: lang === "en" ? "Detect and manage AI tools used in your company." : "Şirketinizdeki yapay zeka araçlarını tespit edin ve yönetin.", badge: null },
        { href: "/ai-politika", label: lang === "en" ? "AI Policy Auto-Update" : "AI Politika Otogüncelleme", icon: FileText, desc: lang === "en" ? "Automatically update AI policies in line with regulations." : "Regülasyonlara uygun AI politikalarını otomatik güncelleyin.", badge: null },
        { href: "/eu-ai-act", label: lang === "en" ? "EU AI Act Compliance" : "AB Yapay Zeka Yasası Uyumu", icon: Scale, desc: lang === "en" ? "Assess your obligations under the EU AI Act." : "EU AI Act kapsamındaki yükümlülüklerinizi değerlendirin.", badge: null },
        { href: "/ai-red-team", label: lang === "en" ? "AI Red Team Report" : "AI Red Team Raporu", icon: Target, desc: lang === "en" ? "Attack simulation targeting your AI systems." : "AI sistemlerinize yönelik saldırı simülasyonu.", badge: null },
        { href: "/ciso-asistan-paketi", label: lang === "en" ? "CISO Assistant" : "CISO Asistan", icon: Bot, desc: lang === "en" ? "Automate CISO reporting workload: monthly board report, compliance score, policy library." : "CISO raporlama yükünü otomatikleştirin: aylık YK raporu, uyum skoru, politika kütüphanesi.", badge: lang === "en" ? "New" : "Yeni" },
      ],
    },
    {
      title: lang === "en" ? "Assessment Tools" : "Değerlendirme Araçları",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40",
      tools: [
        { href: "/assessment/start", label: lang === "en" ? "Mini Risk Assessment" : "Mini Risk Değerlendirmesi", icon: ShieldAlert, desc: lang === "en" ? "Free 20-question cybersecurity assessment." : "20 soruluk ücretsiz siber güvenlik değerlendirmesi.", badge: lang === "en" ? "Free" : "Ücretsiz" },
        { href: "/domain-tarama", label: lang === "en" ? "Domain Security Scan" : "Alan Adı Güvenlik Taraması", icon: Globe, desc: lang === "en" ? "Scan your external attack surface in real time." : "Dış saldırı yüzeyinizi gerçek zamanlı tarayın.", badge: null },
        { href: "/sektorel-kiyaslama", label: lang === "en" ? "Sector Benchmarking" : "Sektörel Kıyaslama", icon: BarChart2, desc: lang === "en" ? "Compare your security score against the sector average." : "Güvenlik skorunuzu sektör ortalamasıyla karşılaştırın.", badge: null },
        { href: "/siber-sigorta", label: lang === "en" ? "Cyber Insurance Guide" : "Siber Sigorta Kılavuzu", icon: Lock, desc: lang === "en" ? "Find the right cyber insurance policy for you." : "Size uygun siber sigorta poliçesini bulun.", badge: null },
        { href: "/finansal-kayip", label: lang === "en" ? "Financial Loss Analysis" : "Finansal Kayıp Analizi", icon: TrendingUp, desc: lang === "en" ? "Calculate estimated financial loss in cyberattack scenarios." : "Siber saldırı senaryolarında tahmini finansal kaybı hesaplayın.", badge: null },
        { href: "/roi-hesaplayici", label: lang === "en" ? "ROI Calculator" : "ROI Hesaplayıcı", icon: Zap, desc: lang === "en" ? "Calculate the return on your cybersecurity investments." : "Siber güvenlik yatırımlarının getirisini hesaplayın.", badge: null },
      ],
    },
    {
      title: lang === "en" ? "Compliance & Legal" : "Uyum & Hukuk",
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40",
      tools: [
        { href: "/kvkk", label: lang === "en" ? "KVKK Compliance Guide" : "KVKK Uyum Kılavuzu", icon: BookOpen, desc: lang === "en" ? "Meet your KVKK obligations step by step." : "KVKK yükümlülüklerinizi adım adım karşılayın.", badge: null },
        { href: "/kvkk-dpa-olustur", label: lang === "en" ? "KVKK DPA Generator" : "KVKK DPA Oluştur", icon: FileText, desc: lang === "en" ? "Generate a Data Processing Agreement." : "Veri İşleme Sözleşmesi oluşturun.", badge: null },
        { href: "/kvkk-verbis", label: lang === "en" ? "KVKK VERBİS Guide" : "KVKK VERBİS Rehberi", icon: Layers, desc: lang === "en" ? "Step-by-step guide to VERBİS registration." : "VERBİS kaydı için adım adım rehber.", badge: null },
        { href: "/kvkk-ceza-sim", label: lang === "en" ? "KVKK Penalty Simulator" : "KVKK Ceza Simülatörü", icon: AlertCircle, desc: lang === "en" ? "Calculate estimated penalty in case of KVKK violation." : "KVKK ihlali durumunda tahmini cezayı hesaplayın.", badge: null },
        { href: "/dora-bddk-uyum", label: lang === "en" ? "DORA & BDDK Compliance" : "DORA & BDDK Uyumu", icon: Building2, desc: lang === "en" ? "Financial sector regulatory compliance assessment." : "Finansal sektör düzenlemeleri uyum değerlendirmesi.", badge: null },
        { href: "/kep-rehberi", label: lang === "en" ? "KEP Guide" : "KEP Rehberi", icon: Mail, desc: lang === "en" ? "Guide on Registered Electronic Mail." : "Kayıtlı elektronik posta hakkında rehber.", badge: null },
      ],
    },
    {
      title: lang === "en" ? "Operational Tools" : "Operasyonel Araçlar",
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/40",
      tools: [
        { href: "/sizinti-izleyici", label: lang === "en" ? "Leak Monitor" : "Sızıntı İzleyici", icon: Search, desc: lang === "en" ? "Monitor company information on the dark web and data breaches." : "Dark web ve veri ihlallerinde şirket bilgilerinizi izleyin.", badge: null },
        { href: "/phishing-sim", label: lang === "en" ? "Phishing Simulator" : "Phishing Simülatörü", icon: Mail, desc: lang === "en" ? "Phishing simulation for employee awareness testing." : "Çalışan farkındalık testleri için phishing simülasyonu.", badge: null },
        { href: "/m365-denetim", label: lang === "en" ? "Microsoft 365 Audit" : "Microsoft 365 Denetimi", icon: Cpu, desc: lang === "en" ? "Detect security vulnerabilities in your M365 environment." : "M365 ortamınızdaki güvenlik açıklarını tespit edin.", badge: null },
        { href: "/marka-koruma", label: lang === "en" ? "Brand Protection" : "Marka Koruma", icon: Shield, desc: lang === "en" ? "Track domains impersonating your brand name." : "Marka adınızı taklit eden alan adlarını takip edin.", badge: null },
        { href: "/erp-tarama", label: lang === "en" ? "ERP Security Scan" : "ERP Güvenlik Taraması", icon: Activity, desc: lang === "en" ? "Scan security risks in your ERP systems." : "ERP sistemlerinizdeki güvenlik risklerini tarayın.", badge: null },
        { href: "/github-tarama", label: lang === "en" ? "GitHub Code Scan" : "GitHub Kod Taraması", icon: Search, desc: lang === "en" ? "Detect sensitive data leaks in GitHub repositories." : "GitHub reposundaki hassas veri sızıntılarını tespit edin.", badge: null },
        { href: "/zero-day-uyari", label: lang === "en" ? "Zero-Day Alert" : "Zero-Day Uyarı", icon: AlertCircle, desc: lang === "en" ? "Receive instant critical security vulnerability notifications." : "Kritik güvenlik açığı bildirimlerini anlık alın.", badge: null },
        { href: "/tedarik-zinciri", label: lang === "en" ? "Supply Chain Security" : "Tedarik Zinciri Güvenliği", icon: Layers, desc: lang === "en" ? "Assess supplier security risks." : "Tedarikçi güvenlik risklerini değerlendirin.", badge: null },
        { href: "/saldiri-simulasyonu", label: lang === "en" ? "Attack Scenario Analysis" : "Saldırı Senaryosu Analizi", icon: Target, desc: lang === "en" ? "MITRE ATT&CK-based attack chain analysis." : "MITRE ATT&CK bazlı saldırı zinciri analizi.", badge: null },
        { href: "/pentest-lite", label: lang === "en" ? "Attack Surface Analysis" : "Saldırı Yüzeyi Analizi", icon: Shield, desc: lang === "en" ? "AI-powered MITRE ATT&CK attack chain analysis. Passive — no agent, no system access." : "AI destekli MITRE ATT&CK saldırı zinciri analizi. Pasif — sisteminize dokunmaz.", badge: null },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
              {lang === "en" ? "All Tools" : "Tüm Araçlar"}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold mb-3">
            {lang === "en" ? "Cybersecurity Toolkit" : "Siber Güvenlik Araç Seti"}
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            {lang === "en"
              ? "All tools to protect your company — from AI-powered assessments to compliance guides and leak monitoring."
              : "AI destekli değerlendirmeden uyum rehberlerine, sızıntı izlemeye kadar şirketinizi koruyacak tüm araçlar."}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-12 space-y-12">
        {TOOL_CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <h2 className={`text-lg font-bold mb-4 ${cat.color}`}>{cat.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat.tools.map(({ href, label, icon: Icon, desc, badge }) => (
                <Link key={href} href={href}>
                  <div className={`group flex items-start gap-3 p-4 rounded-xl border ${cat.bg} hover:shadow-sm transition-all cursor-pointer`}>
                    <div className="shrink-0 mt-0.5">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                        {badge && <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 shrink-0">{badge}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="border border-primary/20 bg-primary/5 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="shrink-0 bg-primary/10 p-3 rounded-xl">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">
              {lang === "en" ? "Want to get to know the tools?" : "Araçları tanımak ister misiniz?"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {lang === "en"
                ? "Our experts can explain the most suitable tools for you at no cost."
                : "Uzmanlarımız size en uygun araçları ücretsiz olarak anlatabilir."}
            </p>
          </div>
          <Link href="/iletisim">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
              {lang === "en" ? "Contact Us" : "Bize Ulaşın"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
