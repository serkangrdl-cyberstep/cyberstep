import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  ExternalLink, RotateCcw, Info, Mail, Clock, Building2, FileText,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

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
    id: "company_type",
    question: "Şirketiniz anonim şirket (A.Ş.) veya limited şirket (Ltd. Şti.) mi?",
    hint: "Ticaret Kanunu kapsamında tescilli tüzel kişilikler KEP kullanımı açısından değerlendirilir.",
    yesLabel: "Evet, A.Ş. / Ltd. Şti.",
    noLabel: "Hayır / Şahıs işletmesi",
  },
  {
    id: "legal_notice",
    question: "Yasal tebligat almak veya göndermek ihtiyacınız var mı?",
    hint: "Mahkeme bildirimleri, vergi tebligatları, idari işlemler, fatura anlaşmazlıkları gibi hukuki belgeler.",
    yesLabel: "Evet",
    noLabel: "Hayır",
  },
  {
    id: "edevlet",
    question: "Kamu kurumlarıyla düzenli yazışma yapıyor musunuz?",
    hint: "İhale, izin, ruhsat, teşvik başvuruları gibi kamu belgeli süreçler.",
    yesLabel: "Evet, sık yapıyoruz",
    noLabel: "Hayır / Nadir",
  },
];

type ResultType = "strongly_recommended" | "recommended" | "optional";

function calcResult(answers: Record<string, Answer>): ResultType {
  const isCompany = answers["company_type"] === "yes";
  const needsLegal = answers["legal_notice"] === "yes";
  const publicComm = answers["edevlet"] === "yes";

  if (isCompany && needsLegal) return "strongly_recommended";
  if (isCompany || needsLegal || publicComm) return "recommended";
  return "optional";
}

const RESULT_MAP: Record<ResultType, {
  label: string;
  color: string;
  title: string;
  description: string;
  actions: string[];
}> = {
  strongly_recommended: {
    label: "Kesinlikle Önerilir",
    color: "red",
    title: "KEP kullanımı sizin için kritik",
    description: "A.Ş. veya Ltd. Şti. olarak hukuki tebligat süreçlerinizde KEP en güvenli ve yasal geçerli yöntemdir. 7201 sayılı Tebligat Kanunu kapsamında KEP ile yapılan tebligatlar kesin hukuki geçerliliğe sahiptir.",
    actions: [
      "Yetkili KEP sağlayıcısından (PTT KEP, TNB KEP, TÜRKKEP vb.) hesap açın.",
      "KEP adresinizi vergi dairesine ve ilgili kurumlara bildirin.",
      "Hukuki belgeleri KEP üzerinden gönderin ve saklayın; gönderim delilleri 10 yıl saklanmalıdır.",
      "Personel eğitimi yapın: KEP, normal e-posta gibi kullanılmaz; her gönderim kayıtlıdır.",
    ],
  },
  recommended: {
    label: "Önerilir",
    color: "amber",
    title: "KEP hesabı açmanızı öneririz",
    description: "Kamu kurumlarıyla yazışma veya hukuki süreçleriniz göz önünde bulundurulduğunda KEP kullanımı operasyonel güvenliğinizi artıracak ve ileride zorunlu hale gelebilecektir.",
    actions: [
      "PTT KEP (ptt.gov.tr/kep) veya özel sağlayıcıdan hesap açın.",
      "Fatura ve sözleşme gibi önemli ticari yazışmalarda KEP kullanmaya başlayın.",
      "E-Fatura ve E-Dönüşüm süreçlerinizi KEP ile entegre edin.",
    ],
  },
  optional: {
    label: "İsteğe Bağlı",
    color: "emerald",
    title: "KEP şimdilik zorunlu değil",
    description: "Mevcut durumunuzda KEP kullanımı zorunlu olmayabilir. Ancak işletmeniz büyüdükçe veya kamu kurumlarıyla yazışma arttıkça ihtiyaç doğabilir.",
    actions: [
      "İşletmeniz büyüdüğünde veya sözleşme anlaşmazlıklarında KEP kullanmayı değerlendirin.",
      "Şimdilik temel güvenli e-posta uygulamalarına odaklanın (şifreleme, MFA).",
    ],
  },
};

const KEP_PROVIDERS = [
  { name: "PTT KEP", url: "https://www.ptt.gov.tr/kep", note: "Devlet güvenceli, yaygın" },
  { name: "TNB KEP", url: "https://www.tnbkep.com.tr", note: "Türkiye Noterler Birliği" },
  { name: "TÜRKKEP", url: "https://www.turkkep.com.tr", note: "Özel sektör, yaygın entegrasyon" },
  { name: "E-Güven KEP", url: "https://www.e-guven.com", note: "Finans sektörü odaklı" },
];

