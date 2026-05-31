import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useGetReport, useGetAssessment } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertOctagon, ArrowRight, Clock, Mail, Phone, User, Building2,
  CheckCircle2, ChevronDown, ChevronUp, Shield, ShieldAlert, Download,
  TrendingUp, TrendingDown, Minus, Zap, Lock, Mail as MailIcon, Monitor, HardDrive,
  Globe, AtSign, Server, KeyRound, XCircle, Scale, FileCheck, Loader2, Share2, Copy, CheckCheck,
} from "lucide-react";
import { ReportLoading } from "@/components/report-loading";
import { useCustomer } from "@/hooks/use-customer";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { MINI_ASSESSMENT_SECTIONS } from "@/lib/constants";
import { FullAssessmentTabs } from "@/components/full-assessment-tabs";

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

// ── BitSight tarzı rating bands ──────────────────────────────────────────────
const RATING_BANDS = [
  { label: "Temel", range: [0, 39], color: "bg-red-500", textColor: "text-red-600", desc: "Temel güvenlik kontrolleri eksik" },
  { label: "Gelişmekte", range: [40, 69], color: "bg-amber-400", textColor: "text-amber-600", desc: "Kısmen korumalı, kritik boşluklar var" },
  { label: "İleri", range: [70, 100], color: "bg-emerald-500", textColor: "text-emerald-600", desc: "Olgun güvenlik altyapısı" },
];

