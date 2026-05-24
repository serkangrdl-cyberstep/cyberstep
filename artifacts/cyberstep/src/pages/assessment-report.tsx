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
  CheckCircle2, ChevronDown, ChevronUp, Shield, ShieldAlert
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

export default function AssessmentReport() {
  const [, params] = useRoute("/assessment/:id/report");
  const id = parseInt(params?.id || "0", 10);
  const [showAnswers, setShowAnswers] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: "", email: "", phone: "", note: "" });
  const [contactSent, setContactSent] = useState(false);

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
  const sectorBenchmark = SECTOR_BENCHMARKS[assessment?.sector ?? "Diğer"] ?? 58;
  const scorePercent = report.scorePercent as number;
  const benchmarkDiff = scorePercent - sectorBenchmark;

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
        <Link href="/dashboard">
          <Button variant="outline">
            Dashboard'a Dön <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
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
                  <span className="text-muted-foreground"> (sektör ort. %{sectorBenchmark})</span>
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

      {/* Expert review notice - replaces AI content */}
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
      <Card className="shadow-sm border-t-4 border-t-primary">
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
