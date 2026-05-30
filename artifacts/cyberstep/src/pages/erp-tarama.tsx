import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  RotateCcw, Info, Database, Lock, Users, Monitor, Cloud, ExternalLink,
} from "lucide-react";

interface RiskItem {
  id: string;
  category: string;
  label: string;
  detail: string;
  risk: "critical" | "high" | "medium";
  recommendation: string;
}

const RISK_ITEMS: RiskItem[] = [
  { id: "erp_patch", category: "Sistem Güncelliği", label: "ERP sistemi güncel sürümde", detail: "Eski ERP sürümleri bilinen güvenlik açıkları içerebilir. Satıcı tarafından yama desteği kesilmiş sürümler kritik risk oluşturur.", risk: "critical", recommendation: "ERP satıcınızla iletişime geçin. Desteklenen en son sürüme geçiş planı oluşturun." },
  { id: "erp_auth", category: "Kimlik ve Erişim", label: "ERP girişinde güçlü parola ve MFA uygulanıyor", detail: "Zayıf veya paylaşılan parolalar, ERP'ye yetkisiz erişimin en yaygın yoludur.", risk: "critical", recommendation: "ERP modülünde MFA zorunlu kılın. Paylaşılan hesapları kapatın; her kullanıcıya bireysel hesap açın." },
  { id: "erp_role", category: "Kimlik ve Erişim", label: "Rol tabanlı erişim kontrolü (RBAC) uygulanıyor", detail: "Muhasebe çalışanı üretim modülüne, IT personeli finansal verilere erişmemelidir.", risk: "high", recommendation: "ERP yetki matrisini gözden geçirin. Her rol için minimum ayrıcalık (least privilege) uygulayın." },
  { id: "erp_audit", category: "Denetim ve İzleme", label: "ERP işlem günlükleri (audit log) etkin ve inceleniyor", detail: "Yetkisiz veri değişikliği, fatura manipülasyonu veya müşteri bilgisi sızdırılmasının izlenebilmesi için audit log şarttır.", risk: "critical", recommendation: "ERP'nin yerleşik denetim modülünü etkinleştirin. Günlükleri SIEM veya harici log sistemine besleyin." },
  { id: "erp_backup", category: "Yedekleme ve Kurtarma", label: "ERP veritabanı günlük yedekleniyor ve kurtarma test ediliyor", detail: "ERP verisi (müşteri, sipariş, finans) en kritik iş verisidir. Yedek alınmadan fidye yazılımı saldırısı felaket boyutuna ulaşır.", risk: "critical", recommendation: "Otomatik günlük yedekleme kurun. 3-2-1 kuralı uygulayın. Yedekten geri yüklemeyi 6 ayda bir test edin." },
  { id: "erp_network", category: "Ağ Güvenliği", label: "ERP sunucusu ayrı ağ segmentinde izole edilmiş", detail: "ERP tüm ağa açıksa, bir iş istasyonundaki kötücül yazılım doğrudan veritabanına erişebilir.", risk: "high", recommendation: "ERP sunucusunu ayrı VLAN'a alın. Güvenlik duvarı kurallarıyla sadece yetkili IP'lere erişim izni verin." },
  { id: "erp_internet", category: "Ağ Güvenliği", label: "ERP web arayüzü internete doğrudan açık değil", detail: "İnternetten erişilebilir ERP panelleri tarama botlarının hedefi olur. VPN veya Zero Trust erişimi tercih edilmelidir.", risk: "critical", recommendation: "İnternet üzerinden ERP erişimini VPN arkasına alın. Doğrudan internet erişimini kapatın." },
  { id: "erp_thirdparty", category: "Tedarik Zinciri", label: "ERP entegrasyonları ve API'lerin güvenliği değerlendirildi", detail: "E-ticaret, muhasebe, lojistik entegrasyonları ek saldırı yüzeyi oluşturur. API anahtarları düzenli döndürülmelidir.", risk: "high", recommendation: "Tüm ERP API entegrasyonlarını listeleyin. Gereksizleri kapatın, aktif olanların API anahtarlarını döndürün." },
  { id: "erp_cloud", category: "Bulut ve SaaS", label: "Bulut ERP ise SLA ve veri yerleşimi doğrulandı", detail: "Bulut ERP kullanıyorsanız verinizin Türkiye'de mi yoksa yurt dışında mı saklandığını bilmeniz KVKK açısından kritiktir.", risk: "medium", recommendation: "ERP satıcısından veri yerleşimi belgesi isteyin. Türkiye dışında depolanıyorsa KVKK kapsamında değerlendirin." },
  { id: "erp_pentest", category: "Test ve Doğrulama", label: "ERP güvenlik denetimi veya penetrasyon testi yapıldı", detail: "Yılda bir kez yapılan ERP güvenlik denetimi, gizli açıkları ortaya çıkarır.", risk: "medium", recommendation: "ERP satıcınızdan güvenlik denetim raporu isteyin veya bağımsız penetrasyon testi yaptırın." },
  { id: "erp_training", category: "Farkındalık", label: "ERP kullanıcıları sosyal mühendislik ve dolandırıcılık konusunda eğitildi", detail: "Muhasebe ve satın alma çalışanları BEC (Business Email Compromise) saldırılarının ana hedefidir.", risk: "high", recommendation: "Yılda en az bir kez ERP kullanıcılarına sosyal mühendislik ve sahte fatura dolandırıcılığı eğitimi verin." },
];

const CATEGORIES = [...new Set(RISK_ITEMS.map((r) => r.category))];

