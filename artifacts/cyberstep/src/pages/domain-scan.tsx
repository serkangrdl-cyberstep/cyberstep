import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
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
  Swords, ChevronDown, ChevronUp, Target, Zap, AlertOctagon,
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
  cisaKevMatches?: Array<{ cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription: string; requiredAction: string }>;
  otxData?: { pulseCount: number; reputation: number; maliciousCount: number } | null;
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
            <span className="font-semibold text-sm">İnternet Maruziyeti Analizi</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Katman 1
            </Badge>
            {notConfigured ? (
              <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-500 border-slate-200">
                Veri yok
              </Badge>
            ) : (
              <>
                <Badge variant="outline" className={`text-xs px-2 py-0 border ${openPorts.length === 0 ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}>
                  {openPorts.length === 0 ? "Açık port yok" : `${openPorts.length} açık port tespit edildi`}
                </Badge>
                {vulnCount > 0 && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border bg-red-100 text-red-700 border-red-200">
                    {vulnCount} güvenlik açığı
                  </Badge>
                )}
              </>
            )}
          </div>
          {notConfigured ? (
            <p className="text-xs text-muted-foreground">
              İnternet maruziyeti analizi yapılandırıldığında sunucularınızda dışarıdan erişilebilen port ve servisleri görüntüleyebilirsiniz.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {openPorts.length === 0
                  ? "Bu IP için internete açık port kaydı bulunamadı."
                  : `İnternete açık ${openPorts.length} port tespit edildi.${vulnCount > 0 ? ` ${vulnCount} bilinen güvenlik açığı mevcut.` : ""}`}
                {country ? ` Sunucu konumu: ${country}.` : ""}
                {isp ? ` Sağlayıcı: ${isp}.` : ""}
              </p>
              {openPorts.length > 0 && (
                <div className="mt-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-700">
                    {openPorts.length} açık port tespit edildi. Bu portların hangi servislere ait olduğu, risk seviyesi ve kapatma önerileri ücretli raporda yer almaktadır.
                  </p>
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
            <span className="font-semibold text-sm">IP Kötüye Kullanım Geçmişi</span>
            <Badge variant="outline" className="text-xs px-2 py-0 border bg-violet-100 text-violet-700 border-violet-200">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Katman 1
            </Badge>
            {notConfigured ? (
              <Badge variant="outline" className="text-xs px-2 py-0 border bg-slate-100 text-slate-500 border-slate-200">
                Veri yok
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
              ? "IP kötüye kullanım istihbaratı yapılandırıldığında alan adının barındırıldığı IP'nin küresel kötüye kullanım geçmişini görüntüleyebilirsiniz."
              : totalReports === 0
              ? `Bu IP için son 90 günde kötüye kullanım raporu bulunamadı.${countryCode ? ` Konum: ${countryCode}` : ""}${isp ? `, ${isp}` : ""}.`
              : `Bu IP son 90 günde ${totalReports} kez kötüye kullanım için raporlandı. Güven skoru: %${score}.${countryCode ? ` Konum: ${countryCode}` : ""}${isp ? `, ${isp}` : ""}.`}
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
            Bu alan adında tespit edilen servisler çöktüğünde şirketiniz nasıl etkilenir? Aşağıda her servis için acil durum senaryosu görüntüleyin.
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface MitreTechnique { kod: string; isim: string; }
interface AttackScenario {
  baslik: string;
  olasilik: "Yüksek" | "Orta" | "Düşük";
  acillik: "Acil" | "Yüksek" | "Orta";
  giris_noktasi: string;
  saldiri_zinciri: string[];
  mitre_teknikler: MitreTechnique[];
  etki: string;
  kvkk_etkisi: string;
  acil_onlemler: string[];
}
interface AttackScenariosResult {
  risk_ozet: string;
  genel_tehdit_seviyesi: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  senaryolar: AttackScenario[];
  once_kapat: Array<{ oncelik: number; aksiyon: string; neden: string }>;
  generated_at: string;
}

// ─── Integration Push Panel ───────────────────────────────────────────────────
function IntegrationPushPanel({ scanId }: { scanId: number }) {
  const { data: customer } = useQuery<{ subscriptionPlan: string | null; id: number } | null>({
    queryKey: ["customer-me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
    staleTime: 60_000,
  });

  const [pushState, setPushState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pushResult, setPushResult] = useState<{ pushed: number; message: string } | null>(null);

  if (!customer) return null;

  const isPro = customer.subscriptionPlan === "pro";
  const hasFullAccess = ["full", "pro"].includes(customer.subscriptionPlan ?? "");

  if (!isPro) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300 mb-1">Entegrasyonlara Gönder — Pro Paket</p>
            <p className="text-xs text-muted-foreground">
              Bu bulguları Jira ticket'larına, QRadar olaylarına veya FortiSIEM'e otomatik aktarmak için Pro pakete geçin.
            </p>
          </div>
          <a href="/iletisim" className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0 mt-0.5">
            Pro'ya Geç
          </a>
        </div>
      </div>
    );
  }

  const handlePush = async () => {
    setPushState("loading");
    setPushResult(null);
    try {
      const r = await fetch(`/api/integrations/push/domain-scan/${scanId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json() as { ok: boolean; pushed: number; message: string };
      if (data.ok) {
        setPushState("done");
        setPushResult({ pushed: data.pushed, message: data.message });
      } else {
        setPushState("error");
        setPushResult({ pushed: 0, message: data.message ?? "Gönderilemedi." });
      }
    } catch {
      setPushState("error");
      setPushResult({ pushed: 0, message: "Bağlantı hatası." });
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Entegrasyonlar</p>
          <p className="text-base font-bold text-foreground mb-1">Bu bulgular entegrasyonlarınıza gönderilsin mi?</p>
          <p className="text-sm text-muted-foreground">
            CVE'ler, e-posta güvenliği sorunları, tehdit listesi tespitleri ve diğer bulgular Jira, QRadar veya FortiSIEM'e aktarılır.
          </p>
        </div>
        <div className="shrink-0">
          {pushState === "idle" && (
            <Button onClick={handlePush} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Zap className="h-4 w-4 mr-2" />
              Entegrasyonlara Gönder
            </Button>
          )}
          {pushState === "loading" && (
            <Button disabled className="bg-primary/50">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gönderiliyor...
            </Button>
          )}
          {pushState === "done" && (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">{pushResult?.message}</span>
            </div>
          )}
          {pushState === "error" && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">{pushResult?.message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPushState("idle")}>
                Tekrar Dene
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Attack Scenario Panel ─────────────────────────────────────────────────────
const ATTACK_GEN_STEPS = [
  { label: "Tarama verileri hazırlanıyor", endMs: 8000, maxPct: 30 },
  { label: "Tehdit modeli oluşturuluyor", endMs: 18000, maxPct: 65 },
  { label: "Senaryolar yazılıyor", endMs: 26000, maxPct: 95 },
] as const;

function AttackScenarioPanel({ scanId }: { scanId: number }) {
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [result, setResult] = useState<AttackScenariosResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [genProgress, setGenProgress] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sseStep, setSseStep] = useState<number | null>(null);
  const genStartRef = useRef<number | null>(null);
  // true once the first SSE message arrives — disables time-based animation
  const sseConnectedRef = useRef(false);

  // Snap to 100%, fade out, then reveal results
  const completeWithTransition = useCallback((scenarioResult: AttackScenariosResult) => {
    setResult(scenarioResult);
    setGenProgress(100);
    setIsFinishing(true);
    setTimeout(() => {
      setIsFinishing(false);
      setStatus("complete");
    }, 500);
  }, []);

  // Animate progress bar while generating (time-based fallback — disabled once SSE connects)
  useEffect(() => {
    if (status !== "generating") {
      if (!isFinishing) setGenProgress(0);
      genStartRef.current = null;
      return;
    }
    genStartRef.current = Date.now();
    const tick = setInterval(() => {
      // SSE is driving the bar — skip time-based updates
      if (sseConnectedRef.current) return;
      const elapsed = Date.now() - (genStartRef.current ?? Date.now());
      let pct = 0;
      const steps = ATTACK_GEN_STEPS;
      for (let i = 0; i < steps.length; i++) {
        const prevMs = i === 0 ? 0 : steps[i - 1].endMs;
        const prevPct = i === 0 ? 0 : steps[i - 1].maxPct;
        if (elapsed <= steps[i].endMs) {
          const fraction = (elapsed - prevMs) / (steps[i].endMs - prevMs);
          pct = prevPct + fraction * (steps[i].maxPct - prevPct);
          break;
        }
        pct = steps[i].maxPct;
      }
      setGenProgress(Math.min(95, pct));
    }, 150);
    return () => clearInterval(tick);
  }, [status, isFinishing]);

  // SSE subscription — updates genProgress and sseStep from real server milestones.
  // Falls back gracefully to the time-based animation above if the connection fails.
  useEffect(() => {
    if (status !== "generating") {
      sseConnectedRef.current = false;
      setSseStep(null);
      return;
    }

    const es = new EventSource(`/api/domain-scan/${scanId}/attack-scenarios/progress`);

    es.onmessage = (e: MessageEvent) => {
      try {
        const data: { step: number; pct: number } = JSON.parse(e.data as string);
        sseConnectedRef.current = true;
        setSseStep(data.step);
        setGenProgress(data.pct);
      } catch { }
    };

    // Server signals generation finished — polling will detect the result
    es.addEventListener("done", () => { es.close(); });

    // Server signals an error — fall back, let polling surface the error state
    es.addEventListener("generror", () => {
      sseConnectedRef.current = false;
      es.close();
    });

    // Connection-level error (network drop, server restart, etc.) — fall back gracefully
    es.onerror = () => {
      sseConnectedRef.current = false;
      setSseStep(null);
      es.close();
    };

    return () => {
      es.close();
      sseConnectedRef.current = false;
    };
  }, [status, scanId]);

  // Check for cached result on mount — auto-trigger generation if not started yet
  useEffect(() => {
    fetch(`/api/domain-scan/${scanId}/attack-scenarios`)
      .then(r => r.json())
      .then((data: { status: string; result: AttackScenariosResult | null }) => {
        if (data.status === "complete" && data.result) {
          // Already cached — show immediately without animation
          setResult(data.result);
          setStatus("complete");
        } else {
          // status "none"/"error"/"generating" — POST to ensure generation is
          // running. The backend returns "generating" if a fresh run is already
          // in progress, or restarts a stale/stuck run (e.g. one interrupted by
          // a server restart), so full details always load.
          setStatus("generating");
          fetch(`/api/domain-scan/${scanId}/attack-scenarios`, { method: "POST" })
            .then(r => r.json())
            .then((d: { status: string; result?: AttackScenariosResult }) => {
              if (d.status === "complete" && d.result) {
                completeWithTransition(d.result);
              }
            })
            .catch(() => setStatus("error"));
        }
      })
      .catch(() => {});
  }, [scanId]);

  // Poll while generating, with a hard timeout so it never spins forever
  useEffect(() => {
    if (status !== "generating") return;
    const startedAt = Date.now();
    const MAX_WAIT_MS = 2 * 60 * 1000; // Haiku model target ~20-30s; 2min is generous headroom
    const interval = setInterval(() => {
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        setStatus("error");
        clearInterval(interval);
        return;
      }
      fetch(`/api/domain-scan/${scanId}/attack-scenarios`)
        .then(r => r.json())
        .then((data: { status: string; result: AttackScenariosResult | null }) => {
          if (data.status === "complete" && data.result) {
            clearInterval(interval);
            completeWithTransition(data.result);
          } else if (data.status === "error") {
            setStatus("error");
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, [status, scanId]);

  const generate = useCallback(() => {
    setStatus("generating");
    fetch(`/api/domain-scan/${scanId}/attack-scenarios`, { method: "POST" })
      .then(r => r.json())
      .then((data: { status: string; result?: AttackScenariosResult }) => {
        if (data.status === "complete" && data.result) {
          completeWithTransition(data.result);
        }
      })
      .catch(() => setStatus("error"));
  }, [scanId, completeWithTransition]);

  const threatColor = (level: string) => {
    if (level === "Kritik") return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400";
    if (level === "Yüksek") return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900 dark:text-orange-400";
    if (level === "Orta") return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900 dark:text-yellow-500";
    return "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400";
  };

  const probabilityBadge = (level: string) => {
    if (level === "Yüksek") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400";
    if (level === "Orta") return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
  };

  const urgencyBadge = (level: string) => {
    if (level === "Acil") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400";
    if (level === "Yüksek") return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
    return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-500";
  };

  // idle → show CTA
  if (status === "idle") {
    return (
      <div className="rounded-2xl border-2 border-destructive/20 bg-gradient-to-br from-destructive/5 to-background p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-destructive/10 shrink-0 mt-0.5">
              <Swords className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground mb-0.5">Saldırı Senaryosu Analizi</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                  Tarama bulgularını analiz ederek bu domaine yönelik en olası saldırı zincirlerini,
                MITRE ATT&CK eşleştirmeleri ve KVKK etkisiyle birlikte oluşturur.
              </p>
            </div>
          </div>
          <Button
            onClick={generate}
            className="shrink-0 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <Sparkles className="h-4 w-4" />
            Analizi Oluştur
          </Button>
        </div>
      </div>
    );
  }

  // generating (or finishing transition) → stepped progress bar
  if (status === "generating" || isFinishing) {
    const currentStep = ATTACK_GEN_STEPS.findIndex((s) => {
      const elapsed = genStartRef.current ? Date.now() - genStartRef.current : 0;
      return elapsed <= s.endMs;
    });
    // SSE overrides the time-based step when connected; finishing always snaps to last
    const activeStep = isFinishing
      ? ATTACK_GEN_STEPS.length - 1
      : sseStep !== null
        ? sseStep
        : (currentStep === -1 ? ATTACK_GEN_STEPS.length - 1 : currentStep);
    return (
      <Card
        className={`shadow-sm border-destructive/20 transition-opacity duration-500 ${
          isFinishing ? "opacity-0" : "opacity-100"
        }`}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
              <Swords className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Saldırı Senaryosu Analizi</p>
              <p className="text-xs text-muted-foreground">Yapay zeka tehdit modeli oluşturuyor...</p>
            </div>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground font-medium">
                {ATTACK_GEN_STEPS[activeStep].label}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(genProgress)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-destructive transition-all duration-300 ease-out"
                style={{ width: `${genProgress}%` }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2">
            {ATTACK_GEN_STEPS.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full h-1 rounded-full transition-all duration-500 ${
                      done
                        ? "bg-destructive"
                        : active
                        ? "bg-destructive/50"
                        : "bg-muted"
                    }`}
                  />
                  <span
                    className={`text-[10px] text-center leading-tight transition-colors duration-300 ${
                      done || active ? "text-foreground/70" : "text-muted-foreground/40"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // error state
  if (status === "error") {
    return (
      <Card className="shadow-sm border-destructive/30">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-muted-foreground">Analiz oluşturulamadı. Lütfen tekrar deneyin.</p>
          </div>
          <Button variant="outline" size="sm" onClick={generate}>Tekrar Dene</Button>
        </CardContent>
      </Card>
    );
  }

  // complete — full result
  if (!result) return null;

  return (
    <div className="space-y-3">
      {/* Header card */}
      <Card className="shadow-sm border-destructive/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Swords className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base">Saldırı Senaryosu Analizi</CardTitle>
                <CardDescription className="text-xs mt-0.5">MITRE ATT&CK eşleştirmeli Tehdit Modeli</CardDescription>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${threatColor(result.genel_tehdit_seviyesi)}`}>
              <AlertOctagon className="h-3.5 w-3.5" />
              {result.genel_tehdit_seviyesi} Tehdit
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3 border border-border/60">
            {result.risk_ozet}
          </p>
        </CardContent>
      </Card>

      {/* Scenarios */}
      {result.senaryolar.map((scenario, idx) => (
        <Card key={idx} className="shadow-sm overflow-hidden">
          <button
            className="w-full text-left"
            onClick={() => setExpanded(expanded === idx ? null : idx)}
          >
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-1.5 rounded-md bg-destructive/10 shrink-0 mt-0.5">
                  <Target className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{scenario.baslik}</span>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${probabilityBadge(scenario.olasilik)}`}>
                      Olasılık: {scenario.olasilik}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyBadge(scenario.acillik)}`}>
                      <Zap className="h-3 w-3" />
                      {scenario.acillik}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{scenario.giris_noktasi}</p>
                </div>
              </div>
              {expanded === idx
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              }
            </div>
          </button>

          {expanded === idx && (
            <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">
              {/* Entry point */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Giriş Noktası
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">{scenario.giris_noktasi}</p>
              </div>

              {/* Attack chain */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5" /> Saldırı Zinciri
                </p>
                <ol className="space-y-1.5">
                  {scenario.saldiri_zinciri.map((step, si) => (
                    <li key={si} className="flex items-start gap-2.5 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center mt-0.5">
                        {si + 1}
                      </span>
                      <span className="text-foreground/80 leading-relaxed">{step.replace(/^\d+\.\s*[^:]+:\s*/, "").replace(/^\d+\.\s*/, "")}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* MITRE techniques */}
              {scenario.mitre_teknikler.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Bug className="h-3.5 w-3.5" /> MITRE ATT&CK Teknikleri
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scenario.mitre_teknikler.map((t, ti) => (
                      <a
                        key={ti}
                        href={`https://attack.mitre.org/techniques/${t.kod.replace(".", "/")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <span className="font-bold text-primary">{t.kod}</span>
                        <span className="text-muted-foreground">·</span>
                        {t.isim}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact + KVKK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 p-3">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> İş Etkisi
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{scenario.etki}</p>
                </div>
                <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" /> KVKK Riski
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{scenario.kvkk_etkisi}</p>
                </div>
              </div>

              {/* Immediate actions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-yellow-500" /> Acil Önlemler
                </p>
                <ul className="space-y-1">
                  {scenario.acil_onlemler.map((action, ai) => (
                    <li key={ai} className="flex items-start gap-2 text-xs text-foreground/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {action.replace(/^\d+\.\s*/, "")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      ))}

      {/* Priority fixes */}
      {result.once_kapat.length > 0 && (
        <Card className="shadow-sm border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-500" />
              Onceliklı Aksiyonlar
            </CardTitle>
            <CardDescription className="text-xs">Tüm senaryolara göre en kritik 3 kapatma noktası</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {result.once_kapat.map((item) => (
              <div key={item.oncelik} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/30">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center">
                  {item.oncelik}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.aksiyon}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.neden}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DomainScanPage() {
  usePageMeta({
    title: "Ücretsiz Domain Güvenlik Taraması | CyberStep.io",
    description: "SPF, DKIM, DMARC, SSL, kara liste, dark web sızıntı — tek taramada tüm güvenlik kontrolü. Ücretsiz, anında sonuç.",
    keywords: "domain güvenlik tarama, ssl kontrol, dmarc kontrol, domain blacklist kontrol, dark web sorgulama",
    canonicalPath: "/domain-tarama",
  });
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [attackTeaserStatus, setAttackTeaserStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [attackTeaser, setAttackTeaser] = useState<{
    totalScenarios: number;
    yuksek: number;
    orta: number;
    dusuk: number;
    overallLevel: string;
  } | null>(null);

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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/domain-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), email: email.trim() }),
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

  const { data: sessionCustomer } = useQuery<{ subscriptionPlan: string | null } | null>({
    queryKey: ["customer-me-scan"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
    staleTime: 60_000,
  });
  const hasFullAccess = ["full", "pro"].includes(sessionCustomer?.subscriptionPlan ?? "");

  // ── DNS İzleme hooks (sadece oturum açık müşteriler) ──────────────────────
  const {
    data: dnsWatchedDomains = [],
    refetch: refetchDnsWatched,
  } = useQuery<{ id: number; domain: string; is_active: boolean; last_checked_at: string | null }[]>({
    queryKey: ["portal-dns-domains-scan"],
    queryFn: () =>
      fetch("/api/portal/dns-monitor/domains", { credentials: "include" })
        .then(r => r.ok ? r.json() as Promise<{ id: number; domain: string; is_active: boolean; last_checked_at: string | null }[]> : []),
    enabled: !!sessionCustomer,
    staleTime: 30_000,
  });

  const dnsWatchedEntry = result
    ? dnsWatchedDomains.find(d => d.domain === result.domain) ?? null
    : null;

  const { data: dnsSnapshot } = useQuery<{
    a_records: unknown; mx_records: unknown; ns_records: unknown;
    txt_records: unknown; cname_records: unknown; checked_at: string;
  } | null>({
    queryKey: ["portal-dns-snapshot-scan", result?.domain],
    queryFn: () =>
      result?.domain
        ? fetch(`/api/portal/dns-monitor/snapshot/${encodeURIComponent(result.domain)}`, { credentials: "include" })
            .then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
    enabled: !!sessionCustomer && !!dnsWatchedEntry,
    staleTime: 60_000,
  });

  const { data: dnsChangesRaw = [] } = useQuery<{ id: number; domain: string; record_type: string; old_values: unknown; new_values: unknown; severity: string; detected_at: string }[]>({
    queryKey: ["portal-dns-changes-scan"],
    queryFn: () =>
      fetch("/api/portal/dns-monitor/changes", { credentials: "include" })
        .then(r => r.ok ? r.json() : []),
    enabled: !!sessionCustomer && !!dnsWatchedEntry,
    staleTime: 30_000,
  });
  const dnsChanges = result ? dnsChangesRaw.filter(c => c.domain === result.domain) : [];

  // ── CT Log sertifika olayları (sadece izlenen domain varsa) ───────────────
  type CtEventRow = {
    id: number; domain: string; cert_domain: string; issuer: string | null;
    sans: string[]; not_before: string | null; not_after: string | null;
    cert_fingerprint: string | null; detected_at: string; is_suspicious: boolean;
  };
  const { data: ctEventsRaw = [] } = useQuery<CtEventRow[]>({
    queryKey: ["portal-ct-events-scan", result?.domain],
    queryFn: (): Promise<CtEventRow[]> => {
      const params = new URLSearchParams({ limit: "20" });
      if (result?.domain) params.set("domain", result.domain);
      return fetch(`/api/portal/ct-monitor/events?${params}`, { credentials: "include" })
        .then(r => r.ok ? (r.json() as Promise<{ events: CtEventRow[] }>).then(d => d.events ?? []) : []);
    },
    enabled: !!sessionCustomer && !!dnsWatchedEntry,
    staleTime: 60_000,
  });
  const ctEvents = result ? ctEventsRaw.filter((e: CtEventRow) => e.domain === result.domain) : [];

  const addDnsMutation = useMutation({
    mutationFn: (domain: string) =>
      fetch("/api/portal/dns-monitor/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain }),
      }).then(async r => {
        if (!r.ok) {
          const b = await r.json() as { error?: string };
          throw new Error(b.error ?? "Hata");
        }
        return r.json();
      }),
    onSuccess: () => { void refetchDnsWatched(); },
  });

  const removeDnsMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/portal/dns-monitor/domains/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { void refetchDnsWatched(); },
  });
  // ─────────────────────────────────────────────────────────────────────────

  // Auto-trigger attack scenarios when scan completes, poll for teaser data
  useEffect(() => {
    if (!result?.id) { setAttackTeaserStatus("idle"); setAttackTeaser(null); return; }
    setAttackTeaserStatus("loading");
    fetch(`/api/domain-scan/${result.id}/attack-scenarios`)
      .then(r => r.json())
      .then((data: { status: string; result: AttackScenariosResult | null }) => {
        if (data.status === "complete" && data.result) {
          const scenarios = data.result.senaryolar ?? [];
          setAttackTeaser({
            totalScenarios: scenarios.length,
            yuksek: scenarios.filter(s => s.olasilik === "Yüksek").length,
            orta: scenarios.filter(s => s.olasilik === "Orta").length,
            dusuk: scenarios.filter(s => s.olasilik === "Düşük").length,
            overallLevel: data.result.genel_tehdit_seviyesi,
          });
          setAttackTeaserStatus("ready");
        }
      })
      .catch(() => {});
  }, [result?.id]);

  useEffect(() => {
    if (attackTeaserStatus !== "loading" || !result?.id) return;
    const id = result.id;
    const interval = setInterval(() => {
      fetch(`/api/domain-scan/${id}/attack-scenarios`)
        .then(r => r.json())
        .then((data: { status: string; result: AttackScenariosResult | null }) => {
          if (data.status === "complete" && data.result) {
            const scenarios = data.result.senaryolar ?? [];
            setAttackTeaser({
              totalScenarios: scenarios.length,
              yuksek: scenarios.filter(s => s.olasilik === "Yüksek").length,
              orta: scenarios.filter(s => s.olasilik === "Orta").length,
              dusuk: scenarios.filter(s => s.olasilik === "Düşük").length,
              overallLevel: data.result.genel_tehdit_seviyesi,
            });
            setAttackTeaserStatus("ready");
            clearInterval(interval);
          } else if (data.status === "error") {
            setAttackTeaserStatus("idle");
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [attackTeaserStatus, result?.id]);

  const handleBuyDomainScan = useCallback(async () => {
    if (!result?.id || !result?.domain) return;
    try {
      const res = await fetch("/api/domain-scan/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || result.email, domain: result.domain, scanId: result.id }),
      });
      const data = await res.json() as { id?: number };
      window.location.href = `/fiyatlar?from=domain-scan&ref=${data.id ?? ""}&email=${encodeURIComponent(email || "")}`;
    } catch { /* silent */ }
  }, [result, email]);

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
                E-posta <span className="text-red-500">*</span>
                <span className="text-muted-foreground text-xs ml-1">(rapor + 30 günlük izleme bildirimleri)</span>
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
            disabled={!domain.trim() || !isEmailValid || scanMutation.isPending}
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
          {/* ── TEHDİT ANALİZİ BANNER ─────────────────────────────────── */}
          {attackTeaserStatus === "loading" && (
            <div className="mb-6 rounded-xl border-2 border-orange-400/60 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-500/40 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="relative shrink-0">
                  <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-orange-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-orange-800 dark:text-orange-300">
                    MITRE ATT&CK Tehdit Analizi Çalışıyor
                  </p>
                  <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-0.5">
                    Saldırı senaryoları ve risk derecelendirmesi hesaplanıyor — bu birkaç dakika sürebilir. Rapor analiz bittikten sonra e-postanıza gönderilecek.
                  </p>
                </div>
                <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                  <span className="text-xs text-orange-600/70 dark:text-orange-400/60 font-medium">Analiz ediliyor...</span>
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="h-1.5 w-5 rounded-full bg-orange-300 dark:bg-orange-700 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  {/* Sektör karşılaştırması */}
                  <div className="mt-2 text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted/30 flex items-center gap-2">
                    <span className="shrink-0">
                      {result.overallScore >= 86
                        ? "CyberStep'te taranan domainlerin %92'si bu skorun altındadır — üst %8 güvenlik profili"
                        : result.overallScore >= 76
                        ? "CyberStep'te taranan domainlerin %78'i bu skorun altındadır — sektör ortalamasının belirgin üstünde"
                        : result.overallScore >= 61
                        ? "CyberStep'te taranan domainlerin %62'si bu skorun altındadır — sektör ortalaması civarında"
                        : result.overallScore >= 41
                        ? "CyberStep'te taranan domainlerin %55'i bu skorun üstündedir — iyileştirme fırsatı var"
                        : "CyberStep'te taranan domainlerin %82'si bu skorun üstündedir — acil iyileştirme gerekiyor"}
                    </span>
                    <a href="/roi-hesaplayici" className="ml-auto shrink-0 text-primary hover:underline whitespace-nowrap font-medium">
                      Risk Maliyeti Hesapla →
                    </a>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => downloadScanPDF(result.id, result.domain)}
                      disabled={downloadingPDF || attackTeaserStatus === "loading"}
                      title={attackTeaserStatus === "loading" ? "MITRE analizi tamamlanana kadar bekleyin" : undefined}
                    >
                      {attackTeaserStatus === "loading" ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />MITRE Analizi Bekleniyor...</>
                      ) : downloadingPDF ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />PDF Hazırlanıyor...</>
                      ) : (
                        <><Download className="h-3.5 w-3.5 mr-1.5" />PDF Olarak İndir</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* E-posta durumu: analiz bitmeden "bekliyor", bittikten sonra "gönderildi" */}
          {attackTeaserStatus === "loading" ? (
            <Card className="mb-6 border-orange-200/60 bg-orange-50/40 dark:bg-orange-950/10 dark:border-orange-800/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Rapor hazırlanıyor...</p>
                  <p className="text-xs text-muted-foreground">Tehdit analizi tamamlandıktan sonra <span className="font-medium">{result.email ?? email}</span> adresine gönderilecek.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Rapor <span className="text-primary">{result.email ?? email}</span> adresine gönderildi</p>
                  <p className="text-xs text-muted-foreground">30 gün içinde alan adı değişikliklerini ve güvenlik uyarılarını e-posta ile alacaksınız.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── DETAYLI RAPOR (tam erişim) veya LOCKED GATE ─────────────── */}
          {hasFullAccess ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 overflow-hidden mb-6">
              <div className="bg-emerald-50/60 dark:bg-emerald-900/20 px-5 py-3 border-b border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold">Detaylı Güvenlik Raporu</span>
                <Badge variant="outline" className="text-xs ml-auto border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30">Tam Erişim</Badge>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* E-posta & SSL */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <p className="text-sm font-semibold">E-posta & SSL Güvenliği</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "SPF", pass: result.spfPass, detail: result.spfRecord ?? "Kayıt yok" },
                      { label: "DMARC", pass: result.dmarcPass, detail: result.dmarcRecord ?? "Kayıt yok" },
                      { label: "DKIM", pass: result.dkimPass, detail: result.dkimSelectors.length > 0 ? result.dkimSelectors.join(", ") : "Tespit edilemedi" },
                      { label: "MX", pass: result.mxPass, detail: result.mxRecords.length > 0 ? result.mxRecords[0].exchange : "Kayıt yok" },
                      { label: "SSL", pass: result.sslPass, detail: result.sslExpiry ? `Son: ${new Date(result.sslExpiry).toLocaleDateString("tr-TR")}${result.sslDaysUntilExpiry !== null ? ` (${result.sslDaysUntilExpiry} gün)` : ""}` : "Sertifika yok" },
                    ].map(({ label, pass, detail }) => (
                      <div key={label} className={`rounded-lg p-3 text-xs border ${pass ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {pass ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                          <span className="font-semibold">{label}</span>
                        </div>
                        <p className="text-muted-foreground truncate" title={detail}>{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HTTP Başlıkları */}
                {result.httpHeadersDetails && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="h-4 w-4 text-violet-500" />
                      <p className="text-sm font-semibold">Web Sunucu Güvenlik Başlıkları</p>
                      <span className={`text-xs ml-auto font-medium ${result.httpHeadersScore >= 80 ? "text-green-600" : result.httpHeadersScore >= 60 ? "text-amber-600" : "text-red-600"}`}>{result.httpHeadersScore}/100</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries({
                        "HSTS": result.httpHeadersDetails.hsts,
                        "CSP": result.httpHeadersDetails.csp,
                        "X-Frame-Options": result.httpHeadersDetails.xFrameOptions,
                        "X-Content-Type": result.httpHeadersDetails.xContentTypeOptions,
                        "Referrer Policy": result.httpHeadersDetails.referrerPolicy,
                      }) as [string, boolean][]).map(([key, val]) => (
                        <span key={key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${val ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {val ? "✓" : "✗"} {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk İstihbaratı */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DatabaseZap className="h-4 w-4 text-red-500" />
                    <p className="text-sm font-semibold">Risk İstihbaratı</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      {result.hibpBreachCount === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                      <span><span className="font-medium">HIBP Veri Sızıntısı: </span>{result.hibpBreachCount === 0 ? "Kayıtlı sızıntı yok" : `${result.hibpBreachCount} sızıntı kaydı bulundu`}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      {!result.blacklisted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                      <span><span className="font-medium">Kara Liste: </span>{result.blacklisted ? `${result.blacklistCount} listede işaretli` : "Hiçbir kara listede değil"}</span>
                    </div>
                    {result.urlhausListed && (
                      <div className="flex items-start gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span><span className="font-medium">URLHaus: </span>Zararlı URL veritabanında kayıtlı{result.urlhausThreat ? ` — ${result.urlhausThreat}` : ""}</span>
                      </div>
                    )}
                    {result.usomListed && (
                      <div className="flex items-start gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span><span className="font-medium">BTK USOM: </span>Zararlı alan adı listesinde</span>
                      </div>
                    )}
                    {result.virusTotalReputation !== null && (
                      <div className="flex items-start gap-2">
                        {result.virusTotalMalicious === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                        <span><span className="font-medium">VirusTotal: </span>{result.virusTotalMalicious === 0 ? `Temiz (itibar: ${result.virusTotalReputation})` : `${result.virusTotalMalicious} motor zararlı işaretledi`}</span>
                      </div>
                    )}
                    {result.abuseIpdbScore !== null && (
                      <div className="flex items-start gap-2">
                        {result.abuseIpdbScore < 25 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                        <span><span className="font-medium">IP Kötüye Kullanım: </span>Güven skoru %{result.abuseIpdbScore}{result.abuseIpdbTotalReports > 0 ? ` — ${result.abuseIpdbTotalReports} rapor` : ""}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CVE Güvenlik Açıkları */}
                {result.cveSummary.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bug className="h-4 w-4 text-orange-500" />
                      <p className="text-sm font-semibold">CVE Güvenlik Açıkları ({result.cveSummary.length})</p>
                    </div>
                    <div className="space-y-1.5">
                      {result.cveSummary.slice(0, 5).map(cve => (
                        <div key={cve.cveId} className="flex items-start gap-2 text-xs">
                          <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded text-white text-[10px] ${cve.cvssScore >= 9 ? "bg-red-600" : cve.cvssScore >= 7 ? "bg-orange-500" : "bg-amber-500"}`}>
                            {cve.cvssScore.toFixed(1)}
                          </span>
                          <span className="font-medium text-foreground shrink-0">{cve.cveId}</span>
                          <span className="text-muted-foreground truncate">{cve.service}: {cve.description.substring(0, 80)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shadow IT */}
                {result.shadowItServices.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Network className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-semibold">Shadow IT Tespiti ({result.shadowItServices.length} servis)</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.shadowItServices.map((svc, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${svc.risk === "yüksek" ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-400" : svc.risk === "orta" ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400" : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}>
                          {svc.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* MITRE ATT&CK — tam saldırı senaryosu analizi (tam erişim) */}
                <div className="px-5 py-4 bg-orange-50/40 dark:bg-orange-950/10 border-t border-orange-200/60 dark:border-orange-900/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="h-4 w-4 text-orange-500 shrink-0" />
                    <p className="text-sm font-semibold">Yapay Zeka Saldırı Senaryosu Analizi (MITRE ATT&CK)</p>
                  </div>
                  <AttackScenarioPanel scanId={result.id} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
              {/* Header */}
              <div className="bg-slate-50 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Detaylı Güvenlik Raporu — Ücretli Pakete Dahil</span>
              </div>

              {/* Tehdit analizi teaser */}
              {attackTeaserStatus === "ready" && attackTeaser && (
                <div className="px-5 py-4 bg-red-50/60 dark:bg-red-950/20 border-b border-red-200/60 dark:border-red-900/40">
                  <div className="flex items-center gap-2 mb-2.5">
                    <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      Tehdit Analizi Tamamlandı — {attackTeaser.overallLevel} Tehdit Seviyesi
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attackTeaser.yuksek > 0 && (
                      <span className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        {attackTeaser.yuksek} Kritik Senaryo
                      </span>
                    )}
                    {attackTeaser.orta > 0 && (
                      <span className="inline-flex items-center gap-1.5 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                        {attackTeaser.orta} Orta Risk
                      </span>
                    )}
                    {attackTeaser.dusuk > 0 && (
                      <span className="inline-flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                        {attackTeaser.dusuk} Düşük Risk
                      </span>
                    )}
                    {attackTeaser.totalScenarios === 0 && (
                      <span className="text-xs text-muted-foreground">Senaryo üretilemedi</span>
                    )}
                  </div>
                  <p className="text-xs text-red-600/80 dark:text-red-400/70">
                    Saldırı zinciri detayları, MITRE ATT&CK haritalama ve aksiyon planı ücretli pakette görüntülenir.
                  </p>
                </div>
              )}

              {/* Gated categories — blurred previews */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 select-none pointer-events-none">
                {[
                  {
                    icon: Mail,
                    title: "E-posta & SSL Güvenliği",
                    items: ["SPF kaydı durumu", "DMARC yapılandırması", "DKIM doğrulaması", "MX kayıtları", "SSL sertifikası"],
                    color: "text-blue-500",
                  },
                  {
                    icon: Server,
                    title: "Web Sunucu Başlıkları",
                    items: ["HSTS", "Content Security Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer Policy"],
                    color: "text-violet-500",
                  },
                  {
                    icon: DatabaseZap,
                    title: "Risk İstihbaratı (10 kaynak)",
                    items: ["Have I Been Pwned sızıntıları", "Kara liste kontrolü", "Açık port taraması", "VirusTotal itibar", "IP İstihbaratı · URLhaus · USOM · CVE"],
                    color: "text-red-500",
                  },
                  {
                    icon: Network,
                    title: "İş Sürekliliği Haritası",
                    items: ["Shadow IT tespiti", "3. parti bağımlılıklar", "Kritik servis riskleri", "Alternatif öneriler"],
                    color: "text-amber-500",
                  },
                  {
                    icon: Swords,
                    title: "Saldırı Senaryosu Analizi (MITRE ATT&CK)",
                    items: ["AI destekli saldırı zinciri", "CISA KEV eşleşmeleri", "AlienVault OTX tehdit pulsu", "Öncelikli aksiyon planı"],
                    color: "text-orange-500",
                  },
                ].map(({ icon: Icon, title, items, color }) => (
                  <div key={title} className="px-5 py-4 flex items-start gap-4 opacity-60">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1.5">{title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(i => (
                          <span key={i} className="text-xs bg-slate-100 dark:bg-slate-700 text-muted-foreground px-2 py-0.5 rounded-full">{i}</span>
                        ))}
                      </div>
                    </div>
                    <Lock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
                  </div>
                ))}
              </div>

              {/* Upsell CTA — 2 seçenek */}
              <div className="bg-gradient-to-b from-transparent via-primary/5 to-primary/10 px-5 py-5 border-t border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tüm detaylara erişmek için</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Ücretli tek tarama */}
                  <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 flex flex-col gap-2">
                    <div>
                      <p className="font-bold text-sm text-primary">Ücretli Alan Adı Taraması</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Bu domain için tek seferlik tam rapor. Değerlendirme gerekmez.</p>
                    </div>
                    <p className="text-xl font-black text-foreground">990 TL <span className="text-xs font-normal text-muted-foreground">+ KDV</span></p>
                    <button
                      onClick={handleBuyDomainScan}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
                    >
                      Hemen Satın Al <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Ücretsiz değerlendirme */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
                    <div>
                      <p className="font-bold text-sm">Ücretsiz Değerlendirme</p>
                      <p className="text-xs text-muted-foreground mt-0.5">20 soruluk mini risk değerlendirmesi + tarama detayları dahil.</p>
                    </div>
                    <p className="text-xl font-black text-foreground">Ücretsiz</p>
                    <a
                      href="/assessment/start"
                      className="w-full inline-flex items-center justify-center gap-1.5 border border-primary/30 text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-primary/5 transition-colors"
                    >
                      Değerlendirmeye Başla <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── END DETAYLI RAPOR / LOCKED GATE ─────────────────────────── */}

          {/* ── DNS İzleme Paneli ────────────────────────────────────────── */}
          {sessionCustomer ? (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 overflow-hidden mb-6">
              <div className="bg-blue-50/60 dark:bg-blue-900/20 px-5 py-3 border-b border-blue-200 dark:border-blue-800/40 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold">DNS Değişiklik İzleme</span>
                {dnsWatchedEntry && (
                  <Badge variant="outline" className="text-xs ml-1 border-green-500/40 text-green-600 bg-green-50 dark:bg-green-900/30">Aktif</Badge>
                )}
                <div className="ml-auto">
                  {dnsWatchedEntry ? (
                    <button
                      onClick={() => removeDnsMutation.mutate(dnsWatchedEntry.id)}
                      disabled={removeDnsMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      {removeDnsMutation.isPending ? "Kaldırılıyor..." : "İzlemeyi Durdur"}
                    </button>
                  ) : (
                    <button
                      onClick={() => result && addDnsMutation.mutate(result.domain)}
                      disabled={addDnsMutation.isPending}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                    >
                      {addDnsMutation.isPending ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />Ekleniyor...</>
                      ) : (
                        <>+ İzlemeye Ekle</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!dnsWatchedEntry ? (
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>{result?.domain}</strong> için A, MX, NS, TXT ve CNAME kayıtlarını her 5 dakikada izleyin.
                    Yetkisiz değişikliklerde anında SOC vakası açılır ve e-posta uyarısı gönderilir.
                  </p>
                  {addDnsMutation.isError && (
                    <p className="text-xs text-red-500 mt-2">{(addDnsMutation.error as Error).message}</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Güncel Snapshot */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Güncel DNS Kayıtları
                      {dnsSnapshot && (
                        <span className="ml-2 font-normal normal-case">
                          — {new Date(dnsSnapshot.checked_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </p>
                    {dnsSnapshot ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {(["A","MX","NS","TXT","CNAME"] as const).map(type => {
                          const val = dnsSnapshot[`${type.toLowerCase()}_records` as keyof typeof dnsSnapshot] as unknown;
                          const isEmpty = !val || (Array.isArray(val) && val.length === 0);
                          return (
                            <div key={type} className="rounded-lg border bg-muted/30 p-2.5">
                              <p className="font-bold text-xs font-mono mb-1">{type}</p>
                              <p className={`text-xs font-mono truncate ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>
                                {isEmpty ? "(boş)" : (
                                  type === "MX"
                                    ? (val as Array<{ priority: number; exchange: string }>).map(r => r.exchange).join(", ")
                                    : type === "TXT"
                                    ? (val as string[][]).map(r => r.join("")).join(" ")
                                    : (val as string[]).join(", ")
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">İlk snapshot bekleniyor (sonraki 5 dk içinde)...</p>
                    )}
                  </div>

                  {/* Değişiklik Geçmişi */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      DNS Değişiklik Geçmişi
                      {dnsChanges.length > 0 && (
                        <span className="ml-2 font-normal normal-case text-orange-600">{dnsChanges.length} değişiklik</span>
                      )}
                    </p>
                    {dnsChanges.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Henüz değişiklik tespit edilmedi. DNS kayıtları stabil.</p>
                    ) : (
                      <div className="space-y-2">
                        {dnsChanges.slice(0, 5).map(c => {
                          const sevColor = c.severity === "critical" ? "bg-red-50 border-red-200" : c.severity === "high" ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200";
                          const sevLabel = c.severity === "critical" ? "Kritik" : c.severity === "high" ? "Yüksek" : c.severity === "medium" ? "Orta" : "Düşük";
                          return (
                            <div key={c.id} className={`rounded-lg border p-3 ${sevColor}`}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-bold text-xs bg-white/80 px-1.5 py-0.5 rounded border font-mono">{c.record_type}</span>
                                <Badge variant="outline" className="text-xs px-1.5 py-0 border">
                                  {sevLabel}
                                </Badge>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(c.detected_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                                <div className="bg-red-50 text-red-700 px-2 py-1 rounded truncate">
                                  {Array.isArray(c.old_values) && c.old_values.length === 0 ? "(boş)" : JSON.stringify(c.old_values).slice(0, 60)}
                                </div>
                                <div className="bg-green-50 text-green-700 px-2 py-1 rounded truncate">
                                  {Array.isArray(c.new_values) && c.new_values.length === 0 ? "(boş)" : JSON.stringify(c.new_values).slice(0, 60)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {dnsChanges.length > 5 && (
                          <a href="/hesabim/dns-izleme" className="text-xs text-primary hover:underline flex items-center gap-1">
                            Tüm değişiklikleri gör ({dnsChanges.length}) <ArrowRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : result && (
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-800/30 p-5 mb-6">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">DNS Değişikliklerini İzleyin</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Üye olun — A, MX, NS, TXT kayıtlarındaki her değişiklikte anında uyarı alın.
                  </p>
                </div>
                <a href="/kayit" className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                  Üye Ol <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
          {/* ── END DNS İzleme Paneli ─────────────────────────────────────── */}

          {/* ── CT Log Sertifika Olayları ─────────────────────────────────── */}
          {sessionCustomer && dnsWatchedEntry && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Lock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Sertifika Olayları</p>
                  <p className="text-xs text-muted-foreground">
                    Certstream CT Log akışından gerçek zamanlı SSL sertifika izleme
                  </p>
                </div>
                {ctEvents.some(e => e.is_suspicious) && (
                  <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">
                    {ctEvents.filter(e => e.is_suspicious).length} Şüpheli
                  </Badge>
                )}
              </div>
              <div className="px-5 py-4">
                {ctEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Henüz sertifika olayı tespit edilmedi. CT Log akışı gerçek zamanlı izleniyor.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ctEvents.slice(0, 5).map(ev => (
                      <div
                        key={ev.id}
                        className={`rounded-lg border p-3 ${ev.is_suspicious ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 mt-0.5">
                            {ev.is_suspicious
                              ? <AlertTriangle className="h-4 w-4 text-red-500" />
                              : <CheckCircle2 className="h-4 w-4 text-slate-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="font-mono text-xs font-semibold truncate">{ev.cert_domain}</span>
                              {ev.is_suspicious && (
                                <Badge className="text-xs px-1.5 py-0 bg-red-100 text-red-700 border border-red-200 shrink-0">
                                  Phishing Riski
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                {new Date(ev.detected_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            {ev.issuer && (
                              <p className="text-xs text-muted-foreground">CA: {ev.issuer}</p>
                            )}
                            {ev.not_after && (
                              <p className="text-xs text-muted-foreground">
                                Geçerlilik: {new Date(ev.not_after).toLocaleDateString("tr-TR")}
                              </p>
                            )}
                            {Array.isArray(ev.sans) && ev.sans.length > 1 && (
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                SANs: {ev.sans.slice(0, 3).join(", ")}
                                {ev.sans.length > 3 ? ` +${ev.sans.length - 3}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {ctEvents.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        Toplam {ctEvents.length} sertifika olayı
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* ── END CT Log Sertifika Olayları ─────────────────────────────── */}

          {/* Değerlendirme Upsell Köprüsü */}
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Domain taraması bir başlangıç
                </p>
                <p className="text-base font-bold text-foreground mb-1">
                  Şirketinizin tüm siber risk tablosunu görün
                </p>
                <p className="text-sm text-muted-foreground">
                  Bu tarama alan adı güvenliğini ölçer. Çalışan farkındalığı, cihaz koruması, erişim yönetimi ve KVKK
                  uyumu için 20 dakikalık ücretsiz değerlendirmeye geçin.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  href="/assessment/start"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5 py-2.5 rounded-lg text-sm"
                >
                  Ücretsiz Değerlendirme Başlat
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>
                <a
                  href="/assessment/full/start"
                  className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/5 font-medium px-5 py-2 rounded-lg text-xs"
                >
                  Tam Değerlendirme — 5.990 TL
                </a>
              </div>
            </div>
          </div>
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
