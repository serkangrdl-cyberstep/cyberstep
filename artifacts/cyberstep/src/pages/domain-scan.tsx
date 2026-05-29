import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Globe,
  Mail, Lock, Server, Loader2, ArrowRight, Info,
  DatabaseZap, ShieldAlert, ShieldCheck, Sparkles, Bug, Network, Wifi, Flag,
} from "lucide-react";

interface HibpBreach {
  name: string;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
}

interface BlacklistResult {
  list: string;
  listed: boolean;
}

interface ShadowItService {
  name: string;
  category: string;
  risk: string;
  description: string;
  version?: string;
}

interface ScanResult {
  id: number;
  domain: string;
  email: string | null;
  spfPass: boolean;
  spfRecord: string | null;
  dmarcPass: boolean;
  dmarcRecord: string | null;
  dkimPass: boolean;
  dkimSelectors: string[];
  mxPass: boolean;
  mxRecords: Array<{ exchange: string; priority: number }>;
  sslPass: boolean;
  sslExpiry: string | null;
  sslIssuer: string | null;
  sslDaysUntilExpiry: number | null;
  overallScore: number;
  hibpBreachCount: number;
  hibpBreaches: HibpBreach[];
  blacklisted: boolean;
  blacklistCount: number;
  blacklistResults: BlacklistResult[];
  shadowItServices: ShadowItService[];
  httpHeadersScore: number;
  httpHeadersDetails: {
    hsts: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
    csp: boolean;
    referrerPolicy: boolean;
  } | null;
  urlhausListed: boolean;
  urlhausThreat: string | null;
  usomListed: boolean;
  ctSubdomains: string[];
  ctSubdomainCount: number;
  cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }>;
  shodanOpenPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  shodanVulnCount: number;
  shodanCountry: string | null;
  shodanIsp: string | null;
  virusTotalReputation: number | null;
  virusTotalMalicious: number;
  virusTotalSuspicious: number;
  abuseIpdbScore: number | null;
  abuseIpdbTotalReports: number;
  abuseIpdbCountry: string | null;
  abuseIpdbIsp: string | null;
  createdAt: string;
}