const RISK_META: Record<string, { label: string; color: string; border: string }> = {
  critical: { label: "Kritik", color: "text-red-500", border: "border-l-red-500" },
  high: { label: "Yüksek", color: "text-orange-500", border: "border-l-orange-500" },
  medium: { label: "Orta", color: "text-amber-500", border: "border-l-amber-400" },
};

type CheckState = "yes" | "no" | "na" | null;

export default function ErpTarama() {
  usePageMeta({
    title: "ERP Güvenlik Tarama Listesi | CyberStep.io",
    description: "ERP sisteminizin (SAP, Logo, Netsis, Mikro vb.) güvenlik risklerini kontrol edin. KOBİ'ler için ücretsiz ERP denetim listesi.",
    noIndex: false,
  });

  const [states, setStates] = useState<Record<string, CheckState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catExpanded, setCatExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, true]))
  );

  const answered = RISK_ITEMS.filter((r) => states[r.id] != null);
  const passed = answered.filter((r) => states[r.id] === "yes" || states[r.id] === "na");
  const failed = answered.filter((r) => states[r.id] === "no");
  const critFailed = failed.filter((r) => r.risk === "critical");
  const progress = Math.round((answered.length / RISK_ITEMS.length) * 100);
  const score = answered.length > 0 ? Math.round((passed.length / answered.length) * 100) : null;

  function setCheck(id: string, val: CheckState) {
    setStates((s) => ({ ...s, [id]: val }));
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-6 w-6 text-primary" />
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">ERP Güvenlik</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">ERP Güvenlik Tarama Listesi</h1>
        <p className="text-muted-foreground max-w-2xl">
          SAP, Logo Tiger, Netsis, Mikro veya herhangi bir ERP sistemi kullanan KOBİ'ler için kritik güvenlik kontrol listesi.
        </p>
      </div>

      <Card className="shadow-sm mb-8">
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-medium">Tarama İlerlemesi</p>
              <p className="text-xs text-muted-foreground">{answered.length} / {RISK_ITEMS.length} madde değerlendirildi</p>
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
            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {passed.length} geçti</span>
            <span className="flex items-center gap-1.5 text-red-500"><XCircle className="h-4 w-4" /> {failed.length} geçmedi</span>
            {critFailed.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertTriangle className="h-4 w-4" /> {critFailed.length} kritik eksik</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 mb-8">
        {CATEGORIES.map((cat) => {
          const items = RISK_ITEMS.filter((r) => r.category === cat);
          const catAnswered = items.filter((r) => states[r.id] != null);
          const catPassed = catAnswered.filter((r) => states[r.id] === "yes" || states[r.id] === "na");
          const open = catExpanded[cat] ?? true;

          return (
            <Card key={cat} className="shadow-sm overflow-hidden">
              <button className="w-full text-left" onClick={() => setCatExpanded((s) => ({ ...s, [cat]: !s[cat] }))}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cat}</CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {catAnswered.length}/{items.length}{catAnswered.length > 0 && <> &mdash; {Math.round((catPassed.length / catAnswered.length) * 100)}%</>}
                      </span>
                      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
              </button>
              {open && (
                <CardContent className="pt-0 space-y-2">
                  {items.map((item) => {
                    const state = states[item.id] ?? null;
                    const isExpanded = expanded[item.id] ?? false;
                    return (
                      <div key={item.id} className={`rounded-md border-l-4 bg-muted/30 p-3 ${RISK_META[item.risk].border}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{item.label}</span>
                              <span className={`text-xs font-medium ${RISK_META[item.risk].color}`}>{RISK_META[item.risk].label}</span>
                            </div>
                            {isExpanded && (
                              <>
                                <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">{item.detail}</p>
                                <p className="text-xs text-primary font-medium mb-2">Öneri: {item.recommendation}</p>
                              </>
                            )}
                            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5" onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}>
                              {isExpanded ? <><ChevronUp className="h-3 w-3" /> Gizle</> : <><ChevronDown className="h-3 w-3" /> Detay ve Öneri</>}
                            </button>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            {(["yes", "no", "na"] as CheckState[]).map((v) => (
                              <button key={v} onClick={() => setCheck(item.id, state === v ? null : v)}
                                className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${state === v ? v === "yes" ? "bg-emerald-500 text-white border-emerald-500" : v === "no" ? "bg-red-500 text-white border-red-500" : "bg-muted text-foreground border-border" : "border-border hover:border-primary text-muted-foreground"}`}>
                                {v === "yes" ? "Evet" : v === "no" ? "Hayır" : "N/A"}
                              </button>
                            ))}
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

      {failed.length > 0 && (
        <Card className="shadow-sm border-red-500/20 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Öncelikli Aksiyonlar ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["critical", "high", "medium"].map((risk) => {
              const items = failed.filter((r) => r.risk === risk);
              if (!items.length) return null;
              return (
                <div key={risk}>
                  <p className={`text-xs font-semibold mb-1 ${RISK_META[risk].color}`}>{RISK_META[risk].label}</p>
                  <ul className="space-y-1">
                    {items.map((r) => (
                      <li key={r.id} className="text-sm flex items-start gap-2">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />{r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setStates({})}>
          <RotateCcw className="mr-2 h-4 w-4" /> Sıfırla
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Bu kontrol listesi SAP, Logo Tiger, Netsis, Mikro, Oracle EBS ve benzeri ERP sistemleri için genel güvenlik en iyi uygulamalarını kapsar. Sisteme özgü teknik detaylar için ERP satıcınızın güvenlik rehberini inceleyin.
      </p>
    </div>
  );
}
