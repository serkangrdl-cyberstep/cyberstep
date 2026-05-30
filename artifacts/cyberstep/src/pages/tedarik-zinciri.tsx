import { useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, Plus,
  Trash2, ChevronRight, RotateCcw, Globe, Lock, Mail, Building2,
} from "lucide-react";

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

export default function TedarikZinciri() {
  usePageMeta({
    title: "Tedarik Zinciri Risk Skorkartı | CyberStep.io",
    description: "Tedarikçilerinizin siber güvenlik durumunu tarayın. AI ile birleşik risk skorkartı ve Avrupa uyumluluk notu üretin.",
    noIndex: false,
  });

  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="container mx-auto px-4 py-14 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-violet-500/40 text-violet-400 bg-violet-500/5">
            <Building2 className="h-3 w-3 mr-1" />
            Tedarik Zinciri Risk Yönetimi
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            Tedarikçileriniz Ne Kadar Güvenli?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Üretim sektöründeki tehdit aktörü faaliyetleri son yılda %71 artış gösterdi — saldırıların büyük
            bölümü tedarikçi ağı üzerinden gerçekleşiyor. Tedarikçilerinizin siber güvenlik durumunu
            tarayın, AI ile birleşik skorkart alın.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-500" />
                Şirket ve Tedarikçi Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Şirket bilgileri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Şirket Adı (opsiyonel)</Label>
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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Tedarik Zinciri Risk Skorkartı</h2>
                <p className="text-muted-foreground text-sm">
                  {companyName || sector} · {result.scanResults.length} tedarikçi
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Yeni Tarama
              </Button>
            </div>

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
                      <div className="rounded bg-background/50 px-3 py-2 mb-2">
                        <p className="text-xs text-muted-foreground mb-0.5 font-medium">Tehdit Senaryosu</p>
                        <p className="text-xs leading-relaxed">{rapor.tehditSenaryosu}</p>
                      </div>

                      {/* Öneri */}
                      <div className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-emerald-400">{rapor.onerilenAksiyon}</span>
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
                  Tedarikçilerinizi koruduğunuz kadar kendinizi de koruyun. Ücretsiz Mini Değerlendirme ile
                  şirketinizin risk puanını alın.
                </p>
                <Link href="/assessment/start">
                  <Button>
                    Ücretsiz Değerlendirme Başlat <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