// ── Sektör bazlı tehdit aktörü veritabanı ────────────────────────────────────
interface ThreatActor {
  name: string;
  type: string;
  desc: string;
  techniques: string[];
  risk: "Yüksek" | "Orta";
}
const THREAT_INTEL_DB: Record<string, ThreatActor[]> = {
  "Finans/Sigorta": [
    { name: "FIN7 / Carbanak", type: "Finansal Suç Grubu", desc: "2013'ten beri aktif, bankacılık ve ödeme sistemlerini hedef alan organize suç örgütü. Türk finans kuruluşlarına yönelik kampanyaları belgelenmiştir.", techniques: ["Hedefli kimlik avı", "BEC dolandırıcılığı", "ATM jackpotting"], risk: "Yüksek" },
    { name: "LockBit 3.0", type: "Fidye Yazılımı (RaaS)", desc: "Dünyada en fazla kurban talep eden fidye yazılımı grubu. Finans ve sigorta sektörü birincil hedef kategorisindedir.", techniques: ["RDP/VPN sızdırma", "Çifte gasp", "Kimlik bilgisi hırsızlığı"], risk: "Yüksek" },
    { name: "Cosmic Wolf / Sea Turtle", type: "Devlet Destekli APT", desc: "Türkiye istihbarat çıkarlarıyla bağlantılı grup. DNS manipülasyonu ve telekom altyapısına yönelik saldırılarıyla tanınır.", techniques: ["DNS hijacking", "BGP routing saldırısı", "Supply chain"], risk: "Orta" },
  ],
  "Sağlık": [
    { name: "ALPHV / BlackCat", type: "Fidye Yazılımı (RaaS)", desc: "Sağlık sektörünü birincil hedef olarak seçen gelişmiş fidye yazılımı grubu. Veri ifşası tehdidiyle çifte baskı uygular.", techniques: ["Fidye yazılımı", "Kişisel sağlık verisi ifşası", "Tedarikçi sızdırma"], risk: "Yüksek" },
    { name: "Rhysida", type: "Fidye Yazılımı", desc: "2023'ten beri aktif, hastane ve klinik sistemlerini hedef alıyor. Türkiye dahil Avrupa sağlık altyapısına saldırıları belgelendi.", techniques: ["Phishing", "Hedefli fidye yazılımı", "Tıbbi kayıt hırsızlığı"], risk: "Yüksek" },
    { name: "Clop / TA505", type: "Suç Grubu", desc: "MOVEit ve GoAnywhere sıfır gün açıkları ile 2023'te 2.000'den fazla kuruma sızdı; sağlık verileri çoğunluğu oluşturdu.", techniques: ["Sıfır gün istismarı", "Toplu veri hırsızlığı"], risk: "Orta" },
  ],
  "Teknoloji": [
    { name: "APT10 / MenuPass", type: "Çin Devlet Destekli APT", desc: "MSP ve teknoloji şirketleri üzerinden müşterilere ulaşan tedarik zinciri saldırıları için tanınır. 'Cloud Hopper' operasyonu ile onlarca ülkede teknoloji firmalarını hedef aldı.", techniques: ["MSP/tedarikçi sızma", "Uzun vadeli kalıcılık", "Kimlik bilgisi dumpı"], risk: "Yüksek" },
    { name: "NOBELIUM / UNC2452", type: "Devlet Destekli APT (Rusya)", desc: "SolarWinds saldırısının arkasındaki grup. Yazılım güncelleme mekanizmalarını silah olarak kullanan tedarik zinciri saldırıları.", techniques: ["Software supply chain", "OAuth token hırsızlığı", "Bulut pivot"], risk: "Yüksek" },
    { name: "LockBit 3.0", type: "Fidye Yazılımı (RaaS)", desc: "Teknoloji şirketleri ve MSP'leri hedef alarak hem şirkete hem müşterilere ulaşmayı hedefler.", techniques: ["Kimlik bilgisi doldurma", "RDP sızdırma", "Lateral movement"], risk: "Orta" },
  ],
  "Üretim/Sanayi": [
    { name: "EKANS / SNAKE", type: "OT/ICS Odaklı Kötü Amaçlı Yazılım", desc: "Endüstriyel kontrol sistemlerini (ICS/SCADA) hedef alan fidye yazılımı. Honda ve Renault dahil üretim tesislerini durdurdu.", techniques: ["ICS/SCADA sızdırma", "Üretim hattı sabotajı", "Fidye yazılımı"], risk: "Yüksek" },
    { name: "LockBit 3.0", type: "Fidye Yazılımı (RaaS)", desc: "2023'te üretim sektörü en çok saldırıya uğrayan sektör oldu. Tedarik zinciri aksaklıkları fidye ödemeyi zorunlu kılıyor.", techniques: ["IT/OT ağ geçişi", "Üretim verisi şifreleme"], risk: "Yüksek" },
    { name: "Volt Typhoon", type: "Çin Devlet Destekli APT", desc: "Kritik üretim altyapısını 'ön mevzi' olarak konumlandıran, uzun süre tespit edilmeden kalan grup.", techniques: ["Ağ yaşam alanı saldırısı (LoTL)", "OT ağ keşfi", "Kalıcılık"], risk: "Orta" },
  ],
  "Perakende/Ticaret": [
    { name: "Magecart", type: "Web Skimming Grubu", desc: "E-ticaret altyapısına enjekte edilen JS kodlarıyla ödeme kartı bilgilerini çalan grup kolektifi. Türk e-ticaret sitelerini de hedef aldı.", techniques: ["Ödeme sayfası JS enjeksiyonu", "Kart verisi sızdırma", "Tedarikçi script sızdırma"], risk: "Yüksek" },
    { name: "FIN8", type: "Finansal Suç Grubu", desc: "POS sistemleri ve ödeme altyapısını hedef alan gelişmiş tehdit grubu. Perakende sektöründe aktif.", techniques: ["POS malware", "Ağ içi lateral hareket", "Kimlik bilgisi hırsızlığı"], risk: "Yüksek" },
  ],
  "Eğitim": [
    { name: "Vice Society", type: "Fidye Yazılımı", desc: "Okul ve üniversiteleri birincil hedef olarak seçen grup. Öğrenci ve personel verilerini çalarak fidye talep eder.", techniques: ["Phishing", "Açık RDP", "Öğrenci/personel verisi ifşası"], risk: "Yüksek" },
    { name: "TA571", type: "Suç Grubu", desc: "Eğitim sektörü e-postalarını spam ve phishing kampanyaları için kötüye kullanan grup.", techniques: ["Toplu phishing", "Makro-tabanlı malware", "BEC"], risk: "Orta" },
  ],
  "Hizmet Sektörü": [
    { name: "BEC/CEO Fraud Grupları", type: "Finansal Suç", desc: "Türkiye'de KOBİ'lere yönelik BEC (İş E-postası Dolandırıcılığı) saldırıları son 3 yılda %140 arttı. Tedarikçi ve muhasebe e-postalarını taklit eder.", techniques: ["Domain spoofing", "Sahte IBAN transferi", "Yönetici taklit"], risk: "Yüksek" },
    { name: "Scattered Spider", type: "Suç Grubu", desc: "Hizmet sektörü çalışanlarını sosyal mühendislik ile manipüle eden ve BT yardım masalarını taklit eden gelişmiş İngilizce konuşan grup.", techniques: ["SIM swapping", "Vishing (sesli kimlik avı)", "MFA bypass"], risk: "Orta" },
  ],
  "Diğer": [
    { name: "LockBit 3.0", type: "Fidye Yazılımı (RaaS)", desc: "Sektörden bağımsız olarak tüm KOBİ'leri hedef alan dünyanın en aktif fidye yazılımı grubu. Türkiye kurbanları açıkça listede yayımlandı.", techniques: ["RDP/VPN sızdırma", "Phishing", "Kimlik bilgisi satın alma"], risk: "Yüksek" },
    { name: "BEC/CEO Fraud Grupları", type: "Finansal Suç", desc: "Tüm sektörlerde KOBİ'lere yönelik. E-posta güvenliği zayıfsa sahte IBAN transferi veya tedarikçi dolandırıcılığı en yaygın ilk saldırı vektörü.", techniques: ["Domain spoofing", "Sahte fatura", "Yönetici taklit"], risk: "Yüksek" },
  ],
};

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

