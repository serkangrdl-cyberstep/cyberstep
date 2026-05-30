import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  ExternalLink, RotateCcw, Info, FileText, Clock, Building2,
} from "lucide-react";
import { Link } from "wouter";

type Answer = "yes" | "no" | null;

interface WizardStep {
  id: string;
  question: string;
  hint: string;
  yesLabel?: string;
  noLabel?: string;
}

const STEPS: WizardStep[] = [
  {
    id: "employees",
    question: "Şirketinizde 50'den az çalışan mı var?",
    hint: "Tam zamanlı + yarı zamanlı tüm çalışanlar dahildir. Holdinge bağlı şirketler için grup toplamı dikkate alınabilir.",
    yesLabel: "Evet, 50'den az",
    noLabel: "Hayır, 50 ve üzeri",
  },
  {
    id: "annual_turnover",
    question: "Yıllık cironuz 25 milyon TL'nin altında mı?",
    hint: "Bir önceki takvim yılındaki net satış gelirinizi baz alın.",
    yesLabel: "Evet, 25M TL altı",
    noLabel: "Hayır, 25M TL ve üzeri",
  },
  {
    id: "special_data",
    question: "Sağlık, biyometrik, ceza veya sendika verisi işliyor musunuz?",
    hint: "KVKK Md.6'da sayılan özel nitelikli kişisel veriler: kan grubu, parmak izi, sağlık kaydı, mahkumiyet bilgisi, sendika üyeliği.",
    yesLabel: "Evet, işliyoruz",
    noLabel: "Hayır, işlemiyoruz",
  },
];

type ResultType = "exempt_small" | "exempt_no_special" | "mandatory" | "likely_mandatory";

function calcResult(answers: Record<string, Answer>): ResultType {
  const fewEmployees = answers["employees"] === "yes";
  const lowTurnover = answers["annual_turnover"] === "yes";
  const noSpecialData = answers["special_data"] === "no";

  if (fewEmployees && lowTurnover && noSpecialData) return "exempt_small";
  if (fewEmployees && lowTurnover && !noSpecialData) return "mandatory";
  if (!fewEmployees || !lowTurnover) return "mandatory";
  return "likely_mandatory";
}

const RESULT_MAP: Record<ResultType, {
  label: string;
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  actions: string[];
  cta: string;
}> = {
  exempt_small: {
    label: "Muaf",
    color: "emerald",
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    title: "VERBİS kaydından muafsınız",
    description: "50'den az çalışan ve 25M TL altı ciro koşullarını sağlayan şirketler ile özel nitelikli veri işlemeyen küçük ölçekli veri sorumluları VERBİS'e kayıt yükümlülüğünden istisna tutulmaktadır (KVK Kurulu 2018/87 sayılı Karar).",
    actions: [
      "İstisna kapsamında olsanız da KVKK'ya uyum yükümlülüğünüz devam eder.",
      "Aydınlatma yükümlülüğü, veri işleme politikası ve teknik tedbirler zorunludur.",
      "Çalışan sayısı veya cirounuz değişirse yükümlülük doğabilir — yıllık gözden geçirin.",
      "İstisna belgelerinizi saklayın; denetimde talep edilebilir.",
    ],
    cta: "Uyum Değerlendirmesi Yap",
  },
  mandatory: {
    label: "Zorunlu",
    color: "red",
    icon: <XCircle className="h-6 w-6 text-red-500" />,
    title: "VERBİS'e kayıt zorunludur",
    description: "50 ve üzeri çalışan veya 25M TL ve üzeri ciro koşulunu taşıyan veri sorumluları ya da özel nitelikli kişisel veri işleyenler VERBİS'e kayıt olmak zorundadır. Kayıt yaptırmamanın idari para cezası 2024 itibarıyla 94.668 TL ile 1.577.793 TL arasındadır.",
    actions: [
      "verbis.kvkk.gov.tr adresinden e-Devlet ile giriş yaparak başvurunuzu yapın.",
      "Veri işleme faaliyetlerinizi envantere dönüştürün (amaç, kategori, aktarım, saklama süresi).",
      "Veri Koruma Görevlisi (VKG) atanması değerlendirin — büyük ölçeklilerde zorunlu olabilir.",
      "Kayıt bilgilerini yıllık güncelleyin; değişiklikleri 30 gün içinde bildirin.",
    ],
    cta: "VERBİS Başvurusuna Başla",
  },
  exempt_no_special: {
    label: "Muhtemelen Muaf",
    color: "amber",
    icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    title: "Büyük ihtimalle muafsınız",
    description: "Kriterlerinize göre muafiyet kapsamında görünüyorsunuz. Ancak faaliyet alanınıza ve işlediğiniz veri türlerine göre farklı yükümlülükler doğabilir. Bir hukuk danışmanı veya KVKK uzmanı ile teyit etmenizi öneririz.",
    actions: [
      "Muafiyet kapsamında olup olmadığınızı avukatınıza teyit ettirin.",
      "Aydınlatma metni ve çerez politikası hazırlayın.",
      "Veri envanteri oluşturun; ihtiyaç halinde hızla VERBİS'e geçin.",
    ],
    cta: "Uyum Değerlendirmesi Yap",
  },
  likely_mandatory: {
    label: "Zorunlu (Kontrol Edin)",
    color: "amber",
    icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    title: "Kayıt yükümlülüğünüz olabilir",
    description: "Verdiğiniz cevaplara göre VERBİS kaydı yükümlülüğünüz bulunuyor olabilir. Emin olmak için bir KVKK uzmanına danışmanızı öneririz.",
    actions: [
      "verbis.kvkk.gov.tr adresini ziyaret ederek kendi değerlendirmenizi yapın.",
      "Faaliyet ve veri envanterinizi hazırlayın.",
      "Hukuki danışmanlık alarak yükümlülüğünüzü netleştirin.",
    ],
    cta: "Uzman Talep Et",
  },
};

