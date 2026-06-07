import { useState, useRef } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Download, RotateCcw, Lock, Mail, Monitor, Users, FileText, ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface CheckItem {
  id: string;
  label: string;
  detail: string;
  risk: "critical" | "high" | "medium";
  link?: string;
}

interface CheckCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  checks: CheckItem[];
}

const CATEGORIES: CheckCategory[] = [
  {
    id: "identity",
    title: "Kimlik ve Erişim",
    icon: <Lock className="h-4 w-4" />,
    checks: [
      { id: "mfa_all", label: "Tüm kullanıcılarda MFA etkin", detail: "Microsoft Entra ID > Users > Per-user MFA veya Conditional Access ile zorunlu kılın. Yöneticilerde öncelikli.", risk: "critical", link: "https://entra.microsoft.com" },
      { id: "mfa_admin", label: "Global Admin hesaplarda MFA zorunlu", detail: "Global Admin, Exchange Admin gibi ayrıcalıklı rollerin MFA olmadan giriş yapamaması gerekir.", risk: "critical" },
      { id: "legacy_auth", label: "Legacy authentication devre dışı", detail: "Entra ID > Security > Authentication Methods'ta Basic Auth, IMAP, POP3 gibi eski protokolleri kapatın.", risk: "critical", link: "https://entra.microsoft.com" },
      { id: "sspr", label: "Self-Service Password Reset etkin ve güvenli", detail: "SSPR birden fazla doğrulama yöntemi gerektirmeli; tek SMS doğrulaması yeterli değil.", risk: "medium" },
      { id: "privileged_id", label: "PIM (Privileged Identity Management) kullanılıyor", detail: "Ayrıcalıklı roller kalıcı değil, Just-in-Time olarak atanmalıdır. Microsoft Entra PIM gerektirir.", risk: "high" },
      { id: "guest_access", label: "Misafir erişimi kısıtlandı", detail: "Entra ID > External Identities'te misafir kullanıcı izinleri en kısıtlı seviyeye ayarlanmalı.", risk: "medium" },
    ],
  },
  {
    id: "email",
    title: "E-posta Güvenliği",
    icon: <Mail className="h-4 w-4" />,
    checks: [
      { id: "dmarc", label: "DMARC reject politikası etkin", detail: "DNS'inizde 'p=reject' içeren DMARC kaydı olmalı. 'p=none' veya 'p=quarantine' yeterli değil.", risk: "critical" },
      { id: "dkim", label: "DKIM imzalama aktif", detail: "Exchange Online'da DKIM imzalama etkinleştirilmeli. Security & Compliance Center > Email Authentication.", risk: "high" },
      { id: "spf", label: "SPF kaydı doğru yapılandırıldı", detail: "SPF kaydınız include:spf.protection.outlook.com içermeli ve -all ile bitmelidir.", risk: "high" },
      { id: "safe_links", label: "Defender for Office 365 Safe Links etkin", detail: "Tüm kullanıcılara uygulanmış Safe Links politikası olmalı. Microsoft 365 Defender > Policies & Rules.", risk: "high", link: "https://security.microsoft.com" },
      { id: "safe_attach", label: "Safe Attachments etkin", detail: "E-posta eklerini sanal ortamda tarayan Safe Attachments politikası tüm kullanıcılarda aktif olmalı.", risk: "high" },
      { id: "atp_antiphish", label: "Anti-phishing politikası yapılandırıldı", detail: "Defender Anti-Phishing'de impersonation koruması ve spoof intelligence etkin olmalı.", risk: "high" },
      { id: "auto_forward", label: "Otomatik e-posta yönlendirme engellendi", detail: "Exchange Online'da dış adreslere otomatik yönlendirme varsayılan olarak kapalı tutulmalı.", risk: "critical" },
    ],
  },
  {
    id: "device",
    title: "Cihaz ve Uç Nokta",
    icon: <Monitor className="h-4 w-4" />,
    checks: [
      { id: "intune_enrolled", label: "Cihazlar Intune ile yönetiliyor", detail: "Şirket cihazları Microsoft Intune'a kaydedilmiş ve uyumluluk politikalarına tabi olmalıdır.", risk: "high" },
      { id: "device_compliance", label: "Uyumsuz cihazların erişimi engellendi", detail: "Conditional Access politikası: uyumsuz cihazlar M365 kaynaklarına erişememeli.", risk: "high" },
      { id: "bitlocker", label: "Windows cihazlarda BitLocker şifrelemesi", detail: "Intune > Device configuration > Endpoint protection üzerinden zorunlu kılın.", risk: "medium" },
      { id: "mde", label: "Microsoft Defender for Endpoint etkin", detail: "Tüm cihazlarda EDR koruması aktif olmalı. Microsoft 365 Defender portalından kontrol edin.", risk: "high" },
    ],
  },
  {
    id: "data",
    title: "Veri Koruma",
    icon: <FileText className="h-4 w-4" />,
    checks: [
      { id: "dlp_policy", label: "DLP politikası tanımlandı", detail: "Microsoft Purview'de kişisel veri ve kredi kartı gibi hassas bilgilerin dışarıya çıkışını engelleyen DLP kuralları olmalı.", risk: "high", link: "https://compliance.microsoft.com" },
      { id: "sensitivity_labels", label: "Duyarlılık etiketleri kullanılıyor", detail: "Microsoft Purview Information Protection'da duyarlılık etiketleri tanımlanmış ve dosyalara uygulanıyor olmalı.", risk: "medium" },
      { id: "retention_policy", label: "Bekletme politikaları yapılandırıldı", detail: "E-posta ve dosyalar için yasal saklama sürelerine uygun bekletme politikaları tanımlanmalı.", risk: "medium" },
      { id: "audit_log", label: "Birleşik denetim günlüğü etkin", detail: "Microsoft 365 Defender > Audit'te denetim günlüğü etkin olmalı. Olay araştırması için kritik.", risk: "critical", link: "https://security.microsoft.com" },
    ],
  },
  {
    id: "admin",
    title: "Yönetim ve İzleme",
    icon: <Users className="h-4 w-4" />,
    checks: [
      { id: "secure_score", label: "Secure Score 60 üzerinde", detail: "Microsoft Secure Score puanınız sektör ortalamasının üzerinde olmalı. Öneriler düzenli takip edilmeli.", risk: "medium", link: "https://security.microsoft.com" },
      { id: "alert_policies", label: "Kritik uyarı politikaları aktif", detail: "Şüpheli oturum açma, toplu e-posta silme, yönetici izni değişikliği gibi kritik olaylar için uyarılar tanımlı olmalı.", risk: "high" },
      { id: "emergency_account", label: "Kırılma camı (break-glass) hesapları var", detail: "MFA gerektirmeyen, güçlü parola korumalı 2 adet acil erişim hesabı olmalı. Parola şifreli fiziksel ortamda saklanmalı.", risk: "high" },
      { id: "global_admin_count", label: "Global Admin sayısı 5'ten az", detail: "Global Admin rolü en az 2, en fazla 4-5 kişide bulunmalıdır. Fazlası ayrıcalık riskini artırır.", risk: "medium" },
      { id: "sign_in_risk", label: "Sign-in risk politikası (Identity Protection) etkin", detail: "Microsoft Entra ID Protection'da risk tabanlı Conditional Access politikaları aktif olmalı. P2 lisansı gerektirir.", risk: "high" },
    ],
  },
];