function MarathonSection({ weeklyActionPlan, assessmentId }: { weeklyActionPlan: Array<{ week: number; title: string; tasks: string[] }>; assessmentId: number }) {
  const storageKey = `marathon-${assessmentId}`;
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const totalTasks = weeklyActionPlan.reduce((sum, w) => sum + (w.tasks?.length ?? 0), 0);
  const completedCount = completedTasks.size;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const allDone = completedCount === totalTasks && totalTasks > 0;

  function toggleTask(key: string) {
    setCompletedTasks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <Card className="shadow-sm mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              30 Gunluk Guvenlik Maratonu
            </CardTitle>
            <CardDescription>
              AI tarafindan hazirlanmis haftalik eylem plani. Her gorevi tamamladiginizda uzerine tiklayin.
            </CardDescription>
          </div>
          {allDone && (
            <Badge className="bg-amber-400 text-amber-900 border-amber-300 shrink-0 text-xs px-2 py-1">
              CyberStep Sertifikali
            </Badge>
          )}
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{completedCount}/{totalTasks} gorev tamamlandi</span>
            <span>%{progressPct}</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {weeklyActionPlan.map((week) => (
          <div key={week.week}>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {week.week}
              </span>
              {week.title}
            </h4>
            <div className="space-y-2">
              {(week.tasks ?? []).map((task, ti) => {
                const key = `w${week.week}-t${ti}`;
                const done = completedTasks.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTask(key)}
                    className={`w-full flex items-start gap-3 text-left p-3 rounded-lg border transition-colors ${done ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-muted/10 hover:bg-muted/30 border-border"}`}
                  >
                    <div className={`shrink-0 mt-0.5 ${done ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {done
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <div className="h-4 w-4 rounded-full border-2 border-current" />
                      }
                    </div>
                    <span className={`text-sm leading-relaxed ${done ? "line-through text-muted-foreground" : ""}`}>
                      {task}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {allDone && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 text-center">
            <div className="text-2xl font-bold text-amber-500 mb-1">★</div>
            <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-1">30 Gunluk Maratonu Tamamladiniz!</h4>
            <p className="text-sm text-amber-700 dark:text-amber-400">Siber guvenlik altyapinizi basariyla guclendiniz. CyberStep tarafindan sertifikalandiniz.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AssessmentReportById({ id }: { id: number }) {
  return <AssessmentReportCore id={id} />;
}

interface BadgeAdvantageItem {
  id: number; title: string; partnerName: string; description: string;
  discountPercent: number | null; badgeText: string | null; isActive: boolean;
}

function BadgeAdvantagesSection({ hasVerificationToken }: { hasVerificationToken: boolean }) {
  const { data: advantages } = useQuery<BadgeAdvantageItem[]>({
    queryKey: ["badge-advantages-public"],
    queryFn: () => fetch("/api/badge-advantages").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const list = Array.isArray(advantages) ? advantages : [];
  if (list.length === 0) return null;
  return (
    <Card className="shadow-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          CyberStep Rozet Avantajları
        </CardTitle>
        <CardDescription>
          {hasVerificationToken
            ? "CyberStep Doğrulandı rozeti sahibi olarak aşağıdaki özel ayrıcalıklardan yararlanabilirsiniz."
            : "CyberStep Doğrulandı rozeti alan firmalar bu iş ortağı ayrıcalıklarından yararlanır."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map(a => (
            <div key={a.id} className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-sm leading-snug">{a.title}</span>
                {a.discountPercent && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs shrink-0">
                    %{a.discountPercent}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-primary font-medium mb-1">{a.partnerName}</p>
              <p className="text-xs text-muted-foreground leading-snug">{a.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: customer } = useCustomer();

  const { data: pricingPlans } = useQuery<Array<{ slug: string; price: string }>>({
    queryKey: ["public-pricing"],
    queryFn: () => fetch("/api/public/pricing").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const fullPlanPrice = parseFloat(pricingPlans?.find(p => p.slug === "full")?.price ?? "0");
  const fmtFullPrice = fullPlanPrice > 0
    ? new Intl.NumberFormat("tr-TR").format(fullPlanPrice) + " TL"
    : "—";
  const fmtDiscountedPrice = fullPlanPrice > 0
    ? new Intl.NumberFormat("tr-TR").format(Math.round(fullPlanPrice * 0.85 / 10) * 10) + " TL"
    : "—";

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

  const isMini = report.assessmentType === "mini";
  const isFullReport = !isMini;
  const showLegacyFullSections = false; // All full-report sections now rendered by FullAssessmentTabs

  const companyName = assessment?.companyName ?? "Şirketimiz";
  const referralLink = (() => {
    const base = window.location.origin;
    const ref = encodeURIComponent(companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30));
    return `${base}/assessment/start?ref=${ref}&utm_source=supplier-invite&utm_medium=email&utm_campaign=viral-passport`;
  })();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const handleMailtoShare = () => {
    const subject = encodeURIComponent(`${companyName} — Siber Güvenlik Değerlendirmesi Talebimiz`);
    const body = encodeURIComponent(
      `Merhaba,\n\n` +
      `Şirketimiz siber güvenlik risklerini CyberStep.io platformu üzerinde değerlendirdi ve tedarikçilerimizin de değerlendirmelerini tamamlamasını talep ediyoruz.\n\n` +
      `Ücretsiz değerlendirmenizi başlatmak için aşağıdaki bağlantıyı kullanabilirsiniz:\n\n` +
      referralLink + `\n\n` +
      `Değerlendirme yaklaşık 3 dakika sürmektedir. Teşekkürler.\n\n` +
      `${companyName}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

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
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" onClick={handleMailtoShare}>
            <Share2 className="mr-2 h-4 w-4" /> Tedarikçine Gönder
          </Button>
          {customer ? (
            <Link href="/raporlarim">
              <Button variant="outline">
                Raporlarıma Dön <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/assessment/start">
              <Button variant="outline">
                Yeni Değerlendirme <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
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

      {/* Tam Değerlendirme Upsell Köprüsü */}
      {(() => {
        const riskRange = scorePercent < 40
          ? { min: 750_000, max: 2_200_000 }
          : scorePercent < 70
          ? { min: 220_000, max: 750_000 }
          : { min: 65_000, max: 220_000 };
        const fmtMoney = (n: number) =>
          n >= 1_000_000
            ? `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} milyon TL`
            : `${n.toLocaleString("tr-TR")} TL`;
        const isHighRisk = scorePercent < 70;
        return (
          <div className={`mb-6 rounded-2xl border-2 ${isHighRisk ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700" : "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-700"} overflow-hidden`}>
            <div className="p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Skorunuzun TL karşılığı
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">
                      {fmtMoney(riskRange.min)} – {fmtMoney(riskRange.max)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      %{scorePercent.toFixed(0)} skor seviyesindeki {assessment?.sector ?? "sektörünüzdeki"} şirketler bu düzeyde yıllık siber risk taşıyor.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "55 soruluk derinlemesine analiz (şu an: 20 soru)",
                      "10 güvenlik alanı kırılımı (şu an: 5 alan)",
                      "Sektörünüzdeki gerçek şirket verileriyle kıyaslama",
                      "PDF sertifika + 1 saat uzman danışmanlığı",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-stretch sm:items-center gap-3 min-w-[200px]">
                  <div className="text-center bg-white dark:bg-slate-800 rounded-xl border p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground mb-1">Tam Değerlendirme</p>
                    <p className="text-2xl font-bold text-primary">{fmtFullPrice}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">tek seferlik</p>
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Potansiyel kayıp</p>
                      <p className="text-sm font-semibold text-destructive">{fmtMoney(riskRange.min)}+</p>
                    </div>
                  </div>
                  <Link href="/assessment/full/start">
                    <Button className="w-full" size="lg">
                      Tam Değerlendirme Yap <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <p className="text-center text-xs text-muted-foreground">
                    KVKK minimum idari ceza: <span className="font-semibold text-foreground">94.000 TL</span>
                  </p>
                  {assessment?.createdAt && Date.now() - new Date(assessment.createdAt as string).getTime() < 24 * 60 * 60 * 1000 && (
                    <div className="mt-3 pt-3 border-t text-center rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700 p-3">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">Bugüne özel</p>
                      <p className="text-xs text-muted-foreground">İlk 24 saat geçerli indirim</p>
                      <p className="text-base font-bold text-primary mt-1">{fmtDiscountedPrice} <span className="line-through text-muted-foreground font-normal text-sm">{fmtFullPrice}</span></p>
                      <p className="text-xs font-mono text-primary font-semibold mt-1">Kod: HIZLI15</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Full Assessment 5-tab dashboard */}
      {isFullReport && (
        <FullAssessmentTabs report={report} />
      )}

      {/* Skor Takibi */}
      {showLegacyFullSections && report.previousScore && (() => {
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

      {/* BitSight-style Rating Band Görseli */}
      {showLegacyFullSections && (() => {
        const band = RATING_BANDS.find(b => scorePercent >= b.range[0] && scorePercent <= b.range[1]) ?? RATING_BANDS[0];
        return (
          <Card className="shadow-sm mb-6">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Siber Güvenlik Segment Konumunuz
              </p>
              <div className="relative mb-2">
                <div className="flex h-8 rounded-full overflow-hidden">
                  {RATING_BANDS.map(b => (
                    <div
                      key={b.label}
                      className={`${b.color} flex items-center justify-center text-white text-xs font-semibold`}
                      style={{ width: `${b.range[1] - b.range[0] + 1}%` }}
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
                <div
                  className="absolute top-0 h-8 w-1 bg-white shadow-lg rounded-full"
                  style={{ left: `${Math.min(98, Math.max(1, scorePercent))}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                    %{scorePercent.toFixed(0)}
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0 — Temel</span><span>40 — Gelişmekte</span><span>70 — İleri — 100</span>
              </div>
              <p className={`text-xs font-medium mt-2 ${band.textColor}`}>
                Sizi şu anda <strong>{band.label}</strong> segmentine yerleştiriyor: {band.desc}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Domain cards */}
      {showLegacyFullSections && (
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
      )}

      {/* Risk Profili Radarı */}
      {showLegacyFullSections && report.domainScores && report.domainScores.length >= 5 && (() => {
        const ds = report.domainScores as Array<{ domain: string; percent: number }>;
        const get = (letter: string) => Math.round(ds.find(d => d.domain === letter)?.percent ?? 50);
        const redAlarmCount = (report.redAlarmQuestions ?? []).length;
        const uyumScore = Math.max(0, Math.round(100 - redAlarmCount * 14));
        const olayHazirlikScore = Math.round(get("E") * 0.6 + (report.redAlarmQuestions?.includes(17) ? 0 : 25) + (report.redAlarmQuestions?.includes(18) ? 0 : 15));
        const radarData = [
          { dimension: "Yönetişim",     value: get("A"), fullMark: 100 },
          { dimension: "Kimlik & Erişim", value: get("B"), fullMark: 100 },
          { dimension: "E-posta & İnsan", value: get("C"), fullMark: 100 },
          { dimension: "Uç Nokta",       value: get("D"), fullMark: 100 },
          { dimension: "Veri Koruma",    value: get("E"), fullMark: 100 },
          { dimension: "Uyum",           value: uyumScore, fullMark: 100 },
          { dimension: "Olay Hazırlığı", value: Math.min(100, olayHazirlikScore), fullMark: 100 },
          { dimension: "Sektör Avg",     value: Math.round(sectorBenchmark), fullMark: 100 },
        ];
        return (
          <Card className="shadow-sm mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500 shrink-0" />
                8 Boyutlu Risk Profili Radarı
              </CardTitle>
              <CardDescription>
                Siber güvenlik olgunluğunuzun çok boyutlu görsel haritası — sektör ortalamasıyla karşılaştırma dahil
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Puanınız" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                      <Tooltip
                        formatter={(value: number) => [`%${value}`, "Puanınız"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {radarData.map((d) => {
                    const color = d.value >= 70 ? "bg-emerald-500" : d.value >= 40 ? "bg-amber-400" : "bg-red-500";
                    return (
                      <div key={d.dimension} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{d.dimension}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${d.value}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">%{d.value}</span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">
                    Sektör ort. <strong>%{Math.round(sectorBenchmark)}</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Tehdit Aktörü Zekası (BitSight Threat Insights) */}
      {showLegacyFullSections && (() => {
        const sectorKey = assessment?.sector as string | undefined;
        const actors: ThreatActor[] = (sectorKey && THREAT_INTEL_DB[sectorKey]) ? THREAT_INTEL_DB[sectorKey] : THREAT_INTEL_DB["Diğer"];
        return (
          <Card className="shadow-sm mb-6 border-orange-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-orange-500 shrink-0" />
                Sektörünüzü Hedef Alan Tehdit Grupları
              </CardTitle>
              <CardDescription>
                {assessment?.sector ?? "Sektörünüz"} için belgelenmiş tehdit aktörleri ve kullandıkları saldırı teknikleri
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {actors.map((actor, i) => (
                  <div key={i} className="rounded-lg border bg-muted/10 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-sm">{actor.name}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${actor.risk === "Yüksek" ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20" : "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"}`}
                          >
                            {actor.risk} Risk
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">{actor.type}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{actor.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {actor.techniques.map((t, j) => (
                        <span key={j} className="text-xs bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                Kaynak: MITRE ATT&amp;CK, Mandiant Threat Intelligence, CISA advisories, Europol IOCTA 2024
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* BDDK / DORA Uyum Teaser */}
      {showLegacyFullSections && <Card className="shadow-sm mb-6 border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 bg-blue-500/10 p-3 rounded-xl">
              <Scale className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">BDDK · SPK · EPDK · DORA Uyum Durumunuz</h3>
                <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">Yeni</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                DORA Ocak 2025'te yürürlüğe girdi. BDDK ve SPK benzer niceliksel ICT risk metrik zorunluluklarına hazırlanıyor.
                Bu puanınızı seçtiğiniz regülasyonlara eşleyin, domain bazlı uyum boşluğu ve yol haritası alın.
              </p>
              <Link href={`/dora-bddk-uyum?sector=${encodeURIComponent(assessment?.sector ?? "")}&score=${Math.round(scorePercent)}`}>
                <Button variant="outline" size="sm" className="text-xs border-blue-500/30 text-blue-500 hover:bg-blue-500/10">
                  Regülasyon Uyum Analizini Aç <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>}

      {/* KVKK Uyum Haritası */}
      {showLegacyFullSections && <Card className="shadow-sm mb-6">
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
      </Card>}

      {/* NIST CSF 2.0 Uyum Özeti */}
      {showLegacyFullSections && <Card className="shadow-sm mb-6">
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
      </Card>}

      {/* Domain bar chart */}
      {(() => {
        const DOMAIN_SHORT: Record<string, string> = {
          A: "Yönetim ve Envanter",
          B: "Kimlik ve Erişim",
          C: "E-posta ve Farkındalık",
          D: "Cihaz ve Uç Nokta",
          E: "Veri Koruma ve Yedek",
        };
        const barData = (report.domainScores as Array<{ domain: string; percent: number }> ?? []).map(d => ({
          ...d,
          label: `${d.domain} — ${DOMAIN_SHORT[d.domain] ?? d.domain}`,
        }));
        return (
          <Card className="shadow-sm mb-6">
            <CardHeader>
              <CardTitle>Kategori Bazlı Puan Dağılımı</CardTitle>
              <CardDescription>5 güvenlik alanında başarı yüzdeniz</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `%${v}`} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={165}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`%${value.toFixed(0)}`, "Başarı"]}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => (
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
        );
      })()}

      {/* Kilitli bölümler — mini kullanıcılar için yükseltme kartı */}
      {isMini && (
        <Card className="mb-6 border-2 border-primary/25 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base">Tam Değerlendirme ile görün</h3>
                <p className="text-sm text-muted-foreground mt-0.5">55 soruluk derinlemesine analiz — 8 bölüm kilitli</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5 mb-5">
              {[
                "8 Boyutlu Risk Profili Radarı",
                "Sektörünüzü Hedef Alan Tehdit Grupları",
                "KVKK Tam Uyum Haritası (Madde 12-18)",
                "NIST CSF 2.0 Uyum Seviyesi",
                "Olası İhlal Maliyeti Tahmini (₺ min/max)",
                "30 Günlük Siber Güvenlik Maratonu",
                "Sektör Karşılaştırması ve Benchmark",
                "KVKK VERBİS Hazırlık Skoru",
              ].map((label) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary/40 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t pt-4">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">KVKK minimum idari ceza: <span className="font-semibold text-foreground">94.000 TL</span></p>
                <p className="text-xs text-muted-foreground">Tam Değerlendirme: <span className="font-semibold text-primary">{fmtFullPrice}</span></p>
              </div>
              <Link href="/assessment/full/start">
                <Button size="lg" className="w-full sm:w-auto">
                  Tam Değerlendirme Yap <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partner Yönlendirme — zayıf alanlara göre çözüm önerileri */}
      {showLegacyFullSections && (() => {
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
                Skorunuza göre aşağıdaki alanlarda adım atmak şirketinizi korumada en büyük etkiyi yaratır.
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
      {showLegacyFullSections && (() => {
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

      {/* Finansal Maliyet Tahmini */}
      {showLegacyFullSections && (report.estimatedBreachCostMin || report.estimatedBreachCostMax) && (() => {
        const fmtMoney = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
        const costMin = report.estimatedBreachCostMin as number;
        const costMax = report.estimatedBreachCostMax as number;
        const reduction = report.riskReductionPercent as number | null;
        return (
          <Card className="shadow-sm mb-6 border-orange-200 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Olasi Ihlal Maliyeti Tahmini
              </CardTitle>
              <CardDescription>
                Mevcut guvenlik aciklari kapatilmadiginda olusabilecek toplam maliyet — fidye, uretim kaybi, KVKK cezasi ve itibar hasari dahil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div>
                  <div className="text-3xl font-bold text-orange-600">
                    {fmtMoney(costMin)} – {fmtMoney(costMax)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Turkiye KOBi gerceklerine gore tahmini maliyet</p>
                </div>
                {reduction != null && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
                    <TrendingDown className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-400">Onerileri tam uygulayin → risk %{reduction} azalir</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Bu tahmin, sektorunuz, calisanlariniz ve aciklariniza gore Gemini AI tarafindan hesaplanmistir. Gercek maliyet duruma gore degisebilir.</p>
            </CardContent>
          </Card>
        );
      })()}

      {/* KVKK Risk Katmanı */}
      {showLegacyFullSections && (report as any).kvkkRiskLevel && (() => {
        const kvkkLevel = (report as any).kvkkRiskLevel as string;
        const kvkkMin = (report as any).kvkkPenaltyMin as number | null;
        const kvkkMax = (report as any).kvkkPenaltyMax as number | null;
        const kvkkArticles = ((report as any).kvkkRiskArticles ?? []) as string[];
        const kvkkSummary = (report as any).kvkkRiskSummary as string | null;
        const levelColor =
          kvkkLevel === "Kritik" ? "red" :
          kvkkLevel === "Yüksek" ? "orange" :
          kvkkLevel === "Orta" ? "yellow" : "green";
        const levelClasses: Record<string, string> = {
          red: "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900",
          orange: "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900",
          yellow: "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900",
          green: "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900",
        };
        const badgeClasses: Record<string, string> = {
          red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
          orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
          yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
          green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        };
        return (
          <Card className={`shadow-sm mb-6 border ${levelClasses[levelColor]}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                KVKK Yasal Risk Analizi
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClasses[levelColor]}`}>
                  {kvkkLevel} Risk
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {kvkkMin !== null && kvkkMax !== null && (
                  <div className="sm:col-span-2 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Olası İdari Para Cezası (KVK Kurulu emsal kararlarına göre)</div>
                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      ₺{kvkkMin.toLocaleString("tr-TR")} – ₺{kvkkMax.toLocaleString("tr-TR")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">KVKK Md.18 kapsamında tahmini yaptırım aralığı</div>
                  </div>
                )}
                {kvkkArticles.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">İlgili Maddeler</div>
                    <div className="flex flex-wrap gap-1.5">
                      {kvkkArticles.map((a: string) => (
                        <span key={a} className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {kvkkSummary && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
                  {kvkkSummary}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Sektör Benchmark */}
      {showLegacyFullSections && (report as any).sectorBenchmarkPercent !== null && (report as any).sectorBenchmarkPercent !== undefined && (() => {
        const pct = (report as any).sectorBenchmarkPercent as number;
        const comment = (report as any).sectorBenchmarkComment as string | null;
        const barColor = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
        const labelColor = pct >= 70 ? "text-emerald-700 dark:text-emerald-400" : pct >= 40 ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-400";
        return (
          <Card className="shadow-sm mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">📊</span>
                Sektör Karşılaştırması
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Sektörünüzdeki konumunuz</span>
                <span className={`text-xl font-bold ${labelColor}`}>
                  %{pct}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">yüzdelik dilim</span>
                </span>
              </div>
              <div className="relative h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>En Kötü</span>
                <span>Sektör Ortalaması</span>
                <span>En İyi</span>
              </div>
              {comment && (
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700 mt-2">
                  {comment}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* KVKK VERBİS Hazırlık Skoru */}
      {showLegacyFullSections && (report as any).verbisRequired !== undefined && (report as any).verbisRequired !== null && (() => {
        const verbisRequired = (report as any).verbisRequired as boolean;
        const verbisRiskLevel = (report as any).verbisRiskLevel as string | null;
        const verbisSteps = ((report as any).verbisSteps ?? []) as string[];
        const riskColor = verbisRiskLevel === "Acil" ? "text-red-600" : verbisRiskLevel === "Yüksek" ? "text-orange-600" : verbisRiskLevel === "Orta" ? "text-yellow-600" : "text-green-600";
        const riskBg = verbisRiskLevel === "Acil" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" : verbisRiskLevel === "Yüksek" ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900" : "bg-slate-50 border-slate-200 dark:bg-slate-900/30";
        return (
          <Card className={`shadow-sm mb-6 ${riskBg}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  KVKK VERBİS Hazirlik Analizi
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${riskColor} border-current`}>
                    {verbisRiskLevel ?? "Analiz Edildi"}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${verbisRequired ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                    {verbisRequired ? "Kayit Zorunlu" : "Zorunlu Degil"}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                VERBİS (Veri Sorumluları Sicili Bilgi Sistemi) KVKK kapsamında veri sorumlusu olarak tescil sistemidir.
                {verbisRequired
                  ? " Firma profilinize gore kayit yaptirmaniz zorunludur."
                  : " Mevcut profil icin zorunlu degil, ancak gönüllü kayit olusturabilirsiniz."}
              </CardDescription>
            </CardHeader>
            {verbisSteps.length > 0 && (
              <CardContent className="pt-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Yol Haritasi</p>
                <ol className="space-y-2">
                  {verbisSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href="https://verbis.kvkk.gov.tr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-primary hover:underline font-medium"
                >
                  verbis.kvkk.gov.tr adresine git
                  <Download className="h-3 w-3" />
                </a>
              </CardContent>
            )}
          </Card>
        );
      })()}

      {/* Siber Sigorta Hazırlık */}
      {showLegacyFullSections && (report as any).insuranceReadinessPercent !== undefined && (report as any).insuranceReadinessPercent !== null && (() => {
        const pct = (report as any).insuranceReadinessPercent as number;
        const gaps = ((report as any).insuranceGaps ?? []) as string[];
        const readColor = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-orange-600" : "text-red-600";
        const readBorderColor = pct >= 70 ? "border-green-200 dark:border-green-900" : pct >= 40 ? "border-orange-200 dark:border-orange-900" : "border-red-200 dark:border-red-900";
        const readLabel = pct >= 70 ? "Sigortaya Hazir" : pct >= 40 ? "Kismi Hazir" : "Eksikler Var";
        return (
          <Card className={`shadow-sm mb-6 border ${readBorderColor}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Siber Sigorta Hazirlik Raporu
                </CardTitle>
                <Badge variant="outline" className={`text-xs font-semibold ${readColor} border-current`}>
                  {readLabel}
                </Badge>
              </div>
              <CardDescription>
                Siber sigorta poliçesi almaya veya mevcut poliçeyi gelistirmeye ne kadar hazirsiniz?
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Hazirlik Puani</span>
                  <span className={`text-sm font-bold ${readColor}`}>%{pct}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {gaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sigorta Kapsaminizi Etkileyen Eksikler</p>
                  <ul className="space-y-1.5">
                    {gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <ShieldAlert className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const assessmentId = report.assessmentId;
                  window.open(`/api/assessments/${assessmentId}/insurance-report`, "_blank");
                }}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                PDF Sigorta Raporunu Indir
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Guvenlik Maratonu — 30 Gunluk Eylem Plani */}
      {showLegacyFullSections && Array.isArray(report.weeklyActionPlan) && (report.weeklyActionPlan as any[]).length > 0 && (
        <MarathonSection
          weeklyActionPlan={report.weeklyActionPlan as Array<{ week: number; title: string; tasks: string[] }>}
          assessmentId={report.assessmentId as number}
        />
      )}

      {/* CyberStep Doğrulama Rozeti veya Denetim CTA */}
      {report.verificationToken ? (() => {
        const base = window.location.origin;
        const verifyUrl = `${base}/verify/${report.verificationToken}`;
        const expiresAt = (report as any).verificationExpiresAt as string | null | undefined;
        const verifiedAt = (report as any).verifiedAt as string | null | undefined;
        const fmtDate = (d: string) =>
          new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
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
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Uzman Onaylı</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Firmanız CyberStep uzmanı tarafından sahada denetlendi ve doğrulandı. Bu rozeti tekliflerinizde ve web sitenizde kullanabilirsiniz.
                  </p>
                  {(verifiedAt || expiresAt) && (
                    <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                      {verifiedAt && (
                        <span>Verildi: <span className="font-medium text-foreground">{fmtDate(verifiedAt)}</span></span>
                      )}
                      {expiresAt && (
                        <span>Geçerlilik: <span className="font-medium text-foreground">{fmtDate(expiresAt)}</span></span>
                      )}
                    </div>
                  )}
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
      })() : (
        <Card className="shadow-sm mb-6 border-slate-200 dark:border-slate-700">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="shrink-0 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                <Shield className="h-7 w-7 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">CyberStep Sahaya Doğrulama Denetimi</h3>
                  <Badge variant="outline" className="text-xs">Ücretli Hizmet</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Bir CyberStep uzmanı firmanızı ziyaret ederek verdiğiniz cevapları sahada doğrular. Denetim tamamlanınca size özel "CyberStep Doğrulandı" rozeti ve doğrulama belgesi verilir — tekliflerinizde ve web sitenizde kullanabilirsiniz.
                </p>
                <a
                  href="mailto:info@cyberstep.io?subject=Doğrulama Denetimi Talebi"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Denetim Talep Et <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CyberStep Rozet Avantajları */}
      <BadgeAdvantagesSection hasVerificationToken={!!report.verificationToken} />

      {/* Expert review notice / badge */}
      {(report as any).expertBadgeEarned ? (
        <Card className="shadow-sm mb-6 border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="shrink-0 bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-xl">
                <Shield className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">Uzman Doğrulandı</h3>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Siber Güvenlik Uzmanı</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Bu rapor bir CyberStep sertifikalı siber güvenlik uzmanı tarafından incelendi ve doğrulandı.
                  {(report as any).expertReviewedBy && (
                    <span className="font-medium text-foreground"> İnceleyen: {(report as any).expertReviewedBy}</span>
                  )}
                </p>
                {(report as any).expertNotes && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 rounded-lg mt-2">
                    <span className="font-semibold">Uzman Notu:</span> {(report as any).expertNotes}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
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
      )}

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

      {/* Tedarikçi Viral Pasaport Paylaşım Bölümü */}
      <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-5 w-5 text-primary" />
            Tedarikçinizden Güvenlik Belgesi Talep Edin
          </CardTitle>
          <CardDescription>
            Büyük alıcılar artık tedarikçilerinden siber güvenlik belgesi istiyor. Aşağıdaki bağlantıyı tedarikçilerinizle paylaşarak onların da ücretsiz değerlendirme yapmasını talep edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 text-xs bg-muted border border-border rounded-md px-3 py-2 text-muted-foreground font-mono truncate outline-none"
            />
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
              {linkCopied ? (
                <><CheckCheck className="h-4 w-4 mr-1.5 text-emerald-500" /> Kopyalandı</>
              ) : (
                <><Copy className="h-4 w-4 mr-1.5" /> Kopyala</>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleMailtoShare}>
              <MailIcon className="h-4 w-4 mr-1.5" /> E-posta Taslağı Oluştur
            </Button>
            <span className="text-xs text-muted-foreground self-center">
              Tedarikçiniz bu bağlantıyla ücretsiz değerlendirme yapar. Kaynağı takip edilir.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