const KEP_STEPS = [
  { num: 1, icon: <Building2 className="h-4 w-4" />, title: "Sağlayıcı Seç", desc: "BTK onaylı bir KEP sağlayıcısından hesap açın. Kimlik doğrulama için e-Devlet veya noter onayı gerekebilir." },
  { num: 2, icon: <FileText className="h-4 w-4" />, title: "Başvur ve Doğrula", desc: "Şirket unvanı ve imza yetkilisi bilgileriyle başvuru yapın. Kurum başvurularında imza sirküleri istenir." },
  { num: 3, icon: <Mail className="h-4 w-4" />, title: "KEP Adresini Bildirin", desc: "Vergi dairesi, SGK ve iş ilişkisinde olduğunuz kurumlara KEP adresinizi bildirin." },
  { num: 4, icon: <Clock className="h-4 w-4" />, title: "Delilleri Saklayın", desc: "Her KEP gönderimi zaman damgalı delil üretir. Bu delilleri en az 10 yıl saklayın." },
];

export default function KepRehberi() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "KEP (Kayıtlı Elektronik Posta) Rehberi | CyberStep.io",
    description: "Şirketinizin KEP ihtiyacını değerlendirin, sağlayıcıları karşılaştırın ve başvuru adımlarını öğrenin.",
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
    if (isLast) setShowResult(true);
    else setStep(step + 1);
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setShowResult(false);
  }

  const result = showResult ? calcResult(answers) : null;
  const resultInfo = result ? RESULT_MAP[result] : null;

  const borderColor: Record<string, string> = {
    red: "border-red-500/30 bg-red-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
  };
  const badgeColor: Record<string, string> = {
    red: "border-red-500/40 text-red-600 bg-red-500/10",
    amber: "border-amber-500/40 text-amber-600 bg-amber-500/10",
    emerald: "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{lang === "en" ? "KEP Guide" : "KEP Rehberi"}</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{lang === "en" ? "KEP Needs Assessment" : "KEP İhtiyaç Değerlendirmesi"}</h1>
        <p className="text-muted-foreground max-w-xl">
          Kayıtlı Elektronik Posta (KEP) kullanmanız gerekip gerekmediğini 3 soruyla öğrenin. Hukuki geçerliliği olan e-posta gönderimi için resmi rehber.
        </p>
      </div>

      {!showResult && (
        <Card className="shadow-sm mb-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Soru {step + 1} / {STEPS.length}</span>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full ${i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted"}`} />
                ))}
              </div>
            </div>
            <CardTitle className="text-lg leading-snug">{currentStep.question}</CardTitle>
            <CardDescription className="flex items-start gap-2 mt-1">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />{currentStep.hint}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1" onClick={() => answer("yes")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />{currentStep.yesLabel ?? "Evet"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => answer("no")}>
              <XCircle className="mr-2 h-4 w-4" />{currentStep.noLabel ?? "Hayır"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showResult && resultInfo && (
        <div className="space-y-6">
          <Card className={`shadow-sm border-2 ${borderColor[resultInfo.color]}`}>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                {resultInfo.color === "red" ? <AlertTriangle className="h-5 w-5 text-red-500" /> : resultInfo.color === "amber" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                <Badge variant="outline" className={badgeColor[resultInfo.color]}>{resultInfo.label}</Badge>
              </div>
              <CardTitle className="text-xl">{resultInfo.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed mt-1">{resultInfo.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium mb-2">Yapmanız gerekenler:</p>
              <ul className="space-y-2">
                {resultInfo.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />{a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Tekrar Değerlendir</Button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-4">KEP Başvuru Adımları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {KEP_STEPS.map((s) => (
            <Card key={s.num} className="shadow-sm">
              <CardContent className="pt-5 flex gap-3">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{s.num}</div>
                <div>
                  <p className="font-medium text-sm mb-0.5">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3">BTK Onaylı KEP Sağlayıcıları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {KEP_PROVIDERS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer">
              <Card className="shadow-sm hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.note}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>

      <Card className="mt-6 shadow-sm border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">Hukuki Uyarı</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              KEP ile gönderilen belgeler, Elektronik İmza Kanunu ve Tebligat Kanunu kapsamında yasal geçerliliğe sahiptir. KEP hesabı açılmamış taraflara hukuki sonuç doğuran tebligat yapılamaz.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">KEP hukuki güvenlik sağlar — siber güvenlik farklı.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              KVKK Madde 12 kapsamında teknik ve idari tedbirlerinizi 20 soruluk ücretsiz değerlendirmeyle kontrol edin.
            </p>
          </div>
          <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
            Ücretsiz Değerlendirme →
          </a>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Bu rehber genel bilgi amaçlıdır. KEP mevzuatı için resmi kaynak: <a href="https://www.btk.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">btk.gov.tr</a>
      </p>
    </div>
  );
}