type CheckState = "yes" | "no" | "na" | null;

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Kritik", color: "text-red-500" },
  high: { label: "Yüksek", color: "text-orange-500" },
  medium: { label: "Orta", color: "text-amber-500" },
};

function RiskBadge({ risk }: { risk: CheckItem["risk"] }) {
  const { label, color } = RISK_LABELS[risk];
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}

export default function M365Denetim() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Microsoft 365 Güvenlik Denetimi | CyberStep.io",
    description: "Microsoft 365 ortamınızın güvenlik yapılandırmasını adım adım kontrol edin. Ücretsiz denetim kontrol listesi.",
    noIndex: false,
  });

  const [states, setStates] = useState<Record<string, CheckState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catExpanded, setCatExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, true]))
  );
  const allChecks = CATEGORIES.flatMap((c) => c.checks);
  const answered = allChecks.filter((ch) => states[ch.id] !== null && states[ch.id] !== undefined);
  const passed = answered.filter((ch) => states[ch.id] === "yes" || states[ch.id] === "na");
  const failed = answered.filter((ch) => states[ch.id] === "no");
  const criticalFailed = failed.filter((ch) => ch.risk === "critical");
  const progress = allChecks.length > 0 ? Math.round((answered.length / allChecks.length) * 100) : 0;
  const score = answered.length > 0 ? Math.round((passed.length / answered.length) * 100) : null;

  function setCheck(id: string, val: CheckState) {
    setStates((s) => ({ ...s, [id]: val }));
  }

  function reset() {
    setStates({});
    setExpanded({});
  }

  function getRiskColor(risk: string) {
    if (risk === "critical") return "border-l-red-500";
    if (risk === "high") return "border-l-orange-500";
    return "border-l-amber-400";
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {lang === "en" ? "M365 Security" : "M365 Güvenlik"}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{lang === "en" ? "Microsoft 365 Security Audit" : "Microsoft 365 Güvenlik Denetimi"}</h1>
        <p className="text-muted-foreground max-w-2xl">
          M365 ortamınızdaki kritik güvenlik ayarlarını kontrol edin. Her madde için durumu işaretleyin; sonuçta öncelikli aksiyonlarınızı görün.
        </p>
      </div>

      {/* Progress + Score */}
      <Card className="shadow-sm mb-8">
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-medium">Denetim İlerlemesi</p>
              <p className="text-xs text-muted-foreground">{answered.length} / {allChecks.length} madde değerlendirildi</p>
            </div>
            {score !== null && (
              <div className="text-right">
                <p className="text-2xl font-bold">{score}%</p>
                <p className="text-xs text-muted-foreground">Uyum skoru</p>
              </div>
            )}
          </div>
          <Progress value={progress} className="h-2 mb-3" />
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {passed.length} geçti
            </span>
            <span className="flex items-center gap-1.5 text-red-500">
              <XCircle className="h-4 w-4" /> {failed.length} geçmedi
            </span>
            {criticalFailed.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-600 font-medium">
                <AlertTriangle className="h-4 w-4" /> {criticalFailed.length} kritik eksik
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="space-y-4 mb-8">
        {CATEGORIES.map((cat) => {
          const catAnswered = cat.checks.filter((ch) => states[ch.id] != null);
          const catPassed = catAnswered.filter((ch) => states[ch.id] === "yes" || states[ch.id] === "na");
          const open = catExpanded[cat.id] ?? true;

          return (
            <Card key={cat.id} className="shadow-sm overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setCatExpanded((s) => ({ ...s, [cat.id]: !s[cat.id] }))}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="text-primary">{cat.icon}</span>
                      {cat.title}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {catAnswered.length}/{cat.checks.length}
                        {catAnswered.length > 0 && (
                          <> &mdash; {Math.round((catPassed.length / catAnswered.length) * 100)}%</>
                        )}
                      </span>
                      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {open && (
                <CardContent className="pt-0 space-y-2">
                  {cat.checks.map((check) => {
                    const state = states[check.id] ?? null;
                    const isExpanded = expanded[check.id] ?? false;

                    return (
                      <div
                        key={check.id}
                        className={`rounded-md border-l-4 bg-muted/30 p-3 transition-colors ${getRiskColor(check.risk)}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium leading-snug">{check.label}</span>
                              <RiskBadge risk={check.risk} />
                            </div>
                            {isExpanded && (
                              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{check.detail}</p>
                            )}
                            {isExpanded && check.link && (
                              <a
                                href={check.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                              >
                                <ExternalLink className="h-3 w-3" /> Portala Git
                              </a>
                            )}
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              onClick={() => setExpanded((e) => ({ ...e, [check.id]: !e[check.id] }))}
                            >
                              {isExpanded ? <><ChevronUp className="h-3 w-3" /> Gizle</> : <><ChevronDown className="h-3 w-3" /> Nasıl kontrol edilir?</>}
                            </button>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => setCheck(check.id, state === "yes" ? null : "yes")}
                              className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${state === "yes" ? "bg-emerald-500 text-white border-emerald-500" : "border-border hover:border-emerald-500 hover:text-emerald-600"}`}
                            >
                              Evet
                            </button>
                            <button
                              onClick={() => setCheck(check.id, state === "no" ? null : "no")}
                              className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${state === "no" ? "bg-red-500 text-white border-red-500" : "border-border hover:border-red-500 hover:text-red-600"}`}
                            >
                              Hayır
                            </button>
                            <button
                              onClick={() => setCheck(check.id, state === "na" ? null : "na")}
                              className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${state === "na" ? "bg-muted text-foreground border-border" : "border-border hover:border-muted-foreground text-muted-foreground"}`}
                            >
                              N/A
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Failed items summary */}
      {failed.length > 0 && (
        <Card className="shadow-sm border-red-500/20 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Öncelikli Aksiyonlar ({failed.length} eksik)
            </CardTitle>
            <CardDescription>Önce kritik bulguları çözün, ardından yüksek riskli maddelere geçin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {["critical", "high", "medium"].map((risk) => {
              const items = failed.filter((ch) => ch.risk === risk);
              if (items.length === 0) return null;
              return (
                <div key={risk}>
                  <p className={`text-xs font-semibold mb-1 ${RISK_LABELS[risk].color}`}>{RISK_LABELS[risk].label}</p>
                  <ul className="space-y-1">
                    {items.map((ch) => (
                      <li key={ch.id} className="text-sm flex items-start gap-2">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                        {ch.label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Score result message */}
      {score !== null && answered.length === allChecks.length && (
        <Card className={`shadow-sm mb-6 ${score >= 80 ? "border-emerald-500/30 bg-emerald-500/5" : score >= 60 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="pt-5 flex gap-3 items-start">
            {score >= 80
              ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              : score >= 60
              ? <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              : <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            }
            <div>
              <p className="font-semibold text-sm mb-1">
                {score >= 80 ? "M365 yapılandırmanız iyi durumda" : score >= 60 ? "Bazı iyileştirmeler gerekiyor" : "M365 yapılandırmanızda kritik eksikler var"}
              </p>
              <p className="text-xs text-muted-foreground">
                {score >= 80
                  ? "Mevcut yapılandırmanızı koruyun ve Secure Score önerilerini düzenli takip edin."
                  : score >= 60
                  ? "Öncelikli aksiyonlardan başlayarak yapılandırmanızı güçlendirin."
                  : "Kritik bulguları en kısa sürede çözmeniz önerilir. Profesyonel destek alabilirsiniz."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <a href="https://security.microsoft.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" /> Microsoft Defender Portalı
          </Button>
        </a>
        <a href="https://entra.microsoft.com" target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" /> Microsoft Entra
          </Button>
        </a>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" /> Sıfırla
        </Button>
      </div>

      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">M365 tek katman — tüm resmi görün.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              E-posta ve kimlik güvenliğinin ötesinde; çalışan farkındalığı, cihazlar ve veri koruma dahil 20 dakikalık kapsamlı değerlendirme yapın.
            </p>
          </div>
          <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
            Ücretsiz Değerlendirme →
          </a>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Bu denetim listesi en iyi uygulamalara dayanmaktadır. Microsoft 365 lisans planınıza göre bazı özellikler mevcut olmayabilir. Detaylı yapılandırma için Microsoft resmi dokümantasyonunu veya bir güvenlik uzmanını inceleyiniz.
      </p>
    </div>
  );
}
