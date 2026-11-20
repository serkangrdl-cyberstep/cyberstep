import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { PLANS } from "@/pages/pricing";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, Plus,
  Trash2, ChevronRight, RotateCcw, Globe, Lock, Mail, Building2,
  Send, Copy, CheckCheck, FileText, Zap, Crown, BarChart2,
  TrendingDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

const SECTORS = [
  "Üretim / İmalat", "Perakende / E-ticaret", "Lojistik / Taşımacılık",
  "İnşaat / Gayrimenkul", "Finans / Muhasebe", "Sağlık / Klinik",
  "Hukuk / Danışmanlık", "Tekstil / Hazır Giyim", "Gıda / Restoran",
  "Turizm / Otelcilik", "Yazılım / BT Hizmetleri", "Eğitim",
  "Otomotiv / Servis", "Tarım / Hayvancılık", "Diğer",
];

const RISK_CONFIG = {
  "Yüksek": { cls: "bg-red-500/10 border-red-500/30 text-red-400",       badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  "Orta":   { cls: "bg-amber-500/10 border-amber-500/30 text-amber-400", badge: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  "Düşük":  { cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

interface ScanResult {
  domain: string; score: number; reachable: boolean;
  spf: boolean; dmarc: boolean; mx: boolean; ssl: boolean; sslDays: number | null;
}

interface TedarikciRapor {
  domain: string; riskSeviyesi: string; riskPuani: number;
  kritikBulgular: string[]; tehditSenaryosu: string; onerilenAksiyon: string;
}

interface TedResult {
  scanResults: ScanResult[];
  ai: {
    genel: { ortalamaSkor: number; riskSeviyesi: string; ozet: string };
    tedarikciRaporlari: TedarikciRapor[];
    avrupaAlicilariNotu: string;
    oncelikliAksiyonlar: string[];
  };
}

interface QuestionnaireLink {
  token: string;
  link: string;
  expiresAt: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return <span className={`font-bold text-lg ${color}`}>{score}/100</span>;
}

function Check({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {pass
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
      <span className={`text-xs ${pass ? "text-muted-foreground" : "text-red-400"}`}>{label}</span>
    </div>
  );
}

const PLAN_STYLE: Record<string, { icon: typeof Shield; color: string; iconColor: string }> = {
  ucretsiz: { icon: Shield, color: "border-violet-500/30 bg-violet-500/5", iconColor: "text-violet-400" },
  baslangic: { icon: BarChart2, color: "border-blue-500/30 bg-blue-500/5", iconColor: "text-blue-400" },
  profesyonel: { icon: BarChart2, color: "border-cyan-500/30 bg-cyan-500/5", iconColor: "text-cyan-400" },
  kurumsal: { icon: Crown, color: "border-amber-500/30 bg-amber-500/5", iconColor: "text-amber-400" },
};

function TierCards() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {PLANS.map((plan) => {
        const st = PLAN_STYLE[plan.id] ?? PLAN_STYLE.ucretsiz;
        const Icon = st.icon;
        return (
          <div key={plan.id} className={`rounded-xl border p-5 ${st.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-background/40">
                <Icon className={`h-5 w-5 ${st.iconColor}`} />
              </div>
              <div>
                <p className="font-bold text-sm">{plan.name.tr}</p>
                <p className="text-xs text-muted-foreground">{plan.suppliers.tr}</p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-3">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${st.iconColor}`} />
                  <span>{f.tr}</span>
                </li>
              ))}
            </ul>
            <Link href="/fiyatlar" className="text-xs font-medium text-primary hover:underline">Fiyatı gör →</Link>
          </div>
        );
      })}
    </div>
  );
}

// ── Tedarikçi Anket Gönderici ─────────────────────────────────────────────────

function QuestionnaireButton(_props: {
  companyName: string; companySector: string; supplier: TedarikciRapor;
  scanScore: number | undefined; scanData: ScanResult | undefined;
}) {
  // Anket bağlantıları yalnızca müşteri hesabına bağlı, tek kullanımlık olarak Tedarikçi Portföyü'nden gönderilir.
  return (
    <Link href="/hesabim/tedarikci-portfoyu">
      <Button variant="outline" size="sm" className="text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10 gap-1.5">
        <Send className="h-3.5 w-3.5" />
        Anketi Tedarikçi Portföyü'nden Gönder
      </Button>
    </Link>
  );
}

