import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
function AttackScenarioPanel({ scanId }: { scanId: number }) {
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [result, setResult] = useState<AttackScenariosResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);

  // Check for cached result on mount
  useEffect(() => {
    fetch(`/api/domain-scan/${scanId}/attack-scenarios`)
      .then(r => r.json())
      .then((data: { status: string; result: AttackScenariosResult | null }) => {
        if (data.status === "complete" && data.result) {
          setResult(data.result);
          setStatus("complete");
        } else if (data.status === "generating") {
          setStatus("generating");
        }
      })
      .catch(() => {});
  }, [scanId]);

  // Poll while generating
  useEffect(() => {
    if (status !== "generating") return;
    const interval = setInterval(() => {
      fetch(`/api/domain-scan/${scanId}/attack-scenarios`)
        .then(r => r.json())
        .then((data: { status: string; result: AttackScenariosResult | null }) => {
          if (data.status === "complete" && data.result) {
            setResult(data.result);
            setStatus("complete");
            clearInterval(interval);
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
          setResult(data.result);
          setStatus("complete");
        }
      })
      .catch(() => setStatus("error"));
  }, [scanId]);

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

  // generating → loading state
  if (status === "generating") {
    return (
      <Card className="shadow-sm border-destructive/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Swords className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-sm">Saldırı Senaryosu Analizi</p>
              <p className="text-xs text-muted-foreground">Tehdit modeli oluşturuyor...</p>
            </div>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
          </div>
          <div className="space-y-2.5">
            {[90, 75, 60].map((w, i) => (
              <div key={i} className="space-y-1">
                <div className={`h-4 rounded bg-muted animate-pulse`} style={{ width: `${w}%` }} />
                <div className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${w - 15}%` }} />
              </div>
            ))}
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
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [wpModalOpen, setWpModalOpen] = useState(false);
  const [attackTeaserStatus, setAttackTeaserStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [attackTeaser, setAttackTeaser] = useState<{
    totalScenarios: number;
    yuksek: number;
    orta: number;
    dusuk: number;
    overallLevel: string;
  } | null>(null);
  const [wpForm, setWpForm] = useState({ title: "", category: "E-posta Güvenliği", priority: "high", description: "", estimatedCost: "" });
  const [wpDone, setWpDone] = useState(false);

  const WP_CATEGORIES = ["E-posta Güvenliği","KVKK / Uyum","IT Altyapı","Penetrasyon Testi","Siber Sigorta","Bulut Güvenliği","SOC / İzleme","Eğitim","Diğer"];

  const createWpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/work-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          domainScanId: result?.id ?? undefined,
          domain: result?.domain ?? undefined,
          scoreBefore: result?.overallScore ?? undefined,
          title: wpForm.title,
          category: wpForm.category,
          priority: wpForm.priority,
          description: wpForm.description || undefined,
          estimatedCost: wpForm.estimatedCost ? Number(wpForm.estimatedCost) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Oluşturulamadı");
      return res.json();
    },
    onSuccess: () => { setWpDone(true); },
  });

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
                      disabled={downloadingPDF}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {downloadingPDF ? "PDF Hazırlanıyor..." : "PDF Olarak İndir"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-violet-500/30 text-violet-600 hover:bg-violet-50"
                      onClick={() => { setWpModalOpen(true); setWpDone(false); setWpForm({ title: `${result.domain} — Alan güvenlik düzeltmesi`, category: "E-posta Güvenliği", priority: result.overallScore < 40 ? "critical" : result.overallScore < 60 ? "high" : "medium", description: "", estimatedCost: "" }); }}
                    >
                      <Package className="h-3.5 w-3.5 mr-1.5" />
                      İş Paketi Oluştur
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

          {/* ── LOCKED GATE ─────────────────────────────────────────────── */}
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
                  items: ["Have I Been Pwned sızıntıları", "Kara liste kontrolü", "Shodan açık port taraması", "VirusTotal itibar", "AbuseIPDB · URLhaus · USOM · CVE"],
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
          {/* ── END LOCKED GATE ──────────────────────────────────────────── */}


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

      {/* İş Paketi Oluştur Modal */}
      <Dialog open={wpModalOpen} onOpenChange={setWpModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-600" />
              İş Paketi Oluştur
            </DialogTitle>
          </DialogHeader>
          {wpDone ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-foreground">İş paketi oluşturuldu</p>
              <p className="text-sm text-muted-foreground mt-1">Admin panelinden partnerlere atayabilirsiniz.</p>
              <Button className="mt-4 w-full" variant="outline" onClick={() => setWpModalOpen(false)}>Kapat</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Başlık *</Label>
                <input className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  value={wpForm.title} onChange={e => setWpForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Kategori</Label>
                  <Select value={wpForm.category} onValueChange={v => setWpForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{WP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Öncelik</Label>
                  <Select value={wpForm.priority} onValueChange={v => setWpForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Düşük</SelectItem>
                      <SelectItem value="medium">Orta</SelectItem>
                      <SelectItem value="high">Yüksek</SelectItem>
                      <SelectItem value="critical">Kritik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tahmini Maliyet (TL)</Label>
                <input type="number" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="Ör: 5000"
                  value={wpForm.estimatedCost} onChange={e => setWpForm(f => ({ ...f, estimatedCost: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Açıklama</Label>
                <Textarea className="resize-none text-sm" rows={2}
                  value={wpForm.description} onChange={e => setWpForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {createWpMutation.isError && (
                <p className="text-xs text-red-500">{(createWpMutation.error as Error).message}</p>
              )}
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={!wpForm.title || createWpMutation.isPending}
                onClick={() => createWpMutation.mutate()}>
                {createWpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Oluştur"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
