import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Shield, CheckCircle2, ArrowRight, FileText,
  BarChart3, BookOpen, Mail, TrendingDown,
  ChevronRight, Zap, XCircle, AlertCircle, Users, Bot, Star, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

type FormState = {
  name: string; email: string; company: string; phone: string;
  sector: string; employeeCount: string; hasCiso: string; tier: string;
};

const EMPTY: FormState = {
  name: "", email: "", company: "", phone: "",
  sector: "", employeeCount: "", hasCiso: "", tier: "",
};

const TIERS = [
  {
    id: "essential",
    name: "vCISO Temel",
    tagTR: "50–100 Çalışan",
    tagEN: "50–100 Employees",
    price: "₺4.990",
    expertHours: 1,
    platformItems: [
      { tr: "Güvenlik Skoru & Risk Dashboard", en: "Security Score & Risk Dashboard" },
      { tr: "Aylık Yönetim Kurulu Raporu (otomatik)", en: "Monthly Board Report (automated)" },
      { tr: "CVE & Dark Web İzleme", en: "CVE & Dark Web Monitoring" },
      { tr: "DNS & Sahte Domain Erken Uyarı", en: "DNS & Fake Domain Alert" },
      { tr: "7545/KVKK Uyum Skoru", en: "7545/KVKK Compliance Score" },
    ],
    expertItems: [
      { tr: "Aylık 1 saat uzman görüşmesi", en: "1 hour/mo expert session" },
      { tr: "Çeyreklik risk önceliklendirme", en: "Quarterly risk prioritization" },
    ],
    popular: false,
  },
  {
    id: "profesyonel",
    name: "vCISO Profesyonel",
    tagTR: "100–500 Çalışan",
    tagEN: "100–500 Employees",
    price: "₺9.990",
    expertHours: 4,
    platformItems: [
      { tr: "Temel'deki her şey", en: "Everything in Temel" },
      { tr: "Tehdit İstihbaratı (Starter)", en: "Threat Intelligence (Starter)" },
      { tr: "Saldırı Yüzeyi Analizi (EASM)", en: "Attack Surface Analysis (EASM)" },
      { tr: "Haftalık Tehdit Özeti", en: "Weekly Threat Digest" },
      { tr: "SOC Lite — AI triage", en: "SOC Lite — AI triage" },
    ],
    expertItems: [
      { tr: "Aylık 4 saat uzman görüşmesi", en: "4 hours/mo expert sessions" },
      { tr: "Aylık Yönlendirme Komitesi toplantısı", en: "Monthly Steering Committee" },
      { tr: "Risk Kaydı ve yol haritası", en: "Risk Register & roadmap" },
      { tr: "Tedarikçi risk değerlendirme", en: "Vendor risk review" },
    ],
    popular: true,
  },
  {
    id: "lider",
    name: "vCISO Lider",
    tagTR: "Kurumsal KOBİ",
    tagEN: "Enterprise SME",
    price: "₺19.990",
    expertHours: 8,
    platformItems: [
      { tr: "Profesyonel'deki her şey", en: "Everything in Profesyonel" },
      { tr: "Tam Değerlendirme (55 soru)", en: "Full Assessment (55 questions)" },
      { tr: "AI Politika Üretimi", en: "AI Policy Generation" },
      { tr: "Siber Güvenlik Olgunluk Raporu", en: "Security Maturity Report" },
    ],
    expertItems: [
      { tr: "Aylık 8 saat uzman görüşmesi", en: "8 hours/mo expert sessions" },
      { tr: "Yönetim Kuruluna katılım (çeyreklik)", en: "Board participation (quarterly)" },
      { tr: "Denetim hazırlığı desteği", en: "Audit preparation support" },
      { tr: "KVKK Süreç Yönetimi", en: "KVKK process management" },
      { tr: "Siber Güvenlik Yol Haritası", en: "Cybersecurity roadmap" },
    ],
    popular: false,
  },
];

const SECTORS = [
  "Finans / Bankacılık", "Sağlık", "Perakende / E-Ticaret", "Üretim / İmalat",
  "Bilişim / Teknoloji", "İnşaat / Gayrimenkul", "Lojistik / Taşımacılık",
  "Hukuk / Danışmanlık", "Eğitim", "Diğer",
];