// ── TPRM Rapor Görünümü ───────────────────────────────────────────────────────

function TprmReport({ result, companyName, sector }: { result: TedResult; companyName: string; sector: string }) {
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const genelCfg = RISK_CONFIG[result.ai.genel.riskSeviyesi as keyof typeof RISK_CONFIG] ?? RISK_CONFIG["Orta"];

  return (
    <div className="space-y-5">
      {/* Report header */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">TPRM Raporu</p>
            <h2 className="text-xl font-bold">Tedarik Zinciri Risk Değerlendirmesi</h2>
            <p className="text-muted-foreground text-sm">{companyName} · {sector} · {today}</p>
          </div>
          <Badge variant="outline" className={`text-sm px-3 py-1.5 ${genelCfg.badge}`}>
            {result.ai.genel.riskSeviyesi} Risk
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed border-t pt-4">
          {result.ai.genel.ozet}
        </p>
      </div>

      {/* Risk matrix — visual supplier grid */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Tedarikçi Risk Matrisi</p>
        <div className="space-y-2">
          {result.ai.tedarikciRaporlari
            .sort((a, b) => {
              const order = { "Yüksek": 0, "Orta": 1, "Düşük": 2 };
              return (order[a.riskSeviyesi as keyof typeof order] ?? 2) - (order[b.riskSeviyesi as keyof typeof order] ?? 2);
            })
            .map((rapor, i) => {
              const scan = result.scanResults.find(s => s.domain === rapor.domain);
              const cfg = RISK_CONFIG[rapor.riskSeviyesi as keyof typeof RISK_CONFIG] ?? RISK_CONFIG["Orta"];
              const score = scan?.score ?? rapor.riskPuani;
              const barW = `${score}%`;
              const barCls = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-400" : "bg-red-500";
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <code className="text-xs font-mono truncate block">{rapor.domain}</code>
                  </div>
                  <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full ${barCls} transition-all`} style={{ width: barW }} />
                    <span className="absolute right-2 top-0 h-full flex items-center text-xs font-bold">{score}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${cfg.badge}`}>
                    {rapor.riskSeviyesi}
                  </Badge>
                </div>
              );
            })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t">
          <span>Ortalama skor: <strong>{result.ai.genel.ortalamaSkor}/100</strong></span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-400" />
            <span>{result.ai.tedarikciRaporlari.filter(r => r.riskSeviyesi === "Yüksek").length} yüksek riskli tedarikçi</span>
          </span>
        </div>
      </div>

      {/* Avrupa notu */}
      {result.ai.avrupaAlicilariNotu && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs font-semibold text-blue-400 mb-1.5">Avrupa Alıcıları — TPRM Uyum Notu</p>
          <p className="text-sm text-muted-foreground">{result.ai.avrupaAlicilariNotu}</p>
        </div>
      )}

      {/* Aksiyonlar */}
      {result.ai.oncelikliAksiyonlar.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Öncelikli Aksiyonlar</p>
          <ol className="space-y-2.5">
            {result.ai.oncelikliAksiyonlar.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="bg-violet-500/20 rounded-full h-6 w-6 flex items-center justify-center shrink-0 text-violet-400 font-bold text-xs">
                  {i + 1}
                </div>
                <p className="text-sm">{a}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function TedarikZinciri() {
  const { lang } = useLanguage();
  usePageMeta({
    title: "Tedarikçi Risk Yönetimi (TPRM): Tedarikçi Risk Skoru | CyberStep.io",
    description: "Tedarikçilerinizin dışarıdan görünen siber güvenlik duruşunu kamuya açık kaynaklardan puanlayın, anket gönderin, bulguları takip edin ve TPRM raporu alın.",
    canonicalPath: "/tedarik-zinciri",
    noIndex: false,
  });

  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"scorecard" | "report">("scorecard");

  function addSupplier() {
    if (suppliers.length < 10) setSuppliers(s => [...s, ""]);
  }

  function removeSupplier(i: number) {
    setSuppliers(s => s.filter((_, idx) => idx !== i));
  }

  function updateSupplier(i: number, val: string) {
    setSuppliers(s => s.map((v, idx) => idx === i ? val : v));
  }

  const validSuppliers = suppliers.filter(s => s.trim().length > 0);

  async function run() {
    if (!sector || validSuppliers.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tedarik-zinciri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName || undefined,
          sector,
          suppliers: validSuppliers,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Bir hata oluştu");
      }
      setResult(await res.json());
      setView("scorecard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const genelCfg = result ? (RISK_CONFIG[result.ai.genel.riskSeviyesi as keyof typeof RISK_CONFIG] ?? RISK_CONFIG["Orta"]) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-violet-950/20 to-background">
        <div className="container mx-auto px-4 py-14 max-w-5xl text-center">
          <Badge variant="outline" className="mb-4 border-violet-500/40 text-violet-400 bg-violet-500/5">
            <Building2 className="h-3 w-3 mr-1" />
            {lang === "en" ? "TPRM — Supply Chain Risk Management" : "TPRM — Tedarik Zinciri Risk Yönetimi"}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {lang === "en" ? "How Secure Are Your Suppliers?" : "Tedarikçileriniz Ne Kadar Güvenli?"}
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-3">
            Üretim, tekstil ve e-ticaret şirketleri Avrupa alıcılarından TPRM raporu isteniyor.
            CyberStep bu raporun Türkçe kaynağı olabilir.
          </p>
          <p className="text-xs text-muted-foreground">
            2024-2025 Q1: üretim sektöründe tehdit aktörü faaliyetleri <strong>%71 arttı</strong> —
            saldırıların büyük bölümü tedarikçi ağı üzerinden gerçekleşti. (BitSight)
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Tier cards — sadece form görünümünde */}
        {!result && <TierCards />}

        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-500" />
                Kademe 1 — Ücretsiz Tedarikçi Taraması
              </CardTitle>
              <CardDescription>
                Alan adlarını girin, tarayın, skorkart + anket linki alın
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Şirket bilgileri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Şirket Adınız (opsiyonel)</Label>
                  <Input
                    placeholder="Şirketinizin adı"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sektörünüz *</Label>
                  <Select value={sector} onValueChange={setSector}>
                    <SelectTrigger><SelectValue placeholder="Sektör seçin" /></SelectTrigger>
                    <SelectContent>
                      {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tedarikçi domain'leri */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Tedarikçi Alan Adları * (en fazla 10)</Label>
                  <span className="text-xs text-muted-foreground">{validSuppliers.length} tedarikçi</span>
                </div>
                <div className="space-y-2">
                  {suppliers.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={`örn: tedarikci${i + 1}.com.tr`}
                        value={s}
                        onChange={e => updateSupplier(i, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSupplier(i)}
                        disabled={suppliers.length <= 1}
                        className="shrink-0 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {suppliers.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addSupplier} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Tedarikçi Ekle
                  </Button>
                )}
              </div>

              {/* Neleri kontrol ederiz */}
              <div className="rounded-lg bg-muted/50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Globe, label: "DNS / Erişilebilirlik" },
                  { icon: Mail, label: "SPF & DMARC" },
                  { icon: Lock, label: "SSL Sertifikası" },
                  { icon: Shield, label: "Gemini AI Skorkartı" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4 text-violet-400 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                size="lg"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={!sector || validSuppliers.length === 0 || loading}
                onClick={run}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Tedarikçiler taranıyor...</>
                ) : (
                  <><Shield className="h-4 w-4 mr-2" /> Tedarik Zinciri Skorkartı Oluştur</>
                )}
              </Button>

              {loading && (
                <p className="text-xs text-muted-foreground text-center">
                  Her tedarikçi için DNS, e-posta güvenliği ve SSL kontrolleri yapılıyor. Bu 20-40 saniye sürebilir.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header + view switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold">TPRM Skorkartı</h2>
                <p className="text-muted-foreground text-sm">
                  {companyName || sector} · {result.scanResults.length} tedarikçi
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === "scorecard" ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground hover:bg-muted/50"}`}
                    onClick={() => setView("scorecard")}
                  >
                    Skorkart
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${view === "report" ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground hover:bg-muted/50"}`}
                    onClick={() => setView("report")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    TPRM Raporu
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Yeni Tarama
                </Button>
              </div>
            </div>

            {view === "report" ? (
              <TprmReport result={result} companyName={companyName || sector} sector={sector} />
            ) : (
              <>
                {/* Genel Değerlendirme */}
                {genelCfg && (
                  <Card className={`border ${genelCfg.cls}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={`${genelCfg.badge} text-xs`}>
                              {result.ai.genel.riskSeviyesi} Risk
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Ortalama Skor: <span className="font-bold">{result.ai.genel.ortalamaSkor}/100</span>
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{result.ai.genel.ozet}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs gap-1.5"
                          onClick={() => setView("report")}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          TPRM Raporunu Aç
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tedarikçi Kartları */}
                <div className="space-y-4">
                  {result.ai.tedarikciRaporlari.map((rapor, i) => {
                    const scan = result.scanResults.find(s => s.domain === rapor.domain);
                    const cfg = RISK_CONFIG[rapor.riskSeviyesi as keyof typeof RISK_CONFIG] ?? RISK_CONFIG["Orta"];
                    return (
                      <Card key={i} className={`border ${cfg.cls}`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <code className="font-mono text-sm font-semibold">{rapor.domain}</code>
                              </div>
                              <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                                {rapor.riskSeviyesi} Risk
                              </Badge>
                            </div>
                            {scan && <ScoreBadge score={scan.score} />}
                          </div>

                          {/* Teknik bulgular */}
                          {scan && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 p-3 bg-background/50 rounded-lg">
                              <Check pass={scan.spf} label="SPF" />
                              <Check pass={scan.dmarc} label="DMARC" />
                              <Check pass={scan.ssl} label={scan.sslDays ? `SSL (${scan.sslDays}g)` : "SSL"} />
                              <Check pass={scan.mx} label="Mail Sunucusu" />
                            </div>
                          )}

                          {/* AI bulgular */}
                          {rapor.kritikBulgular.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Kritik Bulgular</p>
                              <ul className="space-y-1">
                                {rapor.kritikBulgular.map((b, j) => (
                                  <li key={j} className="flex items-start gap-2 text-xs">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Tehdit senaryosu */}
                          <div className="rounded bg-background/50 px-3 py-2 mb-3">
                            <p className="text-xs text-muted-foreground mb-0.5 font-medium">Tehdit Senaryosu</p>
                            <p className="text-xs leading-relaxed">{rapor.tehditSenaryosu}</p>
                          </div>

                          {/* Öneri */}
                          <div className="flex items-start gap-2 text-xs mb-4">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-emerald-400">{rapor.onerilenAksiyon}</span>
                          </div>

                          {/* Anket Gönder */}
                          <div className="pt-3 border-t border-current/10">
                            <QuestionnaireButton
                              companyName={companyName || sector}
                              companySector={sector}
                              supplier={rapor}
                              scanScore={scan?.score}
                              scanData={scan}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Avrupa Alıcıları Notu */}
                {result.ai.avrupaAlicilariNotu && (
                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-blue-400 mb-1.5">Avrupa Alıcıları ve İhracat Notu</p>
                      <p className="text-sm text-muted-foreground">{result.ai.avrupaAlicilariNotu}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Öncelikli Aksiyonlar */}
                {result.ai.oncelikliAksiyonlar.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-sm">Öncelikli Aksiyonlar</h3>
                    <div className="space-y-2">
                      {result.ai.oncelikliAksiyonlar.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                          <div className="bg-violet-500/20 rounded-full h-6 w-6 flex items-center justify-center shrink-0 text-violet-400 font-bold text-xs">
                            {i + 1}
                          </div>
                          <p className="text-sm">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6 text-center">
                    <p className="font-semibold mb-1">Kendi siber güvenlik durumunuzu da ölçün</p>
                    <p className="text-muted-foreground text-sm mb-4">
                      Tedarikçilerinizi koruduğunuz kadar kendinizi de koruyun.
                    </p>
                    <Link href="/domain-tarama">
                      <Button>
                        Ücretsiz Alan Adı Taraması <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
