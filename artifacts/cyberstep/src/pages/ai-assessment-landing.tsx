import { Link } from "wouter";
import { Shield, Brain, FileText, AlertTriangle, CheckCircle, ChevronRight, Lock, Database, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/language-context";

const TOOLS_LIST = [
  { name: "ChatGPT", risk: "YUKSEK", category: "Ücretsiz" },
  { name: "ChatGPT Enterprise", risk: "ORTA", category: "Kurumsal" },
  { name: "Google Gemini", risk: "YUKSEK", category: "Ücretsiz" },
  { name: "Microsoft Copilot", risk: "DUSUK", category: "Kurumsal" },
  { name: "Claude", risk: "ORTA", category: "Ücretsiz/Pro" },
  { name: "GitHub Copilot", risk: "ORTA", category: "Bireysel" },
  { name: "Midjourney", risk: "KRITIK", category: "Ücretsiz/Basic" },
  { name: "DeepL", risk: "ORTA", category: "Ücretsiz" },
  { name: "Grammarly", risk: "YUKSEK", category: "Ücretsiz" },
  { name: "Perplexity AI", risk: "YUKSEK", category: "Ücretsiz" },
  { name: "Notion AI", risk: "ORTA", category: "Business" },
  { name: "Adobe Firefly", risk: "DUSUK", category: "Kurumsal" },
];

const RISK_COLORS: Record<string, string> = {
  KRITIK: "bg-red-100 text-red-700 border-red-200",
  YUKSEK: "bg-orange-100 text-orange-700 border-orange-200",
  ORTA: "bg-yellow-100 text-yellow-700 border-yellow-200",
  DUSUK: "bg-green-100 text-green-700 border-green-200",
};

const RISK_LABELS: Record<string, string> = {
  KRITIK: "Kritik",
  YUKSEK: "Yüksek",
  ORTA: "Orta",
  DUSUK: "Düşük",
};

const FEATURES = [
  { icon: Brain, title: "20+ AI Aracının Risk Profili", desc: "ChatGPT'den Midjourney'e her aracın KVKK uyum durumu ve veri saklama politikası." },
  { icon: AlertTriangle, title: "25 Soruluk Veri Maruz Kalma Analizi", desc: "Çalışanlarınızın ne tür verileri yapay zekaya gönderdiğini sorgular ve KVKK riskini hesaplar." },
  { icon: Lock, title: "KVKK Uyum Haritası", desc: "Tespit edilen AI kullanımını KVKK maddeleriyle eşleştirir, tahmini ceza riskini gösterir." },
  { icon: FileText, title: "Hazır AI Kullanım Politikası", desc: "Claude AI ile şirketinize özel imzalanmaya hazır 'Yapay Zeka Kabul Edilebilir Kullanım Politikası' üretir." },
];

const STEPS = [
  { num: "1", title: "Şirket bilgilerini girin", desc: "Sektör, çalışan sayısı ve iletişim bilgileri." },
  { num: "2", title: "Kullandığınız AI araçlarını seçin", desc: "Listeden çalışanlarınızın kullandığı araçları işaretleyin." },
  { num: "3", title: "25 soruyu yanıtlayın", desc: "Yaklaşık 15 dakika. Teknik bilgi gerekmez." },
  { num: "4", title: "Raporunuzu alın", desc: "AI destekli detaylı analiz ve hazır kullanım politikası." },
];

export default function AiAssessmentLanding() {
  const { lang } = useLanguage();
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-violet-600/20 text-violet-300 border-violet-500/30">
            {lang === "en" ? "New Service" : "Yeni Servis"}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {lang === "en" ? <>AI Security<br />Assessment</> : <>Yapay Zeka Güvenlik<br />Değerlendirmesi</>}
          </h1>
          <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
            {lang === "en" ? <>What are your employees sending to AI?<br /><span className="text-violet-300 font-medium">What does data protection law say?</span></> : <>Çalışanlarınız yapay zekaya ne gönderiyor?<br /><span className="text-violet-300 font-medium">KVKK ne diyor?</span></>}
          </p>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">
            {lang === "en"
              ? "ChatGPT, Gemini, Copilot... Millions of words flow into AI tools every day in Turkish companies. Customer data, contracts, salaries... Are you aware?"
              : "ChatGPT, Gemini, Copilot... Türk şirketlerinde her gün milyonlarca kelime yapay zeka araçlarına gidiyor. Müşteri bilgisi, sözleşme, maaş... Siz de bunun farkında mısınız?"}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/ai-guvenlik/start">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8">
                {lang === "en" ? "Start Assessment" : "Değerlendirmeyi Başlat"}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {lang === "en" ? "2,900 TL — One-time · ~15 min · No technical knowledge required" : "2.900 TL — Tek seferlik · ~15 dakika · Teknik bilgi gerekmez"}
          </p>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 px-4 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-10">
            Değerlendirme kapsamı
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <Card key={i} className="border border-slate-200 dark:border-slate-800">
                <CardContent className="p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <f.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{f.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Araçları Risk Tablosu */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-3">
            Değerlendirilen AI araçları
          </h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mb-10">
            20+ yapay zeka aracının risk profili, KVKK uyumu ve veri saklama politikası
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {TOOLS_LIST.map((tool, i) => (
              <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-1">
                <span className="font-medium text-sm text-slate-900 dark:text-white">{tool.name}</span>
                <span className="text-xs text-slate-500">{tool.category}</span>
                <Badge className={`text-xs w-fit mt-1 border ${RISK_COLORS[tool.risk]}`}>
                  {RISK_LABELS[tool.risk]}
                </Badge>
              </div>
            ))}
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 flex items-center justify-center">
              <span className="text-xs text-slate-400">+8 araç daha</span>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="py-16 px-4 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-10">
            Nasıl çalışır?
          </h2>
          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {step.num}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KVKK Uyarısı */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50 rounded-xl p-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-2">
                  Neden şimdi?
                </h3>
                <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-400">
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> KVKK'ya göre ABD menşeli AI araçlarına kişisel veri göndermek yurt dışı aktarım sayılır (Madde 9).</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> Ücretsiz ChatGPT'de girilen veriler model eğitimi için kullanılabilir.</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> KVK Kurulu, AI kaynaklı veri ihlallerinde cezaları artırıyor.</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> Çalışanlarınız bugün müşteri verisi, sözleşme veya maaş bilgisi gönderiyor olabilir.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-violet-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Şirketinizin AI riskini öğrenin</h2>
          <p className="text-violet-100 mb-8">
            15 dakikada yapay zeka güvenlik değerlendirmesi, KVKK uyum haritası ve imzalanmaya hazır kullanım politikası.
          </p>
          <Link href="/ai-guvenlik/start">
            <Button size="lg" className="bg-white text-violet-700 hover:bg-violet-50 font-semibold px-8">
              Değerlendirmeyi Başlat — 2.900 TL
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-violet-200">
            Tek seferlik ücret · PDF rapor + politika belgesi · 30 gün destek
          </p>
        </div>
      </section>
    </div>
  );
}
