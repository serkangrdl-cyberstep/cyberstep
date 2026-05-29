import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetReport, useGetAssessment } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertOctagon, ArrowRight, Clock, Mail, Phone, User, Building2,
  CheckCircle2, ChevronDown, ChevronUp, Shield, ShieldAlert, Download,
  TrendingUp, TrendingDown, Minus, Zap, Lock, Mail as MailIcon, Monitor, HardDrive,
  Globe, AtSign, Server, KeyRound, XCircle, Scale, FileCheck,
} from "lucide-react";
import { ReportLoading } from "@/components/report-loading";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MINI_ASSESSMENT_SECTIONS } from "@/lib/constants";

const SECTOR_BENCHMARKS: Record<string, number> = {
  "Finans/Sigorta": 72,
  "Sağlık": 61,
  "Teknoloji": 68,
  "Perakende/Ticaret": 55,
  "Üretim/Sanayi": 52,
  "Eğitim": 48,
  "Hizmet Sektörü": 57,
  "Diğer": 58,
};

const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  A: "Firma ve Yönetişim",
  B: "Kimlik, Erişim ve Uzak Erişim",
  C: "E-posta ve Kullanıcı Kaynaklı Riskler",
  D: "Cihaz ve Uç Nokta Güvenliği",
  E: "Veri Koruma, Yedekleme ve Olay Hazırlığı",
};

const KVKK_COMPLIANCE_MAP = [
  { domain: "A", title: "Yönetim ve Envanter", articles: ["Md.12"], risk: "Siber güvenlik sorumluluğu tanımlanmaması teknik tedbirler yükümlülüğünü (KVKK Md.12) doğrudan etkiler." },
  { domain: "B", title: "Kimlik ve Erişim Yönetimi", articles: ["Md.12"], risk: "Yetersiz erişim kontrolü kişisel verilere yetkisiz erişim riski doğurur — KVKK Md.12 bunu yasaklar." },
  { domain: "C", title: "E-posta ve Farkındalık", articles: ["Md.10", "Md.12"], risk: "Phishing saldırılarına açıklık veri ihlali riskini artırır. Çalışan eğitimi KVKK Md.12 gereğidir." },
  { domain: "D", title: "Cihaz ve Uç Nokta", articles: ["Md.12"], risk: "Korumasız cihazlardaki kişisel veriler KVKK Md.12 kapsamındaki teknik tedbir yükümlülüğünü ihlal eder." },
  { domain: "E", title: "Veri Koruma ve Yedek", articles: ["Md.7", "Md.12"], risk: "Kişisel veri kaybı 72 saat içinde bildirimi zorunlu kılar. Yedek ve müdahale planı olmadan uyumsuzluk kaçınılmaz." },
];

const NIST_CSF_MAP = [
  { domain: "A", fn: "IDENTIFY", label: "Tanımla", ids: "ID.AM + GV.OC", desc: "Varlık yönetimi ve organizasyonel bağlam" },
  { domain: "B", fn: "PROTECT", label: "Koru", ids: "PR.AA + PR.PS", desc: "Kimlik doğrulama ve erişim kontrolü" },
  { domain: "C", fn: "DETECT", label: "Tespit Et", ids: "PR.AT + DE.AE", desc: "Farkındalık eğitimi ve olay tespiti" },
  { domain: "D", fn: "PROTECT", label: "Koru", ids: "PR.PS + PR.IR", desc: "Platform güvenliği ve altyapı dayanıklılığı" },
  { domain: "E", fn: "RECOVER", label: "Kurtar", ids: "RC.RP + RS.MA", desc: "Olay kurtarma planı ve müdahale yönetimi" },
];

