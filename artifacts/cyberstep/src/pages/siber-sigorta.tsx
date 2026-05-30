import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, ChevronRight, CheckCircle2, AlertTriangle, RotateCcw,
  Info, ExternalLink, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";

type StepId = "sector" | "employees" | "revenue" | "data_types" | "controls" | "prior_incident";

interface Question {
  id: StepId;
  label: string;
  hint?: string;
  options: { value: string; label: string; score: number }[];
}

const QUESTIONS: Question[] = [
  {
    id: "sector",
    label: "Sektörünüz nedir?",
    hint: "Bazı sektörler siber saldırıların odağında olduğundan premi etkiler.",
    options: [
      { value: "finance", label: "Finans / Sigorta", score: 5 },
      { value: "health", label: "Sağlık", score: 5 },
      { value: "ecommerce", label: "E-ticaret / Perakende", score: 4 },
      { value: "tech", label: "Teknoloji / Yazılım", score: 3 },
      { value: "manufacturing", label: "Üretim / Sanayi", score: 2 },
      { value: "other", label: "Diğer", score: 1 },
    ],
  },
  {
    id: "employees",
    label: "Kaç çalışanınız var?",
    options: [
      { value: "1-9", label: "1 – 9", score: 1 },
      { value: "10-49", label: "10 – 49", score: 2 },
      { value: "50-249", label: "50 – 249", score: 3 },
      { value: "250+", label: "250 ve üzeri", score: 5 },
    ],
  },
  {
    id: "revenue",
    label: "Yıllık cironuz ne kadar?",
    options: [
      { value: "lt5m", label: "5M TL altı", score: 1 },
      { value: "5-25m", label: "5M – 25M TL", score: 2 },
      { value: "25-100m", label: "25M – 100M TL", score: 3 },
      { value: "100m+", label: "100M TL üzeri", score: 5 },
    ],
  },
  {
    id: "data_types",
    label: "Hangi tür kişisel / hassas veri işliyorsunuz?",
    hint: "En hassas veri türünü seçin.",
    options: [
      { value: "none", label: "Kişisel veri işlemiyoruz", score: 0 },
      { value: "basic", label: "Temel müşteri/çalışan bilgileri", score: 1 },
      { value: "financial", label: "Ödeme / finansal veri", score: 4 },
      { value: "health", label: "Sağlık / biyometrik veri", score: 5 },
      { value: "mass", label: "Çok sayıda kişisel kayıt (100K+)", score: 5 },
    ],
  },
  {
    id: "controls",
    label: "Mevcut siber güvenlik önlemleriniz?",
    hint: "En iyi uyan seçeneği seçin.",
    options: [
      { value: "none", label: "Temel önlem yok / bilmiyorum", score: 0 },
      { value: "basic", label: "Antivirüs ve güvenlik duvarı var", score: -1 },
      { value: "medium", label: "MFA, yedekleme ve güncel yamalar uygulanıyor", score: -2 },
      { value: "advanced", label: "EDR, SOC izleme, KVKK uyumu, penetrasyon testi", score: -4 },
    ],
  },
  {
    id: "prior_incident",
    label: "Son 3 yılda siber güvenlik olayı yaşadınız mı?",
    hint: "Fidye yazılımı, veri ihlali, DDoS gibi.",
    options: [
      { value: "no", label: "Hayır", score: 0 },
      { value: "minor", label: "Evet, küçük çaplı (hizmet kesintisi < 1 gün)", score: 2 },
      { value: "major", label: "Evet, ciddi (veri ihlali / fidye)", score: 5 },
    ],
  },
];

interface Coverage {
  teminat: string;
  primMin: number;
  primMax: number;
  label: string;
  color: string;
  desc: string;
  bullets: string[];
}

