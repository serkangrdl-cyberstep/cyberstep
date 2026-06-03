import { Link } from "wouter";
import { ArrowRight, Globe, ShieldAlert, FileText, BarChart2, Search, AlertCircle, Target, Bot, Cpu, BookOpen, Scale, Building2, Zap, Activity, Shield, Mail, Eye, Layers, TrendingUp, Lock, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/use-page-meta";

const TOOL_CATEGORIES = [
  {
    title: "AI Güvenlik",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    tools: [
      { href: "/ai-guvenlik-degerlendirmesi", label: "AI Risk Değerlendirmesi", icon: Shield, desc: "AI sistemlerinizin güvenlik ve uyum riskini ölçün.", badge: null },
      { href: "/ai-phishing-simulasyonu", label: "AI Phishing Simülasyonu", icon: Mail, desc: "Gerçekçi AI destekli saldırı senaryolarıyla farkındalığı test edin.", badge: "Yeni" },
      { href: "/ai-arac-izleme", label: "AI Araç İzleme", icon: Activity, desc: "Şirketinizdeki yapay zeka araçlarını tespit edin ve yönetin.", badge: null },
      { href: "/ai-politika", label: "AI Politika Otogüncelleme", icon: FileText, desc: "Regülasyonlara uygun AI politikalarını otomatik güncelleyin.", badge: null },
      { href: "/deepfake-analizi", label: "Deepfake Tehdit Analizi", icon: Eye, desc: "Deepfake ve ses klonu tehditlerini analiz edin.", badge: null },
      { href: "/eu-ai-act", label: "AB Yapay Zeka Yasası Uyumu", icon: Scale, desc: "EU AI Act kapsamındaki yükümlülüklerinizi değerlendirin.", badge: null },
      { href: "/ai-red-team", label: "AI Red Team Raporu", icon: Target, desc: "AI sistemlerinize yönelik saldırı simülasyonu.", badge: null },
      { href: "/sahte-dokuman", label: "AI Sahte Doküman Tespiti", icon: Search, desc: "Sahte belgeler ve derin sahte tehditleri tespit edin.", badge: null },
      { href: "/ciso-asistan-paketi", label: "CISO Asistan", icon: Bot, desc: "CISO raporlama yükünü otomatikleştirin: aylık YK raporu, uyum skoru, politika kütüphanesi.", badge: "Yeni" },
    ],
  },
  {
    title: "Değerlendirme Araçları",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40",
    tools: [
      { href: "/assessment/start", label: "Mini Risk Değerlendirmesi", icon: ShieldAlert, desc: "20 soruluk ücretsiz siber güvenlik değerlendirmesi.", badge: "Ücretsiz" },
      { href: "/domain-tarama", label: "Alan Adı Güvenlik Taraması", icon: Globe, desc: "Dış saldırı yüzeyinizi gerçek zamanlı tarayın.", badge: null },
      { href: "/sektorel-kiyaslama", label: "Sektörel Kıyaslama", icon: BarChart2, desc: "Güvenlik skorunuzu sektör ortalamasıyla karşılaştırın.", badge: null },
      { href: "/siber-sigorta", label: "Siber Sigorta Kılavuzu", icon: Lock, desc: "Size uygun siber sigorta poliçesini bulun.", badge: null },
      { href: "/finansal-kayip", label: "Finansal Kayıp Analizi", icon: TrendingUp, desc: "Siber saldırı senaryolarında tahmini finansal kaybı hesaplayın.", badge: null },
      { href: "/roi-hesaplayici", label: "ROI Hesaplayıcı", icon: Zap, desc: "Siber güvenlik yatırımlarının getirisini hesaplayın.", badge: null },
    ],
  },
  {
    title: "Uyum & Hukuk",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40",
    tools: [
      { href: "/kvkk", label: "KVKK Uyum Kılavuzu", icon: BookOpen, desc: "KVKK yükümlülüklerinizi adım adım karşılayın.", badge: null },
      { href: "/kvkk-dpa-olustur", label: "KVKK DPA Oluştur", icon: FileText, desc: "Veri İşleme Sözleşmesi oluşturun.", badge: null },
      { href: "/kvkk-verbis", label: "KVKK VERBİS Rehberi", icon: Layers, desc: "VERBİS kaydı için adım adım rehber.", badge: null },
      { href: "/kvkk-ceza-sim", label: "KVKK Ceza Simülatörü", icon: AlertCircle, desc: "KVKK ihlali durumunda tahmini cezayı hesaplayın.", badge: null },
      { href: "/dora-bddk-uyum", label: "DORA & BDDK Uyumu", icon: Building2, desc: "Finansal sektör düzenlemeleri uyum değerlendirmesi.", badge: null },
      { href: "/kep-rehberi", label: "KEP Rehberi", icon: Mail, desc: "Kayıtlı elektronik posta hakkında rehber.", badge: null },
    ],
  },
  {
    title: "Operasyonel Araçlar",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/40",
    tools: [
      { href: "/sizinti-izleyici", label: "Sızıntı İzleyici", icon: Search, desc: "Dark web ve veri ihlallerinde şirket bilgilerinizi izleyin.", badge: null },
      { href: "/phishing-sim", label: "Phishing Simülatörü", icon: Mail, desc: "Çalışan farkındalık testleri için phishing simülasyonu.", badge: null },
      { href: "/m365-denetim", label: "Microsoft 365 Denetimi", icon: Cpu, desc: "M365 ortamınızdaki güvenlik açıklarını tespit edin.", badge: null },
      { href: "/marka-koruma", label: "Marka Koruma", icon: Shield, desc: "Marka adınızı taklit eden alan adlarını takip edin.", badge: null },
      { href: "/erp-tarama", label: "ERP Güvenlik Taraması", icon: Activity, desc: "ERP sistemlerinizdeki güvenlik risklerini tarayın.", badge: null },
      { href: "/github-tarama", label: "GitHub Kod Taraması", icon: Search, desc: "GitHub reposundaki hassas veri sızıntılarını tespit edin.", badge: null },
      { href: "/zero-day-uyari", label: "Zero-Day Uyarı", icon: AlertCircle, desc: "Kritik güvenlik açığı bildirimlerini anlık alın.", badge: null },
      { href: "/tedarik-zinciri", label: "Tedarik Zinciri Güvenliği", icon: Layers, desc: "Tedarikçi güvenlik risklerini değerlendirin.", badge: null },
      { href: "/saldiri-simulasyonu", label: "Saldırı Senaryosu Analizi", icon: Target, desc: "MITRE ATT&CK bazlı saldırı zinciri analizi.", badge: null },
      { href: "/pentest-lite", label: "Pentest Lite", icon: Shield, desc: "AI destekli otomatik penetrasyon testi.", badge: null },
    ],
  },
];

export default function TumAraclar() {
  usePageMeta({
    title: "Siber Güvenlik Araç Seti | CyberStep.io",
    description: "AI destekli değerlendirmeden uyum rehberlerine, sızıntı izlemeye kadar şirketinizi koruyacak tüm siber güvenlik araçları.",
    keywords: "siber güvenlik araçları, domain tarama, ssl kontrol, kvkk uyum, phishing testi",
    canonicalPath: "/tum-araclar",
  });
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Tüm Araçlar</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-3">Siber Güvenlik Araç Seti</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            AI destekli değerlendirmeden uyum rehberlerine, sızıntı izlemeye kadar şirketinizi koruyacak tüm araçlar.
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
            <h3 className="font-semibold text-sm mb-1">Araçları tanımak ister misiniz?</h3>
            <p className="text-xs text-muted-foreground">Uzmanlarımız size en uygun araçları ücretsiz olarak anlatabilir.</p>
          </div>
          <Link href="/iletisim">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
              Bize Ulaşın <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