const VERBIS_STEPS = [
  {
    num: 1,
    title: "Hesap Oluştur",
    desc: "verbis.kvkk.gov.tr adresine e-Devlet ile giriş yapın. Yetkili kişinin kimlik doğrulaması gerekir.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    num: 2,
    title: "Veri Envanteri Hazırla",
    desc: "İşlediğiniz tüm kişisel verileri (çalışan, müşteri, tedarikçi) amaç, kategori, saklama süresi ve aktarım bilgisiyle belgeleyin.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    num: 3,
    title: "VERBİS Kaydını Tamamla",
    desc: "Veri işleme faaliyetlerinizi sisteme girin. Eksik veya hatalı bildirim de ceza riskidir.",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    num: 4,
    title: "Yıllık Güncelle",
    desc: "Kayıt bilgilerini yılda en az bir kez güncelleyin. Değişiklikler 30 gün içinde bildirilmelidir.",
    icon: <Clock className="h-5 w-5" />,
  },
];

export default function KvkkVerbis() {
  usePageMeta({
    title: "KVKK VERBİS Yükümlülük Kontrolü | CyberStep.io",
    description: "Şirketinizin KVKK VERBİS kaydına ihtiyacı var mı? Ücretsiz wizard ile öğrenin, başvuru adımlarını görün.",
    noIndex: false,
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showResult, setShowResult] = useState(false);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function answer(val: Answer) {
    const newAnswers = { ...answers, [currentStep.id]: val };
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

  const result = showResult ? calcResult(answers) : null;
  const resultInfo = result ? RESULT_MAP[result] : null;

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    red: "border-red-500/30 bg-red-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            KVKK Uyum Aracı
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">VERBİS Yükümlülük Kontrolü</h1>
        <p className="text-muted-foreground max-w-xl">
          Şirketinizin Veri Sorumluları Sicili'ne (VERBİS) kayıt yaptırması gerekip gerekmediğini 3 soruyla öğrenin.
        </p>
      </div>

      {/* Wizard */}
      {!showResult && (
        <Card className="shadow-sm mb-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                Soru {step + 1} / {STEPS.length}
              </span>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i < step ? "w-6 bg-primary" : i === step ? "w-6 bg-primary/60" : "w-6 bg-muted"}`}
                  />
                ))}
              </div>
            </div>
            <CardTitle className="text-lg leading-snug">{currentStep.question}</CardTitle>
            <CardDescription className="flex items-start gap-2 mt-1">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              {currentStep.hint}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1"
              onClick={() => answer("yes")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {currentStep.yesLabel ?? "Evet"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => answer("no")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {currentStep.noLabel ?? "Hayır"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {showResult && resultInfo && (
        <div className="space-y-6">
          <Card className={`shadow-sm border-2 ${colorMap[resultInfo.color] ?? ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                {resultInfo.icon}
                <Badge
                  variant="outline"
                  className={
                    resultInfo.color === "emerald"
                      ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                      : resultInfo.color === "red"
                      ? "border-red-500/40 text-red-600 bg-red-500/10"
                      : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                  }
                >
                  {resultInfo.label}
                </Badge>
              </div>
              <CardTitle className="text-xl">{resultInfo.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed mt-1">
                {resultInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Yapmanız gerekenler:</p>
              <ul className="space-y-2">
                {resultInfo.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    {a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {result === "mandatory" || result === "likely_mandatory" ? (
              <a href="https://verbis.kvkk.gov.tr" target="_blank" rel="noopener noreferrer">
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" /> VERBİS Portalına Git
                </Button>
              </a>
            ) : (
              <Link href="/assessment/start">
                <Button>
                  <Shield className="mr-2 h-4 w-4" /> Uyum Değerlendirmesi Yap
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Tekrar Sorgula
            </Button>
          </div>
        </div>
      )}

      {/* VERBİS Başvuru Adımları */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-4">VERBİS Başvuru Süreci</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VERBIS_STEPS.map((s) => (
            <Card key={s.num} className="shadow-sm">
              <CardContent className="pt-5 flex gap-3">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {s.num}
                </div>
                <div>
                  <p className="font-medium text-sm mb-0.5">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Ceza bilgi kutusu */}
      <Card className="mt-6 shadow-sm border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">Kayıt Yaptırmama Cezası</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              VERBİS'e kayıt yükümlülüğünü yerine getirmeyen veri sorumluları hakkında KVK Kurulu tarafından 2024 yılı itibarıyla <strong>94.668 TL ile 1.577.793 TL</strong> arasında idari para cezası uygulanmaktadır (KVKK Md.18/1-b). Ceza miktarları her yıl yeniden değerleme oranında artmaktadır.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="mt-6 text-xs text-muted-foreground">
        Bu araç genel bilgi amaçlıdır ve hukuki tavsiye niteliği taşımaz. Yükümlülüklerinizi kesinleştirmek için bir hukuk danışmanına başvurunuz. VERBİS işlemleri için resmi kaynak: <a href="https://verbis.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">verbis.kvkk.gov.tr</a>.
      </p>
    </div>
  );
}