function ShodanCard({ openPorts, vulnCount, country, isp }: {
  openPorts: Array<{ port: number; protocol: string; service: string; product: string; version: string }> | null;
  vulnCount: number;
  country: string | null;
  isp: string | null;
}) {
  const [open, setOpen] = useState(false);
  const notConfigured = openPorts === null;
  const hasRisk = !notConfigured && (openPorts.length > 5 || vulnCount > 0);
  return (
    <div className={`rounded-xl border p-4 ${notConfigured ? "bg-slate-50/50 border-slate-200" : hasRisk ? "bg-orange-50/50 border-orange-200" : "bg-green-50/50 border-green-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${notConfigured ? "bg-slate-100" : hasRisk ? "bg-orange-100" : "bg-green-100"}`}>
          <Wifi className={`h-4 w-4 ${notConfigured ? "text-slate-400" : hasRisk ? "text-orange-600" : "text-green-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Shodan Internet Maruziyeti</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Katman 1
            </Badge>
            {notConfigured ? (
              <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-500 border-slate-200">
                API anahtari gerekli
              </Badge>
            ) : (
              <>
                <Badge variant="outline" className={`text-xs px-2 py-0 border ${openPorts.length === 0 ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}>
                  {openPorts.length === 0 ? "Acik port yok" : `${openPorts.length} acik port`}
                </Badge>
                {vulnCount > 0 && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border bg-red-100 text-red-700 border-red-200">
                    {vulnCount} guvenlik acigi
                  </Badge>
                )}
              </>
            )}
          </div>
          {notConfigured ? (
            <p className="text-xs text-muted-foreground">
              Shodan API anahtari yapilandirildiginda sunucularinizda internet uzerinden eriselebilen port ve servisleri gorebilirsiniz.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {openPorts.length === 0
                  ? "Shodan veritabaninda bu IP icin acik port kaydi bulunamadi."
                  : `Internete acik ${openPorts.length} port tespit edildi.${vulnCount > 0 ? ` ${vulnCount} bilinen guvenlik acigi mevcut.` : ""}`}
                {country ? ` Sunucu konumu: ${country}.` : ""}
                {isp ? ` Saglayici: ${isp}.` : ""}
              </p>
              {openPorts.length > 0 && (
                <button onClick={() => setOpen(!open)} className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline">
                  <Info className="h-3 w-3" /> {open ? "Kapat" : "Acik portlari listele"}
                </button>
              )}
              {open && openPorts.length > 0 && (
                <div className="mt-2 border-t pt-2 space-y-1">
                  {openPorts.map((p) => {
                    const highRisk = [21, 22, 23, 25, 135, 139, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 27017].includes(p.port);
                    const webPort = [80, 443, 8080, 8443].includes(p.port);
                    return (
                      <div key={`${p.port}-${p.protocol}`} className="flex items-center gap-2 text-xs">
                        <span className={`font-mono px-1.5 py-0.5 rounded ${highRisk ? "bg-red-100 text-red-700" : webPort ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {p.port}/{p.protocol}
                        </span>
                        {p.product && <span className="text-muted-foreground">{p.product}</span>}
                        {p.version && <span className="text-muted-foreground text-xs">v{p.version}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0">
          {notConfigured ? <Lock className="h-5 w-5 text-slate-300" /> :
           openPorts.length === 0 && vulnCount === 0 ? <ShieldCheck className="h-5 w-5 text-green-500" /> :
           <AlertTriangle className="h-5 w-5 text-orange-500" />}
        </div>
      </div>
    </div>
  );
}

function VirusTotalCard({ malicious, suspicious, reputation }: {
  malicious: number;
  suspicious: number;
  reputation: number | null;
}) {
  const notConfigured = reputation === null;
  return (
    <div className={`rounded-xl border p-4 ${notConfigured ? "bg-slate-50/50 border-slate-200" : malicious > 0 ? "bg-red-50/50 border-red-200" : suspicious > 0 ? "bg-orange-50/50 border-orange-200" : "bg-green-50/50 border-green-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${notConfigured ? "bg-slate-100" : malicious > 0 ? "bg-red-100" : suspicious > 0 ? "bg-orange-100" : "bg-green-100"}`}>
          <ShieldAlert className={`h-4 w-4 ${notConfigured ? "text-slate-400" : malicious > 0 ? "text-red-600" : suspicious > 0 ? "text-orange-600" : "text-green-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">VirusTotal Domain Reputasyonu</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Katman 1
            </Badge>
            {notConfigured ? (
              <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-500 border-slate-200">
                API anahtari gerekli
              </Badge>
            ) : (
              <>
                <Badge variant="outline" className={`text-xs px-2 py-0 border ${malicious > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>
                  {malicious > 0 ? `${malicious} zararli` : "Zararli degil"}
                </Badge>
                {suspicious > 0 && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border bg-orange-100 text-orange-700 border-orange-200">
                    {suspicious} supheli
                  </Badge>
                )}
                <Badge variant="outline" className={`text-xs px-2 py-0 border ${(reputation ?? 0) < 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  Skor: {reputation}
                </Badge>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {notConfigured
              ? "VirusTotal API anahtari yapilandirildiginda 70+ antivirusu motoru ile domain reputation analizini goruntuleyebilirsiniz."
              : malicious > 0
              ? `${malicious} antivirusu motoru bu alan adini zararli olarak isaretledi. Acil inceleme gerekiyor.`
              : `70+ antivirusu motoru bu alan adini zararli olarak isaretlemedi. Reputation skoru: ${reputation}.`}
          </p>
        </div>
        <div className="shrink-0">
          {notConfigured ? <Lock className="h-5 w-5 text-slate-300" /> :
           malicious > 0 ? <XCircle className="h-5 w-5 text-red-500" /> :
           <ShieldCheck className="h-5 w-5 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

function AbuseIPDBCard({ score, totalReports, countryCode, isp }: {
  score: number | null;
  totalReports: number;
  countryCode: string | null;
  isp: string | null;
}) {
  const notConfigured = score === null;
  const riskLevel = notConfigured ? null : score >= 75 ? "high" : score >= 25 ? "medium" : "low";
  return (
    <div className={`rounded-xl border p-4 ${notConfigured ? "bg-slate-50/50 border-slate-200" : riskLevel === "high" ? "bg-red-50/50 border-red-200" : riskLevel === "medium" ? "bg-orange-50/50 border-orange-200" : "bg-green-50/50 border-green-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${notConfigured ? "bg-slate-100" : riskLevel === "high" ? "bg-red-100" : riskLevel === "medium" ? "bg-orange-100" : "bg-green-100"}`}>
          <Flag className={`h-4 w-4 ${notConfigured ? "text-slate-400" : riskLevel === "high" ? "text-red-600" : riskLevel === "medium" ? "text-orange-600" : "text-green-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">AbuseIPDB IP Kutuye Kullanim Gecmisi</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Katman 1
            </Badge>
            {notConfigured ? (
              <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-500 border-slate-200">
                API anahtari gerekli
              </Badge>
            ) : (
              <>
                <Badge variant="outline" className={`text-xs px-2 py-0 border ${riskLevel === "high" ? "bg-red-100 text-red-700 border-red-200" : riskLevel === "medium" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-green-100 text-green-700 border-green-200"}`}>
                  Risk: %{score}
                </Badge>
                {totalReports > 0 && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-600 border-slate-200">
                    {totalReports} rapor
                  </Badge>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {notConfigured
              ? "AbuseIPDB API anahtari yapilandirildiginda alan adinin barindirildi IP'nin kuresel kotuye kullanim raporlama gecmisini goruntuleyebilirsiniz."
              : totalReports === 0
              ? `Bu IP icin son 90 gunde kotuye kullanim raporu bulunamadi.${countryCode ? ` Konum: ${countryCode}` : ""}${isp ? `, ${isp}` : ""}.`
              : `Bu IP son 90 gunde ${totalReports} kez kotuye kullanim icin raporlandi. Guven skoru: %${score}.${countryCode ? ` Konum: ${countryCode}` : ""}${isp ? `, ${isp}` : ""}.`}
          </p>
        </div>
        <div className="shrink-0">
          {notConfigured ? <Lock className="h-5 w-5 text-slate-300" /> :
           riskLevel === "high" || riskLevel === "medium" ? <XCircle className="h-5 w-5 text-red-500" /> :
           <ShieldCheck className="h-5 w-5 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

const CHECK_META = {
  spf: {
    icon: Mail,
    label: "SPF Kaydı",
    passText: "Sahte gönderici koruması aktif",
    failText: "Sahte gönderici koruması yok",
    passDesc: "Başka sunucuların alan adınız adına sahte mail göndermesi engelleniyor.",
    failDesc: "Saldırganlar şirketiniz adına sahte fatura veya ödeme talebi maili gönderebilir. SPF kaydı eklemek hosting panelinizden birkaç dakika sürer.",
    score: 20,
  },
  dmarc: {
    icon: Shield,
    label: "DMARC Politikası",
    passText: "E-posta kimlik doğrulama politikası tanımlı",
    failText: "E-posta kimlik doğrulama politikası yok",
    passDesc: "Alıcı mail sunucularına sahte maillere nasıl davranacağı söyleniyor.",
    failDesc: "SPF ve DKIM kayıtlarınız olsa bile DMARC olmadan tam koruma sağlanamaz. Phishing maillerini engellemenin en etkili yolu budur.",
    score: 25,
  },
  dkim: {
    icon: Lock,
    label: "DKIM İmzası",
    passText: "E-posta dijital imzası bulundu",
    failText: "E-posta dijital imzası bulunamadı",
    passDesc: "Gönderilen maillerinizin değiştirilmediği kriptografik imzayla kanıtlanıyor.",
    failDesc: "DKIM olmadan mailinizin içeriği aktarım sırasında değiştirilebilir ve pek çok alıcı tarafından spam olarak işaretlenebilir.",
    score: 20,
  },
  mx: {
    icon: Server,
    label: "MX Kayıtları",
    passText: "Mail sunucu kayıtları mevcut",
    failText: "Mail sunucu kaydı bulunamadı",
    passDesc: "Alan adınız üzerinden mail alabilecek şekilde yapılandırılmış.",
    failDesc: "Bu alan adına gönderilen mailler teslim edilemeyebilir. Doğrulama için domain sağlayıcınızı kontrol edin.",
    score: 10,
  },
  ssl: {
    icon: Globe,
    label: "SSL/TLS Sertifikası",
    passText: "Geçerli HTTPS sertifikası",
    failText: "SSL sertifikası yok veya süresi dolmuş",
    passDesc: "Web siteniz güvenli bağlantı ile erişilebilir durumda.",
    failDesc: "HTTPS olmayan web siteleri tarayıcılar tarafından 'güvensiz' olarak işaretlenir ve ziyaretçiler veri çalmaya açık hale gelir.",
    score: 25,
  },
};

function ScoreColor(score: number) {
  if (score >= 80) return { text: "text-green-600", bg: "bg-green-50 border-green-200", label: "İyi" };
  if (score >= 60) return { text: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Orta" };
  if (score >= 40) return { text: "text-orange-600", bg: "bg-orange-50 border-orange-200", label: "Zayıf" };
  return { text: "text-red-600", bg: "bg-red-50 border-red-200", label: "Kritik" };
}

function CheckCard({
  meta,
  pass,
  detail,
}: {
  meta: typeof CHECK_META.spf;
  pass: boolean;
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border p-4 ${pass ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${pass ? "bg-green-100" : "bg-red-100"}`}>
          <Icon className={`h-4 w-4 ${pass ? "text-green-600" : "text-red-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm">{meta.label}</span>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${pass ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
            >
              {pass ? "Geçti" : "Başarısız"}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">+{meta.score} puan</span>
          </div>
          <p className="text-xs text-muted-foreground">{pass ? meta.passText : meta.failText}</p>
          {detail && (
            <p className="text-xs text-muted-foreground mt-1 font-mono truncate" title={detail}>
              {detail}
            </p>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Info className="h-3 w-3" /> {open ? "Kapat" : "Bu ne anlama geliyor?"}
          </button>
          {open && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t pt-2">
              {pass ? meta.passDesc : meta.failDesc}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {pass
            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
            : <XCircle className="h-5 w-5 text-red-500" />
          }
        </div>
      </div>
    </div>
  );
}

function HibpCard({ breachCount, breaches }: { breachCount: number; breaches: HibpBreach[] }) {
  const [open, setOpen] = useState(false);
  const safe = breachCount === 0;
  return (
    <div className={`rounded-xl border p-4 ${safe ? "bg-green-50/50 border-green-200" : "bg-orange-50/50 border-orange-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${safe ? "bg-green-100" : "bg-orange-100"}`}>
          <DatabaseZap className={`h-4 w-4 ${safe ? "text-green-600" : "text-orange-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Veri Sızıntısı Geçmişi</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${safe ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
            >
              {safe ? "Temiz" : `${breachCount} Sızıntı`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {safe
              ? "Bu alan adı bilinen büyük veri sızıntılarında kaynak olarak yer almıyor."
              : `${breachCount} büyük veri ihlalinde bu alan adından veriler çalınmış. Aşağıdaki sızıntılar kamuya açık kaynaklarda kayıtlı.`}
          </p>
          {!safe && breaches.length > 0 && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" /> {open ? "Gizle" : `${breachCount} sızıntıyı göster`}
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-1.5 border-t pt-2">
              {breaches.map((b) => (
                <div key={b.name} className="text-xs bg-white/70 rounded-lg p-2 border border-orange-200">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold">{b.name}</span>
                    <span className="text-muted-foreground shrink-0">{b.breachDate}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {(b.pwnCount ?? 0).toLocaleString("tr-TR")} hesap etkilendi
                    {b.dataClasses?.length > 0 && ` — ${b.dataClasses.join(", ")}`}
                  </div>
                </div>
              ))}
            </div>
          )}
          {safe && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" /> {open ? "Kapat" : "Bu ne anlama geliyor?"}
            </button>
          )}
          {open && safe && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t pt-2">
              Have I Been Pwned veritabanı, milyarlarca çalınan hesabı içeren küresel sızıntı arşividir. Bu kontrol, alan adınızın geçmişteki büyük veri ihlallerinde kaynak olup olmadığını gösterir.
            </p>
          )}
        </div>
        <div className="shrink-0">
          {safe
            ? <ShieldCheck className="h-5 w-5 text-green-500" />
            : <ShieldAlert className="h-5 w-5 text-orange-500" />
          }
        </div>
      </div>
    </div>
  );
}

const RISK_STYLE: Record<string, string> = {
  "Düşük": "bg-green-100 text-green-700 border-green-200",
  "Orta": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Yüksek": "bg-red-100 text-red-700 border-red-200",
};

const BUSINESS_IMPACT: Record<string, { fn: string; impact: string; backup: string }> = {
  "Google Analytics": { fn: "Pazarlama Analitiği", impact: "Kampanya performansı izlenemez", backup: "Sunucu erişim logları" },
  "Google Tag Manager": { fn: "İzleme & Analitik", impact: "Tüm izleme kodları durabilir", backup: "Doğrudan GA/Pixel entegrasyonu" },
  "Google Fonts": { fn: "Web Sitesi Tasarımı", impact: "Site görünümü bozulabilir", backup: "Yerel font kopyası" },
  "Hotjar": { fn: "Kullanıcı Davranışı", impact: "Heatmap ve oturum kaydı durur", backup: "Alternatif: Microsoft Clarity" },
  "Facebook Pixel": { fn: "Reklam & Retargeting", impact: "Meta reklam optimizasyonu durur", backup: "Sunucu tarafı conversion API" },
  "Stripe": { fn: "Ödeme İşlemleri", impact: "Kart ödemeleri alınamaz, gelir kaybı", backup: "Havale/EFT + iyzico" },
  "Iyzico": { fn: "Ödeme İşlemleri", impact: "Kart ödemeleri alınamaz, gelir kaybı", backup: "Havale/EFT + Stripe" },
  "PayTR": { fn: "Ödeme İşlemleri", impact: "Kart ödemeleri alınamaz, gelir kaybı", backup: "Havale/EFT" },
  "Cloudflare": { fn: "Güvenlik & CDN", impact: "Site yavaşlar, DDoS koruması kalkar", backup: "Doğrudan hosting IP (geçici)" },
  "AWS": { fn: "Altyapı & Depolama", impact: "Kritik servisler çevrimdışı kalabilir", backup: "Yedek sunucu planı gerekli" },
  "Mailchimp": { fn: "E-posta Pazarlama", impact: "Bülten gönderimleri durur", backup: "Brevo veya manuel gönderim" },
  "Intercom": { fn: "Müşteri Desteği", impact: "Canlı destek ve chatbot durur", backup: "Telefon + e-posta desteği" },
  "Zendesk": { fn: "Müşteri Desteği", impact: "Destek sistemi erişilemez olur", backup: "E-posta ile talep yönetimi" },
  "Shopify": { fn: "E-ticaret Platformu", impact: "Online satış tamamen durur", backup: "Telefon siparişi (geçici)" },
  "WooCommerce": { fn: "E-ticaret Platformu", impact: "Online satış tamamen durur", backup: "Telefon siparişi (geçici)" },
  "WordPress": { fn: "Web Sitesi / CMS", impact: "Site tamamen erişilemez olur", backup: "Statik HTML yedek sayfası" },
  "HubSpot": { fn: "CRM & Satış", impact: "Müşteri takibi ve pipeline görünmez", backup: "Excel tabanlı takip (geçici)" },
  "Salesforce": { fn: "CRM & Satış", impact: "Satış süreçleri durur", backup: "Manuel kayıt tutma" },
  "Slack": { fn: "Ekip İletişimi", impact: "İç iletişim kanalı kapanır", backup: "WhatsApp grupları + e-posta" },
  "Zoom": { fn: "Video Konferans", impact: "Uzaktan toplantılar yapılamaz", backup: "Google Meet veya telefon" },
  "Microsoft 365": { fn: "Ofis Araçları & E-posta", impact: "E-posta ve belgeler erişilemez olabilir", backup: "Google Workspace geçiş planı" },
};

function getDefaultImpact(category: string): { fn: string; impact: string; backup: string } {
  const map: Record<string, { fn: string; impact: string; backup: string }> = {
    "Analitik": { fn: "Veri & Analitik", impact: "İzleme ve raporlama durabilir", backup: "Yerel loglar" },
    "Ödeme": { fn: "Ödeme İşlemleri", impact: "Tahsilat aksayabilir", backup: "Alternatif ödeme yöntemi" },
    "CRM": { fn: "Müşteri İlişkileri", impact: "Müşteri verilerine erişim zorlaşır", backup: "Manuel kayıt" },
    "Destek": { fn: "Müşteri Desteği", impact: "Destek kanalı durabilir", backup: "Telefon & e-posta" },
    "Pazarlama": { fn: "Pazarlama", impact: "Kampanya yönetimi aksayabilir", backup: "Doğrudan iletişim" },
    "E-ticaret": { fn: "Online Satış", impact: "Satış kanalı durabilir", backup: "Telefon siparişi" },
    "Altyapı": { fn: "Altyapı", impact: "Servis kesintisi oluşabilir", backup: "Yedek plan gerekli" },
  };
  return map[category] ?? { fn: category, impact: "Hizmet aksaması yaşanabilir", backup: "Alternatif yöntem araştırın" };
}

const RISK_BG: Record<string, string> = {
  "Düşük": "border-green-200 bg-green-50/60",
  "Orta": "border-amber-200 bg-amber-50/60",
  "Yüksek": "border-red-200 bg-red-50/60",
};

function BusinessContinuityMap({ services }: { services: ShadowItService[] }) {
  const [open, setOpen] = useState(false);
  const highCount = services.filter(s => s.risk === "Yüksek").length;

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 mb-2">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-100 shrink-0">
          <Network className="h-4 w-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">İş Sürekliliği Haritası</span>
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
              {services.length} dijital bağımlılık
            </Badge>
            {highCount > 0 && (
              <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">
                {highCount} kritik risk
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Bu alan adında tespit edilen servisler çöktüğünde işletmeniz nasıl etkilenir? Aşağıda her servis için acil durum senaryosu görüntüleyin.
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-purple-700 hover:underline font-medium"
          >
            <Info className="h-3 w-3" />
            {open ? "Haritayı Gizle" : `Tüm senaryoları gör (${services.length})`}
          </button>
          {open && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 border-t border-purple-200 pt-3">
              {services.map(svc => {
                const impact = BUSINESS_IMPACT[svc.name] ?? getDefaultImpact(svc.category);
                return (
                  <div key={svc.name} className={`rounded-lg border p-3 text-xs ${RISK_BG[svc.risk] ?? "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-slate-800">{svc.name}</span>
                      <Badge variant="outline" className={`text-xs px-1.5 py-0 border shrink-0 ${RISK_STYLE[svc.risk] ?? ""}`}>
                        {svc.risk}
                      </Badge>
                    </div>
                    <p className="text-slate-500 mb-0.5"><span className="font-medium text-slate-700">İşlev:</span> {impact.fn}</p>
                    <p className="text-slate-500 mb-0.5"><span className="font-medium text-slate-700">Çökerse:</span> {impact.impact}</p>
                    <p className="text-slate-500"><span className="font-medium text-slate-700">Yedek:</span> {impact.backup}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShadowItCard({ services }: { services: ShadowItService[] }) {
  const [open, setOpen] = useState(false);
  const highCount = services.filter((s) => s.risk === "Yüksek").length;
  const medCount = services.filter((s) => s.risk === "Orta").length;
  const empty = services.length === 0;
  const alertLevel = highCount > 0 ? "high" : medCount > 0 ? "medium" : "clean";
  const bgStyle = alertLevel === "high" ? "bg-red-50/50 border-red-200" : alertLevel === "medium" ? "bg-yellow-50/50 border-yellow-200" : "bg-green-50/50 border-green-200";
  const iconStyle = alertLevel === "high" ? "bg-red-100" : alertLevel === "medium" ? "bg-yellow-100" : "bg-green-100";
  const iconColor = alertLevel === "high" ? "text-red-600" : alertLevel === "medium" ? "text-yellow-600" : "text-green-600";

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <div className={`rounded-xl border p-4 ${bgStyle}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${iconStyle}`}>
          <Globe className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Gölge BT / Üçüncü Parti Servisler</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
            {!empty && (
              <Badge variant="outline" className={`text-xs px-2 py-0 border ${alertLevel === "high" ? "bg-red-100 text-red-700 border-red-200" : alertLevel === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-green-100 text-green-700 border-green-200"}`}>
                {services.length} servis
              </Badge>
            )}
          </div>
          {empty ? (
            <p className="text-xs text-muted-foreground">Site kaynak kodu çözümlenemedi veya harici servis tespit edilemedi.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {highCount > 0
                  ? `${highCount} yüksek riskli servis dahil ${services.length} üçüncü parti araç tespit edildi.`
                  : medCount > 0
                  ? `${services.length} servis tespit edildi — ${medCount} tanesi KVKK uyumu gerektiriyor.`
                  : `${services.length} servis tespit edildi. Bilinen bir güvenlik riski yok.`}
                {" "}Kategoriler: {categories.join(", ")}.
              </p>
              <button
                onClick={() => setOpen(!open)}
                className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Info className="h-3 w-3" /> {open ? "Gizle" : `Tüm servisleri göster (${services.length})`}
              </button>
              {open && (
                <div className="mt-2 border-t pt-2 space-y-2">
                  {services.map((svc) => (
                    <div key={svc.name} className="text-xs bg-white/70 rounded-lg p-2.5 border border-border">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold">{svc.name}</span>
                          {svc.version && (
                            <span className="text-muted-foreground font-mono">v{svc.version}</span>
                          )}
                          <Badge variant="outline" className="text-xs px-1.5 py-0 border text-muted-foreground border-border">
                            {svc.category}
                          </Badge>
                        </div>
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 border shrink-0 ${RISK_STYLE[svc.risk] ?? "bg-gray-100 text-gray-600"}`}>
                          {svc.risk} risk
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{svc.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="shrink-0">
          {alertLevel === "high"
            ? <ShieldAlert className="h-5 w-5 text-red-500" />
            : alertLevel === "medium"
            ? <AlertTriangle className="h-5 w-5 text-yellow-500" />
            : <ShieldCheck className="h-5 w-5 text-green-500" />
          }
        </div>
      </div>
    </div>
  );
}

function BlacklistCard({ blacklisted, blacklistCount, results }: { blacklisted: boolean; blacklistCount: number; results: BlacklistResult[] }) {
  const [open, setOpen] = useState(false);
  const listedOnes = results.filter((r) => r.listed);
  return (
    <div className={`rounded-xl border p-4 ${!blacklisted ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${!blacklisted ? "bg-green-100" : "bg-red-100"}`}>
          <ShieldAlert className={`h-4 w-4 ${!blacklisted ? "text-green-600" : "text-red-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Kara Liste Kontrolü</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${!blacklisted ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
            >
              {!blacklisted ? "Temiz" : `${blacklistCount} Listede`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {results.length === 0
              ? "IP adresi çözümlenemedi, kara liste kontrolü yapılamadı."
              : !blacklisted
              ? `${results.length} farklı spam ve kötü amaçlı yazılım listesi kontrol edildi. Herhangi birinde yer almıyor.`
              : `Sunucu IP'si ${blacklistCount} spam listesinde kayıtlı. Bu durum mail teslim sorunlarına yol açabilir.`}
          </p>
          {results.length > 0 && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" /> {open ? "Kapat" : "Detayları göster"}
            </button>
          )}
          {open && results.length > 0 && (
            <div className="mt-2 border-t pt-2">
              {blacklisted && listedOnes.length > 0 && (
                <div className="mb-2 space-y-1">
                  {listedOnes.map((r) => (
                    <div key={r.list} className="text-xs bg-red-100 text-red-700 rounded px-2 py-1 flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 shrink-0" /> {r.list}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {!blacklisted
                  ? "Spamhaus, SpamCop, SORBS, Barracuda ve diğer listeler tarandı."
                  : "Kara listeden çıkmak için ilgili liste sağlayıcısına başvurmanız gerekir."}
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0">
          {!blacklisted
            ? <ShieldCheck className="h-5 w-5 text-green-500" />
            : <XCircle className="h-5 w-5 text-red-500" />
          }
        </div>
      </div>
    </div>
  );
}

function HttpHeadersCard({
  score,
  details,
}: {
  score: number;
  details: { hsts: boolean; xFrameOptions: boolean; xContentTypeOptions: boolean; csp: boolean; referrerPolicy: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const passedCount = details
    ? [details.hsts, details.xFrameOptions, details.xContentTypeOptions, details.csp, details.referrerPolicy].filter(Boolean).length
    : 0;
  const passed = passedCount >= 3;
  const HEADERS = [
    { key: "hsts" as const, label: "HSTS (Zorunlu HTTPS)" },
    { key: "xFrameOptions" as const, label: "X-Frame-Options (Clickjacking koruması)" },
    { key: "xContentTypeOptions" as const, label: "X-Content-Type-Options (MIME saldırısı)" },
    { key: "csp" as const, label: "Content-Security-Policy (XSS koruması)" },
    { key: "referrerPolicy" as const, label: "Referrer-Policy (Gizlilik)" },
  ];
  return (
    <div className={`rounded-xl border p-4 ${passed ? "bg-green-50/50 border-green-200" : "bg-orange-50/50 border-orange-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${passed ? "bg-green-100" : "bg-orange-100"}`}>
          <Lock className={`h-4 w-4 ${passed ? "text-green-600" : "text-orange-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">HTTP Güvenlik Başlıkları</span>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${passed ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
            >
              {passedCount}/5 aktif
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {passedCount === 5
              ? "Tüm kritik HTTP güvenlik başlıkları aktif. Tarayıcı saldırılarına karşı iyi korunuyor."
              : `${5 - passedCount} güvenlik başlığı eksik — tarayıcı tabanlı saldırılara (XSS, clickjacking) karşı açık.`}
          </p>
          {details && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" /> {open ? "Kapat" : "Başlıkları incele"}
            </button>
          )}
          {open && details && (
            <div className="mt-2 border-t pt-2 space-y-1.5">
              {HEADERS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {details[key]
                    ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                  <span className={details[key] ? "text-muted-foreground" : "text-red-600 font-medium"}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {passed ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-orange-500" />}
        </div>
      </div>
    </div>
  );
}

function UrlhausCard({ listed, threat }: { listed: boolean; threat: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-4 ${!listed ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${!listed ? "bg-green-100" : "bg-red-100"}`}>
          <Bug className={`h-4 w-4 ${!listed ? "text-green-600" : "text-red-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">URLhaus Zararlı URL</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${!listed ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
            >
              {!listed ? "Temiz" : "Zararlı"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {!listed
              ? "Domain, Abuse.ch URLhaus kötü amaçlı yazılım dağıtım listesinde yer almıyor."
              : `URLhaus veritabanında kötü amaçlı yazılım kaynağı olarak tespit edildi.${threat ? ` Tehdit türü: ${threat}` : ""}`}
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Info className="h-3 w-3" /> {open ? "Kapat" : "Bu ne anlama geliyor?"}
          </button>
          {open && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t pt-2">
              URLhaus, Abuse.ch tarafından işletilen ve aktif olarak zararlı yazılım yayan URL'leri izleyen küresel bir tehdit istihbaratı veritabanıdır. Bu listede yer almak alan adınızın kötüye kullanıldığını gösterir.
            </p>
          )}
        </div>
        <div className="shrink-0">
          {!listed ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
        </div>
      </div>
    </div>
  );
}

function UsomCard({ listed }: { listed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-4 ${!listed ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${!listed ? "bg-green-100" : "bg-red-100"}`}>
          <Shield className={`h-4 w-4 ${!listed ? "text-green-600" : "text-red-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">USOM Kara Listesi</span>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${!listed ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
            >
              {!listed ? "Temiz" : "Kara Listede"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {!listed
              ? "Alan adı, BTK/USOM tarafından yayınlanan ulusal zararlı URL listesinde kayıtlı değil."
              : "Bu alan adı, USOM (Ulusal Siber Olaylar Müdahale Merkezi) tarafından zararlı olarak işaretlenmiş!"}
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Info className="h-3 w-3" /> {open ? "Kapat" : "Bu ne anlama geliyor?"}
          </button>
          {open && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t pt-2">
              USOM (Ulusal Siber Olaylar Müdahale Merkezi), Cumhurbaşkanlığı Dijital Dönüşüm Ofisi bünyesinde zararlı alan adlarını takip eden Türkiye'nin ulusal siber güvenlik birimidir. Liste günlük güncellenerek Türk internet sağlayıcıları tarafından erişim engellemede kullanılır.
            </p>
          )}
        </div>
        <div className="shrink-0">
          {!listed ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
        </div>
      </div>
    </div>
  );
}

function CertTransparencyCard({ subdomains, count }: { subdomains: string[]; count: number }) {
  const [open, setOpen] = useState(false);
  const hasSubdomains = count > 0;
  return (
    <div className={`rounded-xl border p-4 ${!hasSubdomains ? "bg-green-50/50 border-green-200" : "bg-yellow-50/50 border-yellow-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${!hasSubdomains ? "bg-green-100" : "bg-yellow-100"}`}>
          <Network className={`h-4 w-4 ${!hasSubdomains ? "text-green-600" : "text-yellow-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Sertifika Şeffaflığı (crt.sh)</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs px-2 py-0 border ${!hasSubdomains ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}
            >
              {count === 0 ? "Alt alan yok" : `${count} alt alan`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {count === 0
              ? "Sertifika şeffaflık kayıtlarında alt alan adı tespit edilmedi."
              : `SSL sertifika geçmişinde ${count} alt alan adı keşfedildi. Bilinmeyen alt alanlar güvenlik riski oluşturabilir.`}
          </p>
          {hasSubdomains && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" /> {open ? "Kapat" : "Alt alanları listele"}
            </button>
          )}
          {open && subdomains.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <div className="flex flex-wrap gap-1.5">
                {subdomains.map((s) => (
                  <span key={s} className="text-xs bg-yellow-100/80 text-yellow-800 border border-yellow-200 rounded px-2 py-0.5 font-mono">{s}</span>
                ))}
              </div>
              {count > subdomains.length && (
                <p className="text-xs text-muted-foreground mt-2">+{count - subdomains.length} daha fazla alt alan mevcut (ilk 30 gösteriliyor)</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Bu alt alanların güncel ve kontrolünüzde olduğunu doğrulayın.</p>
            </div>
          )}
        </div>
        <div className="shrink-0">
          {!hasSubdomains ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
        </div>
      </div>
    </div>
  );
}

function CveCard({ cveSummary }: { cveSummary: Array<{ service: string; cveId: string; description: string; cvssScore: number }> }) {
  const [open, setOpen] = useState(false);
  if (cveSummary.length === 0) return null;
  return (
    <div className="rounded-xl border p-4 bg-red-50/50 border-red-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg shrink-0 bg-red-100">
          <Bug className="h-4 w-4 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-sm">Aktif CVE Açıkları Tespit Edildi</span>
            <Badge variant="outline" className="text-xs px-2 py-0 bg-red-100 text-red-700 border-red-200">
              {cveSummary.length} kritik CVE
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Kullanılan 3. parti servislerinizde NIST NVD veritabanında kayıtlı kritik güvenlik açıkları bulundu.
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Info className="h-3 w-3" />
            {open ? "Kapat" : "CVE detaylarını göster"}
          </button>
          {open && (
            <div className="mt-2 border-t pt-2 space-y-2">
              {cveSummary.map((cve) => (
                <div key={cve.cveId} className="text-xs bg-red-100/70 rounded-lg p-2 border border-red-200">
                  <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono font-bold text-red-700">{cve.cveId}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{cve.service}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-red-300 text-red-700">
                        CVSS {cve.cvssScore}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-snug">{cve.description}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Kaynak: NIST National Vulnerability Database (NVD) — nvd.nist.gov
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <XCircle className="h-5 w-5 text-red-500" />
        </div>
      </div>
    </div>
  );
}

export default function DomainScanPage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  async function downloadScanPDF(id: number, domainName: string) {
    setDownloadingPDF(true);
    try {
      const res = await fetch(`/api/domain-scan/${id}/pdf`);
      if (!res.ok) throw new Error("PDF indirilemedi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Domain_${domainName}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPDF(false);
    }
  }

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/domain-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), email: email.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Tarama başarısız");
      }
      return res.json() as Promise<ScanResult>;
    },
  });

  const result = scanMutation.data;
  const scoreInfo = result ? ScoreColor(result.overallScore) : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Dış Ağ Taraması
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Alan Adı Güvenlik Taraması</h1>
        <p className="text-muted-foreground leading-relaxed">
          Alan adınızın e-posta güvenlik kayıtlarını, SSL sertifikasını, veri sızıntısı geçmişini ve spam listesi
          durumunu otomatik kontrol edin. Hiçbir yazılım kurmanıza gerek yok — sadece alan adınızı girin.
        </p>
      </div>

      {/* Form */}
      <Card className="shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="domain">Alan Adı</Label>
              <Input
                id="domain"
                placeholder="sirketiniz.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !scanMutation.isPending && domain.trim() && scanMutation.mutate()}
                disabled={scanMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">
                E-posta <span className="text-muted-foreground text-xs">(opsiyonel — 30 günde bir bildirim)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="siz@sirket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={scanMutation.isPending}
              />
            </div>
          </div>
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={!domain.trim() || scanMutation.isPending}
            className="w-full sm:w-auto"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Taranıyor...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Taramayı Başlat
              </>
            )}
          </Button>
          {scanMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-2">
              DNS kayıtları, SSL, veri sızıntısı ve kara listeler kontrol ediliyor...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {scanMutation.isError && (
        <Card className="shadow-sm mb-6 border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{(scanMutation.error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && scoreInfo && (
        <>
          {/* Overall score */}
          <Card className={`shadow-sm mb-6 border ${scoreInfo.bg}`}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="text-center shrink-0">
                  <div className={`text-5xl font-black ${scoreInfo.text}`}>{result.overallScore}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">/ 100 puan</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className="font-bold text-lg">{result.domain}</h2>
                    <Badge variant="outline" className={`font-bold border ${scoreInfo.bg} ${scoreInfo.text}`}>
                      {scoreInfo.label}
                    </Badge>
                    {result.blacklisted && (
                      <Badge variant="outline" className="font-bold border bg-red-100 text-red-700 border-red-200">
                        Kara Listede
                      </Badge>
                    )}
                    {result.hibpBreachCount > 0 && (
                      <Badge variant="outline" className="font-bold border bg-orange-100 text-orange-700 border-orange-200">
                        {result.hibpBreachCount} Sızıntı
                      </Badge>
                    )}
                  </div>
                  <Progress value={result.overallScore} className="h-2.5 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {result.overallScore >= 80
                      ? "E-posta güvenliğiniz iyi durumda. Aşağıdaki detayları inceleyin."
                      : result.overallScore >= 60
                      ? "Birkaç önemli güvenlik kaydı eksik. Aşağıdaki başarısız kontrolleri düzeltin."
                      : "Kritik güvenlik açıkları tespit edildi. Aşağıdaki adımları mümkün olan en kısa sürede tamamlayın."}
                  </p>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => downloadScanPDF(result.id, result.domain)}
                      disabled={downloadingPDF}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {downloadingPDF ? "PDF Hazırlanıyor..." : "PDF Olarak İndir"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Temel kontroller */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            E-posta ve SSL Güvenliği
          </p>
          <div className="space-y-3 mb-6">
            <CheckCard meta={CHECK_META.spf} pass={result.spfPass} detail={result.spfRecord ?? undefined} />
            <CheckCard meta={CHECK_META.dmarc} pass={result.dmarcPass} detail={result.dmarcRecord ?? undefined} />
            <CheckCard
              meta={CHECK_META.dkim}
              pass={result.dkimPass}
              detail={result.dkimSelectors.length > 0 ? `Bulunan selector'lar: ${result.dkimSelectors.join(", ")}` : undefined}
            />
            <CheckCard
              meta={CHECK_META.mx}
              pass={result.mxPass}
              detail={result.mxRecords[0] ? `${result.mxRecords[0].exchange}` : undefined}
            />
            <CheckCard
              meta={CHECK_META.ssl}
              pass={result.sslPass}
              detail={
                result.sslDaysUntilExpiry !== null
                  ? `${result.sslIssuer ?? "Sertifika"} — ${result.sslDaysUntilExpiry} gün geçerli`
                  : undefined
              }
            />
          </div>

          {/* Web Sunucu Güvenlik Başlıkları */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Web Sunucu Güvenliği
          </p>
          <div className="space-y-3 mb-6">
            <HttpHeadersCard score={result.httpHeadersScore} details={result.httpHeadersDetails} />
          </div>

          {/* Risk İstihbaratı (Pro) */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Risk İstihbaratı
            </p>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Pro
            </Badge>
          </div>
          <div className="space-y-3 mb-6">
            <HibpCard breachCount={result.hibpBreachCount} breaches={result.hibpBreaches} />
            <BlacklistCard
              blacklisted={result.blacklisted}
              blacklistCount={result.blacklistCount}
              results={result.blacklistResults}
            />
            <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/5 to-background p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1.5">8 Gelismis Risk Kontrolu Kilitlendi</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Shadow IT tespiti · URLhaus zararli URL · USOM kara liste · Sertifika seffafligi
                    · NVD CVE guvenik aciklari · Shodan acik port taramasi · VirusTotal reputation · AbuseIPDB IP gecmisi
                  </p>
                </div>
                <a
                  href="/fiyatlar"
                  className="inline-flex items-center justify-center rounded-md text-sm font-semibold h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors gap-1.5"
                >
                  Tam Degerlendirme ile Kilidi Ac
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <p className="text-xs text-muted-foreground">
                  Tam Degerlendirme musterileri tum bulgulara{" "}
                  <a href="/musteri/giris" className="text-primary hover:underline">musteri panelinden</a>{" "}
                  erisir.
                </p>
              </div>
            </div>
          </div>

          {/* KEP Güvenlik İzleyicisi */}
          {(result as any).kepConfigured !== undefined && (result as any).kepConfigured !== null && (
            <Card className={`shadow-sm mb-2 ${(result as any).kepConfigured ? "border-green-200 bg-green-50/40 dark:bg-green-950/10" : "border-slate-200"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${(result as any).kepConfigured ? "bg-green-100 dark:bg-green-900/30" : "bg-slate-100 dark:bg-slate-800"}`}>
                    <Shield className={`h-4 w-4 ${(result as any).kepConfigured ? "text-green-600" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">KEP Güvenlik İzleyicisi</span>
                      {(result as any).kepConfigured
                        ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200" variant="outline">Yapılandırılmış</Badge>
                        : <Badge className="text-xs bg-slate-100 text-slate-500 border-slate-200" variant="outline">Tespit Edilemedi</Badge>
                      }
                      {(result as any).kepSecure && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200" variant="outline">Güvenli</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(result as any).kepConfigured
                        ? `Kayıtlı Elektronik Posta (KEP) yapılandırması tespit edildi.${(result as any).kepRelays?.length > 0 ? ` Relay: ${((result as any).kepRelays as string[]).join(", ")}` : ""}`
                        : "Alan adında KEP (Kayıtlı Elektronik Posta) yapılandırması bulunamadı. KEP, ticari yazışmalarda yasal geçerlilik sağlar."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CyberTrust Güven Rozeti */}
          {(result as any).badgeToken && (() => {
            const token = (result as any).badgeToken as string;
            const score = result.overallScore ?? 0;
            const grade = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F";
            const gradeColor = grade === "A" ? "#16a34a" : grade === "B" ? "#65a30d" : grade === "C" ? "#d97706" : grade === "D" ? "#ea580c" : "#dc2626";
            const embedCode = `<script src="${window.location.origin}/api/trust-badge/${token}/widget.js"></script>`;
            return (
              <Card className="shadow-sm mb-2 border-violet-200 bg-violet-50/40 dark:bg-violet-950/10 dark:border-violet-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-600" />
                    CyberTrust Güven Rozeti
                  </CardTitle>
                  <CardDescription>
                    Bu kodu web sitenize ekleyerek müsterilerinize güvenli olduğunuzu kanıtlayın.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900">
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, background: gradeColor, borderRadius: 8,
                      fontWeight: 700, fontSize: 18, color: "#fff"
                    }}>{grade}</span>
                    <div>
                      <div className="text-sm font-semibold">{result.domain}</div>
                      <div className="text-xs text-muted-foreground">CyberStep.io Doğrulandı</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Web Sitenize Eklemek İçin:</p>
                    <div className="flex gap-2 items-start">
                      <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 rounded p-2 font-mono break-all border border-slate-200 dark:border-slate-700">
                        {embedCode}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(embedCode).catch(() => {});
                        }}
                      >
                        Kopyala
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* İş Sürekliliği Haritası */}
          {result.shadowItServices && result.shadowItServices.length > 0 && (
            <BusinessContinuityMap services={result.shadowItServices} />
          )}

          {/* Tedarikçi Viral Pasaport */}
          {result.id && (() => {
            const inviteUrl = `${window.location.origin}/domain-tarama?ref=${result.id}&utm_source=cybertrust_badge`;
            return (
              <Card className="shadow-sm mb-2 border-blue-200 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600" />
                    Tedarikçinizi Güvenlik Kontrolünden Geçirin
                  </CardTitle>
                  <CardDescription>
                    Birlikte çalıştığınız şirketlerin de güvenli olduğundan emin olun. Bağlantıyı paylaşın.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteUrl}
                      className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteUrl).catch(() => {});
                      }}
                    >
                      Kopyala
                    </Button>
                  </div>
                  <a
                    href={`mailto:?subject=${encodeURIComponent("Siber Güvenlik Kontrolü — CyberStep.io")}&body=${encodeURIComponent(`Merhaba,\n\nSiber güvenlik durumunuzu ücretsiz kontrol ettirmenizi öneririm.\n${inviteUrl}\n\nİyi çalışmalar.`)}`}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                  >
                    E-posta ile gönder
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            );
          })()}

          {/* CTA */}
          {!result.email && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Değişiklikleri Otomatik Takip Edin</CardTitle>
                <CardDescription>
                  E-posta adresinizi bırakın, 30 günde bir yeniden tarama yaparak değişiklik olursa sizi bilgilendirelim.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="siz@sirket.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (email.trim()) {
                        setDomain(result.domain);
                        scanMutation.mutate();
                      }
                    }}
                    disabled={!email.trim() || scanMutation.isPending}
                  >
                    Kaydet <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {result.email && (
            <Card className="shadow-sm border-green-200 bg-green-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm text-green-700">
                  <strong>{result.email}</strong> adresine 30 günde bir tarama raporu gönderilecek.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!result && !scanMutation.isPending && !scanMutation.isError && (
        <Card className="shadow-sm border-dashed">
          <CardContent className="p-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Alan adınızı girin ve taramayı başlatın.
              <br />
              SPF, DMARC, DKIM, MX, SSL, veri sızıntısı ve kara liste durumu kontrol edilir.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