const EMP_COUNTS = ["1–10", "11–50", "51–200", "201–500", "500+"];

export default function SanalCiso() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Platform-led vCISO | CyberStep.io" : "Platform-led vCISO | CyberStep.io",
    description: lang === "en"
      ? "Corporate-grade cybersecurity governance at 10% of a full-time CISO's cost. CyberStep automates 80% — expert partner handles the rest."
      : "Tam zamanlı CISO maliyetinin %10'uyla kurumsal seviye siber güvenlik yönetişimi. CyberStep %80'ini otomatikleştirir, uzman iş ortağı kalanı yönetir.",
  });

  const { toast: _toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    navigate("/kayit?service=vciso" + (form.tier ? `&tier=${form.tier}` : ""));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/25 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="flex flex-col items-center text-center gap-6">
            <Badge className="bg-primary/20 text-primary border-primary/40">
              {lang === "en" ? "Platform-led vCISO" : "Platform-led vCISO"}
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
              {lang === "en"
                ? <>We don't sell consultants.<br />We sell outcomes.</>
                : <>Danışman satmıyoruz.<br />Siber güvenlik yönetişimi satıyoruz.</>}
            </h1>
            <p className="text-white/80 text-lg max-w-2xl leading-relaxed">
              {lang === "en"
                ? <>CyberStep measures, monitors, and reports. Our expert partner interprets, guides, and decides. <strong className="text-white">Enterprise-grade governance at 10% of a full-time CISO's cost.</strong></>
                : <>CyberStep ölçer, izler, raporlar. Uzman iş ortağımız yorumlar, yönlendirir, kararları hızlandırır. <strong className="text-white">Tam zamanlı CISO maliyetinin %10'uyla kurumsal seviye yönetişim.</strong></>}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8">
                <a href="#paketler">
                  {lang === "en" ? "View Packages" : "Paketleri Gör"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                <a href="#model">
                  {lang === "en" ? "How does it work?" : "Nasıl çalışır?"}
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                <a href="/demo?rapor=board_report">
                  <FileText className="h-4 w-4 mr-2" />
                  {lang === "en" ? "Sample Board Report" : "Örnek Yönetim Raporu"}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Two-layer model */}
      <section id="model" className="py-16 bg-background border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {lang === "en" ? "The Model" : "Model"}
            </p>
            <h2 className="text-2xl font-bold">
              {lang === "en" ? "Platform (80%) + Expert Partner (20%)" : "Platform (%80) + Uzman İş Ortağı (%20)"}
            </h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto">
              {lang === "en"
                ? "This is the key distinction. Most vCISO providers can't scale because they rely purely on humans. Our advantage: the platform does the heavy lifting."
                : "Bu ayrım kritik. Çoğu vCISO sağlayıcısı ölçeklenemiyor çünkü tamamen insana bağımlı. Bizim avantajımız: ağır işi platform yapıyor."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Layer 1 — Platform */}
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    {lang === "en" ? "Layer 1 — CyberStep Platform" : "Katman 1 — CyberStep Platformu"}
                  </p>
                  <p className="font-bold text-sm">
                    {lang === "en" ? "Always on. 7/24. Automated." : "Her zaman açık. 7/24. Otomatik."}
                  </p>
                </div>
                <span className="ml-auto text-2xl font-black text-primary">%80</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {(lang === "en"
                  ? [
                      "Security Score & risk trends — continuously",
                      "CVE impact, dark web leaks — daily",
                      "DNS, fake domain, EASM — 5 min polling",
                      "Monthly board report — auto on the 25th",
                      "KVKK/7545 compliance score — monthly",
                      "Shadow IT, attack surface — weekly",
                      "AI Risk Assessment — on demand",
                    ]
                  : [
                      "Güvenlik Skoru & risk trendleri — sürekli",
                      "CVE etkisi, dark web sızıntısı — günlük",
                      "DNS, sahte domain, EASM — 5 dk tarama",
                      "Aylık yönetim kurulu raporu — 25'inde otomatik",
                      "KVKK/7545 uyum skoru — aylık",
                      "Shadow IT, saldırı yüzeyi — haftalık",
                      "AI Risk Değerlendirmesi — isteğe bağlı",
                    ]
                ).map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-primary/20">
                {lang === "en"
                  ? "Report writing: 0 hours. Risk discovery: 0 hours. The expert's time is fully freed for strategy."
                  : "Rapor yazma: 0 saat. Risk keşfi: 0 saat. Uzmanın tüm zamanı stratejiye ayrılır."}
              </p>
            </div>

            {/* Layer 2 — Expert Partner */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    {lang === "en" ? "Layer 2 — Expert Partner" : "Katman 2 — Uzman İş Ortağı"}
                  </p>
                  <p className="font-bold text-sm">
                    {lang === "en" ? "Monthly sessions. Human touch." : "Aylık görüşmeler. İnsan dokunuşu."}
                  </p>
                </div>
                <span className="ml-auto text-2xl font-black text-amber-500">%20</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {(lang === "en"
                  ? [
                      "Interpreting reports — not writing them",
                      "Risk prioritization & budget guidance",
                      "Building the security roadmap",
                      "Board presentation & management briefing",
                      "Vendor selection support",
                      "Audit preparation",
                    ]
                  : [
                      "Raporları yorumlar — yazmaz",
                      "Risk önceliklendirme & bütçe rehberliği",
                      "Güvenlik yol haritası oluşturur",
                      "Yönetim kurulu sunumu & CEO briefing",
                      "Tedarikçi seçim desteği",
                      "Denetim hazırlığı",
                    ]
                ).map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                {lang === "en"
                  ? "Thanks to the platform, 1 expert can manage 20–30 SMEs instead of 5. Better margins, scalable quality."
                  : "Platform sayesinde 1 uzman 5 yerine 20–30 KOBİ yönetebilir. Daha iyi marj, ölçeklenebilir kalite."}
              </p>
            </div>
          </div>

          {/* Trust factor callout */}
          <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Why the human layer matters" : "Neden insan katmanı önemli?"}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === "en"
                  ? "KOBİs hesitate to trust \"a machine\" alone. The expert partner's presence removes the biggest psychological barrier to the sale: trust."
                  : "KOBİ'ler siber güvenliği yalnız bir makineye emanet etmekten çekiniyor. Uzman iş ortağının varlığı, satışın önündeki en büyük psikolojik engeli — güveni — ortadan kaldırır."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Tier Packages */}
      <section id="paketler" className="py-16 bg-muted/20 border-b">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {lang === "en" ? "Packages" : "Paketler"}
            </p>
            <h2 className="text-2xl font-bold">
              {lang === "en" ? "Platform + Expert — in 3 tiers" : "Platform + Uzman — 3 seviyede"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {lang === "en"
                ? "All packages include the full platform. The difference is expert hours and service scope."
                : "Tüm paketlerde platform tamamen dahil. Fark, uzman saatleri ve servis kapsamında."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map(tier => (
              <div
                key={tier.id}
                className={`rounded-2xl p-6 flex flex-col gap-4 relative ${
                  tier.popular
                    ? "border-2 border-primary bg-primary/5 shadow-md"
                    : "border border-border bg-card"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                      {lang === "en" ? "Most Popular" : "En Çok Tercih Edilen"}
                    </Badge>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                    {lang === "en" ? tier.tagEN : tier.tagTR}
                  </p>
                  <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                  <p className="text-3xl font-black text-primary">
                    {tier.price}
                    <span className="text-sm font-normal text-muted-foreground"> / {lang === "en" ? "mo" : "ay"}</span>
                  </p>
                </div>

                {/* Platform items */}
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Bot className="h-3 w-3" />{lang === "en" ? "Platform (automated)" : "Platform (otomatik)"}
                  </p>
                  <ul className="space-y-1.5">
                    {tier.platformItems.map(item => (
                      <li key={item.tr} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        {lang === "en" ? item.en : item.tr}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Expert items */}
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {lang === "en" ? `Expert (${tier.expertHours}h/mo)` : `Uzman (${tier.expertHours} saat/ay)`}
                  </p>
                  <ul className="space-y-1.5 flex-1">
                    {tier.expertItems.map(item => (
                      <li key={item.tr} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        {lang === "en" ? item.en : item.tr}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => { set("tier")(tier.id); document.getElementById("basvuru")?.scrollIntoView({ behavior: "smooth" }); }}
                  className={`mt-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    tier.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-2 border-primary text-primary hover:bg-primary/10"
                  }`}
                >
                  {lang === "en" ? "Get a Quote" : "Teklif Al"}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {lang === "en"
              ? "All packages: 14-day trial. Prices excl. VAT. Enterprise pricing on request."
              : "Tüm paketlerde 14 gün ücretsiz deneme. Fiyatlar KDV hariçtir. Kurumsal fiyatlandırma için teklif alın."}
          </p>
        </div>
      </section>

      {/* Why this beats traditional consulting */}
      <section className="py-14 bg-muted/20 border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold">
              {lang === "en" ? "Why this scales — and traditional vCISO doesn't" : "Neden bu model ölçeklenir — klasik vCISO neden ölçeklenemez?"}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 p-5">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">
                {lang === "en" ? "Classic vCISO" : "Klasik vCISO"}
              </p>
              <ul className="space-y-2.5">
                {(lang === "en"
                  ? [
                      "Expert spends 60% of time writing reports",
                      "1 expert can manage 4–5 SMEs at most",
                      "Consistency depends on the individual",
                      "Clients feel like a number",
                    ]
                  : [
                      "Uzman zamanının %60'ını rapor yazmakla geçirir",
                      "1 uzman en fazla 4–5 KOBİ yönetebilir",
                      "Kalite tutarlılığı kişiye bağlı",
                      "Müşteriler kendilerini numara gibi hisseder",
                    ]
                ).map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 p-5">
              <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-4">
                {lang === "en" ? "Platform-led vCISO" : "Platform-led vCISO"}
              </p>
              <ul className="space-y-2.5">
                {(lang === "en"
                  ? [
                      "Platform generates all reports automatically",
                      "1 expert can manage 20–30 SMEs profitably",
                      "Platform playbooks ensure consistent quality",
                      "Client data is always live — expert is always prepared",
                    ]
                  : [
                      "Platform tüm raporları otomatik üretiyor",
                      "1 uzman 20–30 KOBİ'yi karlı şekilde yönetebilir",
                      "Platform playbook'ları kaliteyi standartlaştırır",
                      "Müşteri verisi her zaman canlı — uzman her zaman hazır",
                    ]
                ).map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Who needs it */}
      <section className="py-14 bg-background border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold">
              {lang === "en" ? "Who is it for?" : "Kimler için?"}
            </h2>
          </div>
          <div className="space-y-3">
            {(lang === "en"
              ? [
                  { title: "Companies that need a CISO but don't have the budget", desc: "Required to appoint a Cybersecurity Officer under Law 7545 but no full-time budget. This package provides minimum compliance — at a fraction of the cost." },
                  { title: "Companies with a CISO whose time is limited", desc: "Your CISO is tired of writing monthly board reports. The platform automates this — the CISO focuses on strategy." },
                  { title: "IT Directors who also carry the CISO role", desc: "Reduces reporting burden, automates compliance tracking, gives you an expert partner for escalation." },
                ]
              : [
                  { title: "CISO'su olmayan ama olması gereken şirketler", desc: "7545 kapsamında Siber Güvenlik Sorumlusu atamak zorunda, ama tam zamanlı bütçesi yok. Bu paket minimum uyumu çok daha düşük maliyetle sağlar." },
                  { title: "CISO'su olan ama zamanı kısıtlı şirketler", desc: "CISO her ay yönetim kurulu raporu hazırlamaktan bıkmış. Platform bunu otomatikleştirir — CISO stratejiye odaklanır." },
                  { title: "IT direktörü CISO rolü de üstlenen şirketler", desc: "Raporlama yükünü hafifletir, uyum takibini otomatikleştirir, eskalasyon için bir uzman iş ortağı verir." },
                ]
            ).map((w, i) => (
              <div key={i} className="flex gap-4 p-5 border border-border/40 rounded-xl bg-card">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0">{i + 1}</div>
                <div>
                  <p className="font-semibold text-sm text-foreground mb-1">{w.title}</p>
                  <p className="text-sm text-muted-foreground">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="basvuru" className="py-20 bg-muted/20 border-t">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/5">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {lang === "en" ? "We respond within 1 business day" : "1 İş Gününde Geri Döneriz"}
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">
              {lang === "en" ? "Request a Quote" : "Teklif Alın"}
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {lang === "en"
                ? "Fill in the form — our team will contact you with the right package for your company."
                : "Formu doldurun, ekibimiz şirketinize uygun paketi belirlemek için sizinle iletişime geçsin."}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border/50 rounded-2xl p-8 bg-card/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "en" ? "Full Name" : "Ad Soyad"} <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder={lang === "en" ? "John Smith" : "Ahmet Yilmaz"} required />
              </div>
              <div className="space-y-2">
                <Label>{lang === "en" ? "Work Email" : "Is E-postasi"} <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set("email")(e.target.value)} placeholder="name@company.com" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "en" ? "Company Name" : "Firma Adi"} <span className="text-red-500">*</span></Label>
                <Input value={form.company} onChange={e => set("company")(e.target.value)} placeholder={lang === "en" ? "Company Ltd." : "Sirket A.S."} required />
              </div>
              <div className="space-y-2">
                <Label>{lang === "en" ? "Phone" : "Telefon"}</Label>
                <Input value={form.phone} onChange={e => set("phone")(e.target.value)} placeholder="+90 5XX XXX XX XX" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "en" ? "Sector" : "Sektor"}</Label>
                <Select value={form.sector} onValueChange={set("sector")}>
                  <SelectTrigger><SelectValue placeholder={lang === "en" ? "Select..." : "Secin..."} /></SelectTrigger>
                  <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{lang === "en" ? "Employee Count" : "Calisan Sayisi"}</Label>
                <Select value={form.employeeCount} onValueChange={set("employeeCount")}>
                  <SelectTrigger><SelectValue placeholder={lang === "en" ? "Select..." : "Secin..."} /></SelectTrigger>
                  <SelectContent>{EMP_COUNTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "en" ? "Package interest" : "Ilgilendiginiz paket"}</Label>
                <Select value={form.tier} onValueChange={set("tier")}>
                  <SelectTrigger><SelectValue placeholder={lang === "en" ? "Select..." : "Secin..."} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">vCISO Temel — ₺4.990/ay</SelectItem>
                    <SelectItem value="profesyonel">vCISO Profesyonel — ₺9.990/ay</SelectItem>
                    <SelectItem value="lider">vCISO Lider — ₺19.990/ay</SelectItem>
                    <SelectItem value="unsure">{lang === "en" ? "Help me choose" : "Kararsizim, yardim edin"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{lang === "en" ? "Current situation" : "Mevcut durumunuz"}</Label>
                <Select value={form.hasCiso} onValueChange={set("hasCiso")}>
                  <SelectTrigger><SelectValue placeholder={lang === "en" ? "Select..." : "Secin..."} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yok">{lang === "en" ? "No cybersecurity resources" : "Hicbir kaynak yok"}</SelectItem>
                    <SelectItem value="it">{lang === "en" ? "IT team handles it" : "BT ekibi hallediyor"}</SelectItem>
                    <SelectItem value="dis">{lang === "en" ? "External consulting" : "Dis danismanlik var"}</SelectItem>
                    <SelectItem value="ciso">{lang === "en" ? "Full-time CISO" : "Tam zamanli CISO var"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={sending} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {sending
                ? (lang === "en" ? "Sending..." : "Gönderiliyor...")
                : (lang === "en" ? "Submit Application" : "Basvuruyu Gönder")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {lang === "en"
                ? "Your information is kept confidential. No spam. KVKK compliant."
                : "Bilgileriniz gizli tutulur. Spam gönderilmez. KVKK uyumlu."}
            </p>
          </form>
          <div className="mt-6 text-center">
            <a href="mailto:info@cyberstep.io" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-4 w-4 text-primary" />
              info@cyberstep.io
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-secondary text-secondary-foreground border-t">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            {lang === "en" ? "Start with a free domain scan" : "Ücretsiz domain taramasıyla başlayın"}
          </h2>
          <p className="text-white/80 mb-6 text-sm">
            {lang === "en"
              ? "Before selecting a package, let's map your current security posture in 10 minutes. Free, no installation required."
              : "Paket seçmeden önce 10 dakikada mevcut güvenlik durumunuzu haritalayalım. Ücretsiz, kurulum gerektirmez."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Link href="/domain-tarama">
                {lang === "en" ? "Free Domain Scan" : "Ücretsiz Domain Taraması"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/fiyatlar">
                {lang === "en" ? "All Services" : "Tüm Servisler"}
                <TrendingDown className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