const getRiskColor = (level: string) => {
  switch (level) {
    case "Kritik": return "bg-destructive text-destructive-foreground";
    case "Yüksek": return "bg-orange-500 text-white";
    case "Orta": return "bg-yellow-500 text-white";
    case "Düşük": return "bg-green-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
};

const getRiskTextColor = (level: string) => {
  switch (level) {
    case "Kritik": return "text-destructive";
    case "Yüksek": return "text-orange-500";
    case "Orta": return "text-yellow-500";
    case "Düşük": return "text-green-500";
    default: return "text-muted-foreground";
  }
};

const getRiskBorderColor = (level: string) => {
  switch (level) {
    case "Kritik": return "border-t-destructive";
    case "Yüksek": return "border-t-orange-500";
    case "Orta": return "border-t-yellow-500";
    case "Düşük": return "border-t-green-500";
    default: return "border-t-primary";
  }
};

type ContactForm = { name: string; email: string; phone: string; note: string };

export function AssessmentReportById({ id }: { id: number }) {
  return <AssessmentReportCore id={id} />;
}

export default function AssessmentReport() {
  const [, params] = useRoute("/assessment/:id/report");
  const id = parseInt(params?.id || "0", 10);
  return <AssessmentReportCore id={id} />;
}

function AssessmentReportCore({ id }: { id: number }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: "", email: "", phone: "", note: "" });
  const [contactSent, setContactSent] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: reportData, isLoading } = useGetReport(id, {
    query: {
      queryKey: ["report", id],
      enabled: !!id,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        if ("status" in data && (data as any).status !== "report_ready") return 2000;
        return false;
      },
    },
  });

  const { data: assessment } = useGetAssessment(id, {
    query: { queryKey: ["assessment", id], enabled: !!id },
  });

  const isPending = !reportData || ("status" in reportData);

  if (isLoading || isPending) {
    return <ReportLoading />;
  }

  const report = reportData as any;
  const staticBenchmark = SECTOR_BENCHMARKS[assessment?.sector ?? "Diğer"] ?? 58;
  const sectorBenchmark: number = report.sectorAvg?.value ?? staticBenchmark;
  const scorePercent = report.scorePercent as number;
  const benchmarkDiff = scorePercent - sectorBenchmark;

  const DOMAIN_SOLUTIONS: Record<string, { title: string; risk: string; icon: React.ElementType }> = {
    "Firma ve Yönetişim": {
      icon: Shield,
      title: "Sorumluluk ve Envanter Yönetimi",
      risk: "Güvenlik sorumluluğu net tanımlanmazsa bir siber saldırıda kimin ne yapacağı bilinmez, müdahale saatler sürer ve hasar büyür.",
    },
    "Kimlik ve Erişim": {
      icon: Lock,
      title: "Hesap ve Erişim Güvenliği",
      risk: "Çalışan şifresi ele geçirilirse sisteme girilmesini engelleyecek ikinci bir güvence yoksa tüm iş verileri risk altına girer.",
    },
    "E-posta ve İnsan Faktörü": {
      icon: MailIcon,
      title: "E-posta Güvenliği ve Farkındalık",
      risk: "Sahte e-posta ile IBAN değişikliği veya zararlı dosya gönderimi, KOBİ'lerde en yaygın finansal kayıp yöntemidir.",
    },
    "Cihaz Güvenliği": {
      icon: Monitor,
      title: "Cihaz ve Bilgisayar Koruma",
      risk: "Güncellenmemiş bir bilgisayar veya antivirüssüz bir cihaz, fidye yazılımının tüm şirkete yayılması için yeterlidir.",
    },
    "Veri Koruma ve Yedekleme": {
      icon: HardDrive,
      title: "Veri Yedekleme ve İş Sürekliliği",
      risk: "Yedek alınmayan veriler fidye yazılımı veya donanım arızasında tamamen yok olabilir; günler veya haftalar süren iş durması yaşanabilir.",
    },
  };

  const TOP_PRIORITY_MAP: Record<number, { action: string; why: string; domain: string }> = {
    17: {
      action: "Kritik verileriniz için otomatik yedekleme başlatın.",
      why: "Yedek olmadan bir fidye saldırısı veya donanım arızası tüm iş verilerinizi kalıcı olarak silebilir.",
      domain: "Veri Koruma ve Yedekleme",
    },
    5: {
      action: "Tüm çalışan hesaplarında MFA (çok faktörlü doğrulama) aktif edin.",
      why: "Ele geçirilen tek bir şifre, MFA olmadan sistemlerinize tam erişim sağlar. MFA bu riski %99 azaltır.",
      domain: "Kimlik ve Erişim",
    },
    12: {
      action: "E-posta alan adınıza SPF, DKIM ve DMARC kaydı ekleyin.",
      why: "Bu kayıtlar olmadan saldırganlar şirketiniz adına sahte fatura ve ödeme talebi maili gönderebilir.",
      domain: "E-posta ve İnsan Faktörü",
    },
    11: {
      action: "IBAN değişikliği veya acil para transferi taleplerine telefon ile doğrulama zorunluluğu getirin.",
      why: "BEC (iş e-postası dolandırıcılığı) KOBİ'lerin en yaygın finansal kayıp nedenidir — tek bir mail yeterlidir.",
      domain: "E-posta ve İnsan Faktörü",
    },
    14: {
      action: "Tüm bilgisayarlara merkezi antivirüs yazılımı yükleyin ve otomatik güncellemeyi aktif edin.",
      why: "Korumasız bir bilgisayar fidye yazılımının tüm ağa yayılması için açık kapıdır.",
      domain: "Cihaz Güvenliği",
    },
    7: {
      action: "İşten ayrılan çalışanların tüm sistem erişimlerini ayrılış günü kaldırın.",
      why: "Eski çalışan hesapları aktif kaldığında kasıtlı veya kazara veri sızıntısı riski doğar.",
      domain: "Kimlik ve Erişim",
    },
    18: {
      action: "Yedeklerinizi test edin — geri yükleme çalışmazsa yedek yoktur.",
      why: "Yedek alıyor olmak yeterli değildir; test edilmemiş yedekler kriz anında işe yaramayabilir.",
      domain: "Veri Koruma ve Yedekleme",
    },
    6: {
      action: "VPN ve yönetici hesaplarda ek kimlik doğrulamayı (MFA) zorunlu hale getirin.",
      why: "Yönetici yetkili hesaplar ele geçirildiğinde saldırgan tüm sisteme tam erişim kazanır.",
      domain: "Kimlik ve Erişim",
    },
    3: {
      action: "Yeni işe giren ve ayrılan çalışanlar için hesap açma/kapama sürecini yazıya döküp uygulayın.",
      why: "Tanımsız bir süreç, kullanıcı hesaplarının yönetimsiz kalmasına ve güvenlik açıklarına neden olur.",
      domain: "Firma ve Yönetişim",
    },
  };

  const PRIORITY_ORDER = [17, 5, 12, 11, 14, 7, 18, 6, 3];

  const topPriority = (() => {
    const redAlarms: number[] = report.redAlarmQuestions ?? [];
    for (const qNum of PRIORITY_ORDER) {
      if (redAlarms.includes(qNum)) return TOP_PRIORITY_MAP[qNum] ?? null;
    }
    return null;
  })();

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/assessments/${id}/report/pdf`);
      if (!response.ok) throw new Error("PDF oluşturulamadı");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeCompany = (assessment?.companyName ?? "Rapor").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
      a.download = `CyberStep_Rapor_${safeCompany}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Mini Değerlendirme Sonucu
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(report.createdAt).toLocaleDateString("tr-TR")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {assessment?.companyName || "Şirket"} — Siber Risk Özeti
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePdfDownload} disabled={pdfLoading}>
            {pdfLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                PDF Hazırlanıyor
              </span>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> PDF İndir
              </>
            )}
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">
              Dashboard'a Dön <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Score + Red Alarms */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className={`col-span-1 md:col-span-2 shadow-sm border-t-4 ${getRiskBorderColor(report.riskLevel)}`}>
          <CardHeader className="pb-2">
            <CardTitle>Risk Skoru</CardTitle>
            <CardDescription>Siber güvenlik olgunluk seviyeniz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-36 h-36 transform -rotate-90">
                  <circle cx="72" cy="72" r="62" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted/30" />
                  <circle
                    cx="72" cy="72" r="62"
                    stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={389.6}
                    strokeDashoffset={389.6 - (389.6 * scorePercent) / 100}
                    className={`${getRiskTextColor(report.riskLevel)} transition-all duration-1000 ease-out`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-4xl font-bold">{report.totalScore}</span>
                  <span className="text-xs text-muted-foreground">/ {report.maxScore}</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Risk Seviyesi</span>
                    <Badge className={getRiskColor(report.riskLevel)}>{report.riskLevel}</Badge>
                  </div>
                  <Progress value={scorePercent} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">%{scorePercent.toFixed(0)} — yüksek skor daha iyi güvenlik anlamına gelir</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border text-sm">
                  <span className="font-medium">Sektör Karşılaştırması ({assessment?.sector ?? "Genel"}): </span>
                  <span className={benchmarkDiff >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                    {benchmarkDiff >= 0 ? "+" : ""}{benchmarkDiff.toFixed(0)} puan
                  </span>
                  <span className="text-muted-foreground">
                    {" "}(sektör ort. %{sectorBenchmark}
                    {report.sectorAvg ? " — gerçek veri" : " — sektör tahmini"})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-destructive" />
              Kırmızı Alarmlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-full pt-4 pb-2">
              <span className="text-6xl font-bold text-destructive mb-2">{report.redAlarmCount}</span>
              <p className="text-center text-sm font-medium">Kritik Güvenlik Açığı</p>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Derhal aksiyon alınması gereken temel güvenlik eksiklikleri tespit edildi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bugün yapmanız gereken tek şey */}
      {topPriority && (
        <Card className="shadow-sm mb-6 border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-950/20 dark:border-l-red-700">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 bg-red-100 dark:bg-red-900/40 rounded-xl p-3">
                <AlertOctagon className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Bugün yapmanız gereken tek şey</p>
                <p className="text-base font-bold text-foreground mb-2 leading-snug">{topPriority.action}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{topPriority.why}</p>
                <button
                  className="mt-3 text-xs text-red-600 font-medium hover:underline flex items-center gap-1"
                  onClick={() => document.getElementById("uzman-formu")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Uzman yardımı talep et <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skor Takibi */}
      {report.previousScore && (() => {
        const prev = report.previousScore;
        const delta = scorePercent - prev.scorePercent;
        const improved = delta > 0;
        const same = delta === 0;
        return (
          <Card className={`shadow-sm mb-6 border-t-4 ${improved ? "border-t-green-500" : same ? "border-t-slate-400" : "border-t-orange-500"}`}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${improved ? "bg-green-50" : same ? "bg-slate-100" : "bg-orange-50"}`}>
                  {improved ? <TrendingUp className="h-6 w-6 text-green-600" /> : same ? <Minus className="h-6 w-6 text-slate-500" /> : <TrendingDown className="h-6 w-6 text-orange-600" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Önceki Değerlendirmeye Göre Değişim</h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Önceki Skor</div>
                      <div className="text-2xl font-bold text-muted-foreground">%{prev.scorePercent}</div>
                      <Badge variant="outline" className="text-xs mt-0.5">{prev.riskLevel}</Badge>
                    </div>
                    <div className="text-2xl text-muted-foreground">→</div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Bu Skor</div>
                      <div className="text-2xl font-bold">%{scorePercent.toFixed(0)}</div>
                      <Badge className={getRiskColor(report.riskLevel)} variant="default">{report.riskLevel}</Badge>
                    </div>
                    <div className={`text-center ml-2 px-4 py-2 rounded-xl ${improved ? "bg-green-50" : same ? "bg-slate-100" : "bg-orange-50"}`}>
                      <div className="text-xs text-muted-foreground mb-0.5">Değişim</div>
                      <div className={`text-2xl font-bold ${improved ? "text-green-600" : same ? "text-slate-500" : "text-orange-600"}`}>
                        {delta > 0 ? "+" : ""}{delta} puan
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Önceki değerlendirme: {new Date(prev.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Domain cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        {report.domainScores?.map((d: any) => (
          <Card key={d.domain} className="shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <span className="text-2xl font-bold text-primary">{d.domain}</span>
              <p className="text-xs text-muted-foreground leading-tight">{DOMAIN_DESCRIPTIONS[d.domain]}</p>
              <div className={`text-xl font-bold ${d.percent > 70 ? "text-green-600" : d.percent > 40 ? "text-yellow-600" : "text-red-600"}`}>
                %{d.percent.toFixed(0)}
              </div>
              <Progress
                value={d.percent}
                className={`h-1.5 w-full ${d.percent > 70 ? "[&>div]:bg-green-500" : d.percent > 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KVKK Uyum Haritası */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary shrink-0" />
            KVKK Teknik Tedbirler Haritası
          </CardTitle>
          <CardDescription>
            Kişisel Verilerin Korunması Kanunu Madde 12 kapsamında teknik tedbir risk analizi
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {KVKK_COMPLIANCE_MAP.map(({ domain, title, articles, risk }) => {
              const domainScore = report.domainScores?.find((d: any) => d.domain === domain);
              const percent: number = domainScore?.percent ?? 0;
              const atRisk = percent < 60;
              return (
                <div
                  key={domain}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${atRisk ? "bg-red-50/50 border-red-200" : "bg-green-50/50 border-green-200"}`}
                >
                  <div className={`shrink-0 mt-0.5 ${atRisk ? "text-red-500" : "text-green-500"}`}>
                    {atRisk ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-semibold">{domain} — {title}</span>
                      {articles.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs px-1.5 py-0 border-slate-300 text-slate-600">{a}</Badge>
                      ))}
                    </div>
                    <p className={`text-xs ${atRisk ? "text-red-700" : "text-muted-foreground"}`}>
                      {atRisk ? risk : "Bu alanda yeterli güvenlik kontrolleriniz bulunuyor."}
                    </p>
                  </div>
                  <div className="shrink-0 text-xs font-bold text-muted-foreground whitespace-nowrap">
                    %{percent.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
            KVKK Madde 12 kapsamında veri ihlali bildirimi 72 saat içinde yapılmak zorundadır. KVKK Madde 18 uyarınca teknik tedbir eksikliğine 1.000.000 TL'ye kadar idari para cezası uygulanabilir.
          </p>
        </CardContent>
      </Card>

      {/* NIST CSF 2.0 Uyum Özeti */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-4 w-4 text-primary shrink-0" />
            NIST CSF 2.0 Uyum Seviyesi
          </CardTitle>
          <CardDescription>
            ABD Ulusal Standartlar Enstitüsü Siber Güvenlik Çerçevesi — kategori bazlı eşleme
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            {NIST_CSF_MAP.map(({ domain, fn, label, ids, desc }) => {
              const domainScore = report.domainScores?.find((d: any) => d.domain === domain);
              const percent: number = domainScore?.percent ?? 0;
              const level =
                percent >= 80 ? "Yönetilen" :
                percent >= 60 ? "Kısmen Uyumlu" :
                percent >= 40 ? "Başlangıç" :
                "Kritik Açık";
              const levelColor =
                percent >= 80 ? "border-green-300 text-green-700 bg-green-50" :
                percent >= 60 ? "border-yellow-300 text-yellow-700 bg-yellow-50" :
                percent >= 40 ? "border-orange-300 text-orange-700 bg-orange-50" :
                "border-red-300 text-red-700 bg-red-50";
              return (
                <div key={domain} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary">{fn}</span>
                    <span className="text-xs font-bold">%{percent.toFixed(0)}</span>
                  </div>
                  <p className="text-xs font-medium mb-0.5">{label} ({ids})</p>
                  <p className="text-xs text-muted-foreground mb-2 leading-snug">{desc}</p>
                  <Badge variant="outline" className={`text-xs ${levelColor}`}>{level}</Badge>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${percent >= 60 ? "bg-green-500" : percent >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground pt-3 border-t">
            NIST CSF 2.0, dünya genelinde 100'den fazla ülkede KOBİ'ler tarafından kullanılan gönüllü siber güvenlik standardıdır. Uluslararası iş ortakları ve sigorta şirketleri bu çerçeveyi referans alabilir.
          </p>
        </CardContent>
      </Card>

      {/* Domain bar chart */}
      <Card className="shadow-sm mb-6">
        <CardHeader>
          <CardTitle>Kategori Bazlı Puan Dağılımı</CardTitle>
          <CardDescription>5 güvenlik alanında başarı yüzdeniz</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.domainScores} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `%${v}`} />
              <YAxis dataKey="domain" type="category" width={24} tick={{ fontSize: 13, fontWeight: 600 }} />
              <Tooltip
                formatter={(value: number) => [`%${value.toFixed(0)}`, "Başarı"]}
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                {report.domainScores?.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.percent > 70 ? "hsl(142 71% 45%)" : entry.percent > 40 ? "hsl(35 92% 60%)" : "hsl(0 84% 60%)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Partner Yönlendirme — zayıf alanlara göre çözüm önerileri */}
      {(() => {
        const weakDomains = (report.domainScores ?? []).filter((d: any) => d.percent < 60);
        if (weakDomains.length === 0) return null;
        const domainNameMap: Record<string, string> = {
          A: "Firma ve Yönetişim",
          B: "Kimlik ve Erişim",
          C: "E-posta ve İnsan Faktörü",
          D: "Cihaz Güvenliği",
          E: "Veri Koruma ve Yedekleme",
        };
        return (
          <Card className="shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Öncelikli Aksiyon Alanları
              </CardTitle>
              <CardDescription>
                Skorunuza göre aşağıdaki alanlarda adım atmak işletmenizi korumada en büyük etkiyi yaratır.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weakDomains.map((d: any) => {
                  const domainName = domainNameMap[d.domain] ?? d.domain;
                  const sol = DOMAIN_SOLUTIONS[domainName];
                  if (!sol) return null;
                  const Icon = sol.icon;
                  return (
                    <div key={d.domain} className="flex gap-4 p-4 rounded-xl border bg-muted/20">
                      <div className="shrink-0 bg-primary/10 p-2.5 rounded-lg h-fit">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{sol.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0 text-orange-600 border-orange-300 bg-orange-50">
                            %{d.percent.toFixed(0)} Skor
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{sol.risk}</p>
                        <button
                          className="mt-2 text-xs text-primary font-medium hover:underline flex items-center gap-1"
                          onClick={() => document.getElementById("uzman-formu")?.scrollIntoView({ behavior: "smooth" })}
                        >
                          Uzman desteği al <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Alan Adı Güvenlik Taraması */}
      {(() => {
        const scan = report.domainScan as any;
        if (!scan) {
          // No domain provided — show CTA
          return (
            <Card className="shadow-sm mb-6 border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="shrink-0 bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Alan Adı Güvenlik Taraması</h3>
                    <p className="text-xs text-muted-foreground">
                      SPF, DMARC, DKIM ve SSL kayıtlarınızı otomatik kontrol edin. Hiçbir kurulum gerektirmez — sadece alan adınızı girin.
                    </p>
                  </div>
                  <a
                    href="/domain-tarama"
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Tara <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        }

        // For full plan, we have all fields; for mini (free), only id/domain/overallScore/createdAt
        const hasFullDetails = typeof scan.spfPass !== "undefined";

        const scoreColor = scan.overallScore >= 70 ? "text-emerald-600" : scan.overallScore >= 40 ? "text-amber-600" : "text-red-600";
        const scoreBg = scan.overallScore >= 70 ? "bg-emerald-50 border-emerald-200" : scan.overallScore >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

        const checks = hasFullDetails ? [
          { label: "SPF (Sahte E-posta)", icon: AtSign, pass: scan.spfPass, detail: scan.spfPass ? "Aktif" : "Eksik — şirket adınıza sahte e-posta gönderilebilir" },
          { label: "DMARC (E-posta Kimlik Doğrulama)", icon: MailIcon, pass: scan.dmarcPass, detail: scan.dmarcPass ? "Aktif" : "Eksik — phishing saldırıları tespit edilemiyor" },
          { label: "DKIM (E-posta İmzalama)", icon: KeyRound, pass: scan.dkimPass, detail: scan.dkimPass ? "Aktif" : "Eksik — e-postalarınız değiştirilebilir" },
          { label: "SSL Sertifikası", icon: Lock, pass: scan.sslPass, detail: scan.sslPass ? `Geçerli (${scan.sslDaysUntilExpiry ?? "?"} gün kaldı)` : "Hatalı veya süresi dolmuş" },
          { label: "Kara Liste", icon: Shield, pass: !scan.blacklisted, detail: scan.blacklisted ? `${scan.blacklistCount} spam listesinde kayıtlı` : "Temiz" },
          { label: "Veri İhlali Geçmişi", icon: ShieldAlert, pass: scan.hibpBreachCount === 0, detail: scan.hibpBreachCount > 0 ? `${scan.hibpBreachCount} önceki ihlal tespit edildi` : "Bilinen ihlal yok" },
        ] : [];

        const shadowItServices = hasFullDetails ? ((scan.shadowItServices ?? []) as any[]) : [];

        return (
          <Card className={`shadow-sm mb-6 border ${scoreBg}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5 text-primary" />
                  Alan Adı Güvenlik Taraması
                  <span className="font-normal text-sm text-muted-foreground">— {scan.domain}</span>
                </CardTitle>
                <div className={`flex items-center gap-1.5 font-bold text-2xl ${scoreColor}`}>
                  {scan.overallScore}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </div>
              </div>
              {!hasFullDetails && (
                <p className="text-xs text-muted-foreground mt-1">
                  Alan adınızın genel güvenlik skoru hesaplandı. Detaylı SPF, DMARC, DKIM, SSL ve kara liste sonuçları tam plan ile görüntülenebilir.
                </p>
              )}
            </CardHeader>

            {hasFullDetails && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {checks.map(({ label, icon: Icon, pass, detail }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-lg border bg-background">
                      <div className={`shrink-0 mt-0.5 ${pass ? "text-emerald-500" : "text-red-500"}`}>
                        {pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <p className={`text-xs ${pass ? "text-muted-foreground" : "text-red-600"}`}>{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {shadowItServices.length > 0 && (
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Tespit Edilen 3. Taraf Servisler ({shadowItServices.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shadowItServices.map((s: any) => (
                        <Badge
                          key={s.name}
                          variant="outline"
                          className={`text-xs ${s.risk === "high" ? "border-red-300 text-red-700 bg-red-50" : s.risk === "medium" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-300 text-slate-600"}`}
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Yüksek riskli servisler için erişim kontrolü ve güvenlik politikası oluşturmanız önerilir.</p>
                  </div>
                )}
              </CardContent>
            )}

            {!hasFullDetails && (
              <CardContent className="pt-0">
                <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center">
                  <p className="text-xs text-muted-foreground mb-2">SPF, DMARC, DKIM, SSL, kara liste ve veri ihlali detayları tam plan ile erişilebilir.</p>
                  <button
                    onClick={() => document.getElementById("uzman-formu")?.scrollIntoView({ behavior: "smooth" })}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    Tam Planı Keşfet <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })()}

      {/* CyberStep Verified Rozeti */}
      {report.verificationToken && (() => {
        const base = window.location.origin;
        const verifyUrl = `${base}/verify/${report.verificationToken}`;
        return (
          <Card className="shadow-sm mb-6 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="shrink-0 bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-xl">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">CyberStep Doğrulandı</h3>
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Verified</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Bu bağlantıyı tekliflerde, web sitenizde veya müşterilerinizle paylaşarak siber güvenlik değerlendirmenizi tamamladığınızı kanıtlayın.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Doğrulama Sayfasını Gör <ArrowRight className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(verifyUrl)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border hover:border-foreground/20 transition-colors"
                    >
                      Bağlantıyı Kopyala
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Expert review notice */}
      <Card className="shadow-sm mb-6 border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start gap-5">
            <div className="shrink-0 bg-primary/10 p-4 rounded-xl">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Detaylı Raporunuz Hazırlanıyor</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                Risk skoru ve alan dağılımınız yukarıda gösterilmektedir. Uzman ekibimiz yapay zeka ön analizini inceleyerek
                şirketinize özel detaylı değerlendirmeyi <strong>24-48 saat içinde</strong> e-posta ile iletecektir.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Risk skoru hesaplandı
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  AI ön analizi tamamlandı
                </div>
                <div className="flex items-center gap-1.5 text-orange-600 font-medium">
                  <Clock className="h-4 w-4" />
                  Uzman değerlendirmesi bekleniyor
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Answers accordion */}
      <Card className="shadow-sm mb-6">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowAnswers(v => !v)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Verdiğiniz Cevaplar
              </CardTitle>
              <CardDescription>Değerlendirme sırasında seçtiğiniz yanıtları görüntüleyin</CardDescription>
            </div>
            {showAnswers ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showAnswers && (
          <CardContent className="pt-0">
            <div className="space-y-6">
              {MINI_ASSESSMENT_SECTIONS.map((section) => (
                <div key={section.id}>
                  <h4 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                      {section.id}
                    </span>
                    {section.title}
                  </h4>
                  <div className="space-y-2">
                    {section.questions.map((q) => {
                      const ans = report.answers?.find((a: any) => a.questionNumber === q.id);
                      const answerLabel: Record<string, { label: string; cls: string }> = {
                        evet: { label: "Evet", cls: "text-green-700 bg-green-50 border-green-200" },
                        kismen: { label: "Kısmen", cls: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                        hayir: { label: "Hayır", cls: "text-red-700 bg-red-50 border-red-200" },
                        bilmiyorum: { label: "Bilmiyorum", cls: "text-orange-700 bg-orange-50 border-orange-200" },
                      };
                      const a = answerLabel[ans?.answer] ?? { label: "-", cls: "text-muted-foreground bg-muted border-border" };
                      return (
                        <div key={q.id} className="flex items-start justify-between gap-4 py-2 px-3 rounded-lg border bg-muted/10 text-sm">
                          <span className="text-muted-foreground leading-relaxed flex-1">
                            <span className="font-medium text-foreground mr-1">{q.id}.</span>
                            {q.text}
                            {q.isCritical && (
                              <Badge variant="destructive" className="ml-2 text-xs py-0">Kritik</Badge>
                            )}
                          </span>
                          <span className={`shrink-0 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${a.cls}`}>
                            {a.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Contact / Expert form */}
      <Card id="uzman-formu" className="shadow-sm border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Uzman Görüşü Talep Edin
          </CardTitle>
          <CardDescription>
            Sonuçlarınızı bir siber güvenlik uzmanıyla birebir değerlendirmek ister misiniz?
            İletişim bilgilerinizi bırakın, sizi arayalım.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactSent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="bg-green-50 p-4 rounded-full">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Talebiniz Alındı</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Uzmanlarımız en kısa sürede sizinle iletişime geçecektir. Ortalama yanıt süresi 4 iş saatidir.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setContactSent(true);
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Ad Soyad
                </label>
                <input
                  required
                  type="text"
                  value={contactForm.name}
                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Adınız Soyadınız"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> E-posta
                </label>
                <input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@firmaniz.com"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefon <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0 5XX XXX XX XX"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Not <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={contactForm.note}
                  onChange={e => setContactForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Özel bir konuyu görüşmek ister misiniz?"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" className="w-full md:w-auto">
                  Uzman Görüşü Talep Et <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