function calcCoverage(answers: Record<string, string>): Coverage {
  let score = 0;
  QUESTIONS.forEach((q) => {
    const opt = q.options.find((o) => o.value === answers[q.id]);
    if (opt) score += opt.score;
  });

  if (score <= 4) {
    return {
      teminat: "1M – 2M TL",
      primMin: 8_000,
      primMax: 18_000,
      label: "Düşük Risk",
      color: "emerald",
      desc: "Risk profiliniz görece düşük. Temel siber sigorta poliçesi yeterli olabilir.",
      bullets: [
        "Fidye yazılımı teminatı",
        "Olay müdahale masrafları",
        "Veri kurtarma masrafları",
        "Üçüncü taraf bildirim masrafları",
      ],
    };
  } else if (score <= 10) {
    return {
      teminat: "3M – 7M TL",
      primMin: 25_000,
      primMax: 60_000,
      label: "Orta Risk",
      color: "amber",
      desc: "Orta düzey risk profiline sahipsiniz. Kapsamlı bir siber sigorta poliçesi değerlendirin.",
      bullets: [
        "Fidye yazılımı ve gasp teminatı",
        "İş kesintisi tazminatı",
        "Siber sorumluluk (üçüncü taraf)",
        "Medya sorumluluğu",
        "Düzenleyici para cezası masrafları",
      ],
    };
  } else {
    return {
      teminat: "10M – 25M TL",
      primMin: 80_000,
      primMax: 250_000,
      label: "Yüksek Risk",
      color: "red",
      desc: "Risk profiliniz yüksek. Geniş kapsamlı poliçe ve sigorta öncesi siber güvenlik denetimi öneririz.",
      bullets: [
        "Fidye yazılımı ve gasp (geniş kapsamlı)",
        "İş kesintisi ve kâr kaybı",
        "Siber sorumluluk (geniş)",
        "Müşteri bildirimi ve PR masrafları",
        "Düzenleyici para cezası",
        "Adli bilişim ve hukuki danışmanlık",
        "Kripto para gasp teminatı",
      ],
    };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR").format(n);
}

export default function SiberSigorta() {
  usePageMeta({
    title: "Siber Sigorta Prim Hesaplayıcı | CyberStep.io",
    description: "Şirketinizin siber sigorta ihtiyacını ve tahmini prim aralığını öğrenin. Ücretsiz risk değerlendirmesi.",
    noIndex: false,
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  const currentQ = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = Math.round(((step) / QUESTIONS.length) * 100);

  function pick(value: string) {
    const newAnswers = { ...answers, [currentQ.id]: value };
    setAnswers(newAnswers);
    if (isLast) {
      setShowResult(true);
    } else {
      setStep(step + 1);
    }
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setShowResult(false);
  }

  const result = showResult ? calcCoverage(answers) : null;

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
  };

  const badgeColorMap: Record<string, string> = {
    emerald: "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
    amber: "border-amber-500/40 text-amber-600 bg-amber-500/10",
    red: "border-red-500/40 text-red-600 bg-red-500/10",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Siber Sigorta
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Siber Sigorta Prim Tahmini</h1>
        <p className="text-muted-foreground">
          6 soruyla şirketinizin risk profilini değerlendirin, tahmini sigorta primini ve önerilen teminat tutarını öğrenin.
        </p>
      </div>

      {/* Wizard */}
      {!showResult && (
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                Soru {step + 1} / {QUESTIONS.length}
              </span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 mb-4" />
            <CardTitle className="text-lg leading-snug">{currentQ.label}</CardTitle>
            {currentQ.hint && (
              <CardDescription className="flex items-start gap-1.5 mt-1">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                {currentQ.hint}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {currentQ.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => pick(opt.value)}
                className="w-full text-left rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-between group"
              >
                {opt.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {showResult && result && (
        <div className="space-y-6">
          <Card className={`shadow-sm border-2 ${colorMap[result.color]}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <TrendingUp className={`h-5 w-5 ${result.color === "emerald" ? "text-emerald-500" : result.color === "amber" ? "text-amber-500" : "text-red-500"}`} />
                <Badge variant="outline" className={badgeColorMap[result.color]}>
                  {result.label}
                </Badge>
              </div>
              <CardTitle className="text-xl">Tahmini Teminat: {result.teminat}</CardTitle>
              <div className="mt-2 p-3 rounded-lg bg-background border">
                <p className="text-xs text-muted-foreground mb-0.5">Tahmini yıllık prim aralığı</p>
                <p className="text-2xl font-bold">{fmt(result.primMin)} – {fmt(result.primMax)} TL</p>
                <p className="text-xs text-muted-foreground mt-1">* Gerçek prim sigorta şirketine ve poliçe detaylarına göre farklılık gösterebilir.</p>
              </div>
              <CardDescription className="mt-2 text-sm">{result.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium mb-2">Önerilen teminat kapsamı:</p>
              <ul className="space-y-1.5">
                {result.bullets.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.color !== "emerald" && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="pt-5 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1">Primi düşürmenin yolları</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Tüm çalışanlarda MFA zorunlu hale getirin</li>
                    <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Güncel yedekleme ve kurtarma planı oluşturun</li>
                    <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />CyberStep güvenlik denetimini tamamlayıp rapor alın</li>
                    <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Çalışanlara yılda en az 1 siber güvenlik eğitimi verin</li>
                    <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Penetrasyon testi yaptırıp belgeleyin</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Link href="/assessment/start">
              <Button>
                <Shield className="mr-2 h-4 w-4" /> Ücretsiz Güvenlik Değerlendirmesi
              </Button>
            </Link>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Tekrar Hesapla
            </Button>
          </div>
        </div>
      )}

      {/* Info boxes */}
      {!showResult && (
        <div className="mt-6 space-y-3">
          <Card className="shadow-sm">
            <CardContent className="pt-4 flex gap-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Siber sigorta, fidye yazılımı, veri ihlali, iş kesintisi ve yasal yükümlülükler nedeniyle oluşan finansal kayıpları güvence altına alır. Türkiye'de henüz gelişmekte olan bu ürünü çeşitli sigorta şirketleri sunmaktadır.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Bu araç genel bilgi ve tahmin amaçlıdır. Gerçek prim ve teminat tutarları sigorta şirketinin yaptığı risk değerlendirmesine göre belirlenir. Güvenilir bir sigorta brokerı veya acentesiyle görüşmenizi öneririz.
      </p>
    </div>
  );
}
