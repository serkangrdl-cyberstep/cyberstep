import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Globe,
  Mail, Lock, Server, Loader2, ArrowRight, Info,
  DatabaseZap, ShieldAlert, ShieldCheck, Sparkles,
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
  createdAt: string;
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

export default function DomainScanPage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");

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
            <ShadowItCard services={result.shadowItServices} />
          </div>

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
